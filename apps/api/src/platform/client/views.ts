// Her views (specs 015, 016): a kind explored as a table, a kanban, a calendar, a map…
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const views = `
// Her views (specs 015, 016): the entries of a kind, filtered, sorted, as a table, a kanban, a
// calendar, a map, a gallery, a timeline or a tree. Shared by an app and a collection opened alone.
async function explore(key, st, ctx) {
  const r = await api(inSpace('/views/run'), { method: 'POST', body: { id: st.id || undefined, view: st.view } });
  explorerNow = { key, st, r, name: ctx.app, kind: ctx.kind, model: ctx.model };
  const fieldAt = (path) => r.fields.find((x) => x.path === path);
  const fl = (path) => {
    const f = fieldAt(path);
    if (path === 'title') return W.title;
    if (!f) return path;
    if (f.via && path.indexOf('.') > 0) {
      const link = fieldAt(path.split('.')[0]);
      const head = link && link.label ? tr(link.label) : path.split('.')[0];
      return path.endsWith('.title') ? head : head + ' › ' + (f.label ? tr(f.label) : path.split('.').slice(1).join('.'));
    }
    return f.label ? tr(f.label) : path;
  };
  const ol = (path, v) => { const f = fieldAt(path); return f && f.optionLabels && typeof v === 'string' && f.optionLabels[v] ? tr(f.optionLabels[v]) : v; };
  const show = (path, v, row) => {
    const f = fieldAt(path) || {};
    if (f.type === 'button') return '<button class="quiet mini" data-press="' + esc(path) + '" data-id="' + esc(row.id) + '">' + esc(fl(path)) + '</button>';
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '<span class="muted">—</span>';
    switch (f.type) {
      case 'url': return '<a class="link" target="_blank" rel="noopener" href="' + esc(v) + '">' + esc(String(v).replace(/^https?:\\/\\//, '').split('/')[0]) + ' ↗</a>';
      case 'email': return '<a class="link" href="mailto:' + esc(v) + '">' + esc(v) + '</a>';
      case 'phone': return '<a class="link" href="tel:' + esc(String(v).replace(/[^+\\d]/g, '')) + '">' + esc(v) + '</a>';
      case 'multi_choice': case 'list': return [v].flat().map((one) => '<span class="tag">' + esc(ol(path, one)) + '</span>').join('');
      case 'rating': return '<span class="stars">' + '★'.repeat(v) + '<span class="off">' + '★'.repeat(Math.max(0, (typeof f.max === 'number' ? f.max : 5) - v)) + '</span></span>';
      case 'progress': return '<div class="pbar" title="' + esc(v) + ' %"><i style="width:' + Math.max(0, Math.min(100, v)) + '%"></i></div>';
      case 'file': return [v].flat().map((one) => '<a class="link" href="#" data-file="' + esc(one) + '">' + esc(W.fileShort) + '</a>').join(' ');
      case 'location': return '<a class="link" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' + esc(v.lat) + '&mlon=' + esc(v.lng) + '#map=15/' + esc(v.lat) + '/' + esc(v.lng) + '">' + esc(v.address || (v.lat.toFixed(3) + ', ' + v.lng.toFixed(3))) + ' ↗</a>';
      case 'long_text': return '<span class="muted">' + esc(String(v).slice(0, 80)) + (String(v).length > 80 ? '…' : '') + '</span>';
    }
    if (typeof v === 'number') return '<span class="num ' + (v < 0 ? 'neg' : '') + '">' + esc(num(v)) + '</span>';
    if (typeof v === 'boolean') return v ? '✓' : '—';
    if (typeof v === 'object' && !Array.isArray(v)) return '<span class="muted">' + esc(v.address || JSON.stringify(v)) + '</span>';
    return esc(Array.isArray(v) ? v.join(', ') : ol(path, v));
  };
  const v = r.view;
  const isNum = (c) => c in r.totals || r.rows.some((row) => typeof row[c] === 'number');
  const types = '<div class="seg">' + r.types.map((t) => '<button class="' + (t === r.type ? 'on' : 'quiet') + '" data-vtype="' + t + '">' + esc(W['vt_' + t]) + '</button>').join('') + '</div>';
  const chips = v.filters.map((f, i) => '<span class="chip">' + esc(fl(f.field)) + ' <small>' + esc(W['op_' + f.op]) + '</small> ' + (['empty', 'not_empty', 'this_month'].includes(f.op) ? '' : esc(ol(f.field, f.value))) + ' <button class="x" data-vdel="' + i + '" aria-label="' + esc(W.remove) + '">✕</button></span>').join('');
  const sortField = v.sort[0] ? v.sort[0].field : '';
  const options = (sel, withNone) => (withNone ? '<option value="">' + esc(W.none) + '</option>' : '') + r.fields.filter((f) => !(f.via && f.path.endsWith('.title')) && f.type !== 'button').map((f) => '<option value="' + esc(f.path) + '"' + (f.path === sel ? ' selected' : '') + '>' + esc(fl(f.path)) + '</option>').join('');
  const bar = '<div class="vbar">' + types +
    '<button class="quiet" data-vfilter>+ ' + esc(W.filter) + '</button>' + chips +
    '<label class="vsel">' + esc(W.sortBy) + ' <select data-vsort>' + options(sortField, true) + '</select></label>' +
    (sortField ? '<button class="quiet" data-vdir>' + (v.sort[0].desc ? '↓' : '↑') + '</button>' : '') +
    (r.type === 'table' ? '<label class="vsel">' + esc(W.groupBy) + ' <select data-vgroup>' + options(v.groupBy || '', true) + '</select></label><button class="quiet" data-vcols>' + esc(W.columns) + '</button>' : '') +
    '<span class="grow"></span>' +
    (st.id ? '<button class="quiet" data-vupdate>' + esc(W.updateView) + '</button>' : '') + '<button class="quiet" data-vsave>' + esc(W.saveView) + '</button></div>';
  const cols = r.columns;
  const line = (row, depth) => '<tr data-go="#/entree/' + esc(row.id) + '">' + cols.map((c) => '<td class="' + (isNum(c) ? 'n' : '') + '">' + (c === 'title' ? '<span style="padding-left:' + ((depth || 0) * 18) + 'px">' + (depth ? '└ ' : '') + esc(row.title) + '</span>' : show(c, row[c], row)) + '</td>').join('') + '</tr>';
  const head = '<tr>' + cols.map((c) => '<th class="sortable ' + (isNum(c) ? 'n' : '') + '" data-vhead="' + esc(c) + '">' + esc(fl(c)) + (c === sortField ? (v.sort[0].desc ? ' ↓' : ' ↑') : '') + '</th>').join('') + '</tr>';
  let body = '';
  if (r.type === 'table' || r.type === 'tree') {
    const total = (rows, label) => Object.keys(r.totals).length ? '<tr class="total">' + cols.map((c, i) => '<td class="' + (isNum(c) ? 'n num' : '') + '">' + (i === 0 ? esc(label) : c in r.totals ? esc(num(rows.reduce((t, x) => t + (typeof x[c] === 'number' ? x[c] : 0), 0))) : '') + '</td>').join('') + '</tr>' : '';
    const rowsHtml = r.type === 'tree' ? r.tree.rows.map((row) => line(row, row.depth)).join('')
      : r.groups ? r.groups.map((g) => '<tr class="group"><td colspan="' + cols.length + '">' + esc(ol(v.groupBy, g.name)) + ' · ' + g.rows.length + '</td></tr>' + g.rows.map((row) => line(row)).join('') + total(g.rows, say(W.subtotal, { group: ol(v.groupBy, g.name) }))).join('')
      : r.rows.map((row) => line(row)).join('');
    body = r.rows.length ? '<div class="scroll"><table class="rows"><thead>' + head + '</thead><tbody>' + rowsHtml + (r.type === 'table' ? total(r.rows, W.total) : '') + '</tbody></table></div>' + (r.truncated ? '<p class="muted">' + esc(W.more) + '</p>' : '') : empty();
  } else if (r.type === 'kanban') {
    body = '<div class="kanban">' + r.kanban.columns.map((c) => '<div class="kcol" data-vdrop="' + esc(c.name) + '"><div class="caps">' + esc(ol(r.kanban.by, c.name)) + ' · ' + c.items.length + '</div>' +
      c.items.map((i) => '<a class="kcard" draggable="true" data-vcard="' + esc(i.id) + '" href="#/entree/' + esc(i.id) + '">' + esc(i.title) + '</a>').join('') + '</div>').join('') + '</div><p class="muted">' + esc(W.dragHint) + '</p>';
  } else if (r.type === 'calendar') {
    const [y, m] = st.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="cday off"></div>');
    for (let d = 1; d <= days; d++) {
      const day = st.month + '-' + String(d).padStart(2, '0');
      const items = r.calendar.items.filter((i) => i.day === day);
      cells.push('<div class="cday' + (day === new Date().toISOString().slice(0, 10) ? ' today' : '') + '"><span class="num muted">' + d + '</span>' + items.map((i) => '<a class="cev" href="#/entree/' + esc(i.id) + '">' + esc(i.title) + '</a>').join('') + '</div>');
    }
    body = '<div class="vbar"><button class="quiet" data-vmonth="-1">←</button><b>' + esc(first.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })) + '</b><button class="quiet" data-vmonth="1">→</button></div>' +
      '<div class="cal">' + W.weekdays.split(',').map((d) => '<div class="caps">' + esc(d) + '</div>').join('') + cells.join('') + '</div>';
  } else if (r.type === 'map') {
    body = r.map.items.length ? '<div id="vmap" class="vmap"></div><p class="muted">' + esc(say(W.mapCount, { n: r.map.items.length, of: r.rows.length })) + '</p>' : empty(W.mapEmpty);
  } else if (r.type === 'gallery') {
    body = '<div class="gallery">' + r.gallery.items.map((i) => '<a class="gcard" href="#/entree/' + esc(i.id) + '"><div class="gimg">' + (i.file ? '<img alt="" loading="lazy" src="/api/files/' + esc(encodeURIComponent(i.file)) + '?space=' + esc(encodeURIComponent(space)) + '" onerror="this.remove()">' : '') + '<span>' + esc(i.title.slice(0, 2).toUpperCase()) + '</span></div><div class="gmeta">' + esc(i.title) + '</div></a>').join('') + '</div>';
  } else if (r.type === 'timeline') {
    const items = r.timeline.items;
    if (!items.length) body = empty();
    else {
      const dayN = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
      const lo = Math.min(...items.map((i) => dayN(i.start))), hi = Math.max(...items.map((i) => dayN(i.end))) + 1;
      const span = Math.max(1, hi - lo);
      const pct = (n) => ((n - lo) / span) * 100;
      const months = [];
      for (let n = lo; n < hi; n++) { const d = new Date(n * 86400000); if (d.getUTCDate() === 1 || n === lo) months.push('<span style="left:' + pct(n) + '%">' + esc(d.toLocaleDateString(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' })) + '</span>'); }
      const today = dayN(new Date().toISOString().slice(0, 10));
      body = '<div class="tl"><div class="tl-head"><span></span><div class="tl-scale">' + months.join('') + (today >= lo && today < hi ? '<i class="tl-now" style="left:' + pct(today) + '%"></i>' : '') + '</div></div>' +
        items.map((i) => '<div class="tl-row"><a class="link" href="#/entree/' + esc(i.id) + '">' + esc(i.title) + '</a><div class="tl-track"><a class="tl-bar" href="#/entree/' + esc(i.id) + '" title="' + esc(i.start + ' → ' + i.end) + '" style="left:' + pct(dayN(i.start)) + '%;width:' + Math.max(0.8, pct(dayN(i.end) + 1) - pct(dayN(i.start))) + '%"></a></div></div>').join('') + '</div>';
    }
  }
  return { r, html: bar + body };
}

// The map of a view: OpenStreetMap tiles through Leaflet, loaded the first time a map is opened.
let leaflet = null;
function ensureLeaflet() {
  if (leaflet) return leaflet;
  leaflet = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve(window.L); js.onerror = reject;
    document.head.appendChild(js);
  });
  return leaflet;
}
async function drawMap() {
  const el = document.getElementById('vmap');
  if (!el || !explorerNow || !explorerNow.r.map) return;
  const L = await ensureLeaflet();
  const map = L.map(el, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  const items = explorerNow.r.map.items;
  const marks = items.map((i) => L.circleMarker([i.lat, i.lng], { radius: 7, color: '#b83a1b', weight: 2, fillOpacity: 0.8 })
    .bindPopup('<b>' + esc(i.title) + '</b>' + (i.address ? '<br>' + esc(i.address) : '') + '<br><a href="#/entree/' + esc(i.id) + '">' + esc(W.open) + ' →</a>').addTo(map));
  map.fitBounds(L.featureGroup(marks).getBounds().pad(0.2), { maxZoom: 14 });
}
`;
