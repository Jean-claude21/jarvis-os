// Which page the hash names, drawn once; her space chosen; the start.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const router = `
// Pages, by the hash: #/vie?kind=…, #/entree/<id>, …
const pages = Object.assign({}, dayPages, lifePages, settingsPages, v2Pages);
// The screens drawn in the mockup's markup: the page takes its styles (\`.v2\`).
const V2 = new Set(Object.keys(v2Pages));

const titles = { '': 'navNow', accueil: 'navHome', collections: 'navCollections', fichiers: 'navFiles', app: 'navApps', agenda: 'navAgenda', vie: 'navEntries', entree: 'navEntries', documents: 'navDocuments', document: 'navDocuments', tableaux: 'navDashboards',
  rappels: 'navReminders', ranger: 'navToSort', revue: 'navReview', personnes: 'navPeople', journal: 'navJournal', espaces: 'navSpaces', connexions: 'navConnections', donnees: 'navData', compte: 'navAccount' };

let drawing = 0;
async function show() {
  const [path, query] = location.hash.replace(/^#\\/?/, '').split('?');
  const [name, id] = path.split('/');
  const params = new URLSearchParams(query || '');
  const key = pages[name] ? name : '';
  document.getElementById('title').textContent = key === 'app' && id ? decodeURIComponent(id) : key === 'collections' && id ? kindName(decodeURIComponent(id)) : W[titles[key]];
  document.querySelectorAll('a[data-page]').forEach((a) => a.classList.toggle('on', a.dataset.page === (titles[key] || 'navNow')));
  document.querySelectorAll('a[data-app]').forEach((a) => a.classList.toggle('on', key === 'app' && a.dataset.app === id));
  document.querySelector('.shell').classList.remove('open'); closeDrawer();
  page().innerHTML = '<p class="empty">' + esc(W.loading) + '</p>';
  // Only the latest navigation is drawn: a slower earlier one never overwrites it.
  const ticket = ++drawing;
  try {
    const html = await pages[key](params, id ? decodeURIComponent(id) : undefined);
    if (ticket !== drawing) return;
    page().classList.toggle('v2', V2.has(key));
    page().innerHTML = html; bind(); bindV2(page()); window.scrollTo(0, 0);
    document.querySelectorAll('.x-tabbar a[data-tab]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === key));
    if (key === 'ranger') counts();
  } catch (error) { if (ticket === drawing) fail(error); }
}

function choose(id, again) {
  space = id; try { localStorage.setItem('jarvis.space', id); } catch {}
  drawApps().catch(() => undefined);
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
document.getElementById('menu').addEventListener('click', () => document.querySelector('.shell').classList.toggle('open'));
document.getElementById('tab-menu').addEventListener('click', () => document.querySelector('.shell').classList.toggle('open'));
// What waits for her yes (I13): its count beside « À ranger », on the computer and the phone.
async function counts() {
  try {
    const n = (await api('/to-sort')).length;
    for (const id of ['n-ranger', 'tab-ranger']) { const el = document.getElementById(id); if (el) { el.textContent = n; el.hidden = !n; el.style.display = n ? '' : 'none'; } }
  } catch {}
}
// Her spaces (I13): each opens its page; the selector on top filters the whole app.
function drawSpaces() {
  const colors = ['var(--primary)', 'var(--ochre)', 'var(--info)', 'var(--success)', 'var(--verify)'];
  document.getElementById('spaces-nav').innerHTML = '<div class="caps">' + esc(W.navSpacesTitle) + '</div>' + me.spaces.map((s, i) =>
    '<a class="navi" href="#/espaces" data-space-link="' + esc(s.id) + '"><span class="space-dot" style="width:9px;height:9px;border-radius:50%;flex:none;background:' + colors[i % colors.length] + '"></span><span>' + esc(s.name) + '</span></a>').join('');
  document.querySelectorAll('[data-space-link]').forEach((a) => a.addEventListener('click', () => choose(a.dataset.spaceLink, false)));
}
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
  openDrawer(W.navNote, '<textarea class="field" id="note-text" style="min-height:120px;font-family:inherit;font-size:15px" placeholder="' + esc(W.v2writeOrSay) + '"></textarea>', '<button class="primary" id="note-keep">' + esc(W.v2keep) + '</button>');
  const area = document.getElementById('note-text'); area.focus();
  document.getElementById('note-keep').addEventListener('click', async () => {
    const text = area.value.trim(); if (!text) return;
    try { await api(inSpace('/inbox'), { method: 'POST', body: { text } }); closeDrawer(); toast(W.v2kept, null); counts(); } catch (error) { alert(error.message); }
  });
});
window.addEventListener('hashchange', show);
load().then(() => { clock(); drawSpaces(); return drawApps(); }).then(show).then(() => counts()).catch(fail);
`;
