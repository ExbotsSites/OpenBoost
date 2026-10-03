// Downloads DNS Jumper (free tool by Sordum), extracts it to a temp folder and opens it.
const { shell } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { execFile } = require('child_process');

// Official download. If it ever stops working, check https://www.sordum.org/7952/dns-jumper-v2-2/
const URL_ZIP = 'https://www.sordum.org/files/downloads.php?dns-jumper';

const sh = (f, a, o) => new Promise(r => execFile(f, a, { windowsHide: true, ...o }, (e, out) => r({ e, out: (out || '').trim() })));
const find = dir => {
  let hit = null;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) hit = hit || find(p);
    else if (/dns.?jumper.*\.exe$/i.test(f.name)) hit = hit || p;
  }
  return hit;
};

module.exports = async function () {
  const dir = path.join(os.tmpdir(), 'openboost-dnsjumper'), out = path.join(dir, 'app');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const res = await fetch(URL_ZIP, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const host = new URL(res.url).hostname;
  if (!/(^|\.)sordum\.org$/.test(host)) throw new Error(`The download came from ${host}, not sordum.org, so it was blocked`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1e5 || buf.length > 60e6 || buf.subarray(0, 2).toString() !== 'PK') throw new Error('The download was not a zip file');

  const zip = path.join(dir, 'dnsjumper.zip');
  fs.writeFileSync(zip, buf);
  let x = await sh('tar', ['-xf', zip, '-C', out]);
  if (x.e) x = await sh('powershell', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath $env:OB_ZIP -DestinationPath $env:OB_OUT -Force'],
    { env: { ...process.env, OB_ZIP: zip, OB_OUT: out } });
  if (x.e) throw new Error('Could not extract the zip');

  const exe = find(out);
  if (!exe) throw new Error('DnsJumper.exe was not found in the zip');
  const sig = await sh('powershell', ['-NoProfile', '-Command', '(Get-AuthenticodeSignature -LiteralPath $env:OB_EXE).Status'],
    { env: { ...process.env, OB_EXE: exe } });
  const err = await shell.openPath(exe); // ShellExecute, so Windows can ask for admin if the tool needs it
  if (err) throw new Error(err);
  return { dir: out, sha256: crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex'), signature: sig.out || 'Unknown' };
};
