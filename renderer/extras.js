// v2.0 pages: Tools (overlay, disk cleanup, graphics and drivers), Settings, and the benchmark share card.
// Runs after renderer.js and shares its globals ($, api, esc, T, bench, render, PAGES, ...).
const bytes = n => n >= 2 ** 30 ? `${(n / 2 ** 30).toFixed(1)} GB` : n >= 2 ** 20 ? `${Math.round(n / 2 ** 20)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
const refreshIfOn = id => { if (cat === id) render(); };

async function setS(patch) {
  S = await api.settingsSet(patch);
  LANG = S.lang; applyTheme(); render();
}

// ---- Tools: overlay
const overlayPanel = () => {
  const o = S.overlay, seg = (attr, keys, on) => keys.map(k => `<button ${attr}="${k}" aria-pressed="${on(k)}">${t('ov.' + k)}</button>`).join('');
  return `<div class="panel"><div class="phead"><div><h3>${t('ov.title')}</h3><p>${t('ov.desc')}</p></div>
    <button class="sw" role="switch" id="ov-on" aria-checked="${o.on}" aria-label="${t('ov.toggle')}"></button></div>
    <div class="opts">
      <div class="optrow"><span>${t('ov.corner')}</span><div class="seg">${seg('data-ovc', ['tl', 'tr', 'bl', 'br'], k => o.corner === k)}</div></div>
      <div class="optrow"><span>${t('ov.opacity')}</span><input type="range" id="ov-op" min="30" max="100" value="${Math.round(o.opacity * 100)}" aria-label="${t('ov.opacity')}"></div>
      <div class="optrow"><span>${t('ov.show')}</span><div class="seg">${seg('data-ovk', ['cpu', 'ram', 'gpu', 'clock'], k => o[k])}</div></div>
    </div></div>`;
};

// ---- Tools: disk cleanup
const cl = { items: null, admin: false, win: true, sel: new Set(), scanning: false, running: false, msg: '' };
async function scanClean() {
  cl.scanning = true; refreshIfOn('tools');
  const r = await api.cleanScan();
  cl.items = r.items; cl.admin = r.admin; cl.win = r.win; cl.scanning = false;
  const keep = new Set([...cl.sel].filter(id => r.items.some(i => i.id === id && i.bytes > 0)));
  cl.sel = cl.sel.size ? keep : new Set(r.items.filter(i => i.bytes > 0 && (!i.admin || r.admin) && i.id !== 'recycle').map(i => i.id));
  refreshIfOn('tools');
}
async function runClean() {
  cl.running = true; cl.msg = ''; refreshIfOn('tools');
  const r = await api.cleanRun([...cl.sel]);
  cl.running = false; cl.msg = t('cl.freed', { size: bytes(r.freed) });
  await scanClean();
}
const cleanPanel = () => {
  if (!cl.win) return `<div class="sect"><h3>${t('cl.title')}</h3><p class="empty">${t('cl.winOnly')}</p></div>`;
  const items = cl.items || [], total = items.filter(i => cl.sel.has(i.id)).reduce((s, i) => s + i.bytes, 0);
  const row = i => {
    const lock = i.admin && !cl.admin;
    return `<label class="crow"><input type="checkbox" data-cl="${i.id}" ${cl.sel.has(i.id) ? 'checked' : ''} ${lock || cl.running ? 'disabled' : ''}>
      <span><b>${t('cl.' + i.id)}</b><small>${t('cl.' + i.id + '.d')}${lock ? ` ${t('cl.admin')}.` : ''}</small></span><em>${bytes(i.bytes)}</em></label>`;
  };
  return `<div class="sect"><h3>${t('cl.title')}</h3><p class="hint">${t('cl.desc')}</p>
    <div class="group">${cl.items ? items.map(row).join('') : `<p class="find">${t('cl.scanning')}</p>`}</div>
    <div class="cbar"><span>${cl.msg || (cl.items ? t('cl.selected', { size: bytes(total) }) : '')}</span>
      <button id="cl-scan" class="ghost" ${cl.scanning || cl.running ? 'disabled' : ''}>${cl.scanning ? t('cl.scanning') : t('cl.scan')}</button>
      <button id="cl-run" class="primary" ${!cl.sel.size || cl.running || cl.scanning ? 'disabled' : ''}>${cl.running ? t('cl.running') : t('cl.run')}</button></div></div>`;
};

// ---- Tools: graphics and drivers
let gpuState = null;
async function loadGpu() { gpuState = await api.gpu(); refreshIfOn('tools'); }
const VENDOR = { nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel' };
const gpuPanel = () => {
  if (!gpuState) return `<div class="sect"><h3>${t('gpu.title')}</h3><p class="empty">${t('gpu.loading')}</p></div>`;
  if (!gpuState.gpus.length) return `<div class="sect"><h3>${t('gpu.title')}</h3><p class="empty">${t('gpu.none')}</p></div>`;
  const hags = gpuState.hags == null ? t('gpu.unknown') : gpuState.hags ? t('gpu.on') : t('gpu.off');
  const card = g => {
    const old = g.months != null && g.months >= 6;
    return `<div class="group">
      <div class="spec"><span>${t('gpu.name')}</span><span>${esc(g.name)}</span></div>
      <div class="spec"><span>${t('gpu.version')}</span><span>${esc(g.version || '—')}</span></div>
      <div class="spec"><span>${t('gpu.date')}</span><span>${esc(g.date || '—')}${g.months != null ? ` <span class="pill ${old ? 'bad' : 'ok'}">${t(old ? 'gpu.stale' : 'gpu.fresh', { n: g.months })}</span>` : ''}</span></div>
    </div>
    <div class="gbtns">${g.vendor ? `<button class="primary" data-link="${g.vendor}">${t('gpu.get', { vendor: VENDOR[g.vendor] })}</button>`
      : `<button class="primary" data-link="nvidia">${t('gpu.generic')}</button>`}</div>`;
  };
  return `<div class="sect"><h3>${t('gpu.title')}</h3>${gpuState.gpus.map(card).join('')}
    <div class="group sect"><div class="spec"><span>${t('gpu.hags')}</span><span>${hags}</span></div></div>
    <div class="gbtns"><button class="ghost" data-open="ms-settings:display-advancedgraphics">${t('gpu.settings')}</button>
      <button class="ghost" data-open="ms-settings:gaming-gamemode">${t('gpu.game')}</button>
      <button class="ghost" data-link="devmgmt">${t('gpu.devman')}</button></div>
    <ol class="steps"><li>${t('gpu.s1')}</li><li>${t('gpu.s2')}</li><li>${t('gpu.s3')}</li></ol>
    <p class="hint"><button class="link" data-link="ddu">${t('gpu.ddu')}</button></p></div>`;
};

let toolsStarted = false;
function toolsPage() {
  if (!toolsStarted) { toolsStarted = true; setTimeout(() => { scanClean(); loadGpu(); }, 0); }
  $('#act').innerHTML = '';
  $('#home').innerHTML = overlayPanel() + cleanPanel() + gpuPanel();
}

// ---- Settings
function settingsPage() {
  $('#act').innerHTML = `<button id="set-reset" class="ghost">${t('set.reset')}</button>`;
  const seg = (attr, pairs, cur) => `<div class="seg">${pairs.map(([k, label]) => `<button ${attr}="${k}" aria-pressed="${cur === k}">${label}</button>`).join('')}</div>`;
  $('#home').innerHTML = `<div class="group sect">
    <div class="set"><span>${t('set.mode')}</span>${seg('data-mode', ['dark', 'midnight', 'light'].map(m => [m, t('set.' + m)]), S.mode)}</div>
    <div class="set"><span>${t('set.accent')}</span><div class="swatches">${ACCENTS.map(a => `<button class="swatch" data-acc="${a}" aria-pressed="${a.toLowerCase() === S.accent.toLowerCase()}" aria-label="${a}"></button>`).join('')}
      <input type="color" id="acc-custom" value="${S.accent.toLowerCase()}" aria-label="${t('set.custom')}" title="${t('set.custom')}"></div></div>
    <div class="set"><span>${t('set.lang')}</span>${seg('data-lang', Object.entries(LANG_NAMES), S.lang)}</div></div>
    <p class="hint">${t('set.langNote')}</p>`;
  document.querySelectorAll('[data-acc]').forEach(b => { b.style.background = b.dataset.acc; });
}

// ---- Benchmark share card
const share = { style: 'midnight' };
const cardData = () => ({
  before: bench.before, after: bench.after, hw: typeof hw === 'undefined' ? null : hw, accent: S.accent,
  tweaks: T.filter(x => x.applied).length, date: new Date().toLocaleDateString(S.lang, { year: 'numeric', month: 'long', day: 'numeric' })
});
function redrawCard() { const cv = $('#card'); if (cv) drawCard(cv, cardData(), share.style); }
function shareSection() {
  if (!bench.before) return;
  const d = document.createElement('div'); d.className = 'sect';
  d.innerHTML = `<h3>${t('share.title')}</h3><div class="panel2"><canvas id="card" class="card" width="1200" height="630" role="img" aria-label="${t('share.title')}"></canvas>
    <div class="shead cbtns"><div class="seg">${['midnight', 'paper', 'accent'].map(k => `<button data-card="${k}" aria-pressed="${share.style === k}">${t('share.' + k)}</button>`).join('')}</div>
      <div class="pbtns"><button id="sh-copy" class="ghost">${t('share.copy')}</button><button id="sh-save" class="primary">${t('share.save')}</button></div></div>
    <p class="hint" id="shmsg">${t('share.hint')}</p></div>`;
  $('#home').appendChild(d); redrawCard();
}
const _bench = PAGES.bench;
PAGES.bench = () => { _bench(); shareSection(); };
PAGES.tools = toolsPage;
PAGES.settings = settingsPage;

// ---- Events
const jpg = () => $('#card').toDataURL('image/jpeg', 0.93);
document.addEventListener('click', async e => {
  const el = e.target.closest('button'); if (!el) return;
  const d = el.dataset, o = S.overlay;
  if (el.id === 'ov-on') setS({ overlay: { on: !o.on } });
  else if (d.ovc) setS({ overlay: { corner: d.ovc } });
  else if (d.ovk) setS({ overlay: { [d.ovk]: !o[d.ovk] } });
  else if (el.id === 'cl-scan') scanClean();
  else if (el.id === 'cl-run') runClean();
  else if (d.link) api.link(d.link);
  else if (d.mode) setS({ mode: d.mode });
  else if (d.acc) setS({ accent: d.acc });
  else if (d.lang) setS({ lang: d.lang });
  else if (el.id === 'set-reset') { S = await api.settingsReset(); LANG = S.lang; applyTheme(); render(); }
  else if (d.card) { share.style = d.card; document.querySelectorAll('[data-card]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.card === d.card))); redrawCard(); }
  else if (el.id === 'sh-save') {
    const r = await api.cardSave(jpg());
    if (!r.canceled) $('#shmsg').textContent = r.ok ? `${t('share.saved')} ${r.path}` : t('share.failed');
  } else if (el.id === 'sh-copy') { const r = await api.cardCopy(jpg()); $('#shmsg').textContent = r.ok ? t('share.copied') : t('share.failed'); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.cl) { el.checked ? cl.sel.add(el.dataset.cl) : cl.sel.delete(el.dataset.cl); cl.msg = ''; render(); }
  else if (el.id === 'acc-custom') setS({ accent: el.value });
});
let opTimer = 0;
document.addEventListener('input', e => {
  if (e.target.id === 'ov-op') { const v = e.target.value / 100; clearTimeout(opTimer); opTimer = setTimeout(() => api.settingsSet({ overlay: { opacity: v } }).then(s => { S = s; }), 120); }
  else if (e.target.id === 'acc-custom') { S.accent = e.target.value; applyTheme(); }
});

api.onSettings(s => { S = s; if (cat === 'tools') render(); });
api.settingsGet().then(s => { S = s; LANG = s.lang; applyTheme(); render(); });
