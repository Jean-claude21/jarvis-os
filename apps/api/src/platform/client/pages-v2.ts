// The screens of plan v2 (section I), drawn in J-C's mockup (`docs/design/jarvis-v2.html`): the
// same markup, the same classes (`./styles-v2`), read from `/api`. « À ranger » (I12), the review
// (I1), her people (I4).
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no dollar-brace, and every backslash written twice.

export const v2Pages = `
// The mockup's pieces: an icon of its sprite, a page head, a panel, a figure, an origin.
const ic = (n, style) => '<svg class="i"' + (style ? ' style="' + style + '"' : '') + '><use href="#' + n + '"/></svg>';
const v2head = (title, sub, actions, lead) => '<div class="page-head"><div><h1>' + (lead || '') + title + '</h1><p>' + (sub || '') + '</p></div><div class="head-actions">' + (actions || '') + '</div></div>';
const v2panel = (title, body, right, icon) => '<section class="panel"><div class="panel-head"><span class="left caps">' + (icon ? ic(icon) : '') + esc(title) + '</span>' + (right || '') + '</div><div class="panel-body">' + body + '</div></section>';
const v2kpi = (label, v, s, cls) => '<div class="kpi ' + (cls || '') + '"><div class="caps">' + esc(label) + '</div><div class="v">' + v + '</div><div class="s">' + (s || '') + '</div></div>';
const v2origin = (o) => '<span class="origin ' + esc(o) + '">' + esc(W[o] || o) + '</span>';
// An app as the mockup shows it: its colour, its first letter.
const APP_COLORS = ['var(--primary)', 'var(--success)', 'var(--info)', 'var(--ochre)', 'var(--verify)', 'var(--ink)'];
const appColor = (name) => { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 997; return APP_COLORS[h % APP_COLORS.length]; };
const v2app = (name) => '<span class="app-icon" style="background:' + appColor(name) + ';color:var(--on-primary);font:700 11px/1 Archivo,sans-serif">' + esc(String(name).slice(0, 1).toUpperCase()) + '</span>';
const v2touch = (name, href) => '<a class="x-touch" href="' + esc(href || '#/apps') + '">' + v2app(name) + esc(name) + '</a>';
const money2 = (n, cur) => num(Math.round(n)) + ' ' + (!cur || cur === 'XOF' ? 'F' : cur === 'EUR' ? '€' : cur);
const ago = (iso) => {
  if (!iso) return '';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? W.v2today : days === 1 ? W.v2yesterday : say(W.v2daysAgo, { n: days });
};
// « 11 j », « hier »: a duration short enough for a figure.
const agoShort = (iso) => {
  if (!iso) return '—';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? W.v2today : days === 1 ? W.v2yesterday : say(W.v2daysShort, { n: days });
};
// The list and its detail, as in the mockup: on a phone, one then the other.
const v2board = (title, icon, list, detail) => '<div class="board' + (reading ? ' reading' : '') + '"><section class="panel list-panel"><div class="panel-head"><span class="left caps">' + ic(icon) + esc(title) + '</span></div><div class="panel-body list">' + list + '</div></section><section class="detail"><button class="back" data-back>' + ic('i-left') + esc(W.v2backToList) + '</button>' + detail + '</section></div>';

const v2Pages = {
  // I12 / C7 — « À ranger »: everything that waits for her yes, one by one.
  async ranger () {
    const items = await api('/to-sort');
    const sel = items.find((x) => x.id === pick) || items[0];
    const iconOf = { capture: 'i-chat', proposed: 'i-spark', proposal: 'i-spark', merge: 'i-shape' };
    const tagOf = (x) => x.type === 'capture' ? (x.detail.guess && x.detail.guess.sure ? ['ok', W.v2sure] : ['info', W.v2toFile]) : x.type === 'merge' ? ['neutral', W.v2merge] : ['late', W.v2toConfirm];
    const sourceOf = (x) => x.type === 'capture' ? (W['src_' + x.detail.source] || x.detail.source || '') : x.type === 'proposal' ? W.v2proposal : x.type === 'merge' ? W.v2sameThing : kindName(x.detail.kind);
    const list = items.length ? items.map((x) => { const t = tagOf(x); return '<button class="row" data-pick="' + esc(x.id) + '" aria-selected="' + (sel && x.id === sel.id) + '"><span class="kind">' + ic(iconOf[x.type]) + '</span><div><div class="t">' + esc(x.title) + '</div><div class="s">' + esc(sourceOf(x)) + (x.detail.at ? ' · ' + esc(ago(x.detail.at)) : '') + '</div></div><span class="tag ' + t[0] + '">' + esc(t[1]) + '</span></button>'; }).join('') : '<div class="empty">' + esc(W.v2allFiled) + '</div>';
    let det = '<section class="panel"><div class="panel-body empty">' + esc(W.v2nothingToFile) + '</div></section>';
    if (sel) {
      const d = sel.detail;
      let body = '';
      let choices = '';
      if (sel.type === 'capture') {
        const g = d.guess || {};
        const rows = [];
        if (g.amount != null) rows.push([W.v2amount, money2(g.amount, g.currency)]);
        if (g.account) rows.push([W.v2account, W['acc_' + g.account] || g.account]);
        if (g.apps && g.apps.length) rows.push([W.v2apps, g.apps.join(', ')]);
        if (g.tags && g.tags.length) rows.push([W.v2tags, g.tags.map((t) => '#' + t).join(' ')]);
        body = rows.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2understood) + '</th><th>' + esc(W.v2value) + '</th><th>' + esc(W.v2originH) + '</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r[0]) + '</td><td><b>' + esc(r[1]) + '</b></td><td>' + v2origin('inferred') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="context">' + esc(W.v2noGuess) + '</p>';
        choices = (g.sure ? '<article class="choice recommended"><div class="choice-head"><h3>' + esc(W.v2fileAsMove) + '</h3><span class="why">' + esc(W.v2recommended) + '</span></div><p>' + esc(say(W.v2fileAsMoveWhy, { amount: money2(g.amount, g.currency) })) + '</p><div class="choice-foot"><button class="btn solid" data-file-move="' + esc(sel.id) + '">' + ic('i-check') + esc(W.v2doIt) + '</button></div></article>' : '') +
          '<article class="choice' + (g.sure ? '' : ' recommended') + '"><div class="choice-head"><h3>' + esc(W.v2fileAsNote) + '</h3></div><p>' + esc(W.v2fileAsNoteWhy) + '</p><div class="choice-foot"><button class="btn' + (g.sure ? '' : ' solid') + '" data-file-note="' + esc(sel.id) + '">' + ic('i-check') + esc(W.v2doIt) + '</button></div></article>' +
          '<article class="choice"><div class="choice-head"><h3>' + esc(W.v2askClaude) + '</h3></div><p>' + esc(W.v2askClaudeWhy) + '</p></article>';
      } else if (sel.type === 'proposal') {
        body = (d.why ? '<p class="context">' + esc(d.why) + '</p>' : '') + '<div class="x-across">' + (d.apps && d.apps.length ? d.apps : ['Jarvis']).map((a, i) => '<div class="x-app write"><div class="top">' + v2app(a) + esc(a) + '<span class="tag ok" style="margin-left:auto">' + esc(W.v2writes) + '</span></div><p>' + esc((d.makes || []).filter((_, j) => d.apps && d.apps.length > 1 ? j % d.apps.length === i : true).map((m) => m.changes ? say(W.v2changes, { what: kindName(m.kind) + ' « ' + m.title + ' »', fields: m.changes.map((f) => W['lbl_' + f] || W['part_' + f] || f).join(', ') }) : kindName(m.kind) + ' « ' + m.title + ' »').join(' · ')) + '</p></div>').join('') + '</div>';
        choices = '<article class="choice recommended"><div class="choice-head"><h3>' + esc(W.v2writeAll) + '</h3><span class="why">' + esc(say(W.v2inApps, { n: (d.apps || []).length || 1 })) + '</span></div><p>' + esc(W.v2writeAllWhy) + '</p><div class="choice-foot"><button class="btn solid" data-decide="' + esc(sel.id) + ':1:' + esc(sel.spaceId) + '">' + ic('i-check') + esc(W.v2writeAll) + '</button><button class="btn" data-decide="' + esc(sel.id) + ':0:' + esc(sel.spaceId) + '">' + esc(W.v2no) + '</button></div></article>';
      } else if (sel.type === 'proposed') {
        const fields = Object.keys(d.data || {}).filter((f) => !['status', 'then'].includes(f)).slice(0, 10);
        body = '<div class="scroll"><table><thead><tr><th>' + esc(W.v2field) + '</th><th>' + esc(W.v2value) + '</th><th>' + esc(W.v2originH) + '</th></tr></thead><tbody>' + fields.map((f) => '<tr><td>' + esc(f) + '</td><td><b>' + esc(typeof d.data[f] === 'object' ? JSON.stringify(d.data[f]) : d.data[f]) + '</b></td><td>' + v2origin((d.origin && d.origin[f]) || 'inferred') + '</td></tr>').join('') + '</tbody></table></div>';
        choices = '<article class="choice recommended"><div class="choice-head"><h3>' + esc(W.a_accept) + '</h3></div><p>' + esc(W.a_acceptWhy) + '</p><div class="choice-foot"><button class="btn solid" data-decide="' + esc(sel.id) + ':1:' + esc(sel.spaceId) + '">' + ic('i-check') + esc(W.a_accept) + '</button><button class="btn" data-decide="' + esc(sel.id) + ':0:' + esc(sel.spaceId) + '">' + esc(W.a_refuse) + '</button></div></article>';
      } else {
        body = '<p class="context">' + esc(say(W.v2mergeWhy, { from: d.from, to: d.to, n: d.count })) + '</p>' + (d.steps && d.steps.length ? '<ul class="checks">' + d.steps.map((s) => '<li class="good">' + ic('i-check') + '<span>' + esc(s.rename ? s.rename.from + ' → ' + s.rename.to : s.set ? s.set.field + ' = ' + s.set.formula : JSON.stringify(s)) + '</span></li>').join('') + '</ul>' : '');
        choices = '<article class="choice recommended"><div class="choice-head"><h3>' + esc(W.v2mergeDo) + '</h3></div><p>' + esc(W.v2mergeDoWhy) + '</p><div class="choice-foot"><button class="btn solid" data-merge="' + esc(sel.id) + '">' + ic('i-check') + esc(W.v2mergeDo) + '</button><button class="btn" data-merge-no="' + esc(sel.id) + '">' + esc(W.v2notNow) + '</button></div></article>';
      }
      det = '<section class="panel"><div class="panel-head"><span class="left caps">' + ic(iconOf[sel.type]) + esc(sourceOf(sel)) + '</span>' + (sel.spaceId ? '<span class="tag neutral">' + esc((me.spaces.find((s) => s.id === sel.spaceId) || {}).name || '') + '</span>' : '') + '</div>' +
        '<div class="panel-body subject"><div class="subject-top"><div><h2>' + esc(sel.title) + '</h2>' + (d.at ? '<div class="muted" style="font-size:13px">' + esc(time(d.at)) + '</div>' : '') + '</div></div>' + body + '</div></section><div class="choices">' + choices + '</div>';
    }
    const sure = items.filter((x) => x.type === 'capture' && x.detail.guess && x.detail.guess.sure).length;
    return v2head(esc(W.v2toSort), esc(say(W.v2toSortSub, { n: items.length })), '<button class="btn solid" data-sure-all ' + (sure ? '' : 'disabled') + '>' + ic('i-check') + esc(say(W.v2fileSure, { n: sure })) + '</button>') +
      '<div class="hint">' + ic('i-chat') + '<span>' + W.v2toSortHint + '</span></div>' +
      v2board(W.v2toSort, 'i-box', list, det);
  },

  // I1 — the review: the mirror Jarvis prepared, her questions, her decisions turned into actions.
  async revue (params) {
    const span = params.get('p') === 'mois' ? 'mois' : 'semaine';
    const now = new Date();
    const to = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
    const from = span === 'mois' ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10) : new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    const m = await api('/review?from=' + from + '&to=' + to);
    const out = m.money.find((x) => x.direction === 'out');
    const inn = m.money.find((x) => x.direction === 'in');
    const kept = m.made.reduce((s, x) => s + x.n, 0);
    const sentence = say(W.v2mirror, { kept: '<b>' + num(kept) + '</b>', done: '<b>' + num(m.done.length) + '</b>', out: '<b>' + money2(out ? out.total : 0) + '</b>' }) +
      (m.intentions.length ? ' ' + say(W.v2mirrorIntent, { n: '<b>' + m.intentions.length + '</b>' }) : '');
    const madeList = m.made.length ? '<div class="pad x-rel">' + m.made.slice(0, 8).map((x) => '<a href="#/vie?kind=' + esc(encodeURIComponent(x.kind)) + '">' + ic('i-life') + '<span><b>' + esc(kindName(x.kind)) + '</b> <em>· ' + num(x.n) + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>';
    const doneList = m.done.length ? '<div class="pad x-rel">' + m.done.slice(0, 8).map((x) => '<a href="#/entree/' + esc(x.id) + '">' + ic('i-check', 'color:var(--success)') + '<span><b>' + esc(x.title) + '</b> <em>· ' + esc(kindName(x.kind)) + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2nothingDone) + '</div>';
    const moneyHtml = '<div class="pad grid g3" style="gap:10px">' + v2kpi(W.v2out, money2(out ? out.total : 0), '') + v2kpi(W.v2in, money2(inn ? inn.total : 0), '') + v2kpi(W.v2balance, money2((inn ? inn.total : 0) - (out ? out.total : 0)), '', (inn ? inn.total : 0) < (out ? out.total : 0) ? 'alert' : '') + '</div>';
    const intents = m.intentions.length ? '<div class="pad x-rel">' + m.intentions.map((x) => '<a href="#/entree/' + esc(x.id) + '">' + ic('i-hand', x.times >= 3 ? 'color:var(--verify)' : '') + '<span><b>« ' + esc(x.title) + ' »</b> <em>· ' + esc(say(W.v2saidTimes, { n: x.times, since: day(x.since) })) + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2noIntent) + '</div>';
    const pat = (p) => p.kind === 'state' ? ['« ' + p.about + ' »', say(W.v2times, { n: p.figures.times }), say(W.v2inDays, { n: p.figures.days })] : p.kind === 'habit' ? [p.about, p.figures.rate30 + ' %', say(W.v2before, { n: p.figures.before30 })] : p.kind === 'spending' ? [p.about, '+' + p.figures.rise + ' %', money2(p.figures.recent) + ' / ' + money2(p.figures.usual)] : [p.about, say(W.v2times, { n: p.figures.times }), say(W.v2inDays, { n: p.figures.days })];
    const patterns = m.patterns.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2pattern) + '</th><th class="n">' + esc(W.v2howMuch) + '</th><th>' + esc(W.v2from) + '</th></tr></thead><tbody>' + m.patterns.map((p) => { const r = pat(p); return '<tr><td><b>' + esc(r[0]) + '</b><div class="cell-sub">' + esc(W['pk_' + p.kind]) + '</div></td><td class="n">' + esc(r[1]) + '</td><td>' + v2origin('inferred') + ' ' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div><div class="pad muted" style="font-size:12.5px">' + esc(W.v2patternsNote) + '</div>' : '<div class="pad muted">' + esc(W.v2noPattern) + '</div>';
    const goals = m.goals.length ? '<div class="pad" style="display:flex;flex-direction:column;gap:14px">' + m.goals.map((g) => '<div><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><a href="#/entree/' + esc(g.id) + '" style="color:inherit"><b>' + esc(g.title) + '</b></a><span class="muted" style="font-size:12.5px">' + esc(g.deadline ? say(W.v2before2, { d: day(g.deadline) }) : W.v2noDeadline) + '</span></div>' + (g.ratio != null ? '<div class="bar ok" style="margin:8px 0 4px"><i style="width:' + Math.round(g.ratio * 100) + '%"></i></div><div class="cell-sub">' + (g.measurable ? esc(num(g.current) + ' / ' + num(g.target) + ' · ') : '') + Math.round(g.ratio * 100) + ' % · ' + esc(say(W.v2fromLinks, { n: g.parts.length })) + '</div>' : '<div class="cell-sub" style="margin-top:6px">' + esc(W.v2linkToMove) + '</div>') + '</div>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2noGoal) + '</div>';
    const questions = '<div class="pad" style="display:flex;flex-direction:column;gap:14px">' + m.questions.map((q, i) => '<div class="x-q"><label for="q' + i + '">' + esc(q) + '</label><textarea id="q' + i + '" data-question="' + esc(q) + '" placeholder="' + esc(W.v2writeOrSay) + '"></textarea></div>').join('') + '</div>';
    const decisions = '<div class="pad" id="decisions">' + [0, 1, 2].map((i) => '<div class="x-decide"><div><input class="x-edit" data-decision style="border:1px dashed var(--rule-strong);background:var(--paper);padding:6px 10px;width:100%" placeholder="' + esc(i ? W.v2otherDecision : W.v2aDecision) + '"></div><div><input type="date" data-due style="border:1px solid var(--rule);border-radius:6px;padding:4px 6px;background:var(--paper);color:var(--ink)"></div><div class="muted" style="font-size:13px"><span class="x-arrow">→</span> ' + esc(W.v2becomesTask) + '</div></div>').join('') +
      '<div style="display:flex;justify-content:flex-end;padding-top:12px"><button class="btn solid" data-save-review="' + from + ':' + to + '">' + ic('i-check') + esc(W.v2saveReview) + '</button></div></div>';
    return v2head(esc(W.v2review), esc(W.v2reviewSub), '<div class="segmented"><button data-go="#/revue" aria-pressed="' + (span === 'semaine') + '">' + esc(W.v2week) + '</button><button data-go="#/revue?p=mois" aria-pressed="' + (span === 'mois') + '">' + esc(W.v2month) + '</button></div>', '<span class="app-icon" style="background:var(--ink);color:var(--on-ink)">' + ic('i-eye') + '</span>') +
      '<section class="panel"><div class="panel-body pad" style="display:flex;flex-direction:column;gap:12px"><span class="caps">' + esc(say(W.v2mirrorOf, { from: day(m.from), to: day(new Date(new Date(m.to).getTime() - 86400000).toISOString()) })) + '</span><p class="x-mirror" style="margin:0">' + sentence + ' <span class="calc">' + esc(W.v2computed) + '</span></p></div></section>' +
      '<div class="x-grid">' + v2panel(W.v2whatYouKept, madeList, '', 'i-life') + v2panel(W.v2whatYouDid, doneList, '<span class="muted" style="font-size:12px">' + m.done.length + '</span>', 'i-check') + '</div>' +
      '<div class="x-grid">' + v2panel(W.v2yourMoney, moneyHtml, '', 'i-wallet') + v2panel(W.v2openIntents, intents, m.intentions.length ? '<span class="tag info">' + m.intentions.length + '</span>' : '', 'i-hand') + '</div>' +
      '<div class="x-grid">' + v2panel(W.v2comesBack, patterns, '', 'i-chart') + v2panel(W.v2yourGoals, goals, '', 'i-spark') + '</div>' +
      v2panel(W.v2yourQuestions, questions, '', 'i-chat') +
      v2panel(W.v2decisions, decisions, '', 'i-check');
  },

  // I4 — her people: where she stands with each, what she promised, across her apps.
  async personnes (params, id) {
    const people = await api(inSpace('/entries?kind=Person&limit=200'));
    people.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const chosen = id || pick || (people[0] && people[0].id);
    const ini = (t) => String(t).split(/ +/).map((w) => w.slice(0, 1)).join('').slice(0, 2).toUpperCase();
    const list = people.length ? people.map((p) => '<button class="row" data-pick="' + esc(p.id) + '" aria-selected="' + (p.id === chosen) + '"><span class="kind" style="border-radius:50%">' + esc(ini(p.title)) + '</span><div><div class="t">' + esc(p.title) + '</div><div class="s">' + esc(p.data.relation || p.data.circle || kindName(p.kind)) + '</div></div></button>').join('') : '<div class="empty">' + esc(W.v2noPeople) + '</div>';
    let detail = '<section class="panel"><div class="panel-body empty">' + esc(W.v2noPeople) + '</div></section>';
    if (chosen) {
      const c = await api(inSpace('/people/' + encodeURIComponent(chosen)));
      const owed = c.promises.length;
      detail = '<section class="panel"><div class="panel-body pad" style="display:flex;flex-direction:column;gap:16px"><div class="x-person"><span class="x-avatar">' + esc(ini(c.title)) + '</span><div style="flex:1;min-width:200px"><h2 style="margin:0">' + esc(c.title) + '</h2><div class="muted">' + esc([c.data.relation, typeof c.data.circle === 'string' && !/^[0-9]+$/.test(c.data.circle) ? c.data.circle : null, spaceName()].filter(Boolean).join(' · ')) + '</div></div><a class="btn" href="#/entree/' + esc(c.id) + '">' + ic('i-life') + esc(W.fullEntry) + '</a></div>' +
        '<div class="grid g3" style="gap:10px">' + v2kpi(W.v2lastTime, c.last ? esc(agoShort(c.last.on)) : '—', c.last ? esc(c.last.title) : esc(W.v2never)) + v2kpi(W.v2promises, String(owed), owed ? esc(c.promises[0].title) : esc(W.v2none), owed ? 'alert' : '') + v2kpi(W.v2nextTime, c.next ? esc(day(c.next.on)) : '—', c.next ? esc(c.next.title) : esc(W.v2nothingPlanned)) + '</div></div></section>' +
        v2panel(W.v2promises, owed ? '<div class="pad x-rel">' + c.promises.map((p) => '<a href="#/entree/' + esc(p.id) + '">' + ic('i-hand', p.kind === 'Intention' ? 'color:var(--verify)' : '') + '<span><b>' + esc(p.title) + '</b> <em>· ' + esc(kindName(p.kind)) + (p.due ? ' · ' + esc(day(p.due)) : '') + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2none) + '</div>', '', 'i-hand') +
        v2panel(W.v2acrossApps, c.around.length ? '<div class="pad"><div class="x-across">' + c.around.map((g) => '<div class="x-app"><div class="top">' + v2app(kindName(g.kind)) + esc(kindName(g.kind)) + '<span class="muted" style="margin-left:auto;font-size:12px">' + g.n + '</span></div><p>' + g.latest.map((x) => '<a href="#/entree/' + esc(x.id) + '" style="color:inherit">' + esc(x.title) + '</a>').join(' · ') + '</p></div>').join('') + '</div></div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>', '', 'i-link');
    }
    return v2head(esc(W.v2people), esc(say(W.v2peopleSub, { n: people.length })), '<a class="btn" href="#/vie?kind=Person">' + ic('i-plus') + esc(W.v2add) + '</a>') + v2board(W.v2byLastTime, 'i-person', list, detail);
  },
};

// What the v2 screens do: one handler, by the data attributes the mockup's markup carries.
function bindV2(root) {
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
  const run = async (button, work, said) => {
    button.disabled = true;
    try { const done = await work(); toast(typeof said === 'function' ? said(done) : said, null); show(); counts(); } catch (error) { button.disabled = false; alert(error.message); }
  };
  // What « everything sure » filed, and what waits for a link her model asks (an account).
  const filedSaid = (done) => done && done.waiting && done.waiting.length ? say(W.v2filedWaiting, { n: done.filed.length, w: done.waiting.length, needs: done.waiting[0].needs.split(', ').map((f) => { const k = knownKinds.find((one) => one.kind === 'Transaction'); const label = fieldLabelOf(k && k.model, f); return label !== f ? label : W['fld_' + f] || f; }).join(', ') }) : W.v2filed;
  root.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', () => {
    const [id, yes, where] = b.dataset.decide.split(':');
    run(b, () => api('/to-sort/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(where || space), { method: 'POST', body: { yes: yes === '1' } }), yes === '1' ? W.v2written : W.v2setAside);
  }));
  root.querySelectorAll('[data-file-note]').forEach((b) => b.addEventListener('click', () => {
    const title = root.querySelector('.subject h2').textContent;
    run(b, () => api(inSpace('/inbox/' + encodeURIComponent(b.dataset.fileNote) + '/file'), { method: 'POST', body: { entries: [{ kind: 'Note', title: title.slice(0, 120), data: { text: title } }] } }), W.v2filed);
  }));
  root.querySelectorAll('[data-file-move]').forEach((b) => b.addEventListener('click', () => run(b, () => api(inSpace('/inbox/sure'), { method: 'POST', body: {} }), filedSaid)));
  const all = root.querySelector('[data-sure-all]');
  if (all) all.addEventListener('click', () => run(all, () => api(inSpace('/inbox/sure'), { method: 'POST', body: {} }), filedSaid));
  root.querySelectorAll('[data-merge]').forEach((b) => b.addEventListener('click', async () => {
    const [from, to] = b.dataset.merge.split('→');
    const proposals = await api(inSpace('/kinds/merges'));
    const one = proposals.find((p) => p.from === from && p.to === to);
    run(b, () => api(inSpace('/kinds/merge'), { method: 'POST', body: { from, to, steps: one ? one.steps : [], dryRun: false } }), W.v2merged);
  }));
  root.querySelectorAll('[data-merge-no]').forEach((b) => b.addEventListener('click', () => {
    const [from, to] = b.dataset.mergeNo.split('→');
    run(b, () => api('/kinds/merges/dismiss', { method: 'POST', body: { from, to } }), W.v2setAside);
  }));
  const keep = root.querySelector('[data-save-review]');
  if (keep) keep.addEventListener('click', () => {
    const [from, to] = keep.dataset.saveReview.split(':');
    const answers = [...root.querySelectorAll('[data-question]')].filter((t) => t.value.trim()).map((t) => ({ question: t.dataset.question, answer: t.value.trim() }));
    const decisions = [...root.querySelectorAll('#decisions .x-decide')].map((row) => ({ text: row.querySelector('[data-decision]').value.trim(), due: row.querySelector('[data-due]').value })).filter((d) => d.text).map((d) => d.due ? d : { text: d.text });
    if (!answers.length && !decisions.length) { alert(W.v2reviewEmpty); return; }
    run(keep, () => api(inSpace('/review'), { method: 'POST', body: { title: say(W.v2reviewTitle, { from: day(from), to: day(to) }), from, to, answers, decisions } }), W.v2reviewKept);
  });
}

// The journal (the mockup's top bar): each change of her space, who made it, and its undoing.
async function journalDrawer() {
  try {
    const hist = await api(inSpace('/history?limit=40'));
    const who = (h) => h.client || (h.actor === me.person.id ? W.v2you : h.actor);
    openDrawer(W.navJournal, '<ul class="journal">' + hist.map((h) => '<li class="' + (h.undoneBy ? 'undone' : '') + '"><time>' + esc(new Date(h.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })) + '</time><span>' + esc(said(h.command)) + (h.after && h.after.title ? ' · ' + esc(h.after.title) : h.before && h.before.title ? ' · ' + esc(h.before.title) : '') + '<small>' + esc(say(W.by, { who: who(h), door: h.door })) + ' · ' + esc(day(h.at)) + '</small></span>' + (h.undoneBy || h.command === 'journal.undo' ? '' : '<button class="undo" data-undo="' + h.id + '">' + esc(W.undo) + '</button>') + '</li>').join('') + '</ul>', '', W.v2journalSub);
    drawer().querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await api(inSpace('/undo'), { method: 'POST', body: { journalId: Number(b.dataset.undo) } }); toast(W.undoneToast, null); journalDrawer(); show(); } catch (error) { b.disabled = false; alert(error.message); }
    }));
  } catch (error) { alert(error.message); }
}

// The bell: what went wrong or is late, and what Jarvis sent her these days.
async function bellDrawer() {
  try {
    const [now, out] = await Promise.all([api('/now'), api('/outbox?days=7').catch(() => [])]);
    const urgent = now.items.filter((i) => i.group === 'fix' || i.group === 'late');
    openDrawer(W.v2notifications, (urgent.length ? '<div class="x-rel">' + urgent.map((i) => '<a href="#/entree/' + esc(i.id) + '">' + ic(i.group === 'fix' ? 'i-alert' : 'i-bell', 'color:' + (i.group === 'fix' ? 'var(--error)' : 'var(--verify)')) + '<span><b>' + esc(i.title) + '</b> <em>· ' + esc(W['g_' + i.group]) + (i.when ? ' · ' + esc(time(i.when)) : '') + '</em></span></a>').join('') + '</div>' : '<div class="muted">' + esc(W.allClear) + '</div>') +
      '<div class="caps">' + esc(W.v2sentByJarvis) + '</div>' + (out.length ? '<ul class="journal">' + out.slice(0, 20).map((m) => '<li><time>' + esc(new Date(m.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })) + '</time><span>' + esc(m.subject || m.kind) + '<small>' + esc(m.channel) + ' · ' + esc(W['st_' + m.state] || m.state) + ' · ' + esc(day(m.createdAt)) + '</small></span></li>').join('') + '</ul>' : '<div class="muted">' + esc(W.v2nothingSent) + '</div>'), '', W.v2bellSub);
    drawer().querySelectorAll('a[href^="#/"]').forEach((a) => a.addEventListener('click', closeDrawer));
  } catch (error) { alert(error.message); }
}

// « Chercher ou noter »: what Jarvis understood of her words — its kind, its title, an amount, a
// day; kept as it is to file later, or saved now.
function captureDrawer(text) {
  const amount = (text.match(/[0-9][0-9 .]{2,}/) || [''])[0].replace(/[ .]/g, '');
  const kinds = knownKinds.filter((k) => k.model && !['Model', 'Rule', 'Script', 'Page', 'View', 'App', 'Channel', 'Capture', 'Reminder', 'Comment', 'Proposal'].includes(k.kind));
  const guess = amount ? 'Transaction' : /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|aujourd|ce soir|[0-9]h)/i.test(text) ? 'Event' : 'Note';
  const options = [...new Set([guess, 'Transaction', 'Event', 'Task', 'Note', 'Person'].concat(kinds.map((k) => k.kind)))];
  const field = (label, html) => '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + label + html + '</label>';
  openDrawer(W.v2understoodTitle,
    field(esc(W.v2kind) + ' <small class="muted">' + esc(W.v2fromModels) + '</small>', '<select class="field" id="cap-kind">' + options.map((k) => '<option value="' + esc(k) + '"' + (k === guess ? ' selected' : '') + '>' + esc(kindName(k)) + '</option>').join('') + '</select>') +
    field(esc(W.title), '<input class="field" id="cap-title" value="' + esc(text.replace(/[0-9][0-9 .]{2,}/, '').replace(/ +/g, ' ').trim() || text) + '">') +
    (amount ? field(esc(W.v2amount), '<input class="field mono" id="cap-amount" inputmode="numeric" value="' + esc(amount) + '">') : '') +
    field(esc(W.space), '<select class="field" id="cap-space">' + me.spaces.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === space ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>') +
    '<a class="muted" href="#/vie?q=' + encodeURIComponent(text) + '" data-close style="font-size:13px">' + ic('i-search') + ' ' + esc(say(W.v2searchFor, { q: text })) + '</a>',
    '<button class="btn" id="cap-box">' + ic('i-box') + esc(W.v2putToSort) + '</button><button class="btn solid" id="cap-save">' + ic('i-check') + esc(W.v2save) + '</button>', '« ' + text + ' »');
  const where = () => document.getElementById('cap-space').value;
  document.getElementById('cap-box').addEventListener('click', async () => {
    try { await api('/inbox?space=' + encodeURIComponent(where()), { method: 'POST', body: { text } }); closeDrawer(); document.getElementById('search').value = ''; toast(W.v2kept, null); counts(); } catch (error) { alert(error.message); }
  });
  document.getElementById('cap-save').addEventListener('click', async () => {
    const kind = document.getElementById('cap-kind').value;
    const amountEl = document.getElementById('cap-amount');
    const data = {};
    if (amountEl && amountEl.value) { data.amount = Number(amountEl.value.replace(/[^0-9.]/g, '')); if (kind === 'Transaction') { data.direction = 'out'; data.date = new Date().toISOString().slice(0, 10); } }
    if (kind === 'Event') data.start = text;
    if (kind === 'Task') data.due = text;
    try {
      const saved = await api('/save?space=' + encodeURIComponent(where()), { method: 'POST', body: { entries: [{ kind, title: document.getElementById('cap-title').value.trim() || text, data, origin: 'said' }] } });
      closeDrawer(); document.getElementById('search').value = '';
      toast(W.v2savedToast, { id: saved.entries[0].id, spaceId: where() });
      location.hash = '#/entree/' + saved.entries[0].id;
    } catch (error) { alert(error.message); }
  });
}
`;
