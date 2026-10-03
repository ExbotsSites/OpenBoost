const $ = s => document.querySelector(s), api = window.openboost;
const CATS = [
  { id: 'home', name: 'Home', note: 'Your system at a glance.', ico: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>' },
  { id: 'bench', name: 'Benchmark', note: 'Measure before and after you apply tweaks.', ico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  { id: 'speed', name: 'Speed test', note: 'Download, upload, ping and jitter.', ico: '<path d="M12 14l4-4M4 18a9 9 0 1 1 16 0"/>' },
  { id: 'performance', name: 'Performance', note: 'Frame rate and frame pacing.', ico: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>' },
  { id: 'input', name: 'Input', note: 'Mouse and keyboard response.', ico: '<path d="M5 3l14 7-6 2-2 6z"/>' },
  { id: 'network', name: 'Network', note: 'Background traffic and throttling.', ico: '<path d="M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M12 19h.01"/>' },
  { id: 'tools', name: 'Tools', note: 'Overlay, disk cleanup, graphics and drivers.', ico: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.2-.5-.5-2.2z"/>' },
  { id: 'debloat', name: 'Debloat and privacy', note: 'Less running in the background, fewer promotions.', ico: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>' },
  { id: 'bios', name: 'BIOS guide', note: 'Firmware settings worth changing, safest first.', ico: '<path d="M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>' },
  { id: 'settings', name: 'Settings', note: 'Theme, accent color and language.', ico: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>' }
];
const RISK = new Proxy([], { get: (_, i) => (i === '0' ? '' : t('risk.' + i)) });
let T = [], want = {}, cat = 'home', admin = false, win = true, busy = false, rp = true, note = '';
const open = new Set();
const pend = () => T.filter(t => want[t.id] !== t.applied);

const line = a => a.t === 'reg' ? `${a.key}\\${a.name} = ${a.data}`
  : a.t === 'service' ? `Service ${a.name}: startup disabled, then stopped`
  : a.t === 'power' ? 'Active power plan: Ultimate Performance (High performance if unavailable)'
  : `Remove for this account: ${a.names.join(', ')}`;

function row(t) {
  const on = want[t.id], locked = t.reversible === false && t.applied, changed = on !== t.applied;
  const off = !win || (t.admin && !admin) || locked || busy;
  const why = !win ? '' : locked ? 'Applied. Reinstall from the Microsoft Store to undo.' : t.admin && !admin ? 'Needs administrator' : '';
  return `<li class="row"><div>
    <div class="top"><h2>${t.name}</h2>${changed ? `<em>${on ? 'Will apply' : 'Will undo'}</em>` : ''}</div>
    <p>${t.desc}</p>
    <div class="meta"><span class="risk r${t.risk}"><b><i></i><i></i><i></i></b>${RISK[t.risk]}</span>
      ${t.after ? `<span>${t.after}</span>` : ''}${why ? `<span>${why}</span>` : ''}
      <button class="link" data-more="${t.id}" aria-expanded="${open.has(t.id)}">What it changes</button></div>
    <pre ${open.has(t.id) ? '' : 'hidden'}>${t.actions.map(line).join('\n')}</pre>
  </div><button class="sw" role="switch" aria-checked="${!!on}" aria-label="${t.name}" data-id="${t.id}" ${off ? 'disabled' : ''}></button></li>`;
}

function bar() {
  const p = pend(), b = $('#bar');
  b.hidden = !p.length && !note;
  b.innerHTML = `<div class="msg"><strong>${p.length ? t('ui.pending', { n: p.length }) : ''}</strong><span id="note"></span></div>
    ${admin && p.length ? `<label><input type="checkbox" id="rp" ${rp ? 'checked' : ''}> ${t('ui.restore')}</label>` : ''}
    ${p.length ? `<button id="undo" class="ghost">${t('ui.discard')}</button><button id="go" class="primary" ${busy ? 'disabled' : ''}>${busy ? t('ui.applying') : t('ui.apply')}</button>` : ''}`;
  $('#note').textContent = note;
}

function render() {
  $('#nav').innerHTML = CATS.map(c => {
    const n = c.id === 'bios' ? BIOS.length : T.filter(t => t.cat === c.id && t.applied).length;
    return `<button class="nav" data-cat="${c.id}" ${c.id === cat ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${c.ico}</svg>${t('nav.' + c.id)}${n ? `<span>${n}</span>` : ''}</button>`;
  }).join('');
  const c = CATS.find(x => x.id === cat);
  $('#h').textContent = t('nav.' + c.id); $('#hp').textContent = t('note.' + c.id);
  $('#warn').innerHTML = (win ? '' : '<p class="warn">OpenBoost only changes Windows settings. You can browse the tweaks here, but nothing will apply.</p>') + (cat === 'network' ? dnsPanel() : '');
  if ($('#dnsmsg')) $('#dnsmsg').textContent = dnsMsg;
  const isPage = cat in PAGES;
  $('#list').hidden = $('#warn').hidden = isPage; $('#home').hidden = !isPage;
  $('#list').innerHTML = isPage ? '' : T.filter(t => t.cat === cat).sort((a, b) => a.risk - b.risk).map(row).join('');
  if (isPage) PAGES[cat](); else $('#act').innerHTML = presets();
  $('#who').innerHTML = !win ? '' : admin ? `<span>${t('ui.adminOn')}</span>`
    : `<span>${t('ui.adminOff')}</span><button id="adm" class="link">${t('ui.adminGo')}</button>`;
  bar();
}

async function refresh() {
  const s = await api.list();
  T = s.tweaks; admin = s.admin; win = s.win;
  want = Object.fromEntries(T.map(t => [t.id, t.applied]));
  render();
}

async function go() {
  const p = pend();
  const risky = p.filter(t => want[t.id] && t.risk === 4);
  if (risky.length && !confirm(`Extreme tweaks selected:\n\n${risky.map(t => t.name).join('\n')}\n\nThese can lower security or break apps. Apply anyway?`)) return;
  busy = true; render();
  const res = await api.apply({
    apply: p.filter(t => want[t.id]).map(t => t.id),
    revert: p.filter(t => !want[t.id]).map(t => t.id),
    restorePoint: admin && rp
  });
  const bad = res.filter(r => !r.ok), good = res.length - bad.length;
  const after = [...new Set(p.filter(t => t.after && res.some(r => r.id === t.id && r.ok)).map(t => t.after))];
  note = [good ? `${good} done.` : '', ...bad.map(r => `${T.find(t => t.id === r.id).name}: ${r.error}`), after.length ? `${after.join(', ')}.` : ''].filter(Boolean).join(' ');
  busy = false; await refresh();
}

document.addEventListener('click', e => {
  const el = e.target.closest('button'); if (!el) return;
  if (el.dataset.cat) { cat = el.dataset.cat; render(); }
  else if (el.dataset.more) { const id = el.dataset.more; open.has(id) ? open.delete(id) : open.add(id); render(); }
  else if (el.classList.contains('sw') && el.dataset.id) { want[el.dataset.id] = !want[el.dataset.id]; note = ''; render(); }
  else if (el.id === 'go') go();
  else if (el.id === 'undo') { want = Object.fromEntries(T.map(t => [t.id, t.applied])); note = ''; render(); }
  else if (el.id === 'adm') api.relaunch();
  else if (el.id === 'scan') scan();
  else if (el.dataset.p !== undefined) preset(+el.dataset.p);
  else if (el.dataset.open) api.open(el.dataset.open);
  else if (el.id === 'bench') runBench();
  else if (el.id === 'breset') api.benchReset().then(() => { bench = { before: null, after: null }; render(); });
  else if (el.id === 'bios-go' && confirm('Restart into the BIOS in 5 seconds? Save your work first.')) api.bios();
  else if (el.dataset.prof !== undefined) { prof = +el.dataset.prof; render(); }
  else if (el.id === 'dns' && confirm('OpenBoost will download DNS Jumper, a free third-party tool, from sordum.org, extract it to a temp folder and open it. Continue?')) openDnsTool();
  else if (el.id === 'flush') api.flush().then(r => { dnsMsg = r; render(); });
  else if (el.id === 'spd') runSpeed();
  else if (el.dataset.stab) { srv.tab = el.dataset.stab; syncTabs(); drawServers(); }
  else if (el.dataset.sid !== undefined) { srv.sel = el.dataset.sid; drawServers(); }
  else if (el.id === 'sfind') { loadServers(true); srv.whoDone = false; loadWho(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'rp') rp = e.target.checked;
  if (e.target.id === 'ookla') { srv.ookla = e.target.checked; try { localStorage.setItem('ookla', srv.ookla ? '1' : '0'); } catch { /* storage unavailable */ } loadServers(true); }
});

// ---- Home: live stats + system scan
const MEM = { 20: 'DDR', 21: 'DDR2', 24: 'DDR3', 26: 'DDR4', 34: 'DDR5' };
const arr = x => [].concat(x || []);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gb = b => Math.round(b / 2 ** 30);
let hw = null, disp = [], plan = '', scanning = false, live = { cpu: 0, used: 0, total: 0 };

function specs() {
  const ram = arr(hw.ram), total = ram.reduce((s, m) => s + m.Capacity, 0);
  const speed = Math.max(0, ...ram.map(m => m.ConfiguredClockSpeed || m.Speed || 0));
  return [
    ['Processor', `${hw.cpu} (${hw.cores} cores, ${hw.threads} threads)`],
    ['Graphics', arr(hw.gpu).map(g => g.Name).join(', ')],
    ['Memory', `${gb(total)} GB ${MEM[ram[0] && ram[0].SMBIOSMemoryType] || 'RAM'}${speed ? ` at ${speed} MT/s` : ''}, ${ram.length} ${ram.length === 1 ? 'stick' : 'sticks'}`],
    ['Display', disp.map(d => `${d.w}×${d.h} at ${d.hz} Hz`).join(', ')],
    ['Storage', arr(hw.disks).map(d => `${d.FriendlyName} (${d.MediaType === 'Unspecified' ? d.BusType : d.MediaType}, ${gb(d.Size)} GB)`).join(', ')],
    ['Windows', `${hw.os} (build ${hw.build})`],
    ['Power plan', plan], ['Startup apps', hw.startup]
  ];
}

function findings() {
  const f = [], ram = arr(hw.ram);
  const cfg = Math.max(0, ...ram.map(m => m.ConfiguredClockSpeed || 0)), rated = Math.max(0, ...ram.map(m => m.Speed || 0));
  if (cfg && rated && cfg < rated) f.push({ t: `Memory runs at ${cfg} MT/s but is rated for ${rated}. Turn on XMP or EXPO in your BIOS to get the full speed.` });
  const d = disp.find(x => x.primary) || disp[0];
  if (d && d.hz && d.hz <= 60) f.push({ t: `Your main display is running at ${d.hz} Hz. If the monitor supports more, raise it in Windows display settings.` });
  if (plan && !/high|ultimate/i.test(plan)) f.push({ t: `Power plan is ${plan}. A performance plan stops the CPU from down-clocking mid-game.`, go: 'performance', b: 'Open Performance' });
  if (arr(hw.disks).some(x => x.MediaType === 'HDD')) f.push({ t: 'A hard drive is installed. Keep Windows and your games on an SSD for faster loading.' });
  if (hw.startup > 15) f.push({ t: `${hw.startup} apps start with Windows. Disable the ones you don't need in Task Manager.` });
  const todo = T.filter(t => !t.applied && t.risk === 1).length;
  if (todo) f.push({ t: `${todo} safe tweaks aren't applied yet.`, go: 'performance', b: 'Review tweaks' });
  return f;
}

function home() {
  $('#act').innerHTML = win ? `<button id="scan" class="primary" ${scanning ? 'disabled' : ''}>${scanning ? t('home.scanning') : hw ? t('home.again') : t('home.scan')}</button>` : '';
  const meters = `<div class="meters">
    <div class="meter"><div><span>CPU load</span><b id="mc">0%</b></div><i><u id="bc"></u></i></div>
    <div class="meter"><div><span>Memory in use</span><b id="mm">0 GB</b></div><i><u id="bm"></u></i></div></div><div class="sect" id="procs"></div>`;
  if (!hw) {
    $('#home').innerHTML = meters + `<p class="sect empty">${scanning ? 'Scanning your hardware…' : win ? 'Scan your system to see your RAM speed, refresh rate and what could run faster.' : 'System scan needs Windows.'}</p>`;
    return paint();
  }
  const f = findings();
  $('#home').innerHTML = meters +
    `<div class="sect"><h3>Findings</h3><div class="group">${f.length
      ? f.map(x => `<div class="find"><p>${esc(x.t)}</p>${x.go ? `<button class="ghost" data-cat="${x.go}">${x.b}</button>` : ''}</div>`).join('')
      : '<div class="find"><p>Nothing stands out. Your setup looks well tuned.</p></div>'}</div></div>
    <div class="sect"><h3>Your system</h3><div class="group">${specs().map(([k, v]) => `<div class="spec"><span>${k}</span><span>${esc(v)}</span></div>`).join('')}</div></div>`;
  paint();
}

function paint() {
  if (!$('#mc')) return;
  drawProcs();
  const pct = live.total ? Math.round(100 * live.used / live.total) : 0;
  $('#mc').textContent = `${live.cpu}%`; $('#bc').style.width = `${live.cpu}%`;
  $('#mm').textContent = `${(live.used / 2 ** 30).toFixed(1)} of ${gb(live.total)} GB`; $('#bm').style.width = `${pct}%`;
}

async function tick() {
  live = await api.live(); paint();
  if (cat === 'home' && tickN++ % 5 === 0) { procs = await api.procs(); drawProcs(); }
}
async function scan() {
  scanning = true; render();
  const s = await api.scan();
  hw = s.hw; disp = s.displays || []; plan = s.plan || '';
  scanning = false; render();
}

// ---- Presets
const riskEl = r => `<span class="risk r${r}"><b><i></i><i></i><i></i></b>${RISK[r]}</span>`;
const presets = () => `<div class="seg"><span>${t('ui.upTo')}</span>${[1, 2, 3, 4].map(n => `<button data-p="${n}">${RISK[n]}</button>`).join('')}<button data-p="0">${t('ui.none')}</button></div>`;
function preset(n) {
  T.filter(t => t.cat === cat).forEach(t => {
    if (!win || (t.admin && !admin) || (t.reversible === false && t.applied)) return;
    want[t.id] = n ? (t.risk <= n ? true : t.applied) : t.applied;
  });
  note = ''; render();
}

// ---- Benchmark
const METRICS = [['cpu', 'CPU score', '', 1, 0], ['mem', 'Memory copy speed', 'GB/s', 1, 1], ['timer', 'Timer delay (1 ms sleep)', 'ms', 0, 2],
  ['p99', 'Timer delay, worst 1%', 'ms', 0, 2], ['ramspeed', 'RAM speed', 'MT/s', 1, 0], ['hz', 'Refresh rate', 'Hz', 1, 0],
  ['used', 'Memory in use', 'GB', 0, 1], ['procs', 'Running processes', '', 0, 0], ['startup', 'Startup apps', '', 0, 0]];
let bench = { before: null, after: null }, benching = false;
const fmt = (v, d, u) => v == null ? '—' : `${Number(v).toFixed(d)}${u ? ' ' + u : ''}`;

function checks(s) {
  const c = (n, bad, badT, goodT, x) => ({ n, bad, t: bad ? badT : goodT, ...x });
  return [
    c('RAM speed', s.ramspeed && s.ramrated && s.ramspeed < s.ramrated, `${s.ramspeed} MT/s, rated for ${s.ramrated}. Turn on XMP or EXPO.`, s.ramspeed ? `${s.ramspeed} MT/s` : 'Not detected', { go: 'bios', b: 'BIOS guide' }),
    c('Refresh rate', s.hz && s.hz <= 60, `${s.hz} Hz. If your monitor supports more, raise it.`, `${s.hz} Hz`, { open: 'ms-settings:display', b: 'Display settings' }),
    c('Startup apps', s.startup > 10, `${s.startup} apps launch with Windows. Turn off the ones you don't need.`, `${s.startup} apps`, { open: 'ms-settings:startupapps', b: 'Startup apps' }),
    c('Memory in use', s.used / s.total > 0.75, `${Math.round(100 * s.used / s.total)}% in use while idle. Close apps or add RAM.`, `${Math.round(100 * s.used / s.total)}% in use`),
    c('Background processes', s.procs > 180, `${s.procs} processes running. Debloat can trim this.`, `${s.procs} processes`, { go: 'debloat', b: 'Debloat' })
  ];
}

function benchPage() {
  const { before, after } = bench, cur = after || before;
  $('#act').innerHTML = `<button id="bench" class="primary" ${benching ? 'disabled' : ''}>${benching ? t('bench.busy') : before ? t('bench.after') : t('bench.before')}</button>${before ? `<button id="breset" class="ghost">${t('bench.reset')}</button>` : ''}`;
  if (!cur) { $('#home').innerHTML = `<p class="sect empty">${benching ? 'Measuring. This takes about 6 seconds.' : 'Run a benchmark before you apply tweaks, then run it again afterwards to see what changed.'}</p>`; return; }
  const rows = METRICS.map(([k, l, u, hi, d]) => {
    const a = before && before[k], b = after && after[k]; let c = '<span class="flat">—</span>';
    if (a && b != null) { const p = (b - a) / a * 100, better = hi ? p > 0 : p < 0; c = Math.abs(p) < 1 ? '<span class="flat">No change</span>' : `<span class="${better ? 'good' : 'worse'}">${p > 0 ? '+' : ''}${p.toFixed(1)}%</span>`; }
    return `<div class="brow"><span>${l}</span><span>${fmt(a, d, u)}</span><span>${fmt(b, d, u)}</span>${c}</div>`;
  }).join('');
  $('#home').innerHTML = `<div class="sect"><h3>Checkup</h3><div class="group">${checks(cur).map(x => `<div class="vrow"><span>${x.n}</span><span class="pill ${x.bad ? 'bad' : 'ok'}">${x.bad ? 'Change now' : 'Good'}</span><span>${esc(x.t)}</span>${x.bad && x.b ? `<button class="ghost" ${x.go ? `data-cat="${x.go}"` : `data-open="${x.open}"`}>${x.b}</button>` : '<span></span>'}</div>`).join('')}</div></div>
    <div class="sect"><h3>Before and after</h3><div class="group"><div class="brow h"><span>Metric</span><span>Before</span><span>After</span><span>Change</span></div>${rows}</div>
    <p class="hint">Close other apps first. CPU and memory scores vary a few percent between runs, so ignore changes under 3%.</p></div>`;
}

async function runBench() {
  benching = true; render();
  const slot = bench.before ? 'after' : 'before';
  bench[slot] = await api.bench(slot);
  benching = false; render();
}

// ---- BIOS guide
const BIOS = [
  ['Know how to get in and get out', `Settings > System > Recovery > Advanced startup > Restart now > Troubleshoot > UEFI Firmware Settings, or tap Del or F2 at boot. If a change stops the PC booting, clear CMOS (board button or jumper, or pull the coin battery for a minute) to restore defaults.`, 1],
  ['Check your BIOS mode first', `Press Win+R, run msinfo32 and read BIOS Mode. It should say UEFI. Several settings below depend on it.`, 1],
  ['Keep Secure Boot and TPM on', `Windows 11 and anti-cheat systems such as Vanguard expect them. Turning them off gains no FPS.`, 1],
  ['Turn on XMP, EXPO or DOCP', `Memory ships running at a safe default speed. The profile unlocks the speed printed on the sticks and is usually the biggest free gain, especially on AMD Ryzen. With two sticks, use the slots your manual recommends, normally 2 and 4.`, 2],
  ['Turn on Above 4G Decoding and Resizable BAR', `Lets the CPU use all of the GPU's memory at once instead of in small windows. Gains range from nothing to about 10% depending on the game. Needs UEFI mode and a recent GPU driver.`, 2],
  ['Set fan curves', `Aim for a CPU under 85°C and a GPU under 83°C in games. Thermal throttling costs more FPS than most tweaks gain.`, 2],
  ['Leave PCIe on Auto', `Make sure the graphics card sits in the top x16 slot. Forcing a lower generation only costs performance.`, 2],
  ['Turn off the integrated GPU (only with a dedicated GPU)', `Frees a little memory and stops Windows picking the wrong adapter. Keep it on if you want a fallback display.`, 2],
  ['Turn off CSM (UEFI only)', `Required for Resizable BAR on many boards. If Windows is installed in legacy or MBR mode the PC will not boot after this, so check BIOS Mode first.`, 3],
  ['Keep CPU boost on and review power limits', `Leave Intel Turbo Boost or AMD Precision Boost enabled. Raising PL1 and PL2 (Intel) or enabling PBO (AMD) gives more sustained clocks, but needs a good cooler and solid VRM cooling.`, 3],
  ['Turn off virtualization if you never use it', `Skip this if you run virtual machines, WSL or Android emulators. The gain is small.`, 3],
  ['Update the BIOS only for a reason', `Worth it for CPU support, memory stability or a security fix. Never cut power during the flash.`, 3],
  ['Manual memory timings or overclocking', `Tuned timings, voltages and multipliers can add real FPS, but pushed too far they corrupt data and shorten component life. Stress test with OCCT or TestMem5 before trusting it.`, 4],
  ['Undervolt or disable deep C-states', `Disabling deep C-states trims wake-up latency at the cost of power and heat. Undervolting needs a stress test at every step. Both are for experienced tuners.`, 4]
];

const TIER = [0, 0, 0, 0, 1, 1, 1, 2, 1, 2, 2, 1, 3, 3]; // profile that first includes each setting above
const PROFILES = [['Essentials', 'Free wins and the checks to make first.'], ['Balanced', 'Adds the low-risk performance settings.'],
  ['Competitive', 'Adds power and thermal tuning for sustained clocks.'], ['Extreme', 'Everything, including manual tuning.']];
let prof = 1;

function biosPage() {
  $('#act').innerHTML = win ? '<button id="bios-go" class="ghost">Restart into BIOS</button>' : '';
  const ram = hw ? arr(hw.ram) : [], cfg = Math.max(0, ...ram.map(m => m.ConfiguredClockSpeed || 0)), rated = Math.max(0, ...ram.map(m => m.Speed || 0));
  const count = p => BIOS.filter((_, i) => TIER[i] <= p).length;
  $('#home').innerHTML = `<div class="profiles">${PROFILES.map(([n], i) => `<button class="prof" data-prof="${i}" aria-pressed="${i === prof}"><b>${n}</b><span>${count(i)} settings</span></button>`).join('')}</div>
    <p class="hint">${PROFILES[prof][1]}</p>
    <div class="group sect">${BIOS.filter((_, i) => TIER[i] <= prof).map(([t, b, r]) => `<div class="tip"><div><h4>${t}</h4>${riskEl(r)}</div><p>${b}${t.startsWith('Turn on XMP') && cfg ? ` Yours runs at ${cfg} MT/s and is rated for ${rated}.` : ''}</p></div>`).join('')}</div>
    <p class="hint">Menu names differ by brand. Change one thing at a time and photograph the original value.</p>`;
}

// ---- DNS Jumper
let dnsBusy = false, dnsMsg = '';
const dnsPanel = () => `<div class="panel"><div class="phead"><div><h3>DNS Jumper</h3>
  <p>Finds the fastest DNS server for your connection and applies it. OpenBoost downloads the official zip, extracts it to a temp folder and opens it.</p></div>
  <div class="pbtns"><button id="dns" class="primary" ${dnsBusy ? 'disabled' : ''}>${dnsBusy ? 'Working…' : 'Open DNS Jumper'}</button><button id="flush" class="ghost">Flush DNS cache</button></div></div>
  ${dnsMsg ? '<p class="hint" id="dnsmsg"></p>' : ''}
  <ol class="steps"><li>In DNS Jumper, pick your network adapter at the top.</li>
  <li>Click <b>Fastest DNS</b> and start the test. Wait until every server shows a response time.</li>
  <li>Choose the server with the lowest time (Cloudflare, Google and Quad9 are usually near the top) and click <b>Apply DNS</b>.</li>
  <li>Click <b>Clear DNS Cache</b> in DNS Jumper, or use Flush DNS cache here. Button names vary a little between versions.</li>
  <li>Run the speed test again. DNS speeds up page and launcher lookups, not your in-game ping.</li></ol></div>`;

async function openDnsTool() {
  dnsBusy = true; dnsMsg = ''; render();
  const r = await api.dnsOpen();
  dnsBusy = false;
  dnsMsg = r.ok ? `Opened. SHA-256 ${r.sha256}. Signature: ${r.signature}. Saved in ${r.dir}` : `Could not open DNS Jumper: ${r.error}`;
  render();
}

// ---- Speed test
let speed = { run: false, phase: '', down: null, up: null, ping: null, jitter: null, error: '' }, hist = [];
try { hist = JSON.parse(localStorage.getItem('speedHist') || '[]'); } catch { hist = []; }

let procs = null, tickN = 0;
function drawProcs() {
  const el = $('#procs'); if (!el || !procs) return;
  const mem = mb => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
  el.innerHTML = `<h3>Running now (${procs.total} processes)</h3><div class="group">${procs.top.map(p =>
    `<div class="brow3"><span>${esc(p.name)}</span><span>${p.count > 1 ? `${p.count} running` : ''}</span><span>${mem(p.mb)}</span></div>`).join('')}</div>`;
}

// ---- Speed test: location, server picker, results
const SRC = { cf: 'Cloudflare', ls: 'LibreSpeed', ok: 'Speedtest.net' };
const PHASE = { latency: 'Measuring latency…', download: 'Measuring download…', upload: 'Measuring upload…' };
const srv = { list: [], busy: false, started: false, sel: '', tab: 'near', q: '', who: null, whoDone: false, hits: new Set(), searching: false, timer: 0,
  ookla: (() => { try { return localStorage.getItem('ookla') !== '0'; } catch { return true; } })() };

async function loadServers(force) {
  srv.busy = true; if (cat === 'speed') render();
  srv.list = await api.servers(force, srv.ookla);
  srv.busy = false; if (cat === 'speed') render();
}
async function loadWho() { srv.who = await api.who(); srv.whoDone = true; if (cat === 'speed') render(); }
const syncTabs = () => document.querySelectorAll('[data-stab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stab === srv.tab)));

function drawServers() {
  const el = $('#slist'); if (!el) return;
  const q = srv.q.trim().toLowerCase();
  let l = srv.list.filter(s => !q || srv.hits.has(s.id) || `${s.name} ${s.sponsor}`.toLowerCase().includes(q));
  l = srv.tab === 'near' ? l.filter(s => s.p != null).slice(0, 8) : l.slice(0, 300);
  const best = srv.list.find(s => s.p != null);
  const auto = q ? '' : `<button class="srow" data-sid="" aria-pressed="${srv.sel === ''}"><span>Nearest server (automatic)<small>${best ? esc(best.name) : 'Finding servers…'}</small></span><em>${best ? best.p.toFixed(0) + ' ms' : ''}</em></button>`;
  el.innerHTML = auto + (l.length ? l.map(s => `<button class="srow" data-sid="${esc(s.id)}" aria-pressed="${s.id === srv.sel}"><span>${esc(s.name)}<small>${esc([s.sponsor, SRC[s.src]].filter(Boolean).join(' / '))}</small></span><em>${s.p == null ? 'No response' : s.p.toFixed(0) + ' ms'}</em></button>`).join('')
    : `<p class="hint">${srv.busy ? 'Pinging servers near you…' : srv.searching ? 'Searching…' : 'No servers match.'}</p>`);
}

function speedPage() {
  if (!srv.started) { srv.started = true; setTimeout(() => { loadServers(false); loadWho(); }, 0); }
  $('#act').innerHTML = `<button id="spd" class="primary" ${speed.run ? 'disabled' : ''}>${speed.run ? 'Testing…' : 'Start test'}</button>`;
  const v = x => x == null ? '—' : x.toFixed(1), done = !speed.run && speed.ping != null && !speed.error;
  const good = done && speed.ping < 40 && speed.jitter < 10;
  const status = speed.error ? esc(speed.error) : speed.run ? PHASE[speed.phase] || '' : speed.ping == null ? 'Pick a server below, or leave it on automatic. A test takes about 20 seconds.' : '';
  const w = srv.who, place = w ? [w.city, w.region, w.country].filter(Boolean).join(', ') : '';
  const used = speed.server ? `${speed.server.name}${speed.server.sponsor ? ` (${speed.server.sponsor})` : ''}, ${speed.server.p.toFixed(0)} ms away` : '';
  $('#home').innerHTML = `<div class="meters">${[['down', 'Download', 'Mbps'], ['up', 'Upload', 'Mbps'], ['ping', 'Ping', 'ms'], ['jitter', 'Jitter', 'ms']]
    .map(([k, l, u]) => `<div class="meter"><div><span>${l}</span><b><span id="s-${k}">${v(speed[k])}</span> <small>${u}</small></b></div></div>`).join('')}</div>
    ${status ? `<p class="hint">${status}</p>` : ''}
    ${done ? `<div class="group sect"><div class="vrow"><span>Online gaming</span><span class="pill ${good ? 'ok' : 'bad'}">${good ? 'Good' : 'Change now'}</span>
      <span>${good ? 'Ping under 40 ms and jitter under 10 ms.' : `Ping ${speed.ping.toFixed(0)} ms, jitter ${speed.jitter.toFixed(0)} ms. Use a wired connection, pause downloads, or restart your router.`}</span><span></span></div></div>` : ''}
    <div class="group sect">
      <div class="spec"><span>Your location</span><span>${place ? esc(place) : srv.whoDone ? 'Could not detect. Use the search box below.' : 'Detecting…'}</span></div>
      ${w && w.isp ? `<div class="spec"><span>Your ISP</span><span>${esc(w.isp)}</span></div>` : ''}
      ${used ? `<div class="spec"><span>Last test server</span><span>${esc(used)}</span></div>` : ''}
    </div>
    <p class="hint">Location is detected from your IP address, so no permission prompt is needed. Type a city or country below to find servers there.</p>
    <div class="sect"><h3>Server</h3><div class="panel2">
      <div class="shead"><div class="seg"><button data-stab="near" aria-pressed="${srv.tab === 'near'}">Nearest</button><button data-stab="all" aria-pressed="${srv.tab === 'all'}">All servers (${srv.list.length})</button></div>
      <input id="sq" type="search" placeholder="Search city or country" value="${esc(srv.q)}" aria-label="Search servers"><button id="sfind" class="ghost" ${srv.busy ? 'disabled' : ''}>${srv.busy ? 'Pinging…' : 'Refresh'}</button></div>
      <label class="chk"><input type="checkbox" id="ookla" ${srv.ookla ? 'checked' : ''}> Include Speedtest.net servers (unofficial, Ookla's terms apply)</label>
      <div class="slist" id="slist"></div></div></div>
    ${hist.length ? `<div class="sect"><h3>Recent tests</h3><div class="group">${hist.map(h => `<div class="brow"><span>${new Date(h.at).toLocaleString()}</span><span>${h.down.toFixed(1)} Mbps down</span><span>${h.up.toFixed(1)} Mbps up</span><span>${h.ping.toFixed(0)} ms ping</span></div>`).join('')}</div></div>` : ''}`;
  drawServers();
}

document.addEventListener('input', e => {
  if (e.target.id !== 'sq') return;
  srv.q = e.target.value;
  srv.hits.clear();
  if (srv.q && srv.tab === 'near') { srv.tab = 'all'; syncTabs(); }
  drawServers();
  clearTimeout(srv.timer);
  if (srv.ookla && srv.q.trim().length >= 3) srv.timer = setTimeout(searchOokla, 450);
});

// Server-side search: finds servers by city, country or ISP name beyond the nearest 50 (for example "Milano" or "Iliad").
async function searchOokla() {
  const q = srv.q.trim(); srv.searching = true; drawServers();
  const r = await api.search(q);
  if (q !== srv.q.trim()) return;
  r.forEach(s => { if (!srv.list.some(x => x.id === s.id)) srv.list.push(s); srv.hits.add(s.id); });
  srv.list.sort((a, b) => (a.p ?? 1e9) - (b.p ?? 1e9));
  srv.searching = false; drawServers();
}

async function runSpeed() {
  speed = { run: true, phase: 'latency', down: null, up: null, ping: null, jitter: null, error: '', server: null }; render();
  const r = await api.speed(srv.sel);
  speed = { ...speed, ...r, run: false };
  if (!r.error) {
    hist = [{ at: Date.now(), down: r.down, up: r.up, ping: r.ping }, ...hist].slice(0, 6);
    try { localStorage.setItem('speedHist', JSON.stringify(hist)); } catch { /* storage unavailable */ }
  }
  render();
}

const PAGES = { home, bench: benchPage, speed: speedPage, bios: biosPage };

api.benchGet().then(b => { bench = b; if (cat === 'bench') render(); });
api.onSpeed(m => {
  if (m.k === 'phase' || m.k === 'server') { speed[m.k] = m.v; if (cat === 'speed') render(); return; }
  speed[m.k] = m.v;
  const el = $('#s-' + m.k); if (el) el.textContent = m.v.toFixed(1);
});
refresh(); scan(); tick(); setInterval(tick, 2000);

// Use your own icon as the logo when renderer/icon.png exists (made by `npm run icon`); otherwise keep the default mark.
const logo = new Image();
logo.className = 'logo'; logo.alt = ''; logo.width = logo.height = 24;
logo.onload = () => $('#logo').replaceWith(logo);
logo.src = 'icon.png';
