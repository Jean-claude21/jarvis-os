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
.delta.up { color: var(--error); } .delta.down { color: var(--success); }
.bars { display: grid; gap: 7px; }
.bar { display: grid; grid-template-columns: minmax(70px, 34%) 1fr auto; gap: 10px; align-items: center; }
.bar .track, .gauge .track { height: 12px; background: var(--clay); border-radius: 2px; overflow: hidden; }
.bar .fill, .gauge .fill { height: 100%; background: var(--primary); }
.gauge { margin: 8px 0 12px; } .gauge .fill.over { background: var(--error); }
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
function card(b, inner, wide) {
  return '<article class="card' + (wide ? ' wide' : '') + '">' + (b.title ? '<h2>' + esc(tr(b.title)) + '</h2>' : '') + inner + '</article>';
}
function table(columns, rows, extra, kind) {
  if (!rows.length) return '<p class="empty">' + esc(words.empty) + '</p>';
  const nums = columns.map((c) => rows.every((r) => r[c] == null || numeric(r[c])));
  return '<div class="scroll"><table><thead><tr>' + columns.map((c, i) => '<th class="' + (nums[i] ? 'n' : '') + '">' + esc(c === 'title' ? words.titleCol : c === 'group' ? '' : fieldLabel(kind, c)) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr class="' + (r.id ? 'go' : '') + '"' + (r.id ? ' data-open="' + esc(r.id) + '"' : '') + '>' + columns.map((c, i) => '<td class="' + (nums[i] ? 'n num' : '') + '">' + fmt(optionLabel(kind, c, r[c])) + '</td>').join('') + '</tr>').join('') + (extra || '') + '</tbody></table></div>';
}
const draw = {
  stat: (b) => card(b, '<div class="kpi">' + fmt(b.value) + (b.unit ? ' <span class="muted" style="font-size:14px">' + esc(b.unit) + '</span>' : '') + '</div>'),
  stat_delta: (b) => card(b, '<div class="kpi">' + fmt(b.value) + (b.unit ? ' <span class="muted" style="font-size:14px">' + esc(b.unit) + '</span>' : '') + '</div>' +
    (b.delta == null ? '<div class="muted">' + esc(words.noCompare) + '</div>' : '<div class="delta ' + (b.delta > 0 ? 'up' : 'down') + '">' + (b.delta > 0 ? '↑ ' : '↓ ') + fmt(Math.abs(b.delta)) + ' % ' + esc(say(words.vsPrevious, { value: fmt(b.previous) })) + '</div>')),
  gauge: (b) => card(b, b.items.length ? b.items.map((g) => { const p = numeric(g.max) && g.max > 0 && numeric(g.value) ? g.value / g.max * 100 : 0;
    return '<div class="gauge"><div class="top"><span>' + fmt(g.label) + '</span><span class="num">' + fmt(g.value) + ' / ' + fmt(g.max) + '</span></div><div class="track"><div class="fill' + (p > 100 ? ' over' : '') + '" style="width:' + Math.min(100, Math.max(1, p)) + '%"></div></div></div>'; }).join('') : '<p class="empty">' + esc(words.empty) + '</p>'),
  bar: (b) => { const max = Math.max(1, ...b.points.map((p) => Math.abs(p.value)));
    return card(b, b.points.length ? '<div class="bars">' + b.points.map((p) => '<div class="bar"><span>' + fmt(b.groupField ? optionLabel(b.kind, b.groupField, p.label) : p.label) + '</span><span class="track"><span class="fill" style="display:block;width:' + Math.max(1, Math.abs(p.value) / max * 100) + '%"></span></span><span class="num">' + fmt(p.value) + '</span></div>').join('') + '</div>' : '<p class="empty">' + esc(words.empty) + '</p>'); },
  breakdown: (b) => { const total = b.points.reduce((t, p) => t + Math.max(0, p.value), 0) || 1;
    return card(b, b.points.length ? '<div class="share">' + b.points.map((p, i) => '<span style="flex:' + Math.max(0, p.value) + ';background:' + SERIES[i % SERIES.length] + '"></span>').join('') + '</div><div class="legend">' +
      b.points.map((p, i) => '<span><i style="background:' + SERIES[i % SERIES.length] + '"></i>' + fmt(b.groupField ? optionLabel(b.kind, b.groupField, p.label) : p.label) + ' ' + Math.round(Math.max(0, p.value) / total * 100) + ' %</span>').join('') + '</div>' : '<p class="empty">' + esc(words.empty) + '</p>', true); },
  line: (b) => { const v = b.points.map((p) => p.value); if (v.length < 2) return draw.bar(b);
    const lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1, min = lo - pad, span = hi + pad - min;
    const W = 600, H = 180, px = (i) => 10 + i * (W - 20) / (v.length - 1), py = (x) => 12 + (1 - (x - min) / span) * (H - 36);
    return card(b, '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(b.title || '') + '"><polyline fill="none" stroke="var(--primary)" stroke-width="2.5" points="' + v.map((x, i) => px(i).toFixed(1) + ',' + py(x).toFixed(1)).join(' ') + '"/>' +
      v.map((x, i) => '<circle cx="' + px(i) + '" cy="' + py(x) + '" r="3.5" fill="var(--primary)"><title>' + esc(b.points[i].label) + ' : ' + fmt(x) + '</title></circle>').join('') +
      '<text x="10" y="' + (H - 6) + '">' + esc(b.points[0].label) + '</text><text x="' + (W - 10) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(b.points[v.length - 1].label) + '</text></svg>', true); },
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
