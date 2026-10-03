// Disk cleanup and graphics/driver helper.
// Cleanup only ever empties a fixed list of cache and temp folders. It never touches documents, games or saves.
const { shell } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const win = process.platform === 'win32';
const run = (f, a) => new Promise(r => execFile(f, a, { windowsHide: true, maxBuffer: 1 << 24 },
  (e, o, s) => r({ ok: !e, out: o || '', err: ((s || '') + (e ? e.message : '')).trim() })));
const ps = script => run('powershell', ['-NoProfile', '-Command', script]);

const env = process.env, WIN = env.SystemRoot || 'C:\\Windows';
const j = (base, ...p) => (base ? path.join(base, ...p) : null);

// admin: needs an elevated OpenBoost. match: only files whose name matches are removed.
const TARGETS = [
  { id: 'temp', dirs: [os.tmpdir()] },
  { id: 'wintemp', admin: true, dirs: [j(WIN, 'Temp')] },
  { id: 'thumbs', dirs: [j(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Explorer')], match: /^thumbcache_.*\.db$/i },
  { id: 'shaders', dirs: [j(env.LOCALAPPDATA, 'D3DSCache'), j(env.LOCALAPPDATA, 'NVIDIA', 'DXCache'), j(env.LOCALAPPDATA, 'NVIDIA', 'GLCache'), j(env.LOCALAPPDATA, 'AMD', 'DxCache')] },
  { id: 'wu', admin: true, dirs: [j(WIN, 'SoftwareDistribution', 'Download')] },
  { id: 'dumps', dirs: [j(env.LOCALAPPDATA, 'CrashDumps'), j(WIN, 'Minidump'), j(env.ProgramData, 'Microsoft', 'Windows', 'WER', 'ReportQueue')] },
  { id: 'recycle', recycle: true }
];

// Size of everything inside dir (symbolic links are skipped, never followed).
async function size(dir, match) {
  let total = 0, ents;
  try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    try {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (!match) total += await size(p); }
      else if (!match || match.test(e.name)) total += (await fs.promises.lstat(p)).size;
    } catch { /* locked or removed while scanning */ }
  }
  return total;
}

async function measure(t) {
  if (t.recycle) {
    const r = await ps(`$i=(New-Object -ComObject Shell.Application).NameSpace(10).Items(); $s=0; foreach($x in $i){ $s+=[int64]$x.ExtendedProperty('Size') }; $s`);
    return parseInt(r.out, 10) || 0;
  }
  let n = 0;
  for (const d of t.dirs) if (d) n += await size(d, t.match);
  return n;
}

async function empty(dir, match) {
  let ents;
  try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (match && !match.test(e.name)) continue;
    try { await fs.promises.rm(path.join(dir, e.name), { recursive: true, force: true }); } catch { /* in use: skip it */ }
  }
}

const isAdmin = async () => win && (await run('net', ['session'])).ok;

const LINKS = {
  nvidia: 'https://www.nvidia.com/en-us/drivers/',
  amd: 'https://www.amd.com/en/support/download/drivers.html',
  intel: 'https://www.intel.com/content/www/us/en/download-center/home.html',
  ddu: 'https://www.wagnardsoft.com/display-driver-uninstaller-ddu'
};

const vendorOf = n => /nvidia|geforce|quadro|rtx|gtx/i.test(n) ? 'nvidia' : /amd|radeon/i.test(n) ? 'amd' : /intel/i.test(n) ? 'intel' : null;
// Windows reports NVIDIA as 32.0.15.6094; the number printed on the download page is 560.94.
const niceVersion = (v, vendor) => {
  const p = String(v || '').split('.');
  if (vendor === 'nvidia' && p.length === 4) { const s = (p[2] + p[3]).slice(-5); return `${s.slice(0, 3)}.${s.slice(3)}`; }
  return v || '';
};

module.exports = {
  async cleanScan() {
    if (!win) return { admin: false, items: TARGETS.map(t => ({ id: t.id, admin: !!t.admin, bytes: 0 })), win };
    const admin = await isAdmin();
    const items = await Promise.all(TARGETS.map(async t => ({ id: t.id, admin: !!t.admin, bytes: await measure(t) })));
    return { admin, items, win };
  },
  async cleanRun(ids) {
    if (!win) return { freed: 0 };
    const picked = TARGETS.filter(t => Array.isArray(ids) && ids.includes(t.id));
    let before = 0, after = 0;
    for (const t of picked) before += await measure(t);
    for (const t of picked) {
      if (t.recycle) { await ps('Clear-RecycleBin -Force -ErrorAction SilentlyContinue'); continue; }
      for (const d of t.dirs) if (d && path.parse(d).root !== d && d.length > 8) await empty(d, t.match);
    }
    for (const t of picked) after += await measure(t);
    return { freed: Math.max(0, before - after) };
  },
  async gpuInfo() {
    if (!win) return { gpus: [], hags: null };
    const script = `$ErrorActionPreference='SilentlyContinue';
      $g=@(Get-CimInstance Win32_VideoController | ForEach-Object { [ordered]@{ name=$_.Name; version=$_.DriverVersion; date=$(if($_.DriverDate){$_.DriverDate.ToString('yyyy-MM-dd')}else{''}) } });
      $h=(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name HwSchMode).HwSchMode;
      [ordered]@{ gpus=$g; hags=$h } | ConvertTo-Json -Depth 4 -Compress`;
    try {
      const o = JSON.parse((await ps(script)).out);
      const gpus = [].concat(o.gpus || []).filter(g => g && g.name && !/basic (render|display)|remote|virtual|parsec/i.test(g.name)).map(g => {
        const vendor = vendorOf(g.name), at = Date.parse(g.date);
        return { name: g.name, vendor, version: niceVersion(g.version, vendor), date: g.date || '', months: at ? Math.floor((Date.now() - at) / (30.44 * 864e5)) : null };
      });
      return { gpus, hags: o.hags === 2 ? true : o.hags === 1 ? false : null };
    } catch { return { gpus: [], hags: null }; }
  },
  openLink(key) {
    if (LINKS[key]) shell.openExternal(LINKS[key]);
    else if (key === 'devmgmt' && win) execFile('mmc.exe', ['devmgmt.msc'], () => {});
  }
};
