import type { Lang } from '../i18n';
import { brandCss } from '../views/base';
import { appWords } from './words';

// Her web account (spec 009): one page, no build step, in the Kete brand — a sidebar of what she
// keeps (home, life, documents, dashboards, reminders, journal) and of her settings (spaces,
// connections, data, account). It reads and acts through `/api` with her session, like any door.
// Dashboards and documents reuse the views of the clients, framed (`/app/frame/…`).

const css = `
body { padding: 0; }
.app { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
.side { background: var(--sand); border-right: 1px solid var(--rule); padding: 18px 14px; display: flex; flex-direction: column; gap: 18px;
  position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.logo { display: flex; align-items: center; gap: 10px; font: 700 17px/1 Archivo, system-ui, sans-serif; color: var(--ink); text-decoration: none; }
.logo i { width: 28px; height: 28px; background: var(--primary); color: var(--on-primary); display: grid; place-items: center;
  font: 700 15px/1 Archivo, sans-serif; font-style: normal; border-radius: 2px; }
.side select { width: 100%; font: 600 13px/1.2 "Instrument Sans", sans-serif; padding: 8px; border: 1px solid var(--rule-strong);
  border-radius: 2px; background: var(--paper); color: var(--ink); }
.nav { display: grid; gap: 2px; }
.nav a { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 2px; color: var(--ink); text-decoration: none; font-weight: 600; font-size: 14px; }
.nav a:hover { background: var(--clay); }
.nav a.on { background: var(--ink); color: var(--paper); }
.nav a svg { width: 16px; height: 16px; flex: none; }
.nav .caps { padding: 12px 10px 4px; }
.who { margin-top: auto; border-top: 1px solid var(--rule); padding-top: 12px; font-size: 13px; }
.main { min-width: 0; }
.top { display: flex; align-items: center; gap: 12px; padding: 14px 28px; border-bottom: 1px solid var(--rule); background: var(--paper);
  position: sticky; top: 0; z-index: 2; }
.top h1 { flex: 1; font-size: 18px; }
.top input { width: min(340px, 40vw); font: 14px "Instrument Sans", sans-serif; padding: 8px 10px; border: 1px solid var(--rule-strong);
  border-radius: 2px; background: var(--sand); color: var(--ink); }
#menu { display: none; }
.page { padding: 24px 28px 48px; max-width: 1180px; }
.lead { color: var(--bark); margin: -4px 0 18px; }
.kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 16px; }
.kpi-card .kpi { margin-top: 6px; }
.split { display: grid; gap: 16px; grid-template-columns: 220px 1fr; align-items: start; }
.facets a { display: flex; justify-content: space-between; padding: 6px 8px; color: var(--ink); text-decoration: none; border-radius: 2px; font-size: 14px; }
.facets a:hover { background: var(--clay); } .facets a.on { background: var(--clay); font-weight: 600; }
.rows tr { cursor: pointer; } .rows tr:hover td { background: var(--sand); }
.spark { display: flex; align-items: flex-end; gap: 3px; height: 40px; margin-top: 8px; }
.spark span { flex: 1; background: var(--primary); opacity: 0.85; min-height: 2px; border-radius: 1px; }
.field-row { display: grid; grid-template-columns: minmax(110px, 30%) 1fr auto; gap: 10px; padding: 7px 0; border-bottom: 1px dotted var(--rule); align-items: baseline; }
.doc { max-width: 760px; } .doc p, .doc li { font-size: 15px; line-height: 1.65; }
.doc h1, .doc h2, .doc h3 { margin: 1.2em 0 0.5em; } .doc blockquote { border-left: 3px solid var(--primary); margin: 0 0 0.9em; padding: 2px 0 2px 14px; color: var(--bark); }
.doc pre { background: var(--sand); border: 1px solid var(--rule); padding: 10px; overflow-x: auto; } .doc .ref { color: var(--primary); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.stack { display: grid; gap: 14px; }
input.field, textarea.field { width: 100%; font: 14px "Instrument Sans", sans-serif; padding: 9px 10px; border: 1px solid var(--rule-strong);
  border-radius: 2px; background: var(--paper); color: var(--ink); }
textarea.field { min-height: 90px; font-family: "JetBrains Mono", monospace; font-size: 12px; }
code.url { font: 13px "JetBrains Mono", monospace; background: var(--clay); padding: 6px 8px; border-radius: 2px; overflow-wrap: anywhere; }
iframe.view { width: 100%; border: 1px solid var(--rule); border-radius: 2px; min-height: 420px; background: var(--paper); }
a.link { color: var(--primary); text-decoration: none; } a.link:hover { text-decoration: underline; }
@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; }
  .side { position: fixed; inset: 0 auto 0 0; width: 260px; z-index: 5; transform: translateX(-100%); transition: transform .2s; }
  .app.open .side { transform: none; box-shadow: 0 0 0 100vmax rgba(0,0,0,.35); }
  #menu { display: inline-flex; }
  .top { padding: 12px 16px; } .top input { width: 42vw; }
  .page { padding: 16px; }
  .split { grid-template-columns: 1fr; }
  .field-row { grid-template-columns: 1fr; gap: 2px; }
}
`;

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICONS = {
  home: icon('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  life: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  documents: icon('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),
  dashboards: icon('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  reminders: icon(
    '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 004 0"/>',
  ),
  journal: icon('<path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5M12 8v4l3 3"/>'),
  spaces: icon('<circle cx="9" cy="9" r="4"/><circle cx="16" cy="15" r="4"/>'),
  connections: icon('<path d="M10 14l4-4M8 8l-2 2a4 4 0 006 6l1-1M16 16l2-2a4 4 0 00-6-6l-1 1"/>'),
  data: icon('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  account: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
};

const script = `
const W = WORDS;
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
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
  if (!response.ok) throw new Error((data && data.error) || response.status);
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

// Pages, by the hash: #/vie?kind=…, #/entree/<id>, …
const pages = {
  async '' () {
    const o = await api('/overview');
    const here = o.spaces.find((s) => s.id === space) || o.spaces[0];
    const max = Math.max(1, ...o.changes.map((c) => c.n));
    const total = o.changes.reduce((sum, c) => sum + c.n, 0);
    return '<p class="lead">' + esc(W.homeLead) + '</p>' +
      '<section class="kpis">' +
      card('', '<div class="caps">' + esc(W.entries) + '</div><div class="kpi">' + num(here.entries) + '</div>') +
      card('', '<div class="caps">' + esc(W.documents) + '</div><div class="kpi">' + num(here.documents) + '</div>') +
      card('', '<div class="caps">' + esc(W.reminders) + '</div><div class="kpi">' + num(here.reminders) + '</div>') +
      card('', '<div class="caps">' + esc(W.changes) + '</div><div class="kpi">' + num(total) + '</div><div class="spark">' +
        o.changes.map((c) => '<span title="' + esc(c.day + ' : ' + c.n) + '" style="height:' + Math.round(c.n / max * 100) + '%"></span>').join('') + '</div>') +
      '</section><section class="grid">' +
      card(W.upcoming, o.upcoming.length ? '<ul class="list">' + o.upcoming.map((u) =>
        '<li><span><a class="link" href="#/entree/' + esc(u.id) + '">' + esc(u.title) + '</a> <span class="muted">' + esc(u.kind) + ' · ' + esc(u.space) + '</span></span><span class="num">' + esc(time(u.when)) + '</span></li>').join('') + '</ul>' : empty(W.noUpcoming)) +
      card(W.recent, o.recent.length ? '<ul class="list">' + o.recent.map((r) => {
        const what = (r.after && r.after.title) || (r.before && r.before.title) || said(r.command);
        return '<li><span>' + esc(what) + ' <span class="muted">' + esc(said(r.command)) + ' · ' + esc(r.space) + '</span></span><span class="muted">' + esc(time(r.at)) + '</span></li>';
      }).join('') + '</ul>' : empty()) +
      '</section>';
  },

  async vie (params) {
    const kinds = await api(inSpace('/kinds'));
    const kind = params.get('kind') || ''; const q = params.get('q') || '';
    const list = await api(inSpace('/entries?limit=200' + (kind ? '&kind=' + encodeURIComponent(kind) : '') + (q ? '&text=' + encodeURIComponent(q) : '')));
    return '<div class="split"><nav class="card facets"><div class="caps" style="margin-bottom:6px">' + esc(W.kinds) + '</div>' +
      '<a href="#/vie' + (q ? '?q=' + encodeURIComponent(q) : '') + '" class="' + (kind ? '' : 'on') + '"><span>' + esc(W.all) + '</span></a>' +
      kinds.map((k) => '<a href="#/vie?kind=' + encodeURIComponent(k.kind) + '" class="' + (k.kind === kind ? 'on' : '') + '"><span>' + esc(k.kind) + '</span><span class="muted num">' + k.count + '</span></a>').join('') +
      '</nav>' + card(kind || (q ? '« ' + q + ' »' : W.all), list.length ? '<div class="scroll"><table class="rows"><thead><tr><th>' + esc(W.title) + '</th><th>' + esc(W.kind) + '</th><th>' + esc(W.updated) + '</th></tr></thead><tbody>' +
        list.map((e) => '<tr data-go="#/entree/' + esc(e.id) + '"><td>' + esc(e.title) + '</td><td><span class="badge">' + esc(e.kind) + '</span></td><td class="muted">' + esc(day(e.updatedAt)) + '</td></tr>').join('') +
        '</tbody></table></div>' : empty()) + '</div>';
  },

  async entree (params, id) {
    const e = await api(inSpace('/entries/' + encodeURIComponent(id)));
    const hist = await api(inSpace('/history?limit=20&target=' + encodeURIComponent(id)));
    const fields = Object.keys(e.data).filter((f) => f !== 'texte' && f !== 'source');
    const value = (v) => v !== null && typeof v === 'object' ? '<code>' + esc(JSON.stringify(v)) + '</code>' : esc(v);
    let text = '';
    if (typeof e.data.texte === 'string') {
      const d = await api(inSpace('/documents/' + encodeURIComponent(id)));
      text = card(W.text, '<div class="actions" style="margin-bottom:8px"><a class="link" href="#/document/' + esc(id) + '">' + esc(W.open) + ' →</a></div><div class="doc">' + d.html + '</div>', true);
    }
    const link = (l, dir) => '<li><span>' + (dir === 'out' ? '→ ' : '← ') + '<span class="muted">' + esc(l.role) + '</span> <a class="link" href="#/entree/' + esc(l.entry.id) + '">' + esc(l.entry.title) + '</a></span><span class="badge">' + esc(l.entry.kind) + '</span></li>';
    const links = e.links.out.map((l) => link(l, 'out')).concat(e.links.in.map((l) => link(l, 'in')));
    return '<div class="head"><div><div class="caps">' + esc(e.kind) + (e.archivedAt ? ' · ' + esc(W.archived) : '') + '</div><h1>' + esc(e.title) + '</h1>' +
      (e.data.source ? '<div class="meta muted">' + esc(say(W.source, { path: e.data.source })) + '</div>' : '') + '</div>' +
      '<div class="actions">' + (e.archivedAt ? '' : '<button class="quiet" id="aside">' + esc(W.setAside) + '</button>') + '</div></div>' +
      '<section class="grid">' +
      card(W.fields, fields.length ? fields.map((f) => '<div class="field-row"><span class="caps">' + esc(f) + '</span><span>' + value(e.data[f]) + '</span>' + originBadge(e.origin[f] || 'said') + '</div>').join('') : empty()) +
      card(W.links, links.length ? '<ul class="list">' + links.join('') + '</ul>' : empty()) +
      text +
      card(W.history, '<ul class="list">' + hist.map((h) => '<li><span>' + esc(said(h.command)) + ' <span class="muted">' + esc(say(W.by, { who: h.client || h.actor === me.person.id && me.person.name || h.actor, door: h.door })) + ' · ' + esc(time(h.at)) + '</span></span>' +
        (h.undoneBy ? '<span class="badge">' + esc(W.undone) + '</span>' : h.command === 'journal.undo' ? '' : '<button class="quiet" data-undo="' + h.id + '">' + esc(W.undo) + '</button>') + '</li>').join('') + '</ul>', true) +
      '</section>';
  },

  async documents () {
    const r = await api(inSpace('/query'), { method: 'POST', body: { sql: "select id, kind, title, length(data->>'texte') as taille, updated_at from my_entries where length(data->>'texte') > 400 and archived_at is null order by updated_at desc limit 300" } });
    return card('', r.rows.length ? '<div class="scroll"><table class="rows"><thead><tr><th>' + esc(W.title) + '</th><th>' + esc(W.kind) + '</th><th class="n">' + esc(W.size) + '</th><th>' + esc(W.updated) + '</th></tr></thead><tbody>' +
      r.rows.map((d) => '<tr data-go="#/document/' + esc(d.id) + '"><td>' + esc(d.title) + '</td><td><span class="badge">' + esc(d.kind) + '</span></td><td class="n num">' + esc(say(W.chars, { n: num(d.taille) })) + '</td><td class="muted">' + esc(day(d.updated_at)) + '</td></tr>').join('') +
      '</tbody></table></div>' : empty(), true);
  },

  async document (params, id) {
    return '<p><a class="link" href="#/entree/' + esc(id) + '">← ' + esc(W.fields) + ', ' + esc(W.links) + '</a></p>' + frame('/app/frame/document/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space));
  },

  async tableaux (params) {
    const id = params.get('id');
    if (id) return '<p><a class="link" href="#/tableaux">← ' + esc(W.back) + '</a></p>' + frame('/app/frame/dashboard/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space));
    const list = await api(inSpace('/entries?kind=' + encodeURIComponent('Tableau de bord')));
    return list.length ? '<section class="grid">' + list.map((d) => card(d.title, '<p class="muted">' + esc(day(d.updatedAt)) + '</p><a class="link" href="#/tableaux?id=' + esc(d.id) + '">' + esc(W.open) + ' →</a>')).join('') + '</section>' : card('', empty(W.noDashboards));
  },

  async rappels () {
    const list = await api(inSpace('/entries?limit=200&kind=Rappel'));
    const canal = await api('/entries?kind=Canal&limit=1&space=' + encodeURIComponent(me.space.id));
    return '<p class="badge ' + (canal.length ? 'said' : 'error') + '" style="white-space:normal;margin-bottom:14px">' + esc(canal.length ? W.channelOn : W.channelOff) + '</p>' +
      card('', list.length ? '<div class="scroll"><table class="rows"><thead><tr><th>' + esc(W.title) + '</th><th>' + esc(W.when) + '</th><th>' + esc(W.repeats) + '</th><th>' + esc(W.status) + '</th></tr></thead><tbody>' +
        list.map((r) => '<tr data-go="#/entree/' + esc(r.id) + '"><td>' + esc(r.title) + (r.data.message ? '<div class="muted">' + esc(r.data.message) + '</div>' : '') + '</td><td class="num">' + esc(time(r.data.prochaine || r.data.quand)) + '</td><td class="num">' + esc(r.data.repete || '') + '</td><td><span class="badge">' + esc(r.data.statut || '—') + '</span></td></tr>').join('') +
        '</tbody></table></div>' : empty(), true);
  },

  async journal () {
    const hist = await api(inSpace('/history?limit=100'));
    return card('', '<ul class="list">' + hist.map((h) => {
      const what = (h.after && (h.after.title || h.after.role || h.after.name)) || (h.before && (h.before.title || h.before.role)) || h.target;
      return '<li><span>' + esc(what) + ' <span class="muted">' + esc(said(h.command)) + ' · ' + esc(say(W.by, { who: h.client || (h.actor === me.person.id ? me.person.name : h.actor), door: h.door })) + ' · ' + esc(time(h.at)) + '</span></span>' +
        (h.undoneBy ? '<span class="badge">' + esc(W.undone) + '</span>' : h.command === 'journal.undo' || h.command.startsWith('space.') ? '' : '<button class="quiet" data-undo="' + h.id + '">' + esc(W.undo) + '</button>') + '</li>';
    }).join('') + '</ul>', true);
  },

  async espaces () {
    const spaces = await api('/spaces');
    const blocks = [];
    for (const s of spaces) {
      const mine = s.role === 'owner';
      let invites = '';
      if (mine && !s.personal) {
        const list = await api('/spaces/' + encodeURIComponent(s.id) + '/invitations');
        invites = list.filter((i) => i.state === 'open').map((i) => '<li><span>' + esc(i.email) + ' <span class="muted">' + esc(day(i.expiresAt)) + '</span></span><button class="quiet" data-withdraw="' + esc(s.id + '/' + i.id) + '">' + esc(W.withdraw) + '</button></li>').join('');
      }
      const charter = await api('/entries?kind=Charte&limit=5&space=' + encodeURIComponent(s.id));
      blocks.push(card(s.name, '<p class="muted" style="margin:0 0 8px">' + esc(s.personal ? W.own : W.shared) + ' · ' + esc(W[s.role] || s.role) + '</p>' +
        '<div class="caps">' + esc(W.members) + '</div><ul class="list">' + s.members.map((m) => '<li><span>' + esc(m.name || m.person) + '</span><span class="badge">' + esc(W[m.role] || m.role) + '</span></li>').join('') + '</ul>' +
        '<div class="caps" style="margin-top:10px">' + esc(W.charter) + '</div>' + (charter.length ? '<ul class="list">' + charter.map((c) => '<li><a class="link" href="#/entree/' + esc(c.id) + '" data-space="' + esc(s.id) + '">' + esc(c.title) + '</a></li>').join('') + '</ul>' : '<p class="muted">' + esc(W.noCharter) + '</p>') +
        (invites ? '<div class="caps" style="margin-top:10px">' + esc(W.invitations) + '</div><ul class="list">' + invites + '</ul>' : '') +
        (mine && !s.personal ? '<form class="actions" data-invite="' + esc(s.id) + '" style="margin-top:10px"><input class="field" type="email" required placeholder="' + esc(W.inviteEmail) + '" style="flex:1;min-width:180px"><button>' + esc(W.invite) + '</button></form><div data-link="' + esc(s.id) + '"></div>' : '') +
        '<div class="actions" style="margin-top:12px">' + (mine ? '<button class="quiet" data-rename="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + esc(W.rename) + '</button>' : '') +
        (s.personal ? '' : '<button class="quiet" data-leave="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + esc(W.leave) + '</button>') + '</div>'));
    }
    return '<section class="grid">' + blocks.join('') + card(W.newSpace, '<form class="actions" id="new-space"><input class="field" required style="flex:1;min-width:160px" placeholder="Nous"><button>' + esc(W.create) + '</button></form>') + '</section>';
  },

  async connexions () {
    const list = await api('/connections');
    const spaces = me.spaces;
    return card('', '<p class="muted" style="margin:0 0 8px">' + esc(W.connectLead) + '</p><div class="actions"><code class="url">' + esc(location.origin + '/mcp') + '</code><button class="quiet" data-copy="' + esc(location.origin + '/mcp') + '">' + esc(W.copy) + '</button></div>', true) +
      '<h2 style="margin:20px 0 10px">' + esc(W.connections) + '</h2>' +
      (list.length ? '<section class="grid">' + list.map((c) => card(c.name || c.clientId,
        '<p class="muted" style="margin:0 0 8px">' + esc(say(W.since, { date: day(c.since) })) + (c.used ? ' · ' + esc(say(W.lastUsed, { date: time(c.used) })) : '') + '</p>' +
        '<form data-reach="' + esc(c.clientId) + '"><div class="caps">' + esc(W.reach) + '</div>' + spaces.map((s) => '<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" value="' + esc(s.id) + '"' + (c.spaces.includes(s.id) ? ' checked' : '') + '> ' + esc(s.name) + '</label>').join('') +
        '<div class="actions" style="margin-top:8px"><button>' + esc(W.save) + '</button><button type="button" class="quiet" data-revoke="' + esc(c.clientId) + '" data-name="' + esc(c.name || c.clientId) + '">' + esc(W.revoke) + '</button></div></form>')).join('') + '</section>' : card('', empty(W.noConnections)));
  },

  async donnees () {
    return '<section class="grid">' +
      card(W.exportTitle, '<p class="muted">' + esc(W.exportLead) + '</p><a href="' + esc('/api/export?space=' + encodeURIComponent(space)) + '"><button>' + esc(say(W.exportButton, { space: spaceName() })) + '</button></a>') +
      card(W.importTitle, '<p class="muted">' + esc(W.importLead) + '</p><div class="stack"><label class="caps">' + esc(W.importKinds) + '<textarea class="field" id="kinds" placeholder=\\'{ "journal": "Journal" }\\'></textarea></label>' +
        '<label><span class="badge primary" style="cursor:pointer">' + esc(W.importChoose) + '</span><input type="file" id="folder" webkitdirectory multiple hidden></label>' +
        '<div class="actions"><button id="import" disabled>' + esc(say(W.importRun, { n: 0 })) + '</button></div><div id="report"></div></div>') +
      '</section>';
  },

  async compte () {
    return card(W.accountTitle, '<div class="field-row"><span class="caps">' + esc(W.name) + '</span><span>' + esc(me.person.name) + '</span><span></span></div>' +
      '<div class="field-row"><span class="caps">' + esc(W.email) + '</span><span>' + esc(me.person.email) + '</span><span></span></div>' +
      '<div class="actions" style="margin-top:14px"><button class="quiet" id="sign-out">' + esc(W.signOut) + '</button></div>');
  },
};

const titles = { '': 'navHome', vie: 'navLife', entree: 'navLife', documents: 'navDocuments', document: 'navDocuments', tableaux: 'navDashboards',
  rappels: 'navReminders', journal: 'navJournal', espaces: 'navSpaces', connexions: 'navConnections', donnees: 'navData', compte: 'navAccount' };

let drawing = 0;
async function show() {
  const [path, query] = location.hash.replace(/^#\\/?/, '').split('?');
  const [name, id] = path.split('/');
  const params = new URLSearchParams(query || '');
  const key = pages[name] ? name : '';
  document.getElementById('title').textContent = key === '' ? say(W.hello, { name: me.person.name }) : W[titles[key]];
  document.querySelectorAll('.nav a[data-page]').forEach((a) => a.classList.toggle('on', a.dataset.page === (titles[key] || 'navHome')));
  document.querySelector('.app').classList.remove('open');
  page().innerHTML = '<p class="empty">' + esc(W.loading) + '</p>';
  // Only the latest navigation is drawn: a slower earlier one never overwrites it.
  const ticket = ++drawing;
  try {
    const html = await pages[key](params, id ? decodeURIComponent(id) : undefined);
    if (ticket !== drawing) return;
    page().innerHTML = html; bind(); window.scrollTo(0, 0);
  } catch (error) { if (ticket === drawing) fail(error); }
}

function bind() {
  const root = page();
  root.querySelectorAll('[data-go]').forEach((row) => row.addEventListener('click', () => { location.hash = row.dataset.go; }));
  root.querySelectorAll('a[data-space]').forEach((a) => a.addEventListener('click', () => choose(a.dataset.space, false)));
  root.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await api(inSpace('/undo'), { method: 'POST', body: { journalId: Number(b.dataset.undo) } }); show(); } catch (error) { fail(error); }
  }));
  const aside = document.getElementById('aside');
  if (aside) aside.addEventListener('click', async () => {
    const id = location.hash.split('/')[2];
    if (!confirm(say(W.setAsideAsk, { title: document.querySelector('.page h1').textContent }))) return;
    try { await api(inSpace('/entries/' + id + '/archive'), { method: 'POST' }); show(); } catch (error) { fail(error); }
  });
  root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = W.copied; } catch {}
  }));
  root.querySelectorAll('form[data-invite]').forEach((f) => f.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = f.querySelector('input').value;
    try {
      const made = await api('/spaces/' + encodeURIComponent(f.dataset.invite) + '/invitations', { method: 'POST', body: { email } });
      root.querySelector('[data-link="' + f.dataset.invite + '"]').innerHTML = '<p class="muted">' + esc(say(W.inviteLink, { email })) + '</p><div class="actions"><code class="url">' + esc(made.link) + '</code><button class="quiet" id="copy-invite">' + esc(W.copy) + '</button></div>';
      document.getElementById('copy-invite').addEventListener('click', async (e) => { await navigator.clipboard.writeText(made.link); e.target.textContent = W.copied; });
    } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
    const [s, i] = b.dataset.withdraw.split('/');
    try { await api('/spaces/' + s + '/invitations/' + i, { method: 'DELETE' }); show(); } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', async () => {
    const name = prompt(W.newName, b.dataset.name); if (!name) return;
    try { await api('/spaces/' + b.dataset.rename, { method: 'PATCH', body: { name } }); await load(); show(); } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-leave]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(say(W.leaveAsk, { space: b.dataset.name }))) return;
    try { await api('/spaces/' + b.dataset.leave + '/members/me', { method: 'DELETE' }); await load(); show(); } catch (error) { alert(error.message); }
  }));
  const created = document.getElementById('new-space');
  if (created) created.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await api('/spaces', { method: 'POST', body: { name: created.querySelector('input').value } }); await load(); show(); } catch (error) { alert(error.message); }
  });
  root.querySelectorAll('form[data-reach]').forEach((f) => f.addEventListener('submit', async (event) => {
    event.preventDefault();
    const spaces = [...f.querySelectorAll('input:checked')].map((i) => i.value);
    try { await api('/clients/' + encodeURIComponent(f.dataset.reach) + '/spaces', { method: 'PUT', body: { spaces } }); f.querySelector('button').textContent = W.saved; } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(say(W.revokeAsk, { client: b.dataset.name }))) return;
    try { await api('/connections/' + encodeURIComponent(b.dataset.revoke), { method: 'DELETE' }); show(); } catch (error) { alert(error.message); }
  }));
  const folder = document.getElementById('folder');
  if (folder) {
    let docs = [];
    folder.addEventListener('change', async () => {
      const files = [...folder.files].filter((f) => /\\.md$/i.test(f.name) && !/(^|\\/)(\\.|node_modules\\/)/.test(f.webkitRelativePath));
      docs = await Promise.all(files.map(async (f) => ({ path: f.webkitRelativePath.split('/').slice(1).join('/'), text: await f.text() })));
      const run = document.getElementById('import'); run.disabled = !docs.length; run.textContent = say(W.importRun, { n: docs.length });
    });
    document.getElementById('import').addEventListener('click', async (event) => {
      event.target.disabled = true;
      const report = document.getElementById('report');
      try {
        const raw = document.getElementById('kinds').value.trim();
        const done = await api(inSpace('/import'), { method: 'POST', body: Object.assign({ docs }, raw ? { kinds: JSON.parse(raw) } : {}) });
        report.innerHTML = '<p>' + esc(say(W.importDone, done)) + '</p>' + (done.journalId ? '<button class="quiet" data-undo="' + done.journalId + '">' + esc(W.importUndo) + '</button>' : '');
        bind();
      } catch (error) { report.innerHTML = '<p class="error-text">' + esc(say(W.failed, { reason: error.message })) + '</p>'; event.target.disabled = false; }
    });
  }
  const out = document.getElementById('sign-out');
  if (out) out.addEventListener('click', async () => {
    await fetch('/auth/sign-out', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' });
    location.href = '/connexion';
  });
}

function choose(id, again) {
  space = id; try { localStorage.setItem('jarvis.space', id); } catch {}
  document.getElementById('space').value = id;
  if (again !== false) show();
}

async function load() {
  me = await api('/me');
  if (!space || !me.spaces.some((s) => s.id === space)) space = me.space.id;
  const select = document.getElementById('space');
  select.innerHTML = me.spaces.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + ' — ' + esc(s.personal ? W.own : W.shared) + '</option>').join('');
  select.value = space;
  document.getElementById('who').innerHTML = '<strong>' + esc(me.person.name) + '</strong><div class="muted" style="overflow-wrap:anywhere">' + esc(me.person.email) + '</div>';
}

document.getElementById('space').addEventListener('change', (event) => choose(event.target.value));
document.getElementById('search').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') location.hash = '#/vie?q=' + encodeURIComponent(event.target.value.trim());
});
document.getElementById('menu').addEventListener('click', () => document.querySelector('.app').classList.toggle('open'));
window.addEventListener('hashchange', show);
load().then(show).catch(fail);
`;

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Her web account: the shell; every page is drawn by the script from `/api`. */
export function appPage(lang: Lang): string {
  const words = appWords[lang];
  const link = (hash: string, key: keyof typeof words, icon: string) =>
    `<a href="#/${hash}" data-page="${key}">${icon}<span>${escape(words[key])}</span></a>`;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(words.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono:wght@600&display=swap">
<style>${brandCss}${css}</style></head>
<body><div class="app">
<aside class="side">
  <a class="logo" href="#/"><i>J</i>${escape(words.brand)}</a>
  <label class="caps">${escape(words.space)}<select id="space"></select></label>
  <nav class="nav">
    ${link('', 'navHome', ICONS.home)}
    ${link('vie', 'navLife', ICONS.life)}
    ${link('documents', 'navDocuments', ICONS.documents)}
    ${link('tableaux', 'navDashboards', ICONS.dashboards)}
    ${link('rappels', 'navReminders', ICONS.reminders)}
    ${link('journal', 'navJournal', ICONS.journal)}
    <div class="caps">${escape(words.navSettings)}</div>
    ${link('espaces', 'navSpaces', ICONS.spaces)}
    ${link('connexions', 'navConnections', ICONS.connections)}
    ${link('donnees', 'navData', ICONS.data)}
    ${link('compte', 'navAccount', ICONS.account)}
  </nav>
  <div class="who" id="who"></div>
</aside>
<div class="main">
  <header class="top">
    <button class="quiet" id="menu" aria-label="${escape(words.menu)}">☰</button>
    <h1 id="title"></h1>
    <input id="search" type="search" placeholder="${escape(words.search)}">
  </header>
  <main class="page" id="page"><p class="empty">${escape(words.loading)}</p></main>
</div>
</div>
<script>
const LANG = ${JSON.stringify(lang)};
const WORDS = ${JSON.stringify(words)};
${script}
</script></body></html>`;
}
