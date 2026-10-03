// Short benchmark: CPU, memory copy speed, timer precision, plus a snapshot of RAM, startup apps and processes.
const os = require('os');
const { execFile } = require('child_process');
const run = (f, a) => new Promise(r => execFile(f, a, { windowsHide: true, maxBuffer: 1 << 24 }, (e, o) => r(e ? '' : o)));
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async function () {
  let n = 0, x = 0;
  const end = performance.now() + 1000;
  while (performance.now() < end) { for (let i = 0; i < 1e5; i++) x = (x * 1.0000001 + i) % 7919; n++; }
  if (x === -1) n = 0;

  const a = Buffer.alloc(256 << 20, 1), b = Buffer.allocUnsafe(256 << 20);
  a.copy(b);
  const t = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) a.copy(b);
  const mem = (10 * 0.25) / (Number(process.hrtime.bigint() - t) / 1e9);

  const d = [], stop = Date.now() + 2500;
  while (d.length < 300 && Date.now() < stop) {
    const t0 = process.hrtime.bigint(); await sleep(1); d.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  d.sort((p, q) => p - q);
  const timer = d.reduce((s, v) => s + v, 0) / d.length, p99 = d[Math.min(d.length - 1, Math.floor(d.length * 0.99))];

  const procs = (await run('tasklist', ['/fo', 'csv', '/nh'])).trim().split(/\r?\n/).filter(Boolean).length;
  const w = (await run('powershell', ['-NoProfile', '-Command',
    '$s=@(Get-CimInstance Win32_StartupCommand).Count;$m=Get-CimInstance Win32_PhysicalMemory;"$s,$(($m|Measure-Object ConfiguredClockSpeed -Maximum).Maximum),$(($m|Measure-Object Speed -Maximum).Maximum)"']))
    .trim().split(',').map(Number);
  const total = os.totalmem();
  return { at: Date.now(), cpu: n, mem, timer, p99, used: (total - os.freemem()) / 2 ** 30, total: total / 2 ** 30,
    procs, startup: w[0] || 0, ramspeed: w[1] || 0, ramrated: w[2] || 0 };
};
