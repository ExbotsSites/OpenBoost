// Applies and reverts tweaks defined in tweaks.json.
// Every change saves the original value first, so it can be restored exactly.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const tweaks = require('./tweaks');

const run = (f, a) => new Promise(r => execFile(f, a, { windowsHide: true, maxBuffer: 1 << 24 },
  (e, o, s) => r({ ok: !e, out: o || '', err: ((s || '') + (e ? e.message : '')).trim() })));

const stateFile = () => path.join(app.getPath('userData'), 'state.json');
const loadState = () => { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; } };
const saveState = s => fs.writeFileSync(stateFile(), JSON.stringify(s, null, 2));

const GUID = /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i;
const ULTIMATE = 'e9a42b02-d5df-448d-aa00-03f14749eb61';
const HIGH = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';

const needsAdmin = t => t.actions.some(a => a.t === 'service' || (a.t === 'reg' && a.key.startsWith('HKLM')));

async function regGet(key, name) {
  const r = await run('reg', ['query', key, '/v', name]);
  if (!r.ok) return null;
  const m = r.out.match(/^[ ]+(.+?)[ ]{4}(REG_[A-Z_]+)(?:[ ]{4}(.*))?$/m);
  if (!m) return null;
  const d = (m[3] || '').trim();
  return { type: m[2], data: m[2] === 'REG_DWORD' ? parseInt(d, 16) : d };
}

async function serviceStart(name) {
  const r = await run('sc.exe', ['qc', name]);
  const m = r.out.match(/START_TYPE\s*:\s*(\d)/);
  if (!m) return null;
  return m[1] === '4' ? 'disabled' : m[1] === '3' ? 'demand' : /DELAYED/.test(r.out) ? 'delayed-auto' : 'auto';
}

const activePlan = async () => ((await run('powercfg', ['/getactivescheme'])).out.match(GUID) || [])[0];

async function installedApps() {
  const r = await run('powershell', ['-NoProfile', '-Command', 'Get-AppxPackage | Select-Object -ExpandProperty Name']);
  return new Set(r.out.split(/\r?\n/).map(x => x.trim()));
}

async function isOn(t, state, apps, plan) {
  for (const a of t.actions) {
    if (a.t === 'reg') {
      const c = await regGet(a.key, a.name);
      if (!c || String(c.data) !== String(a.data)) return false;
    } else if (a.t === 'service') {
      const s = await serviceStart(a.name);
      if (s !== 'disabled' && !(a.optional && !s)) return false;
    } else if (a.t === 'power') {
      const b = (state[t.id] || []).find(x => x.t === 'power');
      if (!(plan === ULTIMATE || (b && plan === b.target))) return false;
    } else if (a.t === 'appx') {
      if (a.names.some(n => apps.has(n))) return false;
    }
  }
  return true;
}

async function doApply(a) {
  if (a.t === 'reg') {
    const prev = await regGet(a.key, a.name);
    const r = await run('reg', ['add', a.key, '/v', a.name, '/t', a.type, '/d', String(a.data), '/f']);
    if (!r.ok) throw new Error(r.err);
    return { t: 'reg', key: a.key, name: a.name, prev };
  }
  if (a.t === 'service') {
    const prev = await serviceStart(a.name);
    if (!prev) { if (a.optional) return { t: 'noop' }; throw new Error(`Service ${a.name} not found`); }
    const r = await run('sc.exe', ['config', a.name, 'start=', 'disabled']);
    if (!r.ok) throw new Error(r.err || r.out);
    await run('sc.exe', ['stop', a.name]);
    return { t: 'service', name: a.name, prev };
  }
  if (a.t === 'power') {
    const prev = await activePlan();
    const d = await run('powercfg', ['-duplicatescheme', ULTIMATE]);
    const created = (d.out.match(GUID) || [])[0] || null;
    const target = created || HIGH;
    const r = await run('powercfg', ['/setactive', target]);
    if (!r.ok) throw new Error(r.err || r.out);
    return { t: 'power', prev, created, target };
  }
  if (a.t === 'appx') {
    const names = a.names.map(n => `'${n}'`).join(',');
    const script = `$ErrorActionPreference='Stop'; foreach ($n in ${names}) { Get-AppxPackage -Name $n | Remove-AppxPackage }`;
    const r = await run('powershell', ['-NoProfile', '-Command', script]);
    if (!r.ok) throw new Error(r.err);
    return { t: 'appx' };
  }
  throw new Error(`Unknown action ${a.t}`);
}

async function undo(b) {
  if (b.t === 'reg') {
    const r = b.prev
      ? await run('reg', ['add', b.key, '/v', b.name, '/t', b.prev.type, '/d', String(b.prev.data), '/f'])
      : await run('reg', ['delete', b.key, '/v', b.name, '/f']);
    if (!r.ok) throw new Error(r.err);
  } else if (b.t === 'service') {
    const r = await run('sc.exe', ['config', b.name, 'start=', b.prev]);
    if (!r.ok) throw new Error(r.err || r.out);
    if (b.prev === 'auto' || b.prev === 'delayed-auto') await run('sc.exe', ['start', b.name]);
  } else if (b.t === 'power') {
    await run('powercfg', ['/setactive', b.prev]);
    if (b.created) await run('powercfg', ['-delete', b.created]);
  } else if (b.t === 'noop') {
    // nothing was changed
  } else {
    throw new Error('Cannot be undone automatically. Reinstall removed apps from the Microsoft Store.');
  }
}

async function setTweak(id, on) {
  const t = tweaks.find(x => x.id === id);
  const state = loadState();
  try {
    if (on) {
      const done = [];
      try { for (const a of t.actions) done.push(await doApply(a)); }
      catch (e) { for (const b of done.reverse()) await undo(b).catch(() => {}); throw e; }
      state[id] = state[id] || done; // keep the first backup: it holds the true originals
    } else {
      const saved = state[id];
      if (!saved) throw new Error('No saved original values, so OpenBoost cannot restore this one.');
      for (const b of [...saved].reverse()) await undo(b);
      delete state[id];
    }
    saveState(state);
    return { id, ok: true };
  } catch (e) {
    return { id, ok: false, error: e.message };
  }
}

module.exports = {
  async scan() {
    if (process.platform !== 'win32') return { hw: null };
    const ps = `$ErrorActionPreference='SilentlyContinue'; $c=Get-CimInstance Win32_Processor | Select-Object -First 1; $o=Get-CimInstance Win32_OperatingSystem;
      [ordered]@{ cpu=$c.Name.Trim(); cores=$c.NumberOfCores; threads=$c.NumberOfLogicalProcessors; os=$o.Caption; build=$o.BuildNumber;
      ram=@(Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity,Speed,ConfiguredClockSpeed,SMBIOSMemoryType);
      gpu=@(Get-CimInstance Win32_VideoController | Select-Object Name);
      disks=@(Get-PhysicalDisk | Select-Object FriendlyName,MediaType,BusType,Size);
      startup=@(Get-CimInstance Win32_StartupCommand).Count } | ConvertTo-Json -Depth 4 -Compress`;
    const [r, p] = await Promise.all([run('powershell', ['-NoProfile', '-Command', ps]), run('powercfg', ['/getactivescheme'])]);
    try { return { hw: JSON.parse(r.out), plan: (p.out.match(/\(([^)]+)\)/) || [])[1] || '' }; }
    catch { return { hw: null, error: r.err }; }
  },
  async list() {
    const win = process.platform === 'win32';
    if (!win) return { win, admin: false, tweaks: tweaks.map(t => ({ ...t, admin: false, applied: false })) };
    const state = loadState();
    const [apps, plan, adm] = await Promise.all([installedApps(), activePlan(), run('net', ['session'])]);
    const list = await Promise.all(tweaks.map(async t => ({ ...t, admin: needsAdmin(t), applied: await isOn(t, state, apps, plan) })));
    return { win, admin: adm.ok, tweaks: list };
  },
  async apply({ apply = [], revert = [], restorePoint }) {
    if (process.platform !== 'win32') return [...apply, ...revert].map(id => ({ id, ok: false, error: 'Windows only' }));
    if (restorePoint) await run('powershell', ['-NoProfile', '-Command', 'Checkpoint-Computer -Description "OpenBoost" -RestorePointType MODIFY_SETTINGS']);
    const res = [];
    for (const id of revert) res.push(await setTweak(id, false));
    for (const id of apply) res.push(await setTweak(id, true));
    return res;
  }
};
