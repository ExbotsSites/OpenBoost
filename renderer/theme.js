// Theme: the accent color drives every neutral too, so any accent gives a matching palette.
let S = { accent: '#a53FFA', mode: 'dark', lang: 'en', overlay: { on: false, corner: 'tr', opacity: 0.85, cpu: true, ram: true, gpu: true, clock: true } };
const ACCENTS = ['#a53FFA', '#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ec4899', '#ef4444'];

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const onColor = hex => luminance(hex) > 0.4 ? '#14111b' : '#ffffff';

function palette(accent, mode) {
  const [h, s] = hexToHsl(accent), H = (sat, l) => hslToHex(h, sat, l);
  if (mode === 'light') return { bg: H(30, 97), rail: H(26, 94), raise: '#ffffff', raise2: H(26, 95), line: H(20, 88), off: H(16, 80), text: H(30, 12), mute: H(10, 38), code: H(30, 24), link: H(Math.min(s, 80), 36) };
  if (mode === 'midnight') return { bg: '#000000', rail: H(14, 4), raise: H(14, 8), raise2: H(14, 11), line: H(12, 15), off: H(12, 24), text: H(20, 95), mute: H(8, 65), code: H(20, 82), link: H(Math.min(s, 100), 78) };
  return { bg: H(20, 8), rail: H(20, 10), raise: H(20, 12), raise2: H(20, 15), line: H(16, 19), off: H(16, 27), text: H(25, 94), mute: H(10, 66), code: H(25, 82), link: H(Math.min(s, 100), 78) };
}

function applyTheme() {
  const p = palette(S.accent, S.mode), root = document.documentElement;
  for (const k in p) root.style.setProperty('--' + k, p[k]);
  root.style.setProperty('--accent', S.accent);
  root.style.setProperty('--on', onColor(S.accent));
  root.style.colorScheme = S.mode === 'light' ? 'light' : 'dark';
  root.dataset.mode = S.mode;
  root.lang = S.lang;
  if (window.openboost && openboost.theme) openboost.theme({ bg: p.bg, sym: p.mute });
}
