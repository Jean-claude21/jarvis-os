import type { DrawnPage } from '@jarvis-os/core';
import { viewPage } from './base';
import { viewWords } from './words';

// An app's page (spec 014): its filters and blocks, drawn from what the core computed. The same
// view is shown inside Claude (MCP Apps: a filter or a gesture calls the tools `page` and `save`)
// and framed in her web account (it calls the REST API with her session).

const css = `
a { color: var(--primary); text-decoration: none; } a:hover { text-decoration: underline; }
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
.filters label { display: flex; gap: 6px; align-items: center; }
input, select { font: inherit; padding: 6px 8px; border: 1px solid var(--rule-strong); border-radius: 2px; background: var(--paper); color: var(--ink); }
.tl { display: grid; gap: 4px; } .tl-row { display: grid; grid-template-columns: minmax(110px, 28%) 1fr; gap: 10px; align-items: center; }
.tl-track { position: relative; height: 18px; background: var(--sand); } .tl-bar { position: absolute; top: 3px; bottom: 3px; background: var(--ink); border-radius: 2px; }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; } .gcard { border: 1px solid var(--rule); color: var(--ink); text-decoration: none; }
.gimg { aspect-ratio: 4 / 3; background: var(--clay); display: grid; place-items: center; font: 700 22px Archivo, sans-serif; color: var(--bark); } .gmeta { padding: 6px 8px; font-weight: 600; }
.delta.up { color: var(--error); } .delta.down { color: var(--success); }
.bars { display: grid; gap: 7px; }
.bar { display: grid; grid-template-columns: minmax(70px, 34%) 1fr auto; gap: 10px; align-items: center; }
/* The validated design (docs/design/jarvis.html): panels with a sand head, KPIs, thin status bars. */
.card { background: var(--sand); padding: 0; display: flex; flex-direction: column; }
.card > h2 { font: 600 11px/1.4 Archivo, system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: var(--bark); padding: 10px 12px; margin: 0; }
.card > .body { background: var(--paper); border-top: 1px solid var(--rule); padding: 14px 16px; flex: 1; min-width: 0; }
.kpi { font: 600 26px/1.15 "JetBrains Mono", ui-monospace, monospace; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi small { font-size: 13px; font-weight: 500; color: var(--bark); margin-left: 4px; }
.kpi-sub { color: var(--bark); font-size: 12.5px; margin-top: 4px; }
.card.alert { border-color: var(--verify); } .card.alert > h2 { color: var(--verify); } .card.alert > .body { background: var(--verify-surface); }
.bar .track, .gauge .track { height: 6px; background: var(--clay); border-radius: 1px; overflow: hidden; }
.bar .fill, .gauge .fill { height: 100%; background: var(--ink); border-radius: 1px; }
.gauge { margin: 6px 0 12px; } .gauge .fill.ok { background: var(--success); } .gauge .fill.warn { background: var(--ochre); } .gauge .fill.over { background: var(--error); }
.gauge .top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.share { display: flex; height: 16px; gap: 2px; border-radius: 2px; overflow: hidden; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; font-size: 12px; color: var(--bark); }
.legend i { display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; vertical-align: -1px; }
.heat { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.heat span { aspect-ratio: 1; border-radius: 2px; background: var(--clay); }
.heat span.on { background: var(--success); }
.kanban { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(150px, 1fr); gap: 10px; overflow-x: auto; }
.kanban .col { background: var(--sand); border: 1px solid var(--rule); padding: 8px; min-height: 60px; }
.kanban .item { background: var(--paper); border: 1px solid var(--rule); padding: 6px 8px; margin-top: 6px; }
.task { display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px dotted var(--rule); }
.form-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.form-grid label { display: grid; gap: 4px; font-size: 12px; color: var(--bark); }
tr.go { cursor: pointer; } tr.go:hover td { background: var(--sand); }
tr.total td { font-weight: 600; border-top: 1px solid var(--rule-strong); }
.field-row { display: grid; grid-template-columns: minmax(90px, 30%) 1fr auto; gap: 10px; padding: 6px 0; border-bottom: 1px dotted var(--rule); }
`;

const script = `
document.head.insertAdjacentHTML('beforeend', '<style>${css.replace(/\n/g, ' ').replace(/'/g, "\\'")}</style>');
const SERIES = ['var(--primary)', 'var(--ochre)', 'var(--info)', 'var(--success)', 'var(--bark)', 'var(--ember)'];
let current = null;
// Technical names stay English; what she reads comes from the models' labels, in her language.
const lang = () => (words === WORDS.en ? 'en' : 'fr');
const tr = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[lang()] || v.en || v.fr || '' : v);
const vocab = (kind) => (current && current.vocabulary && kind && current.vocabulary[kind]) || null;
const fieldLabel = (kind, name) => { const f = vocab(kind) && vocab(kind).fields[name]; return f && f.label ? tr(f.label) : name; };
const optionLabel = (kind, name, value) => { const f = vocab(kind) && vocab(kind).fields[name]; return f && typeof value === 'string' && f.options[value] ? tr(f.options[value]) : value; };
const numeric = (v) => typeof v === 'number' && isFinite(v);
const fmt = (v) => numeric(v) ? new Intl.NumberFormat(words === WORDS.en ? 'en' : 'fr', { maximumFractionDigits: 2 }).format(v) : (v == null || v === '' ? '—' : esc(Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v));
const framed = () => !host.inside || (current && current.frame);
async function reload(params) {
  if (!current) return;
  const next = Object.assign({}, current.params, params || {});
  if (framed()) {
    const q = new URLSearchParams(Object.assign({ space: current.spaceId }, next));
    const res = await fetch('/api/pages/' + encodeURIComponent(current.id) + '?' + q, { credentials: 'same-origin' });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || res.status);
    render(Object.assign(data, { frame: true }));
  } else {
    render(await callTool('page', { id: current.id, params: next }));
  }
}
async function saveEntries(entries) {
  if (framed()) {
    const res = await fetch('/api/save?space=' + encodeURIComponent(current.spaceId), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || res.status);
    return data;
  }
  return callTool('save', { entries, space: current.spaceId });
}
function open(id) {
  if (framed() && window.parent !== window) { try { window.parent.location.hash = '#/entree/' + id; return; } catch {} }
  if (!framed()) tellModel(say(words.opened, { id }), { id });
}
function card(b, inner, wide, tone) {
  return '<article class="card' + (wide ? ' wide' : '') + (tone ? ' ' + tone : '') + '">' + (b.title ? '<h2>' + esc(tr(b.title)) + '</h2>' : '') + '<div class="body">' + inner + '</div></article>';
}
const figure = (b) => '<div class="kpi">' + fmt(b.value) + (b.unit ? '<small>' + esc(b.unit) + '</small>' : '') + '</div>';
function table(columns, rows, extra, kind) {
  if (!rows.length) return '<p class="empty">' + esc(words.empty) + '</p>';
  const nums = columns.map((c) => rows.every((r) => r[c] == null || numeric(r[c])));
  return '<div class="scroll"><table><thead><tr>' + columns.map((c, i) => '<th class="' + (nums[i] ? 'n' : '') + '">' + esc(c === 'title' ? words.titleCol : c === 'group' ? '' : fieldLabel(kind, c)) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr class="' + (r.id ? 'go' : '') + '"' + (r.id ? ' data-open="' + esc(r.id) + '"' : '') + '>' + columns.map((c, i) => '<td class="' + (nums[i] ? 'n num' : '') + '">' + fmt(optionLabel(kind, c, r[c])) + '</td>').join('') + '</tr>').join('') + (extra || '') + '</tbody></table></div>';
}
const draw = {
  stat: (b) => card(b, figure(b), false, numeric(b.value) && b.value < 0 ? 'alert' : ''),
  stat_delta: (b) => card(b, figure(b) +
    (b.delta == null ? '<div class="kpi-sub">' + esc(words.noCompare) + '</div>' : '<div class="kpi-sub delta ' + (b.delta > 0 ? 'up' : 'down') + '">' + (b.delta > 0 ? '↑ ' : '↓ ') + fmt(Math.abs(b.delta)) + ' % ' + esc(say(words.vsPrevious, { value: fmt(b.previous) })) + '</div>')),
  gauge: (b) => card(b, b.items.length ? b.items.map((g) => { const p = numeric(g.max) && g.max > 0 && numeric(g.value) ? g.value / g.max * 100 : 0;
    return '<div class="gauge"><div class="top"><span>' + fmt(g.label) + '</span><span class="num">' + fmt(g.value) + ' / ' + fmt(g.max) + '</span></div><div class="track"><div class="fill ' + (p > 100 ? 'over' : p >= 80 ? 'warn' : 'ok') + '" style="width:' + Math.min(100, Math.max(1, p)) + '%"></div></div></div>'; }).join('') : '<p class="empty">' + esc(words.empty) + '</p>'),
  bar: (b) => { const max = Math.max(1, ...b.points.map((p) => Math.abs(p.value)));
    return card(b, b.points.length ? '<div class="bars">' + b.points.map((p) => '<div class="bar"><span>' + fmt(b.groupField ? optionLabel(b.kind, b.groupField, p.label) : p.label) + '</span><span class="track"><span class="fill" style="display:block;width:' + Math.max(1, Math.abs(p.value) / max * 100) + '%"></span></span><span class="num">' + fmt(p.value) + '</span></div>').join('') + '</div>' : '<p class="empty">' + esc(words.empty) + '</p>'); },
  breakdown: (b) => { const total = b.points.reduce((t, p) => t + Math.max(0, p.value), 0) || 1;
    return card(b, b.points.length ? '<div class="share">' + b.points.map((p, i) => '<span style="flex:' + Math.max(0, p.value) + ';background:' + SERIES[i % SERIES.length] + '"></span>').join('') + '</div><div class="legend">' +
      b.points.map((p, i) => '<span><i style="background:' + SERIES[i % SERIES.length] + '"></i>' + fmt(b.groupField ? optionLabel(b.kind, b.groupField, p.label) : p.label) + ' ' + Math.round(Math.max(0, p.value) / total * 100) + ' %</span>').join('') + '</div>' : '<p class="empty">' + esc(words.empty) + '</p>', true); },
  line: (b) => {
    // Several series when the query gives several numbers (spec 016): entrées and sorties side by side.
    const series = b.series && b.series.length ? b.series : [{ name: '', points: b.points }];
    const labels = series[0].points.map((p) => p.label);
    if (labels.length < 2) return draw.bar(b);
    const all = series.flatMap((s) => s.points.map((p) => p.value));
    const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1, min = lo - pad, span = hi + pad - min;
    const W = 600, H = 180, px = (i) => 10 + i * (W - 20) / (labels.length - 1), py = (x) => 12 + (1 - (x - min) / span) * (H - 36);
    const lines = series.map((s, n) => '<polyline fill="none" stroke="' + SERIES[n % SERIES.length] + '" stroke-width="2.5" points="' + s.points.map((p, i) => px(i).toFixed(1) + ',' + py(p.value).toFixed(1)).join(' ') + '"/>' +
      s.points.map((p, i) => '<circle cx="' + px(i) + '" cy="' + py(p.value) + '" r="3" fill="' + SERIES[n % SERIES.length] + '"><title>' + esc((s.name ? s.name + ' · ' : '') + p.label) + ' : ' + fmt(p.value) + '</title></circle>').join('')).join('');
    return card(b, '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(tr(b.title) || '') + '">' + lines +
      '<text x="10" y="' + (H - 6) + '">' + esc(labels[0]) + '</text><text x="' + (W - 10) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(labels[labels.length - 1]) + '</text></svg>' +
      (series.length > 1 ? '<div class="legend">' + series.map((s, n) => '<span><i style="background:' + SERIES[n % SERIES.length] + '"></i>' + esc(fieldLabel(b.kind, s.name)) + '</span>').join('') + '</div>' : ''), true);
  },
  view: (b) => {
    // A view inside a page (spec 016).
    const r = b.result;
    const head = (cols) => cols.map((c) => c === 'title' ? words.titleCol : fieldLabel(b.kind, c));
    if (r.type === 'kanban') return draw.kanban({ title: b.title, kind: b.kind, by: r.kanban.by, columns: r.kanban.columns });
    if (r.type === 'calendar' || r.type === 'timeline') {
      const items = r.type === 'calendar' ? r.calendar.items.map((i) => ({ id: i.id, title: i.title, start: i.day, end: i.day })) : r.timeline.items;
      if (!items.length) return card(b, '<p class="empty">' + esc(words.empty) + '</p>', true);
      const dayN = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
      const lo = Math.min(...items.map((i) => dayN(i.start))), hi = Math.max(...items.map((i) => dayN(i.end))) + 1, span = Math.max(1, hi - lo);
      const pct = (n) => ((n - lo) / span) * 100;
      return card(b, '<div class="tl">' + items.map((i) => '<div class="tl-row"><a href="#" data-open="' + esc(i.id) + '">' + esc(i.title) + '</a><div class="tl-track"><span class="tl-bar" title="' + esc(i.start + ' → ' + i.end) + '" style="left:' + pct(dayN(i.start)) + '%;width:' + Math.max(0.8, pct(dayN(i.end) + 1) - pct(dayN(i.start))) + '%"></span></div></div>').join('') + '</div><div class="muted" style="margin-top:6px">' + esc(items[0].start + ' → ' + new Date((hi - 1) * 86400000).toISOString().slice(0, 10)) + '</div>', true);
    }
    if (r.type === 'map') {
      const pts = r.map.items;
      if (!pts.length) return card(b, '<p class="empty">' + esc(words.empty) + '</p>', true);
      const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
      const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lngs), lo1 = Math.max(...lngs);
      const x = (lng) => 30 + ((lng - lo0) / ((lo1 - lo0) || 1)) * 540, y = (lat) => 20 + (1 - (lat - la0) / ((la1 - la0) || 1)) * 200;
      return card(b, '<svg viewBox="0 0 600 240" width="100%" role="img" aria-label="' + esc(tr(b.title) || '') + '"><rect width="600" height="240" fill="var(--clay)"/>' +
        pts.map((p) => '<g><circle cx="' + x(p.lng) + '" cy="' + y(p.lat) + '" r="6" fill="var(--primary)"/><text x="' + (x(p.lng) + 9) + '" y="' + (y(p.lat) + 4) + '" fill="var(--ink)">' + esc(p.title) + '</text></g>').join('') + '</svg>', true);
    }
    if (r.type === 'gallery') return card(b, '<div class="gallery">' + r.gallery.items.map((i) => '<a href="#" data-open="' + esc(i.id) + '" class="gcard"><div class="gimg"><span>' + esc(i.title.slice(0, 2).toUpperCase()) + '</span></div><div class="gmeta">' + esc(i.title) + '</div></a>').join('') + '</div>', true);
    const rows = r.type === 'tree' ? r.tree.rows.map((row) => Object.assign({}, row, { title: '\u00a0'.repeat(row.depth * 4) + (row.depth ? '└ ' : '') + row.title })) : r.rows;
    return card(b, table(r.columns, rows, '', b.kind), true);
  },
  heatmap: (b) => card(b, '<div class="heat">' + b.cells.map((c) => '<span class="' + (c.done ? 'on' : '') + '" title="' + esc(c.day) + '"></span>').join('') + '</div><div class="muted" style="margin-top:6px">' + esc(say(words.daysDone, { n: b.done, of: b.cells.length })) + '</div>'),
  table: (b) => card(b, table(b.columns, b.rows, (b.total ? '<tr class="total">' + b.columns.map((c, i) => '<td class="' + (c === b.total ? 'n num' : '') + '">' + (i === 0 ? esc(words.total) : c === b.total ? fmt(b.totalValue) : '') + '</td>').join('') + '</tr>' : ''), b.kind), true),
  task_list: (b) => card(b, b.items.length ? b.items.map((t) => '<div class="task"><span><a href="#" data-open="' + esc(t.id) + '">' + esc(t.title) + '</a>' + (t.detail != null ? ' <span class="muted">· ' + fmt(t.detail) + '</span>' : '') + '</span><button class="quiet" data-set="' + esc(t.id) + '" data-block="' + current.blocks.indexOf(b) + '">' + esc(b.action.label) + '</button></div>').join('') : '<p class="empty">' + esc(words.allDone) + '</p>'),
  kanban: (b) => card(b, '<div class="kanban">' + b.columns.map((c) => '<div class="col"><div class="caps">' + esc(optionLabel(b.kind, b.by, c.name)) + ' · ' + c.items.length + '</div>' + c.items.map((i) => '<div class="item"><a href="#" data-open="' + esc(i.id) + '">' + esc(i.title) + '</a></div>').join('') + '</div>').join('') + '</div>', true),
  calendar: (b) => card(b, b.occurrences.length ? '<ul class="list">' + b.occurrences.map((o) => '<li><span>' + esc(o.title) + ' <span class="muted">· ' + esc(o.kind) + '</span></span><span class="num muted">' + esc(new Date(o.start).toLocaleString(words === WORDS.en ? 'en' : 'fr', o.allDay ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</span></li>').join('') + '</ul>' : '<p class="empty">' + esc(words.empty) + '</p>'),
  form: (b) => card(b, '<form data-form="' + current.blocks.indexOf(b) + '"><div class="form-grid"><label>' + esc(words.titleCol) + ' *<input name="__title" required></label>' +
    b.fields.map((f) => '<label>' + esc(fieldLabel(b.kind, f.name) + (f.required ? ' *' : '') + (f.unit ? ' · ' + f.unit : '')) +
      (f.type === 'choice' ? '<select name="' + esc(f.name) + '"><option value=""></option>' + f.options.map((o) => '<option value="' + esc(o) + '">' + esc(optionLabel(b.kind, f.name, o)) + '</option>').join('') + '</select>'
        : f.type === 'boolean' ? '<select name="' + esc(f.name) + '"><option value=""></option><option value="true">✓</option><option value="false">—</option></select>'
        : '<input name="' + esc(f.name) + '" placeholder="' + esc(f.type === 'link' ? words.linkHint : '') + '" type="' + (f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : ['number', 'amount'].includes(f.type) ? 'number' : 'text') + '" step="any">') + '</label>').join('') +
    '</div><p class="error-text" data-error></p><button>' + esc(words.add) + '</button></form>', true),
  sql: (b) => {
    // Raw rows: the first column names each point, the first number column gives its value.
    const x = b.columns[0];
    const y = b.columns.find((c) => b.rows.some((r) => numeric(r[c]) || (r[c] !== null && r[c] !== '' && !isNaN(Number(r[c])))));
    const points = y ? b.rows.map((r) => ({ label: r[x], value: Number(r[y]) || 0 })) : [];
    if (b.chart === 'number') return draw.stat({ title: b.title, value: y && b.rows[0] ? Number(b.rows[0][y]) : null });
    if ((b.chart === 'bar' || b.chart === 'line') && y) return draw[b.chart]({ title: b.title, points });
    return card(b, table(b.columns, b.rows), true);
  },
  record: (b) => { const r = b.record; if (!r) return card(b, '<p class="empty">' + esc(words.empty) + '</p>', true);
    // Under the entry's own page, its fields are already shown: only what belongs to it.
    const own = String(current.id).startsWith('record:') ? [] : r.fields;
    return card(b, own.map((f) => '<div class="field-row"><span class="caps">' + esc(fieldLabel(r.kind, f.name)) + '</span><span class="' + (numeric(f.value) ? 'num' : '') + '">' + fmt(optionLabel(r.kind, f.name, f.value)) + '</span><span>' + (f.computed ? '<span class="badge">' + esc(words.computed) + '</span>' : '') + '</span></div>').join('') +
      r.relations.map((rel) => '<h2 style="margin-top:14px">' + esc(rel.name) + ' · ' + rel.rows.length + '</h2>' + table(rel.columns, rel.rows, '', rel.kind)).join(''), true); },
};
function render(data) {
  const root = document.getElementById('root');
  if (!data || !data.blocks) { root.innerHTML = '<p class="empty">' + esc(words.nothing) + '</p>'; return; }
  current = data;
  const filters = data.filters.length ? '<div class="filters">' + data.filters.map((f) => '<label><span class="caps">' + esc(tr(f.label) || f.name) + '</span>' +
    (f.type === 'month' ? '<input type="month" data-filter="' + esc(f.name) + '" value="' + esc(f.value) + '">'
      : f.type === 'choice' ? '<select data-filter="' + esc(f.name) + '">' + (f.options || []).map((o) => '<option' + (o === f.value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>'
      : '<input data-filter="' + esc(f.name) + '" value="' + esc(f.value) + '">') + '</label>').join('') + '</div>' : '';
  // A record page is framed under the entry's own title: no second one.
  const head = String(data.id).startsWith('record:') ? '' : '<header class="head"><div>' + (data.app ? '<div class="caps">' + esc(data.app) + '</div>' : '') + '<h1>' + esc(tr(data.label) || data.title) + '</h1></div></header>';
  root.innerHTML = head + filters +
    '<section class="grid">' + data.blocks.map((b) => b.error ? card(b, '<p class="error-text">' + esc(say(words.failed, { reason: b.error })) + '</p>') : (draw[b.block] ? draw[b.block](b) : '')).join('') + '</section>';
  root.querySelectorAll('[data-filter]').forEach((el) => el.addEventListener('change', () => reload({ [el.dataset.filter]: el.value }).catch((e) => alert(e.message))));
  root.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', (event) => { event.preventDefault(); open(el.dataset.open); }));
  root.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('click', async () => {
    el.disabled = true;
    try { await saveEntries([{ id: el.dataset.set, data: current.blocks[Number(el.dataset.block)].action.set }]); await reload(); }
    catch (e) { el.disabled = false; alert(e.message); }
  }));
  root.querySelectorAll('[data-form]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const b = current.blocks[Number(form.dataset.form)];
    const data = {};
    for (const f of b.fields) {
      const v = form.elements[f.name] && form.elements[f.name].value;
      if (!v) continue;
      data[f.name] = ['number', 'amount'].includes(f.type) ? Number(v) : f.type === 'boolean' ? v === 'true' : v;
    }
    try { await saveEntries([{ kind: b.kind, title: form.elements.__title.value.trim(), data }]); await reload(); }
    catch (e) { form.querySelector('[data-error]').textContent = e.message; }
  }));
}
start(render);
`;

/** The page view (`ui://jarvis/page`); framed in her account with `frame` set. */
export const pageView = (data?: DrawnPage & { frame?: boolean }) =>
  viewPage({ title: 'Jarvis — page', words: viewWords.page, script, ...(data ? { data } : {}) });

/** What a model (or a host without views) reads of a page: each block, briefly. */
export function pageText(page: DrawnPage): string {
  return [
    `# ${page.title}${page.app ? ` (${page.app})` : ''} — ${JSON.stringify(page.params)}`,
    ...page.blocks.map((block) => {
      const { block: type, title, error, ...rest } = block;
      return `## ${title ?? type} (${type})\n${error ? `error: ${error}` : JSON.stringify(rest).slice(0, 2000)}`;
    }),
  ].join('\n\n');
}
