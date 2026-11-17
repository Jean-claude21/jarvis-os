// Spec 084 — the views of an app, as tabs: beside its pages and its saved views, a Calendrier (its
// dated things on a month), a Frise (from a start to an end, over three months), its Fichiers (the
// files linked to its entries) and its Activité (the journal of its entries); « + » keeps a new
// view (a list, a board, a calendar or a timeline of one of its kinds).
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no backticks, no dollar-brace, and no backslashes.

export const v2AppViews = `
const AV_COLORS = ['#2f6f5e', '#b5562c', '#4a5fa8', '#8a5a9e', '#a8862a', '#3b8ea5', '#9e4a5a'];
const AV_TABS = ['calendrier', 'frise', 'fichiers', 'activite'];
const avDay = (d) => d.toLocaleDateString('en-CA');
const avHm = (d) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
const avFields = (k, types) => ((k.model && k.model.fields) || []).filter((f) => types.includes(f.type));
const avDated = (k) => avFields(k, ['date', 'datetime']);
const avWhen = (v) => {
  if (!v) return null;
  const s = String(v);
  const d = s.length <= 10 ? new Date(s.slice(0, 10) + 'T12:00:00') : new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const avMonth = (params) => {
  const p = String(params.get('m') || '').split('-').map(Number);
  const now = new Date();
  return p.length === 2 && p[0] > 2000 && p[1] >= 1 && p[1] <= 12 ? new Date(p[0], p[1] - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
};
const avKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

// The tabs it adds to an app's bar: the dated ones only when one of its kinds has a date.
function appViewTabs(name, models, current) {
  const href = '#/app/' + esc(encodeURIComponent(name)) + '?tab=';
  const dated = models.some((k) => avDated(k).length);
  return [['calendrier', W.avCalendar, dated], ['frise', W.avTimeline, dated], ['fichiers', W.avFiles, true], ['activite', W.avActivity, true]]
    .filter((t) => t[2]).map((t) => '<a href="' + href + t[0] + '"' + (current === t[0] ? ' aria-current="page"' : '') + '>' + esc(t[1]) + '</a>').join('');
}

// Its dated entries: one item per date it holds, coloured by its kind.
async function avItems(models) {
  const dated = models.filter((k) => avDated(k).length);
  const lists = await Promise.all(dated.map((k) => api(inSpace('/entries?kind=' + encodeURIComponent(k.kind) + '&limit=200')).catch(() => [])));
  const colorOf = {};
  models.forEach((k, i) => { colorOf[k.kind] = AV_COLORS[i % AV_COLORS.length]; });
  const items = [];
  dated.forEach((k, i) => lists[i].forEach((e) => {
    const dates = avDated(k).map((f) => ({ field: f.name, at: avWhen(e.data[f.name]), timed: f.type === 'datetime' })).filter((x) => x.at);
    if (dates.length) items.push({ id: e.id, title: e.title, kind: k.kind, color: colorOf[k.kind], dates });
  }));
  return { items, colorOf, dated };
}

const avLegend = (dated, colorOf) => '<div class="av-legend">' + dated.map((k) => '<span><i style="background:' + colorOf[k.kind] + '"></i>' + esc(kindName(k.kind)) + ' <small>' + esc(avDated(k).map((f) => f.name).join(', ')) + '</small></span>').join('') + '</div>';

function avBar(name, tab, anchor, label, step) {
  const at = (n) => '#/app/' + esc(encodeURIComponent(name)) + '?tab=' + tab + '&m=' + avKey(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
  return '<div class="av-bar"><div class="av-nav"><a class="btn" href="' + at(-step) + '" aria-label="' + esc(W.avPrev) + '">' + ic('i-left') + '</a>' +
    '<a class="btn" href="#/app/' + esc(encodeURIComponent(name)) + '?tab=' + tab + '">' + esc(W.avToday) + '</a>' +
    '<a class="btn" href="' + at(step) + '" aria-label="' + esc(W.avNext) + '">' + ic('i-right') + '</a></div><b class="av-title">' + esc(label) + '</b></div>';
}

async function avCalendar(name, models, params) {
  const anchor = avMonth(params);
  const { items, colorOf, dated } = await avItems(models);
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - ((anchor.getDay() + 6) % 7));
  const byDay = {};
  items.forEach((it) => it.dates.forEach((d) => { const k = avDay(d.at); (byDay[k] = byDay[k] || []).push({ it, d }); }));
  const todayKey = avDay(new Date());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const k = avDay(d);
    const here = (byDay[k] || []).sort((a, b) => a.d.at - b.d.at);
    cells.push('<div class="md' + (d.getMonth() === anchor.getMonth() ? '' : ' out') + (k === todayKey ? ' today' : '') + '"><span class="d">' + d.getDate() + '</span>' +
      here.slice(0, 3).map((x) => '<a class="ag-chip" href="#/entree/' + esc(x.it.id) + '" style="--c:' + x.it.color + '" title="' + esc(x.it.title + ' · ' + x.d.field) + '">' + (x.d.timed ? '<time>' + esc(avHm(x.d.at)) + '</time>' : '') + '<span>' + esc(x.it.title) + '</span></a>').join('') +
      (here.length > 3 ? '<span class="ag-more">+' + (here.length - 3) + '<span class="w">' + esc(W.agMoreWord) + '</span></span>' : '') + '</div>');
  }
  const names = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 9 + i).toLocaleDateString(locale, { weekday: 'short' }));
  const label = anchor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const inMonth = Object.keys(byDay).filter((k) => k.slice(0, 7) === avKey(anchor)).sort();
  const list = inMonth.length ? '<div class="av-mlist">' + inMonth.map((k) => '<div class="av-mday"><b>' + esc(new Date(k + 'T12:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })) + '</b><span>' +
    byDay[k].map((x) => '<a class="ag-chip" href="#/entree/' + esc(x.it.id) + '" style="--c:' + x.it.color + '"><span>' + esc(x.it.title) + '</span><small>' + esc(x.d.field) + '</small></a>').join('') + '</span></div>').join('') + '</div>' : '';
  return '<section class="panel av-panel">' + avBar(name, 'calendrier', anchor, label, 1) +
    '<div class="x-month">' + names.map((d) => '<div class="mh">' + esc(d) + '</div>').join('') + cells.join('') + '</div>' + list + avLegend(dated, colorOf) + '</section>';
}

// From a start to an end (its first two dates), over three months; one without an end is a point.
async function avTimeline(name, models, params) {
  const anchor = avMonth(params);
  const ws = anchor.getTime();
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 3, 1);
  const we = end.getTime();
  const span = we - ws;
  const { items, colorOf, dated } = await avItems(models);
  const rows = items.map((it) => {
    const s = it.dates[0].at.getTime();
    const e = it.dates[1] && it.dates[1].at.getTime() > s ? it.dates[1].at.getTime() : null;
    return { it, s, e };
  }).filter((r) => r.s < we && (r.e || r.s) >= ws).sort((a, b) => a.s - b.s);
  const pct = (t) => Math.max(0, Math.min(100, (t - ws) / span * 100));
  const months = [0, 1, 2].map((n) => new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
  const now = Date.now();
  const today = now >= ws && now < we ? '<i class="av-now" style="left:' + pct(now).toFixed(2) + '%"></i>' : '';
  const shown = rows.slice(0, 60);
  const fmt = (t) => new Date(t).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const line = (r) => {
    const left = pct(r.s);
    const bar = r.e ? '<a class="av-span" href="#/entree/' + esc(r.it.id) + '" style="left:' + left.toFixed(2) + '%;width:' + Math.max(0.8, pct(r.e) - left).toFixed(2) + '%;--c:' + r.it.color + '" title="' + esc(r.it.title + ' · ' + fmt(r.s) + ' → ' + fmt(r.e)) + '"></a>'
      : '<a class="av-dot" href="#/entree/' + esc(r.it.id) + '" style="left:' + left.toFixed(2) + '%;--c:' + r.it.color + '" title="' + esc(r.it.title + ' · ' + fmt(r.s)) + '"></a>';
    return '<div class="av-row"><a class="av-name" href="#/entree/' + esc(r.it.id) + '"><i style="background:' + r.it.color + '"></i><span>' + esc(r.it.title) + '</span><small>' + esc(fmt(r.s) + (r.e ? ' → ' + fmt(r.e) : '')) + '</small></a><div class="av-track">' + today + bar + '</div></div>';
  };
  const label = months[0].toLocaleDateString(locale, { month: 'short' }) + ' – ' + months[2].toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const head = '<div class="av-row av-head"><span class="av-name"></span><div class="av-track">' + months.map((m) => '<span style="left:' + pct(m.getTime()).toFixed(2) + '%">' + esc(m.toLocaleDateString(locale, { month: 'long' })) + '</span>').join('') + '</div></div>';
  return '<section class="panel av-panel">' + avBar(name, 'frise', anchor, label, 3) +
    (shown.length ? '<div class="av-tl frame-scroll">' + head + shown.map(line).join('') + '</div>' + (rows.length > shown.length ? '<p class="av-note">' + esc(say(W.avMore, { n: rows.length - shown.length })) + '</p>' : '')
      : '<p class="nw-empty">' + esc(W.avNothingThen) + '</p>') + avLegend(dated, colorOf) + '</section>';
}

async function avFilesTab(models) {
  const kinds = new Set(models.map((k) => k.kind));
  const files = (await api(inSpace('/files')).catch(() => [])).filter((f) => (f.links || []).some((l) => kinds.has(l.kind)));
  const size = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' ' + W.avMB : Math.max(1, Math.round(n / 1024)) + ' ' + W.avKB;
  const type = (f) => (String(f.name || '').indexOf('.') > 0 ? String(f.name).split('.').pop() : String(f.mediaType || '').split('/').pop()).slice(0, 6).toUpperCase();
  const card = (f) => '<div class="av-file"><a class="av-fmain" href="#/entree/' + esc(f.entryId) + '"><span class="av-fic">' + ic('i-file') + '<b>' + esc(type(f)) + '</b></span><span class="t">' + esc(f.title || f.name) + '</span><span class="s">' + esc(size(f.size) + ' · ' + day(f.createdAt)) + '</span></a>' +
    '<span class="av-of">' + f.links.filter((l) => kinds.has(l.kind)).slice(0, 3).map((l) => '<a class="dt-tag" href="#/entree/' + esc(l.id) + '" title="' + esc(kindName(l.kind)) + '">' + esc(l.title) + '</a>').join('') + '</span></div>';
  return '<section class="panel av-panel">' + (files.length ? '<div class="av-files">' + files.map(card).join('') + '</div>'
    : '<div class="sk-empty"><b>' + esc(W.avNoFiles) + '</b><p>' + esc(W.avNoFilesLead) + '</p></div>') + '</section>';
}

async function avActivity(models) {
  const hist = await api(inSpace('/history?limit=80&kinds=' + encodeURIComponent(models.map((k) => k.kind).join(',')))).catch(() => []);
  const titleOf = (h) => (h.after && h.after.title) || (h.before && h.before.title) || '';
  const groups = [];
  hist.forEach((h) => { const d = day(h.at); const last = groups[groups.length - 1]; if (last && last.d === d) last.l.push(h); else groups.push({ d, l: [h] }); });
  const li = (h) => '<li' + (h.undoneBy ? ' class="undone"' : '') + '><span class="nw-av">' + esc(String(h.client || h.door || 'J').slice(0, 1).toUpperCase()) + '</span><span class="nw-what">' + esc(said(h.command)) + (titleOf(h) ? ' <a href="#/entree/' + esc(h.target) + '">' + esc(titleOf(h)) + '</a>' : '') + '</span><time>' + esc(avHm(new Date(h.at))) + '</time></li>';
  return '<section class="panel av-panel">' + (groups.length ? groups.map((g) => '<h3 class="av-day">' + esc(g.d) + '</h3><ul class="nw-feed">' + g.l.map(li).join('') + '</ul>').join('')
    : '<p class="nw-empty">' + esc(W.v2nothingYet) + '</p>') + '</section>';
}

async function appViewHtml(name, models, tab, params) {
  if (tab === 'calendrier') return avCalendar(name, models, params);
  if (tab === 'frise') return avTimeline(name, models, params);
  if (tab === 'fichiers') return avFilesTab(models);
  return avActivity(models);
}

function bindAppViews(root) {
  root.querySelectorAll('[data-av-new]').forEach((b) => b.addEventListener('click', () => avNew(b.dataset.avNew)));
}

// A new view of one of its kinds: a list, a board (by a choice), a calendar (by a date) or a
// timeline (from a date to another); kept as a « View » of the app, opened at once.
function avNew(name) {
  const models = knownKinds.filter((k) => k.model && k.model.app === name);
  if (!models.length) return;
  const f = (label, html, id) => '<label' + (id ? ' id="' + id + '"' : '') + ' style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(label) + html + '</label>';
  const types = [['table', W.avTypeTable], ['kanban', W.avTypeBoard], ['calendar', W.avTypeCalendar], ['timeline', W.avTypeTimeline]];
  openDrawer(W.avNewView,
    f(W.avViewName, '<input class="field" id="av-name" maxlength="80" placeholder="' + esc(W.avViewNameHint) + '">') +
    f(W.avOfKind, '<select class="field" id="av-kind">' + models.map((k) => '<option value="' + esc(k.kind) + '">' + esc(kindName(k.kind)) + '</option>').join('') + '</select>') +
    f(W.avShownAs, '<div class="segmented" id="av-types">' + types.map((t, i) => '<button type="button" data-av-type="' + t[0] + '" aria-pressed="' + (i === 0) + '">' + esc(t[1]) + '</button>').join('') + '</div>') +
    f(W.avBy, '<select class="field" id="av-by"></select>', 'av-by-l') +
    f(W.avDate, '<select class="field" id="av-date"></select>', 'av-date-l') +
    f(W.avEnd, '<select class="field" id="av-end"></select>', 'av-end-l') +
    '<p class="muted" id="av-why" style="margin:0;font-size:13px"></p>',
    '<button class="btn solid" id="av-save">' + ic('i-check') + esc(W.stSave) + '</button>');
  drawer().classList.add('pk');
  let type = 'table';
  const opts = (list, none) => (none ? '<option value="">' + esc(none) + '</option>' : '') + list.map((x) => '<option value="' + esc(x.name) + '">' + esc(x.name) + '</option>').join('');
  const refresh = () => {
    const k = models.find((m) => m.kind === document.getElementById('av-kind').value);
    const choices = avFields(k, ['choice']);
    const dates = avDated(k);
    document.getElementById('av-by').innerHTML = opts(choices);
    document.getElementById('av-date').innerHTML = opts(dates);
    document.getElementById('av-end').innerHTML = opts(dates.slice(1), W.avNoEnd);
    if (dates[1]) document.getElementById('av-end').value = dates[1].name;
    const showIf = (id, on) => { document.getElementById(id).style.display = on ? 'grid' : 'none'; };
    showIf('av-by-l', type === 'kanban');
    showIf('av-date-l', ['calendar', 'timeline'].includes(type));
    showIf('av-end-l', type === 'timeline');
    const missing = (type === 'kanban' && !choices.length) || (['calendar', 'timeline'].includes(type) && !dates.length);
    document.getElementById('av-why').textContent = missing ? (type === 'kanban' ? W.avNeedsChoice : W.avNeedsDate) : '';
    document.getElementById('av-save').disabled = missing;
  };
  document.getElementById('av-kind').addEventListener('change', refresh);
  drawer().querySelectorAll('[data-av-type]').forEach((b) => b.addEventListener('click', () => {
    type = b.dataset.avType;
    drawer().querySelectorAll('[data-av-type]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    refresh();
  }));
  refresh();
  document.getElementById('av-name').focus();
  document.getElementById('av-save').addEventListener('click', async () => {
    const title = document.getElementById('av-name').value.trim();
    if (!title) { alert(W.avNeedsName); return; }
    const data = { kind: document.getElementById('av-kind').value, type, app: name, label: { [LANG]: title } };
    if (type === 'kanban') data.by = document.getElementById('av-by').value;
    if (type === 'calendar') data.date = document.getElementById('av-date').value;
    if (type === 'timeline') { data.start = document.getElementById('av-date').value; const e = document.getElementById('av-end').value; if (e) data.end = e; }
    try {
      const saved = await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: 'View', title, data, origin: 'said' }] } });
      closeDrawer();
      toast(W.avSaved, null);
      location.hash = '#/app/' + encodeURIComponent(name) + '?view=' + encodeURIComponent(saved.entries[0].id);
    } catch (error) { alert(error.message); }
  });
}
`;
