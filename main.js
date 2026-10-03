const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const os = require('os');
const fs = require('fs');
const runBench = require('./bench');
const runSpeed = require('./speed');
const openDns = require('./dns');
const { execFile } = require('child_process');
const path = require('path');
const engine = require('./engine');

function create() {
  // Seleziona il file .ico generato in /build (o /renderer/icon.png se il file .ico non esiste)
  const buildIco = path.join(__dirname, 'build', 'icon.ico');
  const rendererPng = path.join(__dirname, 'renderer', 'icon.png');
  const iconPath = fs.existsSync(buildIco) ? buildIco : (fs.existsSync(rendererPng) ? rendererPng : undefined);

  const w = new BrowserWindow({
    width: 1060, height: 720, minWidth: 820, minHeight: 560,
    backgroundColor: '#16131d', title: 'OpenBoost',
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#16131d', symbolColor: '#cfc8dc', height: 36 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  w.removeMenu();
  w.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('list', () => engine.list());
ipcMain.handle('apply', (_, o) => engine.apply(o));
ipcMain.handle('relaunch', () => {
  const appDir = path.dirname(process.execPath);
  const arg = process.defaultApp ? ` -ArgumentList '"${app.getAppPath()}"'` : '';
  const ps = `Start-Process -FilePath '${process.execPath}'${arg} -WorkingDirectory '${appDir}' -Verb RunAs`;
  execFile('powershell', ['-NoProfile', '-Command', ps], err => { if (!err) app.quit(); });
});

let prev = os.cpus();
ipcMain.handle('live', () => {
  const now = os.cpus(); let idle = 0, tot = 0;
  now.forEach((c, i) => { for (const k in c.times) tot += c.times[k] - prev[i].times[k]; idle += c.times.idle - prev[i].times.idle; });
  prev = now;
  return { cpu: tot ? Math.round(100 * (1 - idle / tot)) : 0, used: os.totalmem() - os.freemem(), total: os.totalmem() };
});
ipcMain.handle('scan', async () => {
  const main = screen.getPrimaryDisplay().id;
  const displays = screen.getAllDisplays().map(d => ({
    w: Math.round(d.size.width * d.scaleFactor), h: Math.round(d.size.height * d.scaleFactor), hz: d.displayFrequency, primary: d.id === main }));
  return { displays, ...(await engine.scan()) };
});

const benchFile = () => path.join(app.getPath('userData'), 'bench.json');
const readBench = () => { try { return JSON.parse(fs.readFileSync(benchFile(), 'utf8')); } catch { return { before: null, after: null }; } };
ipcMain.handle('bench:get', readBench);
ipcMain.handle('bench', async (_, slot) => {
  const s = await runBench();
  s.hz = screen.getPrimaryDisplay().displayFrequency;
  const d = readBench(); d[slot] = s;
  fs.writeFileSync(benchFile(), JSON.stringify(d));
  return s;
});
ipcMain.handle('bench:reset', () => { fs.writeFileSync(benchFile(), JSON.stringify({ before: null, after: null })); return 1; });
ipcMain.handle('open', (_, u) => { if (['ms-settings:display', 'ms-settings:startupapps'].includes(u)) shell.openExternal(u); });
ipcMain.handle('bios', () => execFile('shutdown', ['/r', '/fw', '/t', '5'], () => {}));

ipcMain.handle('speed', async (e, id) => {
  const emit = (k, v) => e.sender.send('speed', { k, v });
  try { return await runSpeed.test(emit, id); } catch { return { error: 'Could not reach the speed test server. Check your connection and try again.' }; }
});
ipcMain.handle('speed:servers', (_, force, ookla) => runSpeed.servers(force, ookla).catch(() => []));
ipcMain.handle('speed:search', (_, q) => runSpeed.search(String(q || '').slice(0, 60)).catch(() => []));
ipcMain.handle('speed:who', () => runSpeed.who());
ipcMain.handle('procs', () => new Promise(r => execFile('tasklist', ['/fo', 'csv', '/nh'], { maxBuffer: 1 << 24 }, (e, o) => {
  const g = {}; let n = 0;
  (o || '').split(/\r?\n/).forEach(l => {
    const c = l.match(/"([^"]*)"/g); if (!c || c.length < 5) return;
    n++; const k = c[0].slice(1, -1); g[k] = g[k] || { name: k, count: 0, mb: 0 };
    g[k].count++; g[k].mb += parseInt(c[4].replace(/\D/g, ''), 10) / 1024 || 0;
  });
  r({ total: n, top: Object.values(g).sort((a, b) => b.mb - a.mb).slice(0, 8) });
})));
ipcMain.handle('dns:open', async () => {
  try { return { ok: true, ...(await openDns()) }; } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('dns:flush', () => new Promise(r => execFile('ipconfig', ['/flushdns'], (e, o, s) =>
  r((o || s || (e && e.message) || '').trim().split(/\r?\n/).filter(Boolean).pop() || 'Done'))));

app.setAppUserModelId('org.openboost.app');
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
