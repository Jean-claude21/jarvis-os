// Spec 081 — « Réglages », after Gr8r Studio's settings: a column of sections on the left (general,
// her spaces, her tools, the journal), the section on the right. A space has its own section: its
// name, its colour (the dot of the sidebar, the agenda, the deadlines), what it is for, who belongs,
// its charter and routines, and leaving it.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no backticks, no dollar-brace, and no backslashes.

export const v2Settings = `
// Her spaces' colours: the one she chose, else one of these by the order of her spaces.
const SPACE_PALETTE = ['#b0451f', '#c08a2c', '#3c6e9e', '#2f7d55', '#6a4fa0', '#c0447a', '#1e8580', '#5f5e5a'];
function spaceColorOf(id) {
  const all = (me && me.spaces) || [];
  const i = Math.max(0, all.findIndex((s) => s.id === id));
  const s = all[i];
  return (s && s.color) || SPACE_PALETTE[i % SPACE_PALETTE.length];
}
let stColor = null;

Object.assign(v2Pages, {
  async reglages (params) {
    const sec = params.get('s') || 'espace';
    const spaces = await api('/spaces');
    const sid = params.get('id') || space;
    const link = (s, id, label, icon, here) => '<a class="st-item" href="#/reglages?s=' + s + (id ? '&id=' + encodeURIComponent(id) : '') + '"' + (here ? ' aria-current="page"' : '') + '>' + icon + '<span>' + esc(label) + '</span></a>';
    const dot = (id) => '<span class="space-dot" style="background:' + spaceColorOf(id) + '"></span>';
    const groups = [
      [W.stGeneral, [link('compte', null, W.navAccount, ic('i-person'), sec === 'compte'), link('apparence', null, W.stAppearance, ic('i-moon'), sec === 'apparence')]],
      [W.navSpacesTitle, spaces.map((s) => link('espace', s.id, s.name, dot(s.id), sec === 'espace' && s.id === sid)).concat([link('espaces', null, W.stNewSpace, ic('i-plus'), sec === 'espaces')])],
      [W.stTools, [link('connexions', null, W.navConnections, ic('i-plug'), sec === 'connexions'), link('collections', null, W.navModels, ic('i-shape'), sec === 'collections'), link('donnees', null, W.navData, ic('i-box'), sec === 'donnees')]],
      [W.stHistory, [link('journal', null, W.navJournal, ic('i-history'), sec === 'journal')]],
    ];
    const nav = '<nav class="st-nav" aria-label="' + esc(W.navSettings) + '">' + groups.map((g) => '<div class="st-group"><div class="caps">' + esc(g[0]) + '</div>' + g[1].join('') + '</div>').join('') + '</nav>';
    let body;
    if (sec === 'espace') body = stSpace(spaces.find((s) => s.id === sid) || spaces[0]);
    else if (sec === 'apparence') {
      const now = (function () { try { return localStorage.getItem('jarvis.theme') || ''; } catch { return ''; } })();
      body = stHead(W.stAppearance, W.stAppearanceLead) + stRow(W.stTheme, W.stThemeLead, '<div class="segmented">' + [['', W.stThemeAuto], ['light', W.stThemeLight], ['dark', W.stThemeDark]].map((t) => '<button data-st-theme="' + t[0] + '" aria-pressed="' + (now === t[0]) + '">' + esc(t[1]) + '</button>').join('') + '</div>');
    } else body = await pages[sec](params);
    return '<div class="st">' + nav + '<div class="st-main">' + body + '</div></div>';
  },
});

const stHead = (title, lead) => '<div class="st-head"><h1>' + esc(title) + '</h1>' + (lead ? '<p>' + esc(lead) + '</p>' : '') + '</div>';
const stRow = (title, lead, control) => '<div class="st-row"><div><div class="t">' + esc(title) + '</div>' + (lead ? '<div class="d">' + esc(lead) + '</div>' : '') + '</div><div class="st-ctl">' + control + '</div></div>';

function stSpace(s) {
  stColor = null;
  const owner = s.role === 'owner';
  const color = spaceColorOf(s.id);
  const swatches = SPACE_PALETTE.map((c) => '<button type="button" class="st-swatch" data-st-color="' + c + '" style="background:' + c + '" aria-label="' + esc(c) + '" aria-pressed="' + (c === color) + '"' + (owner ? '' : ' disabled') + '></button>').join('') +
    '<label class="st-swatch st-custom" title="' + esc(W.stOtherColor) + '"><input type="color" data-st-custom value="' + esc(color) + '"' + (owner ? '' : ' disabled') + ' aria-label="' + esc(W.stOtherColor) + '"></label>';
  const members = '<ul class="st-members">' + s.members.map((m) => '<li><span class="st-avatar">' + esc(String(m.name || m.person || '?').slice(0, 1).toUpperCase()) + '</span><span>' + esc(m.name || m.person) + (m.person === me.person.id ? ' <span class="muted">(' + esc(W.v2you) + ')</span>' : '') + '</span><span class="muted">' + esc(W[m.role] || m.role) + '</span></li>').join('') + '</ul>';
  return stHead(s.name, s.personal ? W.stOwnLead : W.stSharedLead) +
    '<form class="st-card" data-st-space="' + esc(s.id) + '">' +
      '<div class="st-ident"><span class="st-icon" id="st-icon" style="background:' + color + '">' + esc(String(s.name).slice(0, 1).toUpperCase()) + '</span><div><div class="t">' + esc(W.stColor) + '</div><div class="st-swatches">' + swatches + '</div></div></div>' +
      '<label class="st-field"><span>' + esc(W.stName) + '</span><input class="field" name="name" required maxlength="120" value="' + esc(s.name) + '"' + (owner ? '' : ' disabled') + '></label>' +
      '<label class="st-field"><span>' + esc(W.stWhat) + '</span><textarea class="field" name="description" rows="2" maxlength="280" placeholder="' + esc(W.stWhatHint) + '"' + (owner ? '' : ' disabled') + '>' + esc(s.description || '') + '</textarea></label>' +
      (owner ? '<div><button class="btn solid">' + esc(W.stSave) + '</button></div>' : '<p class="muted">' + esc(W.stOwnerOnly) + '</p>') +
    '</form>' +
    '<h2 class="st-h2">' + esc(W.members) + '</h2>' + members + (s.personal ? '' : stRow(W.stInvite, W.stInviteLead, '<a class="btn" href="#/reglages?s=espaces">' + esc(W.invite) + '</a>')) +
    '<h2 class="st-h2">' + esc(W.stHow) + '</h2>' + stRow(W.stCharter, W.stCharterLead, '<a class="btn" href="#/espace/' + esc(s.id) + '">' + esc(W.open) + '</a>') +
    (s.personal ? '' : '<h2 class="st-h2 st-danger">' + esc(W.stDanger) + '</h2>' + stRow(W.leave, W.stLeaveLead, '<button class="btn st-danger-btn" data-leave="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + esc(W.leave) + '</button>'));
}

function bindSettings(root) {
  const form = root.querySelector('form[data-st-space]');
  const icon = root.querySelector('#st-icon');
  const pick = (c) => { stColor = c; if (icon) icon.style.background = c; root.querySelectorAll('[data-st-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stColor === c))); };
  root.querySelectorAll('[data-st-color]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.stColor)));
  const custom = root.querySelector('[data-st-custom]');
  if (custom) custom.addEventListener('input', () => pick(custom.value));
  if (form) form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = form.dataset.stSpace;
    const body = { name: form.querySelector('[name=name]').value.trim(), description: form.querySelector('[name=description]').value.trim() || null };
    if (stColor) body.color = stColor;
    try {
      await api('/spaces/' + encodeURIComponent(id), { method: 'PATCH', body });
      me = await api('/me');
      toast(W.stSaved, null); show();
    } catch (error) { alert(error.message); }
  });
  root.querySelectorAll('[data-st-theme]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.stTheme;
    applyTheme(t || null);
    try { if (t) localStorage.setItem('jarvis.theme', t); else localStorage.removeItem('jarvis.theme'); } catch {}
    show();
  }));
}
`;
