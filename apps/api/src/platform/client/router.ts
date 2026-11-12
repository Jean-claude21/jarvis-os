// Which page the hash names, drawn once in J-C's mockup shell; her space chosen; the start.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no dollar-brace, and every backslash written twice.

export const router = `
// Pages, by the hash: #/vie?kind=…, #/entree/<id>, …
const pages = Object.assign({}, dayPages, lifePages, settingsPages, v2Pages);

// The title of each page, as the breadcrumb says it; the sidebar item it lights.
const titles = { '': 'navNow', accueil: 'navNow', collections: 'navModels', modeles: 'navModels', fichiers: 'navDocuments', app: 'navApps', agenda: 'navAgenda', vie: 'navEntries', entree: 'navEntries', documents: 'navDocuments', document: 'navDocuments', tableaux: 'navDashboards',
  rappels: 'navAgenda', ranger: 'navToSort', revue: 'navReview', personnes: 'navPeople', apps: 'navAllApps', role: 'navApps', espace: 'navSpaces', bienvenue: 'v2welcome', journal: 'navJournal', espaces: 'navSpaces', connexions: 'navConnections', donnees: 'navData', compte: 'navAccount' };
const navOf = { '': '', accueil: '', agenda: 'agenda', rappels: 'agenda', ranger: 'ranger', revue: 'revue', personnes: 'personnes', vie: 'vie', entree: 'vie', documents: 'documents', document: 'documents', fichiers: 'documents', tableaux: 'tableaux', apps: 'apps' };

// The breadcrumb: « Jarvis › … › the page ». A page may say more (its kind, its entry).
let crumbParts = null;
function crumbs(parts) { crumbParts = parts; }
function drawCrumbs(key, id) {
  const parts = crumbParts || [W[titles[key]] || W.navNow].concat(key === 'app' && id ? [id] : key === 'role' && id ? [W.navApps, id] : []);
  document.getElementById('crumbs').innerHTML = '<span class="hide-s">' + ic('i-panel') + '</span><span class="hide-s">' + esc(W.brand) + '</span>' +
    parts.map((p, i) => i === parts.length - 1 ? '<span class="hide-s">›</span><b>' + esc(p) + '</b>' : '<span class="hide-s">›</span><span class="hide-s">' + esc(p) + '</span>').join('');
  document.title = parts[parts.length - 1] + ' · ' + W.brand;
}

// The side and its menus, open or closed; the scrim behind what is open.
function closeAll() {
  ['side', 'scrim', 'me-menu', 'space-menu'].forEach((id) => { const el = document.getElementById(id); if (el) el.classList.remove('open'); });
  closeDrawer();
}

let drawing = 0;
// What makes the app fluid: each page drawn is kept (its HTML and its breadcrumb); coming back shows
// it at once, then it is drawn again behind and replaced only if something changed. Hovering a link
// prepares its page. A page is never repainted under her while she types.
const pageCache = new Map();
let shownKey = null;
let drawingNow = false;
let prefetching = null;
const cacheKeyOf = (hash) => (space || '') + '|' + (hash || '#/');
const routeOf = (hash) => {
  const [path, query] = String(hash || '').replace(/^#[/]?/, '').split('?');
  const [name, id] = path.split('/');
  return { key: pages[name] ? name : '', id: id ? decodeURIComponent(id) : undefined, params: new URLSearchParams(query || '') };
};
let prefetchKey = null;
let prefetchDiscard = false;
async function renderTo(cacheKey, route, ahead) {
  crumbParts = null;
  const html = await pages[route.key](route.params, route.id);
  const entry = { html: html, crumbs: crumbParts, at: Date.now() };
  if (ahead && prefetchDiscard) return entry;
  pageCache.set(cacheKey, entry);
  if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value);
  return entry;
}
function paint(entry, route, first) {
  const y = window.scrollY;
  page().innerHTML = entry.html; dress(page());
  crumbParts = entry.crumbs; drawCrumbs(route.key, route.id);
  bind(); bindV2(page()); bindAgenda(page()); bindEntry(page()); bindApps(page()); bindLife(page()); bindNow(page()); bindEntries2(page()); bindModels(page()); bindConnexions(page()); bindBlocks(page()); bindBoards(page()); bindRoutines(page());
  if (first) { page().scrollTop = 0; window.scrollTo(0, 0); } else window.scrollTo(0, y);
}
const typing = () => { const a = document.activeElement; return Boolean(a && page().contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
async function show() {
  const route = routeOf(location.hash);
  const cacheKey = cacheKeyOf(location.hash);
  const same = cacheKey === shownKey;
  closeAll();
  drawNav(route.key, route.id);
  // The page she hovered is being prepared: wait for it. Another one: ignore it (and keep nothing
  // of it, its breadcrumb could cross this one's).
  let overlap = false;
  if (prefetching && prefetchKey === cacheKey) await prefetching.catch(() => undefined);
  else if (prefetching) { prefetchDiscard = true; overlap = true; }
  const cached = pageCache.get(cacheKey);
  // Only the latest navigation is drawn: a slower earlier one never overwrites it.
  const ticket = ++drawing;
  drawingNow = true;
  if (!same) {
    if (cached) paint(cached, route, true);
    else page().innerHTML = '<div class="empty">' + esc(W.loading) + '</div>';
  }
  shownKey = cacheKey;
  document.querySelectorAll('.x-tabbar a[data-tab]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === route.key));
  try {
    // Just prepared by a hover: shown as it is.
    const entry = cached && !same && Date.now() - cached.at < 4000 ? cached : await renderTo(cacheKey, route);
    if (overlap) entry.crumbs = null;
    if (ticket !== drawing) return;
    if (!cached || same || entry.html !== cached.html) {
      if (cached && !same && typing()) return;
      paint(entry, route, !cached && !same);
    }
    if (route.key === 'ranger' || route.key === '') counts();
  } catch (error) { if (ticket === drawing && !cached) fail(error); }
  finally { if (ticket === drawing) drawingNow = false; }
}
// A link hovered: its page prepared, when nothing is being drawn.
let hoverTimer = null;
document.addEventListener('mouseover', (event) => {
  const a = event.target && event.target.closest ? event.target.closest('a[href^="#/"]') : null;
  if (!a) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    const hash = a.getAttribute('href');
    const cacheKey = cacheKeyOf(hash);
    const known = pageCache.get(cacheKey);
    if (prefetching || cacheKey === shownKey || (known && Date.now() - known.at < 30000)) return;
    if (drawingNow) return;
    const saved = crumbParts;
    prefetchKey = cacheKey; prefetchDiscard = false;
    prefetching = renderTo(cacheKey, routeOf(hash), true).catch(() => undefined).finally(() => { if (!prefetchDiscard) crumbParts = saved; prefetching = null; prefetchKey = null; });
  }, 120);
});

// The sidebar, as the mockup draws it: her day, her life, her apps, her spaces, each with its count.
let navApps = [];
let navCounts = {};
const SPACE_COLORS2 = ['var(--primary)', 'var(--ochre)', 'var(--info)', 'var(--success)', 'var(--verify)'];
function drawNav(key, id) {
  const on = navOf[key] !== undefined ? navOf[key] : key;
  const item = (href, label, icon, here, count, hot) => '<a class="nav-item" href="' + href + '"' + (here ? ' aria-current="page"' : '') + '>' + icon + esc(label) + (count ? '<span class="count' + (hot ? ' hot' : '') + '">' + esc(count) + '</span>' : '') + '</a>';
  const group = (title, items, extra) => '<div class="nav-group"><div class="caps">' + esc(title) + (extra || '') + '</div>' + items.join('') + '</div>';
  const appIcon = (a) => '<span class="app-icon" style="background:' + appColor(a) + '"><span style="font:700 10px/1 Archivo,sans-serif;color:var(--on-primary)">' + esc(String(a).slice(0, 1).toUpperCase()) + '</span></span>';
  document.getElementById('nav').innerHTML =
    group(W.navDaily, [
      item('#/', W.navNow, ic('i-now'), on === '', navCounts.now, true),
      item('#/agenda', W.navAgenda, ic('i-cal'), on === 'agenda'),
      item('#/ranger', W.navToSort, ic('i-box'), on === 'ranger', navCounts.ranger, true),
      item('#/revue', W.navReview, ic('i-eye'), on === 'revue'),
    ]) +
    group(W.navLife, [
      item('#/personnes', W.navPeople, ic('i-person'), on === 'personnes', navCounts.people),
      item('#/vie', W.navEntries, ic('i-life'), on === 'vie', navCounts.entries),
      item('#/documents', W.navDocuments, ic('i-doc'), on === 'documents'),
      item('#/tableaux', W.navDashboards, ic('i-chart'), on === 'tableaux', navCounts.boards),
    ]) +
    group(W.navApps, navApps.map((a) => item('#/app/' + encodeURIComponent(a), a, appIcon(a), (key === 'app' || key === 'role') && id === a)).concat(['<a class="nav-item ghost" href="#/apps"' + (on === 'apps' ? ' aria-current="page"' : '') + '>' + ic('i-plus') + esc(W.navAllApps) + '</a>'])) +
    group(W.navSpacesTitle, me ? me.spaces.map((s, i) => '<a class="nav-item" href="#/espace/' + esc(s.id) + '"' + (key === 'espace' && id === s.id ? ' aria-current="page"' : '') + '><span class="space-dot" style="background:' + SPACE_COLORS2[i % SPACE_COLORS2.length] + '"></span>' + esc(s.name) + '</a>') : []);
}

// Her space: the switcher on top filters the whole app.
function choose(id, again) {
  space = id; try { localStorage.setItem('jarvis.space', id); } catch {}
  drawSwitcher();
  drawApps().catch(() => undefined);
  if (again !== false) show();
}
function drawSwitcher() {
  const s = me.spaces.find((x) => x.id === space) || me.space;
  document.getElementById('space-name').textContent = s.name + ' · ' + (s.personal ? W.own : W.shared);
  document.getElementById('space-menu').innerHTML = me.spaces.map((x, i) => '<button data-space="' + esc(x.id) + '"' + (x.id === space ? ' aria-current="true" style="font-weight:600"' : '') + '><span class="space-dot" style="background:' + SPACE_COLORS2[i % SPACE_COLORS2.length] + '"></span>' + esc(x.name) + '<span class="muted" style="margin-left:auto;font-size:12px">' + esc(x.personal ? W.own : W.shared) + '</span></button>').join('') +
    '<button data-go="#/espaces">' + ic('i-plus') + esc(W.newSpace) + '</button>';
  document.querySelectorAll('#space-menu [data-space]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.space)));
  document.querySelectorAll('#space-menu [data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
}

async function load() {
  me = await api('/me');
  if (!space || !me.spaces.some((s) => s.id === space)) space = me.space.id;
  drawSwitcher();
  const name = me.person.name || me.person.email;
  document.getElementById('me-initials').textContent = String(name).split(/ +/).map((w) => w.slice(0, 1)).join('').slice(0, 2).toUpperCase();
  document.getElementById('me-name').textContent = name;
  document.getElementById('me-sub').textContent = me.person.email;
}

// What needs her: counts beside « Maintenant » and « À ranger », the pip on the bell.
async function counts() {
  try {
    const [toSort, now] = await Promise.all([api('/to-sort'), api('/now')]);
    navCounts.ranger = toSort.length || '';
    navCounts.now = now.items.length || '';
    for (const id of ['tab-ranger']) { const el = document.getElementById(id); if (el) { el.textContent = toSort.length; el.style.display = toSort.length ? '' : 'none'; } }
    document.getElementById('pip').style.display = now.items.some((i) => i.group === 'fix' || i.group === 'late') ? '' : 'none';
    const [path] = location.hash.replace(/^#[/]?/, '').split('?');
    const [name, id] = path.split('/');
    drawNav(pages[name] ? name : '', id ? decodeURIComponent(id) : undefined);
  } catch {}
}

document.getElementById('switcher').addEventListener('click', (event) => { event.stopPropagation(); document.getElementById('space-menu').classList.toggle('open'); document.getElementById('me-menu').classList.remove('open'); });
document.getElementById('me').addEventListener('click', (event) => { event.stopPropagation(); document.getElementById('me-menu').classList.toggle('open'); document.getElementById('space-menu').classList.remove('open'); });
document.querySelectorAll('#me-menu [data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
document.addEventListener('click', (event) => { if (!event.target.closest('#me-menu, #me, #space-menu, #switcher')) { document.getElementById('me-menu').classList.remove('open'); document.getElementById('space-menu').classList.remove('open'); } });
const openSide = () => { document.getElementById('side').classList.add('open'); document.getElementById('scrim').classList.add('open'); };
document.getElementById('open-side').addEventListener('click', openSide);
document.getElementById('tab-menu').addEventListener('click', openSide);
document.getElementById('scrim').addEventListener('click', closeAll);
document.getElementById('open-journal').addEventListener('click', journalDrawer);
document.getElementById('open-bell').addEventListener('click', bellDrawer);

// « Chercher ou noter »: a question is answered (I8); other words are understood, to keep or file.
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('search').focus(); }
  if (event.key === 'Escape') closeAll();
});
document.getElementById('search').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || !event.target.value.trim()) return;
  event.preventDefault();
  const q = event.target.value.trim();
  if (/[?]$|^(combien|how much|how many|total|quel total|quand|qui|quel|quelle)[ ]/i.test(q)) answer(q);
  else captureDrawer(q);
});

// Her theme: light, dark, or as her device says; kept on this device.
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
try { applyTheme(localStorage.getItem('jarvis.theme')); } catch {}
document.getElementById('theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  applyTheme(next); try { localStorage.setItem('jarvis.theme', next); } catch {}
});
// « Noter » (I11): a few words kept at once, as she said them, to file later.
document.getElementById('note').addEventListener('click', () => {
  openDrawer(W.navNote, '<div class="x-q"><textarea id="note-text" style="min-height:140px;font-size:15px" placeholder="' + esc(W.v2writeOrSay) + '"></textarea></div>', '<button class="btn" data-close>' + esc(W.cancel) + '</button><button class="btn solid" id="note-keep">' + ic('i-check') + esc(W.v2keep) + '</button>', W.v2noteSub);
  const area = document.getElementById('note-text'); area.focus();
  document.getElementById('note-keep').addEventListener('click', async () => {
    const text = area.value.trim(); if (!text) return;
    try { await api(inSpace('/inbox'), { method: 'POST', body: { text } }); closeDrawer(); toast(W.v2kept, null); counts(); } catch (error) { alert(error.message); }
  });
});
window.addEventListener('hashchange', show);
load().then(() => { clock(); return drawApps(); }).then(() => {
  // Her first time (I10): nothing kept yet, and no page asked: the welcome.
  if (!location.hash.replace(/^#[/]?/, '') && !knownKinds.some((k) => (k.count || 0) > 0)) location.hash = '#/bienvenue';
  return show();
}).then(() => counts()).catch(fail);
`;
