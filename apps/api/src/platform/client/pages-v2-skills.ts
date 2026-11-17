// Spec 082 — « Skills »: how the AI works for each thing she asks. Hers (the routines of her spaces:
// what starts them, what they make), Jarvis's own, and what her apps tell the assistant. One opens in
// the side card (hers) or in a drawer (Jarvis's, an app's); a new one is written here.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no backticks, no dollar-brace, and no backslashes.

export const v2Skills = `
let skTab = 'mine';
let skData = null;
Object.assign(v2Pages, {
  async skills () {
    skData = await api('/skills');
    const d = skData;
    const tabs = [['mine', W.skMine, d.mine.length], ['jarvis', W.skJarvis, d.jarvis.length], ['apps', W.skApps, d.apps.length]];
    const startOf = (s) => [s.phrases.map((p) => '« ' + p + ' »').join(', '), s.repeat || '', s.saved ? say(W.skWhenSaved, { kind: kindName(s.saved) }) : ''].filter(Boolean).join(' · ') || s.when || '—';
    const mine = d.mine.length ? d.mine.map((s) => '<a class="sk-row" href="#/entree/' + esc(s.id) + '" data-space="' + esc(s.spaceId) + '">' +
      '<span class="sk-ic">' + ic('i-spark') + '</span><span class="sk-main"><span class="t">' + esc(s.title) + '</span><span class="s">' + esc(s.excerpt || W.skNoText) + '</span></span>' +
      '<span class="sk-meta"><span class="sk-when">' + esc(startOf(s)) + '</span>' + (s.result ? '<span class="dt-tag">' + esc(kindName(s.result)) + '</span>' : '') + '<span class="sk-space"><span class="space-dot" style="background:' + spaceColorOf(s.spaceId) + '"></span>' + esc(s.space) + '</span></span></a>').join('')
      : '<div class="sk-empty"><b>' + esc(W.skNoneTitle) + '</b><p>' + esc(W.skNoneLead) + '</p><button class="btn solid" data-sk-new>' + ic('i-plus') + esc(W.skNew) + '</button></div>';
    const jarvis = d.jarvis.map((s, i) => '<button class="sk-row" data-sk-base="' + i + '"><span class="sk-ic">' + ic('i-shape') + '</span><span class="sk-main"><span class="t">' + esc(s.name) + '</span><span class="s">' + esc(s.when) + '</span></span><span class="sk-meta"><span class="dt-tag">' + esc(W.skBuiltIn) + '</span></span></button>').join('');
    const apps = d.apps.length ? d.apps.map((a, i) => '<button class="sk-row" data-sk-app="' + i + '"><span class="sk-ic">' + ic('i-box') + '</span><span class="sk-main"><span class="t">' + esc(a.app) + '</span><span class="s">' + esc(tr(a.covers) || '') + '</span></span><span class="sk-meta"><span class="sk-space">' + esc(a.space) + '</span></span></button>').join('') : '<div class="sk-empty"><p>' + esc(W.skNoApp) + '</p></div>';
    return v2head(esc(W.navSkills), esc(W.skLead), '<button class="btn solid" data-sk-new>' + ic('i-plus') + esc(W.skNew) + '</button>') +
      '<section class="panel sk-panel"><div class="nw-head"><div class="segmented">' + tabs.map((t) => '<button data-sk-tab="' + t[0] + '" aria-pressed="' + (skTab === t[0]) + '">' + esc(t[1]) + '<span class="n">' + t[2] + '</span></button>').join('') + '</div><span class="muted sk-hint">' + esc(skTab === 'mine' ? W.skMineHint : skTab === 'jarvis' ? W.skJarvisHint : W.skAppsHint) + '</span></div>' +
      '<div class="sk-list">' + (skTab === 'mine' ? mine : skTab === 'jarvis' ? jarvis : apps) + '</div></section>';
  },
});

function bindSkills(root) {
  root.querySelectorAll('[data-sk-tab]').forEach((b) => b.addEventListener('click', () => { skTab = b.dataset.skTab; show(); }));
  root.querySelectorAll('[data-sk-base]').forEach((b) => b.addEventListener('click', () => {
    const s = skData.jarvis[Number(b.dataset.skBase)];
    openDrawer(s.name, '<p class="muted" style="margin:0">' + esc(s.when) + '</p><div class="doc">' + s.html + '</div>', '', W.skBuiltIn);
    drawer().classList.add('pk');
  }));
  root.querySelectorAll('[data-sk-app]').forEach((b) => b.addEventListener('click', () => {
    const a = skData.apps[Number(b.dataset.skApp)];
    openDrawer(a.app, '<p class="muted" style="margin:0">' + esc(tr(a.covers) || '') + '</p><div class="doc"><p style="white-space:pre-wrap">' + esc(tr(a.instructions) || '') + '</p></div>', '<a class="btn" href="#/role/' + encodeURIComponent(a.app) + '">' + esc(W.skAppRole) + '</a>', W.skFromApp);
    drawer().classList.add('pk');
  }));
  root.querySelectorAll('[data-sk-new]').forEach((b) => b.addEventListener('click', () => skNew()));
}

// A new skill: its name, what starts it (a phrase, or a time), what the AI does, what it makes.
function skNew() {
  const f = (label, html, hint) => '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(label) + html + (hint ? '<small class="muted" style="font-weight:400">' + esc(hint) + '</small>' : '') + '</label>';
  openDrawer(W.skNew,
    f(W.skName, '<input class="field" id="sk-name" maxlength="120" placeholder="' + esc(W.skNameHint) + '">') +
    f(W.skPhrases, '<input class="field" id="sk-phrases" maxlength="300" placeholder="/bilan, mon bilan">', W.skPhrasesHint) +
    f(W.skRepeat, '<input class="field" id="sk-repeat" maxlength="80" placeholder="' + esc(W.skRepeatHint) + '">') +
    f(W.skDoes, '<textarea class="field" id="sk-text" rows="10" placeholder="' + esc(W.skDoesHint) + '"></textarea>', W.skDoesLead) +
    f(W.skResult, '<input class="field" id="sk-result" maxlength="80" placeholder="Bilan">', W.skResultHint) +
    f(W.space, '<select class="field" id="sk-space">' + me.spaces.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === space ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>'),
    '<button class="btn solid" id="sk-save">' + ic('i-check') + esc(W.stSave) + '</button>');
  drawer().classList.add('pk');
  document.getElementById('sk-name').focus();
  document.getElementById('sk-save').addEventListener('click', async () => {
    const name = document.getElementById('sk-name').value.trim();
    const text = document.getElementById('sk-text').value.trim();
    if (!name || !text) { alert(W.skNeeds); return; }
    const phrases = document.getElementById('sk-phrases').value.split(',').map((x) => x.trim()).filter(Boolean);
    const repeat = document.getElementById('sk-repeat').value.trim();
    const result = document.getElementById('sk-result').value.trim();
    const where = document.getElementById('sk-space').value;
    const trigger = {};
    if (phrases.length) trigger.phrases = phrases;
    if (repeat) trigger.repeat = repeat;
    const data = { trigger, instructions: text };
    if (result) data.result = { kind: result };
    try {
      const saved = await api('/save?space=' + encodeURIComponent(where), { method: 'POST', body: { entries: [{ kind: 'Routine', title: name, data, origin: 'said' }] } });
      closeDrawer(); skTab = 'mine'; toast(W.skSaved, { id: saved.entries[0].id, spaceId: where }); show();
    } catch (error) { alert(error.message); }
  });
}
`;
