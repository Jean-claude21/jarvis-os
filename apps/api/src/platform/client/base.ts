// The ground every page stands on: words, formats, `/api`, the drawer, the toast, her apps.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const base = `
const W = WORDS;
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
// Technical names stay English; what she reads comes from the models' labels, in her language.
const tr = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[LANG] || v.en || v.fr || '' : v);
const kindLabel = (k) => (k && k.model && k.model.label ? tr(k.model.label) : k.kind);
const fieldLabelOf = (model, name) => { const f = model && model.fields.find((c) => c.name === name); return f && f.label ? tr(f.label) : name; };
const optionLabelOf = (model, name, v) => { const f = model && model.fields.find((c) => c.name === name); return f && f.optionLabels && typeof v === 'string' && f.optionLabels[v] ? tr(f.optionLabels[v]) : v; };
const say = (t, v) => String(t).replace(/\\{(\\w+)\\}/g, (_, k) => (v && v[k] != null ? v[k] : ''));
const locale = LANG === 'en' ? 'en' : 'fr';
const day = (iso) => iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const time = (iso) => iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
const num = (n) => new Intl.NumberFormat(locale).format(n || 0);
let me = null; let space = null;
try { space = localStorage.getItem('jarvis.space'); } catch {}

async function api(path, options) {
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
const card = (title, body, wide) => '<article class="card' + (wide ? ' wide' : '') + '">' + (title ? '<h2>' + esc(title) + '</h2>' : '') + body + '</article>';
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
function openDrawer(title, body, foot) {
  drawer().innerHTML = '<div class="dh"><h2>' + esc(title) + '</h2><button class="quiet" data-close>✕</button></div><div class="db">' + body + '</div>' + (foot ? '<div class="df">' + foot + '</div>' : '');
  drawer().classList.add('open');
  drawer().querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
}
function closeDrawer() { drawer().classList.remove('open'); }
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
const clock = () => { const el = document.getElementById('clock'); if (el) el.textContent = new Date().toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase(); };
setInterval(clock, 30000);
let pick = null;
// The views she is exploring, by kind or kept view; the one on screen.
const explorers = {};
let explorerNow = null;
let reading = false;
// The kinds of her space, kept by drawApps: a kind shows its label, not its technical name.
let knownKinds = [];
const kindName = (name) => { const k = knownKinds.find((one) => one.kind === name); return k ? kindLabel(k) : name; };
const areaOfApp = (kinds, app) => { const k = kinds.find((one) => one.model && one.model.app === app && one.model.area); return k ? k.model.area : ''; };
async function drawApps() {
  const kinds = await api(inSpace('/kinds'));
  knownKinds = kinds;
  const appPages = await api(inSpace('/pages'));
  const apps = [...new Set(kinds.filter((k) => k.model && k.model.app).map((k) => k.model.app).concat(appPages.filter((p) => p.app).map((p) => p.app)))];
  // Apps grouped by the area she files them in (spec 015); those not filed last.
  const groups = {};
  for (const a of apps) (groups[areaOfApp(kinds, a) || ''] = groups[areaOfApp(kinds, a) || ''] || []).push(a);
  const names = Object.keys(groups).sort((x, y) => (x === '') - (y === '') || x.localeCompare(y));
  const link = (a) => '<a class="navi" data-app="' + esc(encodeURIComponent(a)) + '" href="#/app/' + esc(encodeURIComponent(a)) + '"><span class="app-dot">' + esc(a.slice(0, 1).toUpperCase()) + '</span><span>' + esc(a) + '</span></a>';
  document.getElementById('apps').innerHTML = '<div class="caps">' + esc(W.navApps) + '</div>' +
    (names.length === 1 && names[0] === '' ? groups[''].map(link).join('') : names.map((n) => '<details class="area" open><summary class="caps">' + esc(n || W.unfiled) + '</summary>' + groups[n].map(link).join('') + '</details>').join('')) +
    '<a class="navi ghost" href="#/app">' + ICON_PLUS + '<span>' + esc(W.newApp) + '</span></a>';
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
