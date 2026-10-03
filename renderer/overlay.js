const root = document.getElementById('ov');
window.ov.on(d => {
  document.documentElement.style.setProperty('--a', d.accent);
  document.body.style.opacity = d.opacity;
  root.replaceChildren(...d.rows.map(r => {
    const row = document.createElement('div'); row.className = r.k ? 'r' : 'r t';
    if (r.k) { const k = document.createElement('span'); k.textContent = r.k; row.append(k); }
    if (r.p != null) { const bar = document.createElement('i'), fill = document.createElement('u'); fill.style.width = `${r.p}%`; bar.append(fill); row.append(bar); }
    const v = document.createElement('b'); v.textContent = r.v; row.append(v);
    return row;
  }));
});
