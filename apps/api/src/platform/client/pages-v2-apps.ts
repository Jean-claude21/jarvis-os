// I13 / I6 / I7 / I14 — her apps, drawn in J-C's mockup: « Toutes les apps » (installed, pinned and
// ordered for her sidebar; the catalog, each previewed before it is installed; how they talk to each
// other: who reads and writes which common type, the bridges), and an app's role.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no dollar-brace, and every backslash written twice.

export const v2Apps = `
// The apps she pinned to her sidebar, in her order (kept in her preferences: every device alike).
const pinnedApps = () => (prefs && Array.isArray(prefs.pinned) ? prefs.pinned : []);
const COMMON = ['Person', 'Account', 'Transaction', 'Event', 'Task', 'Place', 'Fichier', 'Goal'];

Object.assign(v2Pages, {
  async apps (params) {
    const t = ['catalogue', 'liens'].includes(params.get('t')) ? params.get('t') : 'installees';
    await prefsNow();
    const mine = await api(inSpace('/apps/mine'));
    const tabs = '<nav class="tabs">' + [['installees', W.v2installed, mine.apps.length], ['catalogue', W.v2catalog], ['liens', W.v2howTheyTalk]].map((x) => '<a href="#/apps?t=' + x[0] + '"' + (t === x[0] ? ' aria-current="page"' : '') + '>' + esc(x[1]) + (x[2] !== undefined ? '<span class="n">' + x[2] + '</span>' : '') + '</a>').join('') + '</nav>';
    const want = '<button class="btn solid" data-want>' + ic('i-chat') + esc(W.v2iWant) + '</button>';
    if (t === 'liens') {
      const used = COMMON.filter((k) => mine.apps.some((a) => a.kinds.includes(k) || a.role.watches.includes(k) || a.role.reads.includes(k) || a.role.writes.includes(k)));
      const cell = (a, k) => { const r = a.role.watches.includes(k) || a.role.reads.includes(k); const w = a.role.writes.includes(k) || a.kinds.includes(k); return r && w ? '<span class="rw">' + esc(W.v2readsWrites) + '</span>' : w ? '<span class="w">' + esc(W.v2writesW) + '</span>' : r ? '<span class="r">' + esc(W.v2reads) + '</span>' : '<span class="faint">·</span>'; };
      const matrix = used.length ? '<div class="scroll"><table class="x-matrix"><thead><tr><th>' + esc(W.v2app) + '</th>' + used.map((k) => '<th style="text-align:center">' + esc(kindName(k)) + '</th>').join('') + '</tr></thead><tbody>' + mine.apps.map((a) => '<tr><td><div class="cell-title" style="display:flex;gap:8px;align-items:center">' + v2app(a.app) + esc(a.app) + '</div></td>' + used.map((k) => '<td class="c">' + cell(a, k) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.v2noCommon) + '</div>';
      const bridges = mine.bridges.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2when) + '</th><th></th><th>' + esc(W.v2then) + '</th><th>' + esc(W.v2state) + '</th></tr></thead><tbody>' + mine.bridges.map((b) => { const [from, to] = b.title.split(' → '); return '<tr><td><div class="cell-title" style="display:flex;gap:8px;align-items:center">' + v2app(b.app || from) + esc(b.app || '') + '</div><div class="cell-sub">' + esc(say(W.v2bridgeWhen, { kind: kindName(from) })) + '</div></td><td class="x-arrow">→</td><td><div class="cell-sub">' + esc(say(W.v2bridgeThen, { kind: kindName(to || '') })) + '</div></td><td><a class="tag ' + (b.active ? 'ok' : 'neutral') + '" href="#/entree/' + esc(b.id) + '">' + esc(b.active ? W.v2active : W.v2paused) + '</a></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.v2noBridge) + '</div>';
      return v2head(esc(W.navAllApps), esc(W.v2linksSub), '<button class="btn" data-ask-bridge>' + ic('i-chat') + esc(W.v2askBridge) + '</button>', '<span class="app-icon" style="background:var(--ink);color:var(--on-ink)">' + ic('i-link') + '</span>') + tabs +
        v2panel(W.v2whoReadsWrites, matrix, '<span class="muted" style="font-size:12px">' + esc(say(W.v2typesApps, { t: used.length, a: mine.apps.length })) + '</span>', 'i-shape') +
        v2panel(W.v2activeBridges, bridges, '', 'i-link') +
        '<div class="hint">' + ic('i-plug') + '<span>' + W.v2bridgesHint + '</span></div>';
    }
    if (t === 'catalogue') {
      const shipped = await api('/apps');
      const have = mine.apps.map((a) => a.app);
      return v2head(esc(W.navAllApps), esc(W.v2catalogSub), want) + tabs +
        '<div class="x-across">' + shipped.map((a) => '<div class="x-app' + (have.includes(a.app) ? ' write' : '') + '"><div class="top">' + v2app(a.app) + esc(a.app) + (have.includes(a.app) ? '<span class="tag ok" style="margin-left:auto">' + esc(W.installed) + '</span>' : '<button class="btn small" style="margin-left:auto" data-preview="' + esc(a.app) + '">' + esc(W.v2see) + '</button>') + '</div><p>' + esc(tr(a.description)) + '</p></div>').join('') + '</div>' +
        '<div class="hint">' + ic('i-chat') + '<span>' + esc(W.newAppHow) + '</span></div>';
    }
    // Installed: pinned first in her order, then the others; pin, unpin, move up.
    const pins = pinnedApps().filter((a) => mine.apps.some((x) => x.app === a));
    const ordered = pins.map((a) => mine.apps.find((x) => x.app === a)).concat(mine.apps.filter((x) => !pins.includes(x.app)));
    return v2head(esc(W.navAllApps), esc(say(W.v2installedSub, { n: mine.apps.length })), want) + tabs +
      (ordered.length ? '<div class="x-across">' + ordered.map((a) => { const on = pins.includes(a.app); return '<div class="x-app' + (on ? ' write' : '') + '"><div class="top">' + v2app(a.app) + '<a href="#/app/' + esc(encodeURIComponent(a.app)) + '" style="color:inherit">' + esc(a.app) + '</a><span style="margin-left:auto;display:flex;gap:4px">' + (on && pins.indexOf(a.app) > 0 ? '<button class="btn small" data-pin-up="' + esc(a.app) + '" aria-label="' + esc(W.v2moveUp) + '">↑</button>' : '') + '<button class="btn small" data-pin="' + esc(a.app) + '">' + esc(on ? W.v2pinned : W.v2pin) + '</button></span></div><p>' + esc(tr(a.role.covers)) + '</p><p class="faint" style="font-size:12px">' + esc(say(W.v2nKinds, { n: a.kinds.length })) + ' · <a href="#/role/' + esc(encodeURIComponent(a.app)) + '">' + esc(W.v2itsRole) + '</a></p></div>'; }).join('') + '</div>' : '<div class="panel"><div class="panel-body empty">' + esc(W.v2noApps) + '</div></div>');
  },

  // I6 — an app's role: what it covers, when it is concerned, what it reads and writes, what it asks.
  async role (params, name) {
    const mine = await api(inSpace('/apps/mine'));
    const a = mine.apps.find((x) => x.app === name);
    if (!a) return v2head(esc(name), '', '') + '<div class="panel"><div class="panel-body empty">' + esc(W.noApp) + '</div></div>';
    // Her words once each: « acheté » and « achete » are the same word.
    const fold2 = (w) => String(w).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const once = (list) => list.filter((w, i) => list.findIndex((x) => fold2(x) === fold2(w)) === i);
    const chips = (list, cls) => '<div class="x-intent">' + list.map((w) => '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(cls ? kindName(w) : '« ' + w + ' »') + '</span>').join('') + '</div>';
    const kinds = [...new Set(a.kinds.concat(a.role.watches, a.role.reads, a.role.writes))];
    const rw = kinds.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2kind) + '</th><th>' + esc(W.v2reads) + '</th><th>' + esc(W.v2writesW) + '</th></tr></thead><tbody>' + kinds.map((k) => '<tr><td><b>' + esc(kindName(k)) + '</b>' + (COMMON.includes(k) ? ' <span class="tag info">' + esc(W.v2common) + '</span>' : '') + '</td><td>' + (a.role.watches.includes(k) || a.role.reads.includes(k) ? '<span class="tag info">' + esc(W.v2reads) + '</span>' : '') + '</td><td>' + (a.role.writes.includes(k) || a.kinds.includes(k) ? '<span class="tag ok">' + esc(W.v2writesW) + '</span>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>';
    const own = mine.bridges.filter((b) => b.app === a.app);
    return v2head(esc(a.app) + ' <span class="built">' + esc(say(W.v2nKinds, { n: a.kinds.length })) + '</span>', esc(W.v2roleSub), '<a class="btn" href="#/app/' + esc(encodeURIComponent(a.app)) + '">' + esc(W.open) + '</a><button class="btn" data-remove-app="' + esc(a.app) + '">' + esc(W.v2remove) + '</button>', v2app(a.app)) +
      '<div class="x-grid">' +
      v2panel(W.v2covers, '<div class="pad"><p class="x-mirror" style="font-size:18px;margin:0">' + esc(tr(a.role.covers)) + '</p>' + (a.declared || a.role.intents.length ? '' : '<p class="muted" style="font-size:12.5px">' + esc(W.v2deduced) + '</p>') + '</div>', '', 'i-spark') +
      v2panel(W.v2concerned, '<div class="pad" style="display:flex;flex-direction:column;gap:12px"><div><div class="caps" style="margin-bottom:6px">' + esc(W.v2whatYouSay) + '</div>' + (a.role.intents.length ? chips(once(a.role.intents)) : '<span class="muted">—</span>') + '</div><div><div class="caps" style="margin-bottom:6px">' + esc(W.v2whatIsSaved) + '</div>' + (a.role.watches.length ? chips(a.role.watches, 't') : '<span class="muted">—</span>') + '</div></div>', '', 'i-bell') +
      '</div><div class="x-grid">' +
      v2panel(W.v2readsAndWrites, rw, '', 'i-shape') +
      v2panel(W.v2asks, a.role.ask.length ? '<div class="pad x-rel">' + a.role.ask.map((q) => '<a>' + ic('i-chat') + '<span>« ' + esc(tr(q)) + ' »</span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2asksNothing) + '</div>', '', 'i-chat') +
      '</div>' +
      (own.length ? v2panel(W.v2activeBridges, '<div class="pad x-rel">' + own.map((b) => '<a href="#/entree/' + esc(b.id) + '">' + ic('i-link') + '<span><b>' + esc(b.title) + '</b> <em>· ' + esc(b.active ? W.v2active : W.v2paused) + '</em></span></a>').join('') + '</div>', '', 'i-link') : '') +
      v2panel(W.v2assistantsKnow, '<div class="pad"><pre class="x-tech" style="white-space:pre-wrap">' + esc(a.line) + (a.role.instructions ? '\\n\\n' + esc(tr(a.role.instructions)) : '') + '</pre><p class="muted" style="font-size:12.5px;margin:10px 0 0">' + esc(W.v2assistantsNote) + '</p></div>', '<span class="tag ok">' + esc(W.v2upToDate) + '</span>', 'i-plug');
  },
});

// What « Toutes les apps » does: pin, order, preview and install, « je veux… », remove.
function bindApps(root) {
  const keepPins = async (list) => { keepPrefs({ pinned: list }); await drawApps(); show(); };
  root.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.pin; const now = pinnedApps();
    keepPins(now.includes(a) ? now.filter((x) => x !== a) : now.concat([a]));
  }));
  root.querySelectorAll('[data-pin-up]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.pinUp; const now = pinnedApps().slice(); const i = now.indexOf(a);
    if (i > 0) { now.splice(i, 1); now.splice(i - 1, 0, a); keepPins(now); }
  }));
  const want = root.querySelector('[data-want]');
  if (want) want.addEventListener('click', () => openDrawer(W.v2iWant, '<p>' + esc(W.newAppHow) + '</p><div class="hint" style="margin-top:12px">' + esc(W.v2wantHow) + '</div>'));
  const ask = root.querySelector('[data-ask-bridge]');
  if (ask) ask.addEventListener('click', () => openDrawer(W.v2askBridge, '<p>' + esc(W.v2askBridgeHow) + '</p>'));
  // I14 — before installing: what will be made, what of hers is reused; one line in the journal.
  root.querySelectorAll('[data-preview]').forEach((b) => b.addEventListener('click', async () => {
    const name = b.dataset.preview;
    try {
      const tried = await api(inSpace('/apps/install'), { method: 'POST', body: { name } });
      const r = tried.result;
      const rows = [[W.v2willMake, r.created.map((x) => '<span class="tag ok">' + esc(W.v2new) + '</span> ' + esc(x)).join(' · ')]];
      if (r.reuse && r.reuse.length) rows.push([W.v2reused, r.reuse.map((x) => '<span class="tag info">' + esc(W.v2yours) + '</span> ' + esc(say(W.v2reuseLine, { from: x.from, to: kindName(x.to), n: x.count }))).join(' · ')]);
      if (r.kept && r.kept.length) rows.push([W.v2alreadyThere, esc(say(W.installKept, { n: r.kept.length }))]);
      openDrawer(say(W.installWhat, { app: name }), '<div class="v2"><div class="scroll"><table><tbody>' + rows.map((x) => '<tr><td><b>' + esc(x[0]) + '</b></td><td>' + x[1] + '</td></tr>').join('') + '</tbody></table></div><div class="hint" style="margin-top:12px">' + ic('i-plug') + '<span>' + W.v2installHint + '</span></div><p class="error-text" id="i__error"></p></div>',
        '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button class="primary" id="i__go">' + esc(W.install) + '</button>');
      document.getElementById('i__go').addEventListener('click', async () => {
        try {
          await api(inSpace('/apps/install'), { method: 'POST', body: { name, dryRun: false } });
          closeDrawer(); toast(say(W.installedToast, { app: name }), null); await drawApps(); location.hash = '#/role/' + encodeURIComponent(name);
        } catch (error) { document.getElementById('i__error').textContent = error.message; }
      });
    } catch (error) { alert(error.message); }
  }));
  const remove = root.querySelector('[data-remove-app]');
  if (remove) remove.addEventListener('click', async () => {
    const name = remove.dataset.removeApp;
    try {
      const tried = await api(inSpace('/apps/remove'), { method: 'POST', body: { name, dryRun: true } });
      openDrawer(say(W.v2removeWhat, { app: name }), '<p>' + esc(W.v2removeKeeps) + '</p><ul class="list">' + tried.result.removed.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (tried.result.kept.length ? '<p class="muted">' + esc(say(W.v2removeKept, { list: tried.result.kept.join(', ') })) + '</p>' : ''),
        '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button class="primary" id="r__go">' + esc(W.v2remove) + '</button>');
      document.getElementById('r__go').addEventListener('click', async () => {
        try { await api(inSpace('/apps/remove'), { method: 'POST', body: { name, dryRun: false } }); closeDrawer(); toast(say(W.v2removed, { app: name }), null); await drawApps(); location.hash = '#/apps'; } catch (error) { alert(error.message); }
      });
    } catch (error) { alert(error.message); }
  });
}
`;
