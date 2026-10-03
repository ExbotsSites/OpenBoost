// Live overlay: a small click-through window kept on top of games that run windowed or borderless.
const { BrowserWindow, screen } = require('electron');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const W = 188, ROW = 24, PAD = 14, MARGIN = 12;
let win = null, timer = null, gpuProc = null, gpu = null, prev = os.cpus(), cfg = null, accent = '#a53FFA';

function cpuLoad() {
  const now = os.cpus(); let idle = 0, tot = 0;
  now.forEach((c, i) => { for (const k in c.times) tot += c.times[k] - prev[i].times[k]; idle += c.times.idle - prev[i].times.idle; });
  prev = now;
  return tot ? Math.round(100 * (1 - idle / tot)) : 0;
}

// GPU load comes from the WMI performance class, whose name is the same in every Windows language.
function startGpu() {
  if (gpuProc || process.platform !== 'win32') return;
  const script = `while($true){ try { $s=(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop | Where-Object { $_.Name -like '*engtype_3D' } | Measure-Object UtilizationPercentage -Sum).Sum; if($null -eq $s){$s=0}; [Console]::WriteLine([int][math]::Min(100,[math]::Round($s))) } catch { [Console]::WriteLine(-1) }; Start-Sleep -Seconds 2 }`;
  const p = gpuProc = spawn('powershell', ['-NoProfile', '-Command', script], { windowsHide: true });
  let buf = '';
  p.stdout.on('data', d => {
    buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop();
    const last = lines.filter(Boolean).pop();
    if (last != null) { const n = Number(last); gpu = n >= 0 ? n : null; }
  });
  p.on('exit', () => { if (gpuProc === p) gpuProc = null; });
}
function stopGpu() { if (gpuProc) { try { gpuProc.kill(); } catch { /* already gone */ } gpuProc = null; } gpu = null; }

function rows() {
  const r = [];
  if (cfg.cpu) { const c = cpuLoad(); r.push({ k: 'CPU', v: `${c}%`, p: c }); }
  if (cfg.ram) { const used = os.totalmem() - os.freemem(); r.push({ k: 'RAM', v: `${(used / 2 ** 30).toFixed(1)} GB`, p: Math.round(100 * used / os.totalmem()) }); }
  if (cfg.gpu) r.push({ k: 'GPU', v: gpu == null ? '—' : `${gpu}%`, p: gpu || 0 });
  if (cfg.clock) r.push({ k: '', v: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), p: null });
  return r;
}

function place(n) {
  const wa = screen.getPrimaryDisplay().workArea, h = PAD * 2 + n * ROW;
  const x = cfg.corner.endsWith('l') ? wa.x + MARGIN : wa.x + wa.width - W - MARGIN;
  const y = cfg.corner.startsWith('t') ? wa.y + MARGIN : wa.y + wa.height - h - MARGIN;
  win.setBounds({ x, y, width: W, height: h });
}

function tick() {
  if (!win || win.isDestroyed()) return;
  const r = rows();
  if (!r.length) return win.hide();
  place(r.length);
  if (!win.isVisible()) win.showInactive();
  win.webContents.send('ov', { rows: r, accent, opacity: cfg.opacity });
}

function create() {
  win = new BrowserWindow({
    width: W, height: 100, frame: false, transparent: true, resizable: false, focusable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true);
  win.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  win.webContents.once('did-finish-load', tick);
  win.on('closed', () => { win = null; });
}

function stop() {
  clearInterval(timer); timer = null; stopGpu();
  if (win && !win.isDestroyed()) win.destroy();
  win = null;
}

function apply(s) {
  cfg = s.overlay; accent = s.accent;
  if (!cfg.on) return stop();
  if (!win) create();
  cfg.gpu ? startGpu() : stopGpu();
  if (!timer) timer = setInterval(tick, 1000);
  tick();
}

module.exports = { apply, stop };
