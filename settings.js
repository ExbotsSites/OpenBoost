// Persistent app settings (theme, language, overlay). Stored in the user data folder.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  accent: '#a53FFA', mode: 'dark', lang: 'en',
  overlay: { on: false, corner: 'tr', opacity: 0.85, cpu: true, ram: true, gpu: true, clock: true }
};
const LANGS = ['en', 'it', 'es', 'fr', 'de'];
const file = () => path.join(app.getPath('userData'), 'settings.json');
const merge = (a, b) => ({ ...a, ...b, overlay: { ...a.overlay, ...((b && b.overlay) || {}) } });

// Only known keys with valid values get through, whatever the renderer sends.
function clean(p = {}) {
  const o = {};
  if (/^#[0-9a-f]{6}$/i.test(p.accent)) o.accent = p.accent;
  if (['dark', 'midnight', 'light'].includes(p.mode)) o.mode = p.mode;
  if (LANGS.includes(p.lang)) o.lang = p.lang;
  if (p.overlay && typeof p.overlay === 'object') {
    const v = p.overlay, ov = {};
    if (['tl', 'tr', 'bl', 'br'].includes(v.corner)) ov.corner = v.corner;
    if (typeof v.opacity === 'number' && isFinite(v.opacity)) ov.opacity = Math.min(1, Math.max(0.3, v.opacity));
    ['on', 'cpu', 'ram', 'gpu', 'clock'].forEach(k => { if (typeof v[k] === 'boolean') ov[k] = v[k]; });
    o.overlay = ov;
  }
  return o;
}

let cache = null;
function get() {
  if (!cache) {
    let saved = {};
    try { saved = clean(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch { /* first run */ }
    cache = merge(DEFAULTS, saved);
  }
  return cache;
}
function set(patch) {
  cache = merge(get(), clean(patch));
  try { fs.writeFileSync(file(), JSON.stringify(cache, null, 2)); } catch { /* read-only profile */ }
  return cache;
}
function reset() { cache = merge(DEFAULTS, { overlay: get().overlay }); try { fs.writeFileSync(file(), JSON.stringify(cache, null, 2)); } catch { /* ignore */ } return cache; }

module.exports = { get, set, reset, DEFAULTS };
