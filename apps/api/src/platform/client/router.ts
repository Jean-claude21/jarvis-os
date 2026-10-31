// Which page the hash names, drawn once; her space chosen; the start.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const router = `
// Pages, by the hash: #/vie?kind=…, #/entree/<id>, …
const pages = Object.assign({}, dayPages, lifePages, settingsPages);

const titles = { '': 'navNow', accueil: 'navHome', collections: 'navCollections', fichiers: 'navFiles', app: 'navApps', agenda: 'navAgenda', vie: 'navEntries', entree: 'navEntries', documents: 'navDocuments', document: 'navDocuments', tableaux: 'navDashboards',
  rappels: 'navReminders', journal: 'navJournal', espaces: 'navSpaces', connexions: 'navConnections', donnees: 'navData', compte: 'navAccount' };

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
    page().innerHTML = html; bind(); window.scrollTo(0, 0);
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
window.addEventListener('hashchange', show);
load().then(() => { clock(); return drawApps(); }).then(show).catch(fail);
`;
