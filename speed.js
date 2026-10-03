// Speed test. Builds a server list from LibreSpeed's public network plus Cloudflare, pings every server,
// then measures latency, jitter, download and upload against the one you pick (or the nearest).
const U = 'https://speed.cloudflare.com';
const LIST = 'https://librespeed.org/backend-servers/servers.php';
const now = () => performance.now();
const bust = u => u + (u.includes('?') ? '&' : '?') + 'r=' + Math.random();
const fail = m => Object.assign(new Error(m), { friendly: true });
const CF = { id: 'cf', src: 'cf', name: 'Cloudflare', sponsor: 'Nearest edge location', ping: `${U}/__down?bytes=0`, dl: `${U}/__down?bytes=25000000`, ul: `${U}/__up` };

const norm = (s, i) => {
  let b = s.server.startsWith('//') ? 'https:' + s.server : s.server;
  if (!b.endsWith('/')) b += '/';
  return { id: `s${i}`, src: 'ls', name: s.name, sponsor: s.sponsorName || '', ping: b + s.pingURL, dl: `${b}${s.dlURL}?ckSize=50`, ul: b + s.ulURL };
};

// Timed requests in order (first one pays for the TLS handshake and is dropped). Null if the server fails.
async function samples(s, n, timeout) {
  const t = [];
  try {
    for (let i = 0; i <= n; i++) {
      const a = now();
      await (await fetch(bust(s.ping), { cache: 'no-store', signal: AbortSignal.timeout(timeout) })).arrayBuffer();
      if (i) t.push(now() - a);
    }
  } catch { return null; }
  return t;
}
const median = t => [...t].sort((a, b) => a - b)[t.length >> 1];

// Speedtest.net servers (where ISP servers such as Iliad, TIM or Fastweb live). Unofficial endpoint, same one speedtest-cli uses.
const OOKLA = 'https://www.speedtest.net/api/js/servers?engine=js';
const EXO = { milano: 'milan', roma: 'rome', torino: 'turin', firenze: 'florence', napoli: 'naples', venezia: 'venice', genova: 'genoa', padova: 'padua' };
const normO = s => {
  const base = String(s.url).replace(/upload\.php.*$/, '');
  return { id: `o${s.id}`, src: 'ok', name: [s.name, s.country].filter(Boolean).join(', '), sponsor: s.sponsor || '', ping: base + 'latency.txt', dl: base + 'random4000x4000.jpg', ul: s.url };
};
async function ooklaList(q, limit) {
  try {
    const r = await fetch(`${OOKLA}&limit=${limit}${q ? '&search=' + encodeURIComponent(q) : ''}`,
      { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'OpenBoost', Accept: 'application/json' } });
    if (!r.ok) return [];
    return (await r.json()).filter(s => s && s.url && s.id).map(normO);
  } catch { return []; }
}
async function pingAll(all) {
  for (let i = 0; i < all.length; i += 25)
    await Promise.all(all.slice(i, i + 25).map(async s => { const t = await samples(s, 1, 1500); s.p = t ? median(t) : null; }));
}

let cache = null, useOokla = true;
async function list(force, ookla = useOokla) {
  if (!force && cache && cache.ookla === ookla && Date.now() - cache.at < 6e5) return cache.list;
  let raw = [];
  try {
    raw = (await (await fetch(LIST, { signal: AbortSignal.timeout(6000) })).json())
      .filter(s => s && s.server && s.pingURL && s.dlURL && s.ulURL);
  } catch { /* fall back to Cloudflare only */ }
  const extra = ookla ? await ooklaList('', 50) : []; // the 50 closest to your IP
  const all = [CF, ...raw.map(norm), ...extra];
  await pingAll(all); // quick pass over every server
  const best = all.filter(s => s.p != null).sort((a, b) => a.p - b.p).slice(0, 5);
  await Promise.all(best.map(async s => { const t = await samples(s, 5, 2000); if (t) s.p = median(t); })); // refine the closest
  const l = [...all.filter(s => s.p != null).sort((a, b) => a.p - b.p), ...all.filter(s => s.p == null)];
  cache = { at: Date.now(), list: l, ookla };
  return l;
}

// Runs `workers` parallel loops for `ms`, counting bytes; the first second (TCP ramp-up) is ignored.
async function transfer(kind, emit, ms, workers, step) {
  const ac = new AbortController(), start = now();
  let bytes = 0, mark = null;
  const warm = setTimeout(() => { mark = { b: bytes, t: now() }; }, 1000);
  const rate = () => (mark ? (bytes - mark.b) * 8 / 1e6 / ((now() - mark.t) / 1000) : bytes * 8 / 1e6 / ((now() - start) / 1000));
  const tick = setInterval(() => emit(kind, rate()), 300);
  const stop = setTimeout(() => ac.abort(), ms);
  await Promise.all(Array.from({ length: workers }, () => step(ac.signal, n => { bytes += n; }, () => now() - start < ms)));
  clearTimeout(warm); clearTimeout(stop); clearInterval(tick);
  return rate();
}

const down = (s, emit) => transfer('down', emit, 8000, 4, async (signal, add, live) => {
  try {
    while (live()) {
      const r = await fetch(bust(s.dl), { signal, cache: 'no-store' });
      if (!r.ok) throw new Error('bad status');
      const rd = r.body.getReader();
      for (;;) { const { done, value } = await rd.read(); if (done) break; add(value.length); }
    }
  } catch { /* aborted at the time limit, or the server refused */ }
});

const body = Buffer.alloc(2e6, 97);
const up = (s, emit) => transfer('up', emit, 6000, 3, async (signal, add, live) => {
  try {
    while (live()) {
      await (await fetch(bust(s.ul), { method: 'POST', body, signal, headers: { 'Content-Type': 'application/octet-stream' } })).arrayBuffer();
      add(body.length);
    }
  } catch { /* aborted at the time limit */ }
});

async function latency(s) {
  const t = await samples(s, 10, 3000);
  if (!t) return null;
  return { ping: t.reduce((a, b) => a + b, 0) / t.length, jitter: t.slice(1).reduce((a, v, i) => a + Math.abs(v - t[i]), 0) / (t.length - 1) };
}

async function run(emit, id) {
  const reach = (await list(false)).filter(s => s.p != null);
  const order = [...reach.filter(s => s.id === id), ...reach.filter(s => s.id !== id)];
  if (!order.length) throw fail('No server answered. Check your connection.');
  for (const s of id ? order.slice(0, 1) : order.slice(0, 3)) { // a chosen server is tried alone; auto tries the next closest
    emit('server', { name: s.name, sponsor: s.sponsor, p: s.p });
    emit('phase', 'latency'); const l = await latency(s); if (!l) continue;
    emit('ping', l.ping); emit('jitter', l.jitter);
    emit('phase', 'download'); const d = await down(s, emit); if (!(d > 0.01)) continue;
    emit('phase', 'upload'); const u = await up(s, emit);
    return { ...l, down: d, up: u, server: { name: s.name, sponsor: s.sponsor, p: s.p } };
  }
  throw fail(id ? 'That server did not complete the test. Pick another one or use the nearest.' : 'No server completed the test. Try again.');
}

// Tries three free IP lookup services in turn, so one being down or blocked doesn't leave you without a location.
const getJson = u => fetch(u, { signal: AbortSignal.timeout(4000), headers: { Accept: 'application/json' } })
  .then(r => { if (!r.ok) throw new Error('bad status'); return r.json(); });
async function who() {
  const tries = [
    async () => { const m = await getJson('https://ipwho.is/'); if (m.success === false) throw new Error('failed'); return { isp: m.connection && (m.connection.isp || m.connection.org), city: m.city, region: m.region, country: m.country }; },
    async () => { const m = await getJson('https://get.geojs.io/v1/ip/geo.json'); return { isp: m.organization_name, city: m.city, region: m.region, country: m.country }; },
    async () => { const m = await getJson(`${U}/meta`); return { isp: m.asOrganization, city: m.city, region: m.region, country: m.country }; }
  ];
  for (const t of tries) {
    try { const r = await t(); if (r && (r.city || r.country)) return { isp: r.isp || '', city: r.city || '', region: r.region || '', country: r.country || '' }; } catch { /* try the next one */ }
  }
  return null;
}

const pub = ({ id, src, name, sponsor, p }) => ({ id, src, name, sponsor, p });

module.exports = {
  servers: async (force, ookla = true) => { useOokla = ookla; return (await list(force, ookla)).map(pub); },
  search: async q => {
    const low = q.toLowerCase(), variants = [...new Set([q, EXO[low]].filter(Boolean))];
    const found = (await Promise.all(variants.map(v => ooklaList(v, 30)))).flat();
    const uniq = [...new Map(found.map(s => [s.id, s])).values()];
    await pingAll(uniq);
    if (cache) uniq.forEach(s => { if (s.p != null && !cache.list.some(x => x.id === s.id)) cache.list.push(s); });
    return uniq.map(pub);
  },
  test: async (emit, id) => {
    try { return await run(emit, id); }
    catch (e) { return { error: e.friendly ? e.message : 'Could not reach the speed test servers. Check your connection and try again.' }; }
  },
  who
};
