// Benchmark share card: drawn on a canvas, exported as a 1200x630 JPG.
const CARD_ROWS = [['cpu', 'CPU score', '', 1, 0], ['mem', 'Memory speed', 'GB/s', 1, 1], ['timer', 'Timer delay', 'ms', 0, 2],
  ['p99', 'Timer delay, worst 1%', 'ms', 0, 2], ['procs', 'Background processes', '', 0, 0], ['startup', 'Startup apps', '', 0, 0]];
const CARD_STYLES = {
  midnight: a => ({ bg: '#0d0b13', ink: '#f3f0fa', mute: '#9a93ac', line: 'rgba(255,255,255,.1)', good: '#4cd694', bad: '#ff7a8a', flat: '#9a93ac', edge: a }),
  paper: a => ({ bg: '#f7f5fb', ink: '#17141f', mute: '#6a6479', line: 'rgba(23,20,31,.13)', good: '#10854f', bad: '#c92a47', flat: '#6a6479', edge: a }),
  accent: a => { const ink = onColor(a), mute = ink === '#ffffff' ? 'rgba(255,255,255,.78)' : 'rgba(20,17,27,.72)';
    return { bg: a, ink, mute, line: ink === '#ffffff' ? 'rgba(255,255,255,.28)' : 'rgba(20,17,27,.22)', good: ink, bad: ink, flat: mute, edge: null }; }
};
const cardLogo = new Image();
cardLogo.onload = () => { if (typeof redrawCard === 'function') redrawCard(); };
cardLogo.src = 'icon.png';

const cardNum = (v, d, u) => v == null ? '—' : `${Number(v).toFixed(d)}${u ? ' ' + u : ''}`;
function fitText(c, text, max) {
  if (c.measureText(text).width <= max) return text;
  while (text.length > 1 && c.measureText(text + '…').width > max) text = text.slice(0, -1);
  return text.trimEnd() + '…';
}
const brand = hw => {
  if (!hw) return ['', ''];
  const ram = [].concat(hw.ram || []), total = Math.round(ram.reduce((s, m) => s + (m.Capacity || 0), 0) / 2 ** 30);
  const speed = Math.max(0, ...ram.map(m => m.ConfiguredClockSpeed || m.Speed || 0));
  const gpu = [].concat(hw.gpu || []).map(g => g.Name).filter(n => !/basic (render|display)/i.test(n))[0] || '';
  return [hw.cpu || '', [gpu, total ? `${total} GB RAM${speed ? ` at ${speed} MT/s` : ''}` : ''].filter(Boolean).join(', ')];
};

function drawCard(cv, d, styleKey) {
  const c = cv.getContext('2d'), W = 1200, H = 630, s = CARD_STYLES[styleKey](d.accent), X = 64;
  const F = (w, px) => `${w} ${px}px "Segoe UI Variable Display","Segoe UI",system-ui,sans-serif`;
  c.clearRect(0, 0, W, H); c.fillStyle = s.bg; c.fillRect(0, 0, W, H);
  if (s.edge) { c.fillStyle = s.edge; c.fillRect(0, 0, 10, H); }

  // header
  if (cardLogo.complete && cardLogo.naturalWidth) {
    c.save(); c.beginPath(); c.roundRect(X, 48, 44, 44, 10); c.clip(); c.drawImage(cardLogo, X, 48, 44, 44); c.restore();
  }
  c.textBaseline = 'alphabetic'; c.fillStyle = s.ink; c.font = F(700, 28); c.fillText('OpenBoost', X + 58, 80);
  c.textAlign = 'right'; c.fillStyle = s.mute; c.font = F(400, 20); c.fillText(d.date, W - X, 78); c.textAlign = 'left';

  // numbers
  const { before, after } = d;
  const rows = CARD_ROWS.map(([k, label, u, hi, dec]) => {
    const a = before && before[k], b = after && after[k]; let st = 'none', txt = '—';
    if (a && b != null) {
      const p = (b - a) / a * 100, better = hi ? p > 0 : p < 0;
      if (Math.abs(p) < 1) { st = 'flat'; txt = 'No change'; } else { st = better ? 'good' : 'bad'; txt = `${better ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%`; }
    }
    return { label, a: cardNum(a, dec, u), b: cardNum(b, dec, u), st, txt };
  });

  // headline
  c.fillStyle = s.ink; c.font = F(700, 54);
  if (after) { const n = rows.filter(r => r.st === 'good').length; c.fillText(`${n} of ${rows.length} results improved`, X, 176); }
  else c.fillText('Baseline measured', X, 176);
  const [l1, l2] = brand(d.hw);
  c.fillStyle = s.mute; c.font = F(400, 21);
  const tw = d.tweaks ? `${d.tweaks} ${d.tweaks === 1 ? 'tweak' : 'tweaks'} applied` : '';
  if (l1) c.fillText(fitText(c, l1, W - 2 * X), X, 220);
  if (l2 || tw) c.fillText(fitText(c, [l2, tw].filter(Boolean).join('. '), W - 2 * X), X, 252);

  // table
  const cols = { a: 800, b: 950, c: W - X };
  c.font = F(400, 18); c.fillStyle = s.mute; c.textAlign = 'right';
  c.fillText('Before', cols.a, 322); if (after) { c.fillText('After', cols.b, 322); c.fillText('Change', cols.c, 322); }
  rows.forEach((r, i) => {
    const y = 366 + i * 38;
    c.fillStyle = s.line; c.fillRect(X, y - 28, W - 2 * X, 1);
    c.textAlign = 'left'; c.fillStyle = s.ink; c.font = F(400, 22); c.fillText(r.label, X, y);
    c.textAlign = 'right'; c.fillText(r.a, cols.a, y);
    if (after) {
      c.fillText(r.b, cols.b, y);
      c.fillStyle = s[r.st === 'good' ? 'good' : r.st === 'bad' ? 'bad' : 'flat']; c.font = F(r.st === 'good' || r.st === 'bad' ? 700 : 400, 22); c.fillText(r.txt, cols.c, y);
    }
  });

  // footer
  c.textAlign = 'left'; c.fillStyle = s.mute; c.font = F(400, 18); c.fillText('Measured with OpenBoost  github.com/ExbotsSites/OpenBoost', X, H - 28);
}
