// The ground every page stands on: words, formats, `/api`, the drawer, the toast, her apps.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const base = `
const W = WORDS;
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
// Technical names stay English; what she reads comes from the models' labels, in her language.
const tr = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[LANG] || v.en || v.fr || '' : v);
const kindLabel = (k) => (k && k.model && k.model.label ? tr(k.model.label) : k && k.common ? tr(k.common) : k.kind);
const fieldLabelOf = (model, name) => { const f = model && model.fields.find((c) => c.name === name); return f && f.label ? tr(f.label) : name; };
const optionLabelOf = (model, name, v) => { const f = model && model.fields.find((c) => c.name === name); return f && f.optionLabels && typeof v === 'string' && f.optionLabels[v] ? tr(f.optionLabels[v]) : v; };
const say = (t, v) => String(t).replace(/\\{(\\w+)\\}/g, (_, k) => (v && v[k] != null ? v[k] : ''));
const locale = LANG === 'en' ? 'en' : 'fr';
const day = (iso) => iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const time = (iso) => iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
const num = (n) => new Intl.NumberFormat(locale).format(n || 0);
let me = null; let space = null;
try { space = localStorage.getItem('jarvis.space'); } catch {}

// What changes rarely (her profile, her kinds, her apps' pages and views, her preferences) is kept
// a minute; any change she makes forgets it, and every page drawn again behind (see the router).
const apiMemo = new Map();
const MEMO_PATHS = /^[/](me|kinds|pages|views|apps[/]mine|prefs|me[/]prefs|spaces)([?]|$)/;
async function api(path, options) {
  const method = ((options && options.method) || 'GET').toUpperCase();
  if (method !== 'GET') { apiMemo.clear(); if (typeof pageCache !== 'undefined') pageCache.forEach((entry) => { entry.at = 0; }); }
  else if (MEMO_PATHS.test(path)) {
    const kept = apiMemo.get(path);
    if (kept && Date.now() - kept.at < 60000) return kept.data;
    const data = await apiFetch(path, options);
    apiMemo.set(path, { at: Date.now(), data: data });
    return data;
  }
  return apiFetch(path, options);
}
async function apiFetch(path, options) {
  const opts = Object.assign({ credentials: 'same-origin' }, options || {});
  if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
    opts.headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
    opts.body = JSON.stringify(opts.body);
  }
  const response = await fetch('/api' + path, opts);
  if (response.status === 401) { location.href = '/connexion'; throw new Error('401'); }
  const data = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
  if (!response.ok) {
    // A refusal she can read (spec 015): its kind in her language, the model's sentence as the detail.
    const known = data && data.code && W['err_' + data.code];
    throw new Error(known ? known + ' — ' + data.error : (data && data.error) || response.status);
  }
  return data;
}
const inSpace = (path) => path + (path.includes('?') ? '&' : '?') + 'space=' + encodeURIComponent(space);
const page = () => document.getElementById('page');
const fail = (error) => { page().innerHTML = '<p class="error-text">' + esc(say(W.failed, { reason: error.message })) + '</p>'; };
// A card is the mockup's panel: its title in capitals at its head, what it holds below.
const card = (title, body, wide) => '<section class="panel' + (wide ? ' wide' : '') + '">' + (title ? '<div class="panel-head"><span class="left caps">' + esc(title) + '</span></div>' : '') + '<div class="panel-body pad">' + body + '</div></section>';
// What a page drawn before the mockup still holds, dressed as the mockup: its buttons, its badges.
function dress(root) {
  root.querySelectorAll('button:not(.btn):not(.row):not(.chip):not(.icon-btn):not(.back):not(.undo):not([role="tab"]):not(.x-occ button)').forEach((b) => {
    if (b.closest('.segmented, .x-occ, .x-src, .menu, .x-tabbar, .tabs')) return;
    b.classList.add('btn');
    if (b.classList.contains('primary')) b.classList.add('solid');
  });
  root.querySelectorAll('.badge').forEach((b) => { b.classList.add('tag'); if (b.classList.contains('said')) b.classList.add('ok'); else if (b.classList.contains('error')) b.classList.add('error'); else if (b.classList.contains('primary')) b.classList.add('info'); else b.classList.add('neutral'); });
  root.querySelectorAll('nav.tabs a.on').forEach((a) => a.setAttribute('aria-current', 'page'));
}
const empty = (text) => '<p class="empty">' + esc(text || W.empty) + '</p>';
const originBadge = (o) => '<span class="badge ' + esc(o) + '">' + esc(W[o] || o) + '</span>';
const said = (command) => W['c.' + command] || command;
const spaceName = () => (me.spaces.find((s) => s.id === space) || {}).name || '';

function frame(src) {
  const id = 'f' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    const el = document.getElementById(id); if (!el) return;
    const fit = () => { try { el.style.height = (el.contentDocument.documentElement.scrollHeight + 4) + 'px'; } catch {} };
    el.addEventListener('load', () => { fit(); try { new ResizeObserver(fit).observe(el.contentDocument.body); } catch {} });
  });
  return '<iframe class="view" id="' + id + '" src="' + esc(src) + '"></iframe>';
}


// The drawer, the toast and an undo for what was just done (spec 013).
const drawer = () => document.getElementById('drawer');
// The drawer of the mockup: its title and a line under it, what it holds, its gestures at the foot.
function openDrawer(title, body, foot, sub) {
  drawer().innerHTML = '<div class="drawer-head"><div><h2>' + esc(title) + '</h2>' + (sub ? '<span class="muted" style="font-size:12px">' + esc(sub) + '</span>' : '') + '</div><button class="icon-btn" data-close aria-label="' + esc(W.close || '×') + '"><svg class="i"><use href="#i-x"/></svg></button></div>' +
    '<div class="pad" style="display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1;min-height:0">' + body + '</div>' + (foot ? '<div class="drawer-foot">' + foot + '</div>' : '');
  drawer().classList.add('open');
  document.getElementById('scrim').classList.add('open');
  drawer().querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  dress(drawer());
}
function closeDrawer() {
  drawer().classList.remove('open');
  const side = document.getElementById('side');
  if (!side || !side.classList.contains('open')) { const scrim = document.getElementById('scrim'); if (scrim) scrim.classList.remove('open'); }
}
let toastTimer; let lastDone = null;
function toast(text, undoable) {
  document.getElementById('toast-text').textContent = text;
  document.getElementById('toast-undo').style.display = undoable ? '' : 'none';
  lastDone = undoable || null;
  const t = document.getElementById('toast'); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 6000);
}
document.getElementById('toast-undo').addEventListener('click', async () => {
  if (!lastDone) return;
  const { id, spaceId } = lastDone; lastDone = null;
  const hist = await api('/history?limit=1&target=' + encodeURIComponent(id) + '&space=' + encodeURIComponent(spaceId));
  if (hist[0]) await api('/undo?space=' + encodeURIComponent(spaceId), { method: 'POST', body: { journalId: hist[0].id } });
  toast(W.undoneToast, null); show();
});
// « 2026-10-29 » or « 2026-10-29T14:00 », a day later, as she wrote it.
function dayLater(text) {
  const d = String(text).slice(0, 10).split('-').map(Number);
  const next = new Date(Date.UTC(d[0], d[1] - 1, d[2] + 1)).toISOString().slice(0, 10);
  return next + String(text).slice(10);
}
// « MAR. 10 NOV · 15:52 », as the mockup's top bar says it.
const clock = () => { const el = document.getElementById('clock'); if (!el) return; const d = new Date(); el.innerHTML = '<span class="hide-s">' + esc(d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase().replace(/[.,]/g, '') + ' · ') + '</span>' + esc(d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })); };
setInterval(clock, 30000);
let pick = null;
// The views she is exploring, by kind or kept view; the one on screen.
const explorers = {};
let explorerNow = null;
let reading = false;
// The kinds of her space, kept by drawApps: a kind shows its label, not its technical name.
let knownKinds = [];
const kindName = (name) => { const k = knownKinds.find((one) => one.kind === name); const l = k ? kindLabel(k) : name; return l === name ? W['knd_' + name] || name : l; };
const areaOfApp = (kinds, app) => { const k = kinds.find((one) => one.model && one.model.app === app && one.model.area); return k ? k.model.area : ''; };
async function drawApps() {
  const [kinds, appPages] = await Promise.all([api(inSpace('/kinds')), api(inSpace('/pages'))]);
  knownKinds = kinds;
  const all = [...new Set(kinds.filter((k) => k.model && k.model.app).map((k) => k.model.app).concat(appPages.filter((p) => p.app).map((p) => p.app)))];
  // Her habits held by no app still open as « Routines » (the mockup's app), with its three tabs.
  if (!all.includes('Routines') && kinds.some((k) => ['habit', 'habitude'].includes(String(k.kind).toLowerCase()) && k.count && !(k.model && k.model.app))) all.unshift('Routines');
  // Her pinned apps, in her order (I13), when she pinned some; else all of them.
  await prefsNow();
  const pins = (prefs && Array.isArray(prefs.pinned) ? prefs.pinned : []).filter((a) => all.includes(a));
  const apps = pins.length ? pins : all;
  navApps = apps;
  // Her counts beside « Personnes », « Entrées », « Tableaux de bord ».
  const person = kinds.find((k) => k.kind === 'Person');
  navCounts.people = person && person.count ? num(person.count) : '';
  navCounts.entries = num(kinds.reduce((a, k) => a + (['Model', 'Rule', 'Script', 'Page', 'View', 'App', 'Channel', 'Reminder', 'Comment', 'Proposal', 'Capture'].includes(k.kind) ? 0 : k.count || 0), 0));
  navCounts.boards = appPages.filter((p) => !p.app).length || '';
  const [path] = location.hash.replace(/^#[/]?/, '').split('?');
  const [name, id] = path.split('/');
  if (typeof drawNav === 'function') drawNav(pages[name] ? name : '', id ? decodeURIComponent(id) : undefined);
}

// A kind whose model links it, or that other models link to (spec 014): its record page shows them.
async function hasRelations(kind) {
  const fold = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const models = (await api(inSpace('/kinds'))).filter((k) => k.model);
  return models.some((k) => k.model.fields.some((f) => f.type === 'link' && (fold(k.kind) === fold(kind) || (f.inverse && f.target && fold(f.target) === fold(kind)))));
}

// Her day in one band, 6:00 to 23:00: the template, the events, the proposals; now marked.
function dayBand(occ, focus) {
  const from = 6, to = 23;
  const at = (iso) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
  const pct = (h) => Math.max(0, Math.min(100, (h - from) / (to - from) * 100));
  const blocks = occ.filter((o) => !o.allDay).map((o) => {
    const a = at(o.start); const b = o.end ? at(o.end) || 24 : a + 0.5;
    return '<a class="blk' + (o.proposed ? ' proposed' : o.repeated ? '' : ' ev') + (o.id === focus ? ' focus' : '') + '" href="#/entree/' + esc(o.id) + '" title="' + esc(o.title) + '" style="left:' + pct(a) + '%;width:calc(' + (pct(b) - pct(a)) + '% - 2px)">' + esc(o.title) + '</a>';
  }).join('');
  const n = at(new Date().toISOString());
  return '<section class="pane"><div class="ph"><span>' + esc(W.yourDay) + '</span><a class="link" href="#/agenda">' + esc(W.navAgenda) + ' →</a></div><div class="pb"><div class="dayband"><div class="hrs">' +
    Array.from({ length: to - from }, (_, i) => '<span>' + (i % 2 ? '' : String(from + i).padStart(2, '0')) + '</span>').join('') + '</div>' + blocks +
    (n >= from && n <= to ? '<div class="nowl" style="left:' + pct(n) + '%"></div>' : '') + '</div></div></section>';
}

// Her preferences (specs 017, 018), kept in her account: kinds flat or grouped, how lists open, the
// hour of her morning brief.
let prefs = null;
async function prefsNow() { if (!prefs) { try { prefs = await api('/me/prefs'); } catch { prefs = {}; } } return prefs; }
const kindsMode = () => (prefs && prefs.kinds) || 'grouped';
function keepPrefs(patch) { prefs = Object.assign({}, prefs, patch, patch.modes ? { modes: Object.assign({}, prefs && prefs.modes, patch.modes) } : {}); api('/me/prefs', { method: 'POST', body: patch }).catch(() => {}); }
`;
