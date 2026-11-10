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
    const from = span === 'mois' ? now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01' : new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    const m = await api('/review?from=' + from + '&to=' + to);
    const out = m.money.find((x) => x.direction === 'out');
    const inn = m.money.find((x) => x.direction === 'in');
    const kept = m.made.reduce((s, x) => s + x.n, 0);
    const sentence = say(W.v2mirror, { kept: '<b>' + num(kept) + '</b>', done: '<b>' + num(m.done.length) + '</b>', out: '<b>' + money2(out ? out.total : 0) + '</b>' }) +
      (m.intentions.length ? ' ' + say(W.v2mirrorIntent, { n: '<b>' + m.intentions.length + '</b>' }) : '');
    const madeList = m.made.length ? '<div class="pad x-rel">' + m.made.slice(0, 8).map((x) => '<a href="#/vie?kind=' + esc(encodeURIComponent(x.kind)) + '">' + ic('i-life') + '<span><b>' + esc(kindName(x.kind)) + '</b> <em>· ' + num(x.n) + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>';
    const doneList = m.done.length ? '<div class="pad x-rel">' + m.done.slice(0, 8).map((x) => '<a href="#/entree/' + esc(x.id) + '">' + ic('i-check', 'color:var(--success)') + '<span><b>' + esc(x.title) + '</b> <em>· ' + esc(kindName(x.kind)) + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2nothingDone) + '</div>';
    const moneyHtml0 = '<div class="pad grid g3" style="gap:10px">' + v2kpi(W.v2out, money2(out ? out.total : 0), '') + v2kpi(W.v2in, money2(inn ? inn.total : 0), '') + v2kpi(W.v2balance, money2((inn ? inn.total : 0) - (out ? out.total : 0)), '', (inn ? inn.total : 0) < (out ? out.total : 0) ? 'alert' : '') + '</div>';
    const intents = m.intentions.length ? '<div class="pad x-rel">' + m.intentions.map((x) => '<a href="#/entree/' + esc(x.id) + '">' + ic('i-hand', x.times >= 3 ? 'color:var(--verify)' : '') + '<span><b>« ' + esc(x.title) + ' »</b> <em>· ' + esc(say(W.v2saidTimes, { n: x.times, since: day(x.since) })) + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2noIntent) + '</div>';
    const pat = (p) => p.kind === 'state' ? ['« ' + p.about + ' »', say(W.v2times, { n: p.figures.times }), say(W.v2inDays, { n: p.figures.days })] : p.kind === 'habit' ? [p.about, p.figures.rate30 + ' %', say(W.v2before, { n: p.figures.before30 })] : p.kind === 'spending' ? [p.about, '+' + p.figures.rise + ' %', money2(p.figures.recent) + ' / ' + money2(p.figures.usual)] : [p.about, say(W.v2times, { n: p.figures.times }), say(W.v2inDays, { n: p.figures.days })];
    const patterns = m.patterns.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2pattern) + '</th><th class="n">' + esc(W.v2howMuch) + '</th><th>' + esc(W.v2from) + '</th></tr></thead><tbody>' + m.patterns.map((p) => { const r = pat(p); return '<tr><td><b>' + esc(r[0]) + '</b><div class="cell-sub">' + esc(W['pk_' + p.kind]) + '</div></td><td class="n">' + esc(r[1]) + '</td><td>' + v2origin('inferred') + ' ' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div><div class="pad muted" style="font-size:12.5px">' + esc(W.v2patternsNote) + '</div>' : '<div class="pad muted">' + esc(W.v2noPattern) + '</div>';
    const goals = m.goals.length ? '<div class="pad" style="display:flex;flex-direction:column;gap:14px">' + m.goals.map((g) => '<div><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><a href="#/entree/' + esc(g.id) + '" style="color:inherit"><b>' + esc(g.title) + '</b></a><span class="muted" style="font-size:12.5px">' + esc(g.deadline ? say(W.v2before2, { d: day(g.deadline) }) : W.v2noDeadline) + '</span></div>' + (g.ratio != null ? '<div class="bar ok" style="margin:8px 0 4px"><i style="width:' + Math.round(g.ratio * 100) + '%"></i></div><div class="cell-sub">' + (g.measurable ? esc(num(g.current) + ' / ' + num(g.target) + ' · ') : '') + Math.round(g.ratio * 100) + ' % · ' + esc(say(W.v2fromLinks, { n: g.parts.length })) + '</div>' : '<div class="cell-sub" style="margin-top:6px">' + esc(W.v2linkToMove) + '</div>') + '</div>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2noGoal) + '</div>';
    const questions = '<div class="pad" style="display:flex;flex-direction:column;gap:14px">' + m.questions.map((q, i) => '<div class="x-q"><label for="q' + i + '">' + esc(q) + '</label><textarea id="q' + i + '" data-question="' + esc(q) + '" placeholder="' + esc(W.v2writeOrSay) + '"></textarea></div>').join('') + '</div>';
    const decisions = '<div class="pad" id="decisions">' + [0, 1, 2].map((i) => '<div class="x-decide"><div><input class="x-edit" data-decision style="border:1px dashed var(--rule-strong);background:var(--paper);padding:6px 10px;width:100%" placeholder="' + esc(i ? W.v2otherDecision : W.v2aDecision) + '"></div><div><input type="date" data-due style="border:1px solid var(--rule);border-radius:6px;padding:4px 6px;background:var(--paper);color:var(--ink)"></div><div class="muted" style="font-size:13px"><span class="x-arrow">→</span> ' + esc(W.v2becomesTask) + '</div></div>').join('') +
      '<div style="display:flex;justify-content:flex-end;padding-top:12px"><button class="btn solid" data-save-review="' + from + ':' + to + '">' + ic('i-check') + esc(W.v2saveReview) + '</button></div></div>';
    const streakOf = (line) => { let n = 0; for (let i = line.length - 1; i >= 0; i--) { if (line[i].state === 'off') continue; if (line[i].state !== 'done') break; n++; } return n; };
    const last7 = (line) => line.slice(-7);
    const dayHead = m.habits.length ? last7(m.habits[0].days) : [];
    const keptH = m.habits.reduce((s, h) => s + h.kept, 0);
    const plannedH = m.habits.reduce((s, h) => s + h.planned, 0);
    const dotName = { done: W.rv_done, miss: W.rv_miss, moved: W.rv_moved, off: W.rv_off };
    const legendDot = (k) => '<span><i class="x-dot ' + k + '" style="width:12px;height:12px;margin:0"></i>' + esc(dotName[k]) + '</span>';
    const habitsHtml = m.habits.length ? '<div class="pad"><div class="x-days"><span></span>' + dayHead.map((d) => '<span class="h">' + esc(new Date(d.day + 'T12:00:00').toLocaleDateString(locale, { weekday: 'narrow' }) + ' ' + Number(d.day.slice(8))) + '</span>').join('') + '<span class="h">' + esc(W.rv_streak) + '</span>' +
      m.habits.map((h) => { const st = streakOf(h.days); return '<a href="#/entree/' + esc(h.id) + '" style="color:inherit">' + esc(h.title) + '</a>' + last7(h.days).map((d) => '<span class="x-dot ' + d.state + '" title="' + esc(dotName[d.state]) + '"></span>').join('') + '<span class="x-streak">' + (st ? esc(say(W.rv_days, { n: st })) : '—') + '</span>'; }).join('') +
      '</div><div class="x-legend" style="margin-top:12px">' + ['done', 'miss', 'off'].map(legendDot).join('') + '</div></div>' : '<div class="pad muted">' + esc(W.rv_noHabit) + '</div>';
    const tmax = Math.max(1, ...m.time.map((t) => Math.max(t.planned, t.kept)));
    const hours = (v) => String(v).replace('.', ',');
    const timeHtml = m.time.length ? '<div class="pad"><div class="x-cmp">' + m.time.map((t) => '<span>' + esc(t.title) + '</span><div class="bars"><i class="plan" style="width:' + (t.planned / tmax) * 100 + '%"></i><i class="real' + (t.kept > t.planned ? ' over' : '') + '" style="width:' + (t.kept / tmax) * 100 + '%"></i></div><span class="v">' + hours(t.kept) + ' / ' + hours(t.planned) + ' h</span>').join('') + '</div>' +
      '<div class="x-legend" style="margin-top:12px"><span><i style="width:18px;height:8px;border:1px dashed var(--rule-strong);background:var(--clay);border-radius:2px"></i>' + esc(W.rv_planned) + '</span><span><i style="width:18px;height:8px;background:var(--ink);border-radius:2px"></i>' + esc(W.rv_real) + '</span></div></div>' : '<div class="pad muted">' + esc(W.rv_noTime) + '</div>';
    const spentNow = m.spending.reduce((s, x) => s + x.now, 0);
    const moneyTag = (x) => !x.usual ? '<span class="tag info">' + esc(W.rv_new) + '</span>' : x.now > x.usual * 1.1 ? '<span class="tag late">+' + Math.round((x.now / x.usual - 1) * 100) + ' %</span>' : '<span class="tag ok">' + esc(W.rv_held) + '</span>';
    const moneyHtml = m.spending.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.rv_fund) + '</th><th class="n">' + esc(span === 'mois' ? W.rv_thisMonth : W.rv_thisWeek) + '</th><th class="n">' + esc(W.rv_usual) + '</th><th></th></tr></thead><tbody>' +
      m.spending.map((x) => '<tr><td><div class="cell-title">' + esc(x.name) + '</div></td><td class="n">' + money2(x.now) + '</td><td class="n faint">' + (x.usual ? money2(x.usual) : '—') + '</td><td>' + moneyTag(x) + '</td></tr>').join('') +
      '<tr class="total"><td>' + esc(W.rv_total) + '</td><td class="n">' + money2(spentNow) + '</td><td class="n">' + money2(m.spending.reduce((s, x) => s + x.usual, 0)) + '</td><td></td></tr></tbody></table></div>' : '<div class="pad muted">' + esc(W.rv_noMoney) + '</div>';
    const late = m.commitments.filter((c) => c.state === 'late').length;
    const commitIcon = { done: ic('i-check', 'color:var(--success)'), late: ic('i-alert', 'color:var(--error)'), ahead: ic('i-cal') };
    const commitsHtml = m.commitments.length ? '<div class="pad x-rel">' + m.commitments.map((c) => '<a href="#/entree/' + esc(c.id) + '">' + commitIcon[c.state] + '<span><b>' + esc(c.title) + '</b> <em>· ' + esc(say(W['rv_c_' + c.state], { d: day(c.due) })) + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.rv_noCommit) + '</div>';
    const peopleHtml = m.people.length ? '<div class="pad x-rel">' + m.people.map((p) => '<a href="#/personnes/' + esc(p.id) + '">' + ic('i-person') + '<span><b>' + esc(p.title) + '</b> <em>· ' + esc(say(W.rv_things, { n: p.n, ago: agoShort(p.last) })) + '</em></span></a>').join('') + '</div>' : '<div class="pad muted">' + esc(W.rv_noPeople) + '</div>';
    const saidHtml = m.said.length ? '<div class="pad"><ul class="x-tl">' + m.said.map((x) => '<li><time>' + esc(new Date(x.at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })) + '</time><i></i><span><a href="#/entree/' + esc(x.id) + '" style="color:inherit">« ' + esc(x.text) + ' »</a><small>' + esc(kindName(x.kind)) + '</small></span></li>').join('') + '</ul></div>' : '<div class="pad muted">' + esc(W.rv_noSaid) + '</div>';
    const habitPart = plannedH ? ' ' + say(W.rv_mirrorHabits, { kept: '<b>' + keptH + '</b>', of: '<b>' + plannedH + '</b>' }) : '';
    const latePart = late ? ' ' + say(W.rv_mirrorLate, { n: '<b>' + late + '</b>' }) : '';
    return v2head(esc(W.v2review), esc(W.v2reviewSub), '<div class="segmented"><button data-go="#/revue" aria-pressed="' + (span === 'semaine') + '">' + esc(W.v2week) + '</button><button data-go="#/revue?p=mois" aria-pressed="' + (span === 'mois') + '">' + esc(W.v2month) + '</button></div>', '<span class="app-icon" style="background:var(--ink);color:var(--on-ink)">' + ic('i-eye') + '</span>') +
      '<section class="panel"><div class="panel-body pad" style="display:flex;flex-direction:column;gap:12px"><span class="caps">' + esc(say(W.v2mirrorOf, { from: day(m.from), to: day(new Date(new Date(m.to).getTime() - 86400000).toISOString()) })) + '</span><p class="x-mirror" style="margin:0">' + sentence + habitPart + latePart + ' <span class="calc">' + esc(W.v2computed) + '</span></p>' +
      (m.made.length ? '<div class="chips">' + m.made.slice(0, 6).map((x) => '<a class="x-touch" href="#/vie?kind=' + esc(encodeURIComponent(x.kind)) + '">' + v2app(kindName(x.kind)) + esc(kindName(x.kind)) + ' <em class="muted" style="font-style:normal">' + num(x.n) + '</em></a>').join('') + '</div>' : '') + '</div></section>' +
      '<div class="x-grid">' + v2panel(W.rv_habits, habitsHtml, plannedH ? '<span class="muted" style="font-size:12px">' + keptH + ' / ' + plannedH + '</span>' : '', 'i-routine') + v2panel(W.rv_time, timeHtml, '', 'i-cal') + '</div>' +
      '<div class="x-grid">' + v2panel(W.v2yourMoney, moneyHtml + moneyHtml0, '<a class="btn small" href="#/vie?kind=Transaction">' + esc(W.rv_moves) + '</a>', 'i-wallet') + v2panel(W.rv_commits, commitsHtml, late ? '<span class="tag late">' + esc(say(W.rv_nLate, { n: late })) + '</span>' : '', 'i-hand') + '</div>' +
      '<div class="x-grid">' + v2panel(W.rv_people, peopleHtml, '', 'i-person') + v2panel(W.rv_said, saidHtml, '', 'i-chat') + '</div>' +
      '<div class="x-grid">' + v2panel(W.v2openIntents, intents, m.intentions.length ? '<span class="tag info">' + m.intentions.length + '</span>' : '', 'i-hand') + v2panel(W.v2comesBack, patterns, '', 'i-chart') + '</div>' +
      v2panel(W.v2yourGoals, goals, '', 'i-spark') +
      v2panel(W.v2yourQuestions, questions, '', 'i-chat') +
      v2panel(W.v2decisions, decisions, '', 'i-check') +
      (m.done.length ? v2panel(W.v2whatYouDid, doneList, '<span class="muted" style="font-size:12px">' + m.done.length + '</span>', 'i-check') : '');
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

// « Maintenant » in the mockup: what needs her, by group; the one chosen, its day, what she can do.
let nowFilter = 'all';
const NOW_GROUPS = ['fix', 'late', 'proposed', 'intent', 'today', 'week'];
const NOW_ICONS = { fix: 'i-alert', late: 'i-bell', proposed: 'i-spark', intent: 'i-hand', today: 'i-cal', week: 'i-cal' };
const NOW_TAGS = { fix: 'error', late: 'late', proposed: 'info', intent: 'info', today: 'ok', week: 'neutral' };
function dayBandV2(occ, focus) {
  const from = 6, to = 23;
  const at = (iso) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
  const pct = (h) => Math.max(0, Math.min(100, ((h - from) / (to - from)) * 100));
  const hhmm2 = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const blocks = occ.filter((o) => !o.allDay).map((o) => {
    const a = at(o.start); const b = o.end ? at(o.end) || 24 : a + 0.5;
    return '<a class="block ' + (o.proposed ? 'proposed' : o.repeated ? '' : 'event') + (o.id === focus ? ' focus' : '') + '" href="#/entree/' + esc(o.id) + '" title="' + esc(o.title) + '" style="left:' + pct(a) + '%;width:calc(' + (pct(b) - pct(a)) + '% - 3px)"><b>' + esc(o.title) + '</b><small>' + esc(hhmm2(o.start)) + '</small></a>';
  }).join('');
  const n = at(new Date().toISOString());
  return v2panel(say(W.v2yourDay, { day: new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric' }) }),
    '<div class="dayband"><div class="hours" style="grid-template-columns:repeat(' + (to - from) + ',1fr)">' + Array.from({ length: to - from }, (_, i) => '<span>' + (i % 2 ? '' : String(from + i).padStart(2, '0')) + '</span>').join('') + '</div>' + blocks +
    (n >= from && n <= to ? '<div class="now-line" style="left:' + pct(n) + '%"></div>' : '') + '</div>' +
    '<div class="legend pad" style="padding-top:10px;padding-bottom:12px"><span><i style="background:var(--sand);border:1px solid var(--rule-strong)"></i>' + esc(W.legendRepeated) + '</span><span><i style="background:var(--paper);border:1px solid var(--ink)"></i>' + esc(W.legendEvent) + '</span><span><i style="background:var(--info-surface);border:1px dashed var(--info)"></i>' + esc(W.legendProposed) + '</span></div>',
    '<a class="btn small" href="#/agenda?v=jour">' + esc(W.navAgenda) + '</a>', 'i-cal');
}
v2Pages[''] = async function () {
  const now = await api('/now');
  const items = now.items;
  const n = (g) => items.filter((i) => i.group === g).length;
  const vis = items.filter((i) => nowFilter === 'all' || i.group === nowFilter);
  const sel = vis.find((i) => i.id === pick) || vis[0];
  const when = (i) => (i.when ? (i.allDay ? day(i.when) : time(i.when)) : '');
  const sub = (i) => [kindName(i.kind), i.space, i.said ? say(W.v2saidTimes, { n: i.said.times, since: day(i.said.since) }) : when(i)].filter(Boolean).join(' · ');
  const list = vis.length ? NOW_GROUPS.map((g) => {
    const rows = vis.filter((i) => i.group === g);
    return rows.length ? '<div class="group-title caps">' + esc(W['g_' + g]) + ' <span class="n">' + rows.length + '</span></div>' + rows.map((i) =>
      '<button class="row" data-pick="' + esc(i.id) + '" aria-selected="' + (sel && i.id === sel.id) + '"><span class="kind' + (g === 'proposed' ? ' proposed' : '') + '">' + ic(NOW_ICONS[g]) + '</span><div><div class="t">' + esc(i.title) + '</div><div class="s">' + esc(sub(i)) + '</div></div><span class="tag ' + NOW_TAGS[g] + '">' + esc(W['r_' + i.reason] || i.reason) + '</span></button>').join('') : '';
  }).join('') : '<div class="empty">' + esc(W.allClear) + '</div>';
  let det = '<div class="panel"><div class="panel-body empty">' + esc(W.v2nothingToDecide) + '</div></div>';
  if (sel) {
    const e = await api('/entries/' + encodeURIComponent(sel.id) + '?space=' + encodeURIComponent(sel.spaceId));
    const links = e.links.out.concat(e.links.in).filter((l) => l.entry.kind !== 'Comment').slice(0, 6);
    const acts = [];
    if (sel.group === 'proposed') acts.push(['accept', W.a_accept, W.a_acceptWhy, true], ['refuse', W.a_refuse, W.a_refuseWhy]);
    else if (sel.group === 'fix') acts.push(['retry', W.a_retry, W.a_retryWhy, true], ['done', W.a_done, W.a_doneWhy]);
    else if (sel.group === 'intent') acts.push(['plan', W.v2planIt, W.v2planItWhy, true], ['done', W.a_done, W.v2intentDoneWhy], ['drop', W.v2dropIt, W.v2dropItWhy]);
    else {
      acts.push(['done', W.a_done, W.a_doneWhy, sel.group === 'late']);
      if (e.data.at || e.data.due || e.data.start) acts.push(['later', W.a_later, W.a_laterWhy, sel.group !== 'late']);
      acts.push(['cancel', W.a_cancel, W.a_cancelWhy]);
    }
    const context = typeof e.data.text === 'string' ? e.data.text.slice(0, 360) + (e.data.text.length > 360 ? '…' : '') : sel.said ? say(W.v2intentContext, { n: sel.said.times, since: day(sel.said.since) }) : '';
    det = '<button class="back" data-back>' + ic('i-left') + esc(W.v2backToList) + '</button>' +
      '<section class="panel"><div class="panel-head"><span class="left caps">' + ic(NOW_ICONS[sel.group]) + esc(kindName(sel.kind) + ' · ' + W['g_' + sel.group]) + '</span><span class="tag ' + NOW_TAGS[sel.group] + '">' + esc(W['r_' + sel.reason] || sel.reason) + '</span></div>' +
      '<div class="panel-body subject"><div class="subject-top"><div><h2>' + esc(e.title) + '</h2><div class="muted" style="font-size:13px">' + esc(sub(sel)) + '</div></div><a class="btn small" href="#/entree/' + esc(e.id) + '">' + ic('i-life') + esc(W.fullEntry) + '</a></div>' +
      (context ? '<p class="context">' + esc(context) + '</p>' : '') +
      (links.length ? '<div class="chips">' + links.map((l) => '<a class="chip" href="#/entree/' + esc(l.entry.id) + '">' + ic(l.entry.kind === 'Person' ? 'i-person' : l.entry.kind === 'Fichier' ? 'i-file' : 'i-link') + esc(l.entry.title) + '<small>' + esc(kindName(l.entry.kind)) + '</small></a>').join('') + '</div>' : '') + '</div></section>' +
      dayBandV2(now.day, sel.id) +
      '<div class="choices">' + acts.map((a) => '<article class="choice' + (a[3] ? ' recommended' : '') + '"><div class="choice-head"><h3>' + esc(a[1]) + '</h3>' + (a[3] ? '<span class="why">' + esc(W.v2recommended) + '</span>' : '') + '</div><p>' + esc(a[2]) + '</p><div class="choice-foot"><button class="btn' + (a[3] ? ' solid' : '') + '" ' + (a[0] === 'plan' || a[0] === 'drop' ? 'data-intent' : 'data-act') + '="' + a[0] + '" data-id="' + esc(sel.id) + '" data-space="' + esc(sel.spaceId) + '">' + (a[3] ? ic('i-check') : '') + esc(a[1]) + '</button></div></article>').join('') + '</div>';
  }
  const filters = [['all', W.v2all, items.length], ['fix', W.g_fix, n('fix')], ['late', W.g_late, n('late')], ['today', W.g_today, n('today')], ['proposed', W.g_proposed, n('proposed')]];
  const today = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return v2head(esc(W.navNow), esc(today.charAt(0).toUpperCase() + today.slice(1) + ' · ' + say(W.nowLead, { fix: n('fix'), late: n('late'), proposed: n('proposed'), today: n('today') })),
    '<div class="segmented">' + filters.map((f) => '<button data-now-filter="' + f[0] + '" aria-pressed="' + (nowFilter === f[0]) + '">' + esc(f[1]) + '<span class="n">' + f[2] + '</span></button>').join('') + '</div><a class="btn hide-s" href="#/agenda">' + ic('i-cal') + esc(W.v2openAgenda) + '</a>') +
    '<div class="board' + (reading ? ' reading' : '') + '"><section class="panel list-panel"><div class="panel-head"><span class="left caps">' + ic('i-now') + esc(W.navNow) + ' · ' + esc(new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })) + '</span><span class="pill"><span class="live"></span>' + esc(W.v2live) + '</span></div><div class="panel-body list">' + list + '</div></section><section class="detail">' + det + '</section></div>';
};
v2Pages.accueil = v2Pages[''];

// What « Maintenant » does beyond the usual gestures: its filter, an intention planned or dropped.
function bindNow(root) {
  root.querySelectorAll('[data-now-filter]').forEach((b) => b.addEventListener('click', () => { nowFilter = b.dataset.nowFilter; pick = null; show(); }));
  root.querySelectorAll('[data-intent]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.id; const where = b.dataset.space;
    if (b.dataset.intent === 'plan') {
      const e = await api('/entries/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(where));
      const t = new Date(Date.now() + 86400000);
      newEvent(t.toLocaleDateString('en-CA') + 'T09:00', e.title);
      return;
    }
    try { await api('/save?space=' + encodeURIComponent(where), { method: 'POST', body: { entries: [{ id, data: { status: 'dropped' } }] } }); pick = null; toast(W.v2dropped, { id, spaceId: where }); show(); } catch (error) { alert(error.message); }
  }));
}

// « Entrées » in the mockup: everything she keeps, grouped as she thinks her life — by kind, by
// space, by month, or by a link to a kind she chooses (« Mandat », « Projet »…). A kind opened shows
// its own explorer (views, filters, bulk changes), as before.
let entriesBy = 'type';
let entriesLink = '';
v2Pages.vie = async function (params) {
  const ENGINE = ['Model', 'Rule', 'Script', 'Page', 'View', 'App', 'Channel', 'Reminder', 'Comment', 'Proposal', 'Capture'];
  if (params.get('kind') || params.get('view')) {
    const inner = await lifePages.vie(params);
    const k = params.get('kind');
    crumbs([W.navEntries, k ? kindName(k) : W.navEntries]);
    return v2head(esc(k ? kindName(k) : W.navEntries), esc(W.v2entriesKindSub), '<a class="btn" href="#/vie">' + ic('i-left') + esc(W.navEntries) + '</a><a class="btn" href="#/collections/' + esc(encodeURIComponent(k || '')) + '">' + ic('i-shape') + esc(W.seeModel) + '</a>') + '<section class="panel"><div class="panel-body pad">' + inner + '</div></section>';
  }
  const q = params.get('q') || '';
  const spacesToRead = me.spaces;
  const lists = await Promise.all(spacesToRead.map((s) => api('/entries?limit=200&space=' + encodeURIComponent(s.id) + (q ? '&text=' + encodeURIComponent(q) : '')).then((rows) => rows.map((r) => Object.assign(r, { spaceName: s.name }))).catch(() => [])));
  const all = lists.flat().filter((e) => !ENGINE.includes(e.kind));
  // What each entry is linked to (both ways), for « lien vers ».
  const linkRows = await Promise.all(spacesToRead.map((s) => api('/query?space=' + encodeURIComponent(s.id), { method: 'POST', body: { sql: 'select l.from_id as a, l.to_id as b, f.kind as fk, f.title as ft, t.kind as tk, t.title as tt from my_links l join my_entries f on f.id = l.from_id join my_entries t on t.id = l.to_id limit 5000' } }).then((r) => r.rows).catch(() => [])));
  const linksOf = new Map();
  for (const r of linkRows.flat()) {
    linksOf.set(r.a, (linksOf.get(r.a) || []).concat([{ kind: r.tk, title: r.tt }]));
    linksOf.set(r.b, (linksOf.get(r.b) || []).concat([{ kind: r.fk, title: r.ft }]));
  }
  for (const e of all) e.links = linksOf.get(e.id) || [];
  const total = knownKinds.reduce((a, k) => a + (ENGINE.includes(k.kind) ? 0 : k.count || 0), 0);
  // The kinds others link to: what « lien vers » can group by.
  const linkKinds = [...new Set(all.flatMap((e) => (e.links || []).map((l) => l.kind)))].filter((k) => k && !ENGINE.includes(k));
  if (entriesBy === 'lien' && !entriesLink) entriesLink = linkKinds[0] || '';
  const monthOf = (e) => new Date(e.data.date || e.data.start || e.data.at || e.createdAt).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const keyOf = (e) => entriesBy === 'type' ? kindName(e.kind) : entriesBy === 'espace' ? e.spaceName : entriesBy === 'mois' ? monthOf(e) : ((e.links || []).find((l) => l.kind === entriesLink) || {}).title || '';
  const groups = new Map();
  for (const e of all) { const k = keyOf(e); groups.set(k, (groups.get(k) || []).concat([e])); }
  const order = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : entriesBy === 'mois' ? 0 : groups.get(b).length - groups.get(a).length));
  const by = [['type', W.v2byKind], ['espace', W.space], ['mois', W.v2byMonth], ['lien', entriesLink ? say(W.v2linkTo, { kind: kindName(entriesLink) }) : W.v2byLink]];
  const rows = order.map((g) => {
    const list = groups.get(g);
    const first = list[0];
    const open = entriesBy === 'type' ? ' <a class="btn small" href="#/vie?kind=' + esc(encodeURIComponent(first.kind)) + '">' + esc(W.open) + '</a>' : '';
    return '<tr class="total"><td colspan="4">' + esc(g || (entriesBy === 'lien' ? W.v2unlinked : '—')) + ' <span class="muted">' + list.length + '</span>' + open + '</td></tr>' +
      list.slice(0, 40).map((e) => '<tr><td><div class="cell-title"><a href="#/entree/' + esc(e.id) + '">' + esc(e.title) + '</a></div></td><td>' + esc(kindName(e.kind)) + '</td><td>' + esc(e.spaceName) + '</td><td class="cell-sub">' + esc(monthOf(e)) + '</td></tr>').join('') +
      (list.length > 40 ? '<tr><td colspan="4" class="cell-sub">' + esc(say(W.v2andMore, { n: list.length - 40 })) + '</td></tr>' : '');
  }).join('');
  return v2head(esc(W.navEntries), esc(say(W.v2entriesSub, { n: num(total) })) + (q ? ' · « ' + esc(q) + ' »' : ''),
    '<div class="segmented">' + by.map((x) => '<button data-entries-by="' + x[0] + '" aria-pressed="' + (entriesBy === x[0]) + '">' + esc(x[1]) + '</button>').join('') + '</div>' +
    (entriesBy === 'lien' && linkKinds.length ? '<select class="field" data-entries-link style="width:auto">' + linkKinds.map((k) => '<option value="' + esc(k) + '"' + (k === entriesLink ? ' selected' : '') + '>' + esc(kindName(k)) + '</option>').join('') + '</select>' : '')) +
    v2panel(say(W.v2groupedBy, { by: (by.find((x) => x[0] === entriesBy) || by[0])[1].toLowerCase() }), all.length ? '<div class="scroll"><table style="min-width:560px"><thead><tr><th>' + esc(W.title) + '</th><th>' + esc(W.v2kind) + '</th><th>' + esc(W.space) + '</th><th>' + esc(W.v2byMonth) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>', '<span class="muted" style="font-size:12px">' + esc(say(W.v2latestN, { n: all.length })) + '</span>', 'i-life') +
    '<div class="hint">' + ic('i-link') + '<span>' + W.v2linkHint + '</span></div>';
};
function bindEntries2(root) {
  root.querySelectorAll('[data-entries-by]').forEach((b) => b.addEventListener('click', () => { entriesBy = b.dataset.entriesBy; show(); }));
  const sel = root.querySelector('[data-entries-link]');
  if (sel) sel.addEventListener('change', () => { entriesLink = sel.value; show(); });
}

// « Modèles de type » in the mockup: each kind's fields, how it links, what it computes, where it
// goes on export; changed here (journaled, undone) or by telling Claude.
const natureOf = (f) => f.type === 'link' ? '→ ' + kindName(f.target || '') : W['nat_' + f.type] || f.type;
v2Pages.collections = async function (params, kind) {
  if (kind) return modelPage(kind);
  const models = knownKinds.filter((k) => k.model && !['Model', 'Rule', 'Script', 'Page', 'View', 'App', 'Channel'].includes(k.kind));
  const byApp = new Map();
  for (const k of models) { const a = k.model.app || W.v2yours2; byApp.set(a, (byApp.get(a) || []).concat([k])); }
  const apps = [...byApp.keys()].sort((a, b) => (a === W.v2yours2) - (b === W.v2yours2) || a.localeCompare(b));
  crumbs([W.navModels]);
  return v2head(esc(W.navModels), esc(W.v2modelsSub), '<button class="btn" data-ask-claude="model">' + ic('i-chat') + esc(W.v2createWithClaude) + '</button>') +
    (apps.length ? '<div class="grid g3">' + apps.map((a) => v2panel(a, byApp.get(a).map((k) => '<a class="model-card" href="#/collections/' + esc(encodeURIComponent(k.kind)) + '"><span class="kind">' + ic('i-shape') + '</span><span><b>' + esc(kindLabel(k)) + '</b><div class="cell-sub">' + esc(say(W.v2fieldsEntries, { f: k.model.fields.length, n: num(k.count || 0) })) + '</div></span>' + ic('i-right') + '</a>').join(''), '', a === W.v2yours2 ? 'i-life' : 'i-box')).join('') + '</div>' : '<div class="panel"><div class="panel-body empty">' + esc(W.v2noModel) + '</div></div>') +
    '<div class="hint">' + ic('i-chat') + '<span>' + W.v2modelsHint + '</span></div>';
};
v2Pages.modeles = v2Pages.collections;

async function modelPage(kind) {
  const k = knownKinds.find((x) => x.kind === kind);
  if (!k || !k.model) return v2head(esc(kindName(kind)), esc(W.v2noModelFor), '<a class="btn" href="#/vie?kind=' + esc(encodeURIComponent(kind)) + '">' + esc(W.v2itsEntries) + '</a>');
  const m = k.model;
  const [rules, hist] = await Promise.all([api(inSpace('/entries?kind=Rule&limit=200')).catch(() => []), api(inSpace('/history?limit=1&target=' + encodeURIComponent(m.id))).catch(() => [])]);
  const fold3 = (t) => String(t || '').toLowerCase();
  const mine = rules.filter((r) => r.data.when && [r.data.when.saved, r.data.when.changed && r.data.when.changed.kind, r.data.when.before && r.data.when.before.kind].map(fold3).includes(fold3(kind)));
  // What computes on this kind: its own formulas, and those of kinds linked to it.
  const calcs = m.fields.filter((f) => f.type === 'formula').map((f) => [kindName(kind), labelOf(m, f.name), f.formula]);
  for (const other of knownKinds.filter((x) => x.model && x.kind !== kind)) {
    const linkedTo = m.fields.some((f) => f.type === 'link' && f.target === other.kind);
    if (!linkedTo && !other.model.fields.some((f) => f.type === 'link' && f.target === kind)) continue;
    for (const f of other.model.fields.filter((x) => x.type === 'formula')) calcs.push([kindName(other.kind), labelOf(other.model, f.name), f.formula]);
  }
  const ruleLine = (r) => { const w = r.data.when; const cond = w.saved ? say(W.v2whenSaved, { kind: kindName(w.saved) }) : w.changed ? say(W.v2whenChanged, { field: w.changed.field }) : w.before ? say(W.v2whenBefore, { n: w.before.days, field: w.before.field }) : w.schedule || ''; return '<div class="rule-line"><span><span class="kw">' + esc(W.v2when2) + '</span>' + esc(cond) + (r.data.if ? ' <span class="kw">' + esc(W.v2if) + '</span>' + esc(r.data.if) : '') + ' <span class="kw">' + esc(W.v2then2) + '</span>' + esc(r.title) + '</span>' + (r.data.active === false ? '<span class="tag neutral">' + esc(W.v2paused) + '</span>' : '') + '</div>'; };
  const changed = hist[0];
  const cols = m.columns || m.fields.filter((f) => f.type !== 'formula').slice(0, 6).map((f) => f.name);
  const fieldsTable = '<div class="scroll"><table><thead><tr><th>' + esc(W.v2field) + '</th><th>' + esc(W.v2nature) + '</th><th>' + esc(W.v2required) + '</th><th>' + esc(W.v2precision) + '</th></tr></thead><tbody>' +
    m.fields.map((f) => '<tr><td class="mono"><b>' + esc(labelOf(m, f.name)) + '</b>' + (labelOf(m, f.name) !== f.name ? ' <span class="cell-sub">' + esc(f.name) + '</span>' : '') + '</td><td><span class="nature' + (f.type === 'link' ? ' ref' : f.type === 'formula' ? ' calc' : '') + '">' + esc(natureOf(f)) + '</span></td><td>' + esc(f.required ? W.yes : W.no) + '</td><td class="cell-sub">' + esc([f.options ? f.options.map((o) => optionLabelOf(m, f.name, o)).join(' · ') : '', f.formula ? '= ' + f.formula : '', f.help || '', f.unit || ''].filter(Boolean).join(' · ')) + '</td></tr>').join('') + '</tbody></table></div>';
  const path = m.path || '';
  const example = path ? path.replace(/[{]year[}]/g, '2026').replace(/[{]month[}]/g, '11').replace(/[{]day[}]/g, '10').replace(/[{]date[}]/g, '2026-11-10').replace(/[{]title[}]/g, 'exemple') : '';
  crumbs([W.navModels, kindLabel(k)]);
  return v2head(esc(kindLabel(k)) + (changed ? ' <span class="built">' + esc(say(W.v2changedOn, { when: day(changed.at), who: changed.client || changed.door })) + '</span>' : ''), esc([m.app ? say(W.v2appOf, { app: m.app }) : W.v2yours2, say(W.v2nEntries, { n: num(k.count || 0) })].join(' · ')),
    '<a class="btn" href="#/vie?kind=' + esc(encodeURIComponent(kind)) + '">' + ic('i-life') + esc(W.v2itsEntries) + '</a><button class="btn" data-model-history="' + esc(m.id) + '">' + ic('i-history') + esc(W.v2versions) + '</button><button class="btn solid" data-ask-claude="model">' + ic('i-chat') + esc(W.v2changeWithClaude) + '</button>',
    v2app(m.app || kindName(kind))) +
    '<div class="grid g21"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
    v2panel(W.v2fields, fieldsTable, '<span class="muted" style="font-size:12px">' + esc(W.v2checkedEachSave) + '</span>', 'i-shape') +
    v2panel(W.v2calcs, calcs.length ? '<div>' + calcs.map((c) => '<div class="rule-line"><span class="nature calc">' + esc(c[0] + '.' + c[1]) + '</span><span class="muted">= ' + esc(c[2]) + '</span></div>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2noCalc) + '</div>', '', 'i-chart') +
    v2panel(W.v2rules, mine.length ? '<div>' + mine.map(ruleLine).join('') + '</div>' : '<div class="pad muted">' + esc(W.v2noRule) + '</div>', '<span class="muted" style="font-size:12px">' + esc(W.v2rulesNote) + '</span>', 'i-scale') +
    '</div><div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
    v2panel(W.v2exportLayout, '<div class="form" style="display:grid;gap:12px"><label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.v2path) + ' <small class="muted">' + esc(W.v2pathHelp) + '</small><input class="field mono" data-model-path="' + esc(m.id) + '" value="' + esc(path) + '" placeholder="' + esc(kind.toLowerCase()) + '/{year}/{month}/{title}.md"></label>' + (example ? '<div class="cell-sub">' + esc(W.v2example) + ' <span class="path">' + esc(example) + '</span></div>' : '') + '<div class="cell-sub">' + esc(W.v2reimport) + '</div></div>', '', 'i-box') +
    v2panel(W.v2display, '<div class="form" style="display:grid;gap:12px"><div><div class="caps" style="margin-bottom:6px">' + esc(W.v2columns) + '</div><div class="chips">' + m.fields.map((f) => '<button class="chip" data-model-col="' + esc(m.id) + ':' + esc(f.name) + '" aria-pressed="' + cols.includes(f.name) + '"' + (cols.includes(f.name) ? '' : ' style="opacity:.55"') + '>' + esc(labelOf(m, f.name)) + '</button>').join('') + '</div></div>' +
      '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.v2groupByH) + '<select class="field" data-model-set="' + esc(m.id) + ':groupBy"><option value="">—</option>' + m.fields.filter((f) => ['choice', 'date', 'datetime', 'link', 'text'].includes(f.type)).map((f) => '<option value="' + esc(f.name) + '"' + (m.groupBy === f.name ? ' selected' : '') + '>' + esc(labelOf(m, f.name)) + '</option>').join('') + '</select></label>' +
      '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.v2totalH) + '<select class="field" data-model-set="' + esc(m.id) + ':total"><option value="">—</option>' + m.fields.filter((f) => ['number', 'amount', 'duration', 'formula'].includes(f.type)).map((f) => '<option value="' + esc(f.name) + '"' + (m.total === f.name ? ' selected' : '') + '>' + esc(labelOf(m, f.name)) + '</option>').join('') + '</select></label>' +
      '<div class="cell-sub">' + esc(W.v2formFrom) + ' <a href="#/vie?kind=' + esc(encodeURIComponent(kind)) + '">' + esc(W.v2seeForm) + '</a></div></div>', '', 'i-eye') +
    '<div class="hint">' + ic('i-chat') + '<span>' + W.v2modelHint + '</span></div></div></div>';
}

// What the model page does: each change is one save of the model, journaled, undone at once.
function bindModels(root) {
  const keep = async (id, data) => {
    try { await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id, data }] } }); toast(W.v2modelChanged, { id, spaceId: space }); await drawApps(); show(); } catch (error) { alert(error.message); show(); }
  };
  root.querySelectorAll('[data-model-path]').forEach((el) => el.addEventListener('change', () => keep(el.dataset.modelPath, { path: el.value.trim() || null })));
  root.querySelectorAll('[data-model-set]').forEach((el) => el.addEventListener('change', () => { const [id, field] = el.dataset.modelSet.split(':'); keep(id, { [field]: el.value || null }); }));
  root.querySelectorAll('[data-model-col]').forEach((b) => b.addEventListener('click', () => {
    const [id, field] = b.dataset.modelCol.split(':');
    const now = [...root.querySelectorAll('[data-model-col][aria-pressed="true"]')].map((x) => x.dataset.modelCol.split(':')[1]);
    keep(id, { columns: now.includes(field) ? now.filter((x) => x !== field) : now.concat([field]) });
  }));
  root.querySelectorAll('[data-model-history]').forEach((b) => b.addEventListener('click', async () => {
    const hist = await api(inSpace('/history?limit=30&target=' + encodeURIComponent(b.dataset.modelHistory)));
    openDrawer(W.v2versions, '<ul class="journal">' + hist.map((h) => '<li class="' + (h.undoneBy ? 'undone' : '') + '"><time>' + esc(day(h.at)) + '</time><span>' + esc(said(h.command)) + '<small>' + esc(say(W.by, { who: h.client || (h.actor === me.person.id ? W.v2you : h.actor), door: h.door })) + '</small></span>' + (h.undoneBy ? '' : '<button class="undo" data-undo-model="' + h.id + '">' + esc(W.undo) + '</button>') + '</li>').join('') + '</ul>');
    drawer().querySelectorAll('[data-undo-model]').forEach((u) => u.addEventListener('click', async () => { await api(inSpace('/undo'), { method: 'POST', body: { journalId: Number(u.dataset.undoModel) } }); closeDrawer(); await drawApps(); show(); }));
  }));
  root.querySelectorAll('[data-ask-claude]').forEach((b) => b.addEventListener('click', () => openDrawer(W.v2changeWithClaude, '<p>' + esc(W.v2askClaudeModel) + '</p>')));
}

// « Connexions » in the mockup: those who use Jarvis, and what Jarvis uses for her — even when she
// does not speak to it. A connection is a key, not a sentence: each key is cut here.
v2Pages.connexions = async function (params) {
  const [list, tools, catalog, health] = await Promise.all([api('/connections'), api('/connectors'), api('/connectors/catalog'), fetch('/health').then((r) => r.json()).catch(() => null)]);
  const logo = (l) => '<span class="app-icon" style="background:#' + esc(l.hex) + ';color:' + esc(l.fg) + ';width:24px;height:24px">' + (l.path ? '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;fill:currentColor"><path d="' + esc(l.path) + '"/></svg>' : '<span style="font:700 11px/1 Archivo,sans-serif">' + esc(l.initial) + '</span>') + '</span>';
  const known = (t) => catalog.find((e) => e.url && e.url === t.url);
  const logoOfTool = (t) => { const e = known(t); return logo(e ? e.logo : { hex: '6B4E43', fg: '#ffffff', path: null, initial: (t.name || '?').slice(0, 1) }); };
  const spaceNames = (ids) => me.spaces.filter((s) => ids.includes(s.id)).map((s) => s.name).join(', ') || '—';
  const stateTag = (st) => '<span class="tag ' + (st === 'connected' ? 'ok' : st === 'needs_sign_in' ? 'late' : st === 'failed' || st === 'refused' ? 'error' : 'neutral') + '">' + esc(W['con_' + st] || st) + '</span>';
  const assistants = '<div class="scroll"><table style="min-width:560px"><thead><tr><th>' + esc(W.v2assistant) + '</th><th>' + esc(W.navSpaces) + '</th><th>' + esc(W.v2lastAccess) + '</th><th>' + esc(W.v2state) + '</th><th></th></tr></thead><tbody>' +
    list.map((c) => '<tr><td><div class="cell-title">' + esc(c.name || c.clientId) + '</div><div class="cell-sub">' + esc(c.contextReadAt ? say(W.contextRead, { date: time(c.contextReadAt) }) : W.contextNotRead) + '</div></td><td>' + esc(spaceNames(c.spaces)) + '</td><td class="mono" style="font-size:12.5px">' + esc(c.used ? time(c.used) : '—') + '</td><td><span class="tag ok">' + esc(W.v2connected) + '</span></td><td><button class="btn small" data-manage-client="' + esc(c.clientId) + '">' + esc(W.v2manage) + '</button></td></tr>').join('') +
    '<tr><td><div class="cell-title">ChatGPT · ' + esc(W.v2otherAssistants) + '</div><div class="cell-sub">' + esc(W.v2pasteAddress) + '</div></td><td>—</td><td>—</td><td><span class="tag neutral">' + esc(W.v2notConnected) + '</span></td><td><button class="btn small" data-copy="' + esc(location.origin + '/mcp') + '">' + esc(W.copy) + '</button></td></tr>' +
    '<tr><td><div class="cell-title">' + esc(W.v2watcher) + '</div><div class="cell-sub">' + esc(W.v2watcherDoes) + '</div></td><td>' + esc(W.v2all) + '</td><td class="mono" style="font-size:12.5px">' + esc(health && health.watcher && health.watcher.lastPassAt ? time(health.watcher.lastPassAt) : '—') + '</td><td><span class="tag ' + (health && health.watcher && !health.watcher.late ? 'ok' : 'late') + '">' + esc(health && health.watcher && !health.watcher.late ? W.v2active : W.v2late) + '</span></td><td></td></tr>' +
    '</tbody></table></div><div class="pad"><div class="x-path">' + esc(W.connectLead) + ' <code class="url mono">' + esc(location.origin + '/mcp') + '</code> <button class="btn small" data-copy="' + esc(location.origin + '/mcp') + '">' + esc(W.copy) + '</button></div></div>';
  const used = '<div class="scroll"><table style="min-width:560px"><thead><tr><th>' + esc(W.v2tool) + '</th><th>' + esc(W.v2whatItReads) + '</th><th>' + esc(W.v2whatItCanDo) + '</th><th>' + esc(W.v2state) + '</th><th></th></tr></thead><tbody>' +
    (tools.length ? tools.map((t) => '<tr><td><div class="cell-title" style="display:flex;gap:8px;align-items:center;overflow-wrap:anywhere">' + logoOfTool(t) + esc(t.name) + '</div><div class="cell-sub">' + esc(t.serverName || t.url) + '</div></td><td><div class="cell-sub">' + esc(t.tools.length ? say(W.conTools, { n: t.tools.length }) : '—') + '</div></td><td><div class="cell-sub">' + esc(W.v2withYourYes) + '</div></td><td>' + stateTag(t.state) + '</td><td style="white-space:nowrap">' + (t.state === 'needs_sign_in' ? '<button class="btn small solid" data-con-signin="' + esc(t.id) + '">' + esc(W.conSignIn) + '</button> ' : '') + '<button class="btn small" data-con-check="' + esc(t.id) + '">' + esc(W.conCheck) + '</button> <button class="btn small" data-con-cut="' + esc(t.id) + '" data-name="' + esc(t.name) + '">' + esc(W.conCut) + '</button></td></tr>').join('') : '<tr><td colspan="5" class="muted">' + esc(W.conNone) + '</td></tr>') +
    '</tbody></table></div>' +
    '<div class="pad"><form class="form" id="con-add" style="padding:0;display:grid;gap:10px"><div class="field-row" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:10px;align-items:end">' +
    '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.v2addMcp) + ' <small class="muted">' + esc(W.v2anyMcp) + '</small><input class="field" name="url" type="url" required placeholder="https://exemple.com/mcp"></label>' +
    '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.conName) + '<input class="field" name="name" required maxlength="80"></label>' +
    '<input type="hidden" name="auth" value="oauth"><button class="btn solid">' + ic('i-plus') + esc(W.conConnect) + '</button></div>' +
    '<details><summary class="cell-sub" style="cursor:pointer">' + esc(W.v2withKey) + '</summary><div style="display:grid;gap:10px;margin-top:10px"><label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.conAuth) + '<select class="field" name="authPick"><option value="oauth">' + esc(W.conAuthOauth) + '</option><option value="none">' + esc(W.conAuthNone) + '</option><option value="bearer">' + esc(W.conAuthBearer) + '</option><option value="header">' + esc(W.conAuthHeader) + '</option></select></label><label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.conHeader) + '<input class="field" name="headerName" placeholder="x-api-key"></label><label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.conKey) + '<input class="field" name="secret" type="password" autocomplete="off"></label></div></details></form></div>';
  // The catalog, the most relevant first (her everyday tools: Drive, Gmail, Agenda…), with their logos.
  const groups = ['everyday', 'files', 'money', 'work', 'design'];
  const shown = catalog.filter((e) => !tools.some((t) => e.url && t.url === e.url));
  const discover = groups.map((g) => {
    const here = shown.filter((e) => e.group === g);
    if (!here.length) return '';
    return '<div class="caps" style="margin:14px 0 8px">' + esc(W['conGroup_' + g] || g) + '</div><div class="x-across">' + here.map((e) => '<div class="x-app"><div class="top">' + logo(e.logo) + esc(e.name) + '</div><p>' + esc(LANG === 'en' ? e.en : e.fr) + '</p><p class="cell-sub" style="margin:0">' + esc(e.url ? W['conWay_' + e.auth] : W.conWay_url) + '</p>' +
      (e.ready
        ? '<form class="tool-form" data-con-pick="' + esc(e.id) + '" data-name="' + esc(e.name) + '" data-url="' + esc(e.url) + '" data-auth="' + esc(e.auth) + '" style="display:grid;gap:8px">' + (e.url ? '' : '<input class="field" name="url" type="url" required placeholder="https://…" aria-label="' + esc(W.conUrl) + '">') + (e.auth === 'bearer' ? '<input class="field" name="secret" type="password" required autocomplete="off" placeholder="' + esc(W.conKey) + '" aria-label="' + esc(W.conKey) + '">' : '') +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn small solid">' + esc(e.auth === 'oauth' ? W.conPickSignIn : W.conPick) + '</button>' + (e.help ? '<a class="cell-sub" href="' + esc(e.help) + '" target="_blank" rel="noopener">' + esc(e.url ? W.conWhereKey : W.conWhereUrl) + '</a>' : '') + '</div></form>'
        : '<p class="cell-sub">' + esc(W.conNeedsGoogle) + '</p>') + '</div>').join('') + '</div>';
  }).join('');
  return v2head(esc(W.navConnections), esc(W.v2connectionsSub), '') +
    '<div class="grid" style="grid-template-columns:minmax(0,1fr);gap:16px">' +
    v2panel(W.v2theyUseJarvis, assistants, '', 'i-chat') +
    v2panel(W.v2jarvisUsesThem, used, '', 'i-plug') +
    v2panel(W.v2toConnectH, '<div class="pad">' + discover + '</div>', '<span class="muted" style="font-size:12px">' + esc(W.v2relevantFirst) + '</span>', 'i-spark') +
    '</div><div class="hint">' + ic('i-lock') + '<span>' + W.v2keyHint + '</span></div>';
};

// What the connections page does beyond the usual gestures: the reach of an assistant, cut there.
function bindConnexions(root) {
  root.querySelectorAll('[data-manage-client]').forEach((b) => b.addEventListener('click', async () => {
    const list = await api('/connections');
    const c = list.find((x) => x.clientId === b.dataset.manageClient);
    if (!c) return;
    openDrawer(c.name || c.clientId, '<form data-reach="' + esc(c.clientId) + '" style="display:grid;gap:8px"><div class="caps">' + esc(W.reach) + '</div>' + me.spaces.map((s) => '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" value="' + esc(s.id) + '"' + (c.spaces.includes(s.id) ? ' checked' : '') + '> ' + esc(s.name) + '</label>').join('') + '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn solid">' + esc(W.save) + '</button><button type="button" class="btn" data-revoke="' + esc(c.clientId) + '" data-name="' + esc(c.name || c.clientId) + '">' + esc(W.revoke) + '</button></div></form>', '', say(W.since, { date: day(c.since) }));
    bindCommon(drawer());
  }));
  const form = root.querySelector('#con-add');
  if (form) {
    const pick = form.querySelector('[name="authPick"]');
    if (pick) pick.addEventListener('change', () => { form.querySelector('[name="auth"]').value = pick.value; });
  }
}

// The blocks of a page (an app's page, a dashboard), drawn in the mockup's markup: figures, gauges,
// bars, a line, shares, tables with their total, things to act on, a form, a kanban, her days.
const SERIES2 = ['var(--primary)', 'var(--ochre)', 'var(--info)', 'var(--success)', 'var(--verify)', 'var(--ink)'];
function blocksHtml(drawn) {
  const vocab = drawn.vocabulary || {};
  const fLabel = (kind, name) => { const v = vocab[kind] && vocab[kind].fields[name]; return v && v.label ? tr(v.label) : name === 'title' ? W.title : W['lbl_' + name] || name; };
  const oLabel = (kind, name, value) => { const v = vocab[kind] && vocab[kind].fields[name]; return v && v.options && typeof value === 'string' && v.options[value] ? tr(v.options[value]) : value; };
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const fmt = (v) => v === null || v === undefined || v === '' ? '—' : isNum(v) ? num(Math.round(v * 100) / 100) : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const T = (b) => tr(b.title) || '';
  const table = (columns, rows, kind, extra) => rows.length ? '<div class="scroll"><table><thead><tr>' + columns.map((c) => '<th class="' + (rows.every((r) => r[c] == null || isNum(r[c])) ? 'n' : '') + '">' + esc(c === 'group' ? '' : fLabel(kind, c)) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr' + (r.id ? ' class="row-click" data-go="#/entree/' + esc(r.id) + '" style="cursor:pointer"' : '') + '>' + columns.map((c) => '<td class="' + (isNum(r[c]) ? 'n' : '') + '">' + (c === 'title' ? '<div class="cell-title">' + esc(fmt(r[c])) + '</div>' : esc(fmt(oLabel(kind, c, r[c])))) + '</td>').join('') + '</tr>').join('') + (extra || '') + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>';
  const bars = (b) => { const max = Math.max(1, ...b.points.map((p) => Math.abs(p.value))); return b.points.length ? '<div class="pad" style="display:flex;flex-direction:column;gap:8px">' + b.points.map((p) => '<div class="hbar" style="grid-template-columns:minmax(80px,30%) 1fr 90px"><span>' + esc(fmt(b.groupField ? oLabel(b.kind, b.groupField, p.label) : p.label)) + '</span><div class="track"><div class="fill" style="width:' + Math.max(1, Math.abs(p.value) / max * 100) + '%"></div></div><span class="mono" style="text-align:right;font-size:12px">' + esc(fmt(p.value)) + '</span></div>').join('') + '</div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>'; };
  const draw = {
    stat: (b) => v2kpi(T(b), esc(fmt(b.value)) + (b.unit ? '<small>' + esc(b.unit) + '</small>' : ''), '', isNum(b.value) && b.value < 0 ? 'alert' : ''),
    stat_delta: (b) => v2kpi(T(b), esc(fmt(b.value)) + (b.unit ? '<small>' + esc(b.unit) + '</small>' : ''), b.delta == null ? esc(W.v2noCompare) : (b.delta > 0 ? '↑ ' : '↓ ') + esc(fmt(Math.abs(b.delta))) + ' % · ' + esc(say(W.v2vsBefore, { value: fmt(b.previous) }))),
    gauge: (b) => v2panel(T(b), b.items.length ? '<div class="pad" style="display:flex;flex-direction:column;gap:12px">' + b.items.map((g) => { const p = isNum(g.max) && g.max > 0 && isNum(g.value) ? g.value / g.max * 100 : 0; return '<div><div style="display:flex;justify-content:space-between;gap:8px"><span>' + esc(fmt(g.label)) + '</span><span class="mono" style="font-size:12px">' + esc(fmt(g.value)) + ' / ' + esc(fmt(g.max)) + '</span></div><div class="bar ' + (p > 100 ? 'warn' : p >= 80 ? 'info' : 'ok') + '" style="margin-top:6px"><i style="width:' + Math.min(100, Math.max(1, p)) + '%"></i></div></div>'; }).join('') + '</div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>', '', 'i-chart'),
    bar: (b) => v2panel(T(b), bars(b), '', 'i-chart'),
    breakdown: (b) => { const total = b.points.reduce((t, p) => t + Math.max(0, p.value), 0) || 1; return v2panel(T(b), b.points.length ? '<div class="pad"><div style="display:flex;height:12px;border-radius:3px;overflow:hidden">' + b.points.map((p, i) => '<span style="flex:' + Math.max(0, p.value) + ';background:' + SERIES2[i % SERIES2.length] + '"></span>').join('') + '</div><div class="legend" style="margin-top:10px">' + b.points.map((p, i) => '<span><i style="background:' + SERIES2[i % SERIES2.length] + '"></i>' + esc(fmt(b.groupField ? oLabel(b.kind, b.groupField, p.label) : p.label)) + ' ' + Math.round(Math.max(0, p.value) / total * 100) + ' %</span>').join('') + '</div></div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>', '', 'i-chart'); },
    line: (b) => {
      const series = b.series && b.series.length ? b.series : [{ name: '', points: b.points }];
      const labels = series[0].points.map((p) => p.label);
      if (labels.length < 2) return draw.bar(b);
      const all = series.flatMap((s) => s.points.map((p) => p.value));
      const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1, min = lo - pad, span = hi + pad - min;
      const Wd = 520, H = 160, px = (i) => 28 + i * (Wd - 38) / (labels.length - 1), py = (x) => 10 + (1 - (x - min) / span) * (H - 30);
      return v2panel(T(b), '<div class="pad"><svg class="chart" viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="' + esc(T(b)) + '">' + series.map((s, n) => '<polyline fill="none" stroke="' + SERIES2[n % SERIES2.length] + '" stroke-width="2.2" points="' + s.points.map((p, i) => px(i).toFixed(1) + ',' + py(p.value).toFixed(1)).join(' ') + '"/>' + s.points.map((p, i) => '<circle cx="' + px(i) + '" cy="' + py(p.value) + '" r="3" fill="' + SERIES2[n % SERIES2.length] + '"><title>' + esc(p.label + ' : ' + fmt(p.value)) + '</title></circle>').join('')).join('') + '<text x="28" y="' + (H - 4) + '">' + esc(labels[0]) + '</text><text x="' + (Wd - 10) + '" y="' + (H - 4) + '" text-anchor="end">' + esc(labels[labels.length - 1]) + '</text></svg>' +
        (series.length > 1 ? '<div class="legend">' + series.map((s, n) => '<span><i style="background:' + SERIES2[n % SERIES2.length] + '"></i>' + esc(fLabel(b.kind, s.name)) + '</span>').join('') + '</div>' : '') + '</div>', '', 'i-chart');
    },
    heatmap: (b) => v2panel(T(b), '<div class="pad"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(14px,1fr));gap:3px">' + b.cells.map((c) => '<span title="' + esc(c.day) + '" style="aspect-ratio:1;border-radius:3px;background:' + (c.done ? 'var(--success)' : 'var(--clay)') + '"></span>').join('') + '</div><div class="cell-sub" style="margin-top:8px">' + esc(say(W.v2daysDone, { n: b.done, of: b.cells.length })) + '</div></div>', '', 'i-routine'),
    table: (b) => v2panel(T(b), table(b.columns, b.rows, b.kind, b.total ? '<tr class="total">' + b.columns.map((c, i) => '<td class="' + (c === b.total ? 'n' : '') + '">' + (i === 0 ? esc(W.total) : c === b.total ? esc(fmt(b.totalValue)) : '') + '</td>').join('') + '</tr>' : ''), '<span class="muted" style="font-size:12px">' + b.rows.length + '</span>', 'i-life'),
    task_list: (b, at) => v2panel(T(b), b.items.length ? '<div class="pad x-rel">' + b.items.map((t) => '<div style="display:flex;gap:10px;align-items:center;padding:9px 12px;border-radius:8px;background:var(--sand)"><a href="#/entree/' + esc(t.id) + '" style="flex:1;color:inherit"><b>' + esc(t.title) + '</b>' + (t.detail != null ? ' <em class="muted" style="font-style:normal">· ' + esc(fmt(t.detail)) + '</em>' : '') + '</a><button class="btn small" data-block-set="' + esc(t.id) + ':' + at + '">' + ic('i-check') + esc(b.action.label) + '</button></div>').join('') + '</div>' : '<div class="pad muted">' + esc(W.allDone) + '</div>', '', 'i-check'),
    kanban: (b) => v2panel(T(b), '<div class="pad"><div style="display:grid;grid-template-columns:repeat(' + Math.max(1, b.columns.length) + ',minmax(160px,1fr));gap:10px;overflow-x:auto">' + b.columns.map((c) => '<div style="background:var(--sand);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px"><div class="caps">' + esc(oLabel(b.kind, b.by, c.name)) + ' · ' + c.items.length + '</div>' + c.items.map((i) => '<a href="#/entree/' + esc(i.id) + '" style="background:var(--paper);border:1px solid var(--rule);border-radius:6px;padding:6px 8px;color:inherit">' + esc(i.title) + '</a>').join('') + '</div>').join('') + '</div></div>', '', 'i-life'),
    calendar: (b) => v2panel(T(b), b.occurrences.length ? '<div class="x-day">' + b.occurrences.map((o) => '<div class="slot"><time>' + esc(new Date(o.start).toLocaleString(locale, o.allDay ? { weekday: 'short', day: 'numeric' } : { weekday: 'short', hour: '2-digit', minute: '2-digit' })) + '</time><div><b><a href="#/entree/' + esc(o.id) + '" style="color:inherit">' + esc(o.title) + '</a></b><div class="meta"><span class="cell-sub">' + esc(kindName(o.kind)) + '</span></div></div><span></span></div>').join('') + '</div>' : '<div class="pad muted">' + esc(W.noEvents) + '</div>', '', 'i-cal'),
    form: (b, at) => v2panel(T(b) || say(W.addOne, { kind: kindName(b.kind) }), '<form class="pad" data-block-form="' + at + '" style="display:grid;gap:10px"><label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.title) + ' *<input class="field" name="__title" required></label>' +
      b.fields.map((f) => '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(fLabel(b.kind, f.name) + (f.required ? ' *' : '') + (f.unit ? ' · ' + f.unit : '')) +
        (f.type === 'choice' ? '<select class="field" name="' + esc(f.name) + '"><option value=""></option>' + f.options.map((o) => '<option value="' + esc(o) + '">' + esc(oLabel(b.kind, f.name, o)) + '</option>').join('') + '</select>'
          : f.type === 'boolean' ? '<select class="field" name="' + esc(f.name) + '"><option value=""></option><option value="true">' + esc(W.yes) + '</option><option value="false">' + esc(W.no) + '</option></select>'
          : '<input class="field" name="' + esc(f.name) + '" type="' + (f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : ['number', 'amount'].includes(f.type) ? 'number' : 'text') + '" step="any">') + '</label>').join('') +
      '<div><button class="btn solid">' + ic('i-plus') + esc(W.v2add) + '</button></div></form>', '', 'i-plus'),
    sql: (b) => {
      const x = b.columns[0];
      const y = b.columns.find((c) => b.rows.some((r) => isNum(r[c]) || (r[c] !== null && r[c] !== '' && !isNaN(Number(r[c])))));
      const points = y ? b.rows.map((r) => ({ label: r[x], value: Number(r[y]) || 0 })) : [];
      if (b.chart === 'number') return draw.stat({ title: b.title, value: y && b.rows[0] ? Number(b.rows[0][y]) : null });
      if ((b.chart === 'bar' || b.chart === 'line') && y) return draw[b.chart]({ title: b.title, points });
      return v2panel(T(b), table(b.columns, b.rows), '', 'i-chart');
    },
    record: (b) => { const r = b.record; if (!r) return v2panel(T(b), '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>'); return v2panel(T(b), '<div class="scroll"><table><tbody>' + r.fields.map((f) => '<tr><td class="muted">' + esc(fLabel(r.kind, f.name)) + '</td><td><b>' + esc(fmt(oLabel(r.kind, f.name, f.value))) + '</b></td><td>' + (f.computed ? '<span class="origin inferred">' + esc(W.v2computed) + '</span>' : '') + '</td></tr>').join('') + '</tbody></table></div>' + r.relations.map((rel) => '<div class="caps pad" style="padding-bottom:0">' + esc(rel.name) + ' · ' + rel.rows.length + '</div>' + table(rel.columns, rel.rows, rel.kind)).join(''), '', 'i-life'); },
    view: (b) => { const r = b.result; if (r.type === 'kanban') return draw.kanban({ title: b.title, kind: b.kind, by: r.kanban.by, columns: r.kanban.columns }); const rows = r.rows || (r.tree && r.tree.rows) || []; return v2panel(T(b), table(r.columns || ['title'], rows, b.kind), '', 'i-life'); },
  };
  // Figures side by side, as the mockup's KPIs; every other block in a panel.
  const out = [];
  let figures = [];
  const flush = () => { if (figures.length) out.push('<div class="grid g' + Math.min(4, Math.max(2, figures.length)) + '">' + figures.join('') + '</div>'); figures = []; };
  drawn.blocks.forEach((b, at) => {
    const html = b.error ? v2panel(T(b), '<div class="pad error-text">' + esc(say(W.failed, { reason: b.error })) + '</div>') : draw[b.block] ? draw[b.block](b, at) : '';
    if (!b.error && (b.block === 'stat' || b.block === 'stat_delta' || (b.block === 'sql' && b.chart === 'number'))) figures.push(html);
    else { flush(); out.push(html); }
  });
  flush();
  const filters = drawn.filters && drawn.filters.length ? '<div class="toolbar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' + drawn.filters.map((f) => '<label style="display:flex;gap:6px;align-items:center"><span class="caps">' + esc(tr(f.label) || f.name) + '</span>' +
    (f.type === 'month' ? '<input class="field" type="month" data-page-filter="' + esc(f.name) + '" value="' + esc(f.value) + '" style="width:auto">' : f.type === 'choice' ? '<select class="field" data-page-filter="' + esc(f.name) + '" style="width:auto">' + (f.options || []).map((o) => '<option' + (o === f.value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' : '<input class="field" data-page-filter="' + esc(f.name) + '" value="' + esc(f.value) + '" style="width:auto">') + '</label>').join('') + '</div>' : '';
  return filters + '<div style="display:flex;flex-direction:column;gap:16px">' + out.join('') + '</div>';
}

// What blocks do: a filter changes the page, a gesture sets fields, a form adds an entry.
let shownPage = null;
async function drawPageInto(id, params) {
  const q = new URLSearchParams(params || {}); q.set('space', space);
  shownPage = await api('/pages/' + encodeURIComponent(id) + '?' + q.toString());
  return shownPage;
}
function bindBlocks(root) {
  root.querySelectorAll('[data-page-filter]').forEach((el) => el.addEventListener('change', () => {
    const h = location.hash.split('?'); const q = new URLSearchParams(h[1] || ''); q.set('f_' + el.dataset.pageFilter, el.value); location.hash = h[0] + '?' + q.toString();
  }));
  root.querySelectorAll('[data-block-set]').forEach((b) => b.addEventListener('click', async () => {
    const [id, at] = b.dataset.blockSet.split(':');
    b.disabled = true;
    try { await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id, data: shownPage.blocks[Number(at)].action.set }] } }); toast(W.v2filed, { id, spaceId: space }); show(); } catch (error) { b.disabled = false; alert(error.message); }
  }));
  root.querySelectorAll('[data-block-form]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const b = shownPage.blocks[Number(form.dataset.blockForm)];
    const data = {};
    for (const f of b.fields) {
      const v = form.elements[f.name] && form.elements[f.name].value;
      if (!v) continue;
      data[f.name] = ['number', 'amount'].includes(f.type) ? Number(v) : f.type === 'boolean' ? v === 'true' : v;
    }
    try { const saved = await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: b.kind, title: form.elements.__title.value, data }] } }); toast(say(W.added1, { kind: kindName(b.kind) }), { id: saved.entries[0].id, spaceId: space }); show(); } catch (error) { alert(error.message); }
  }));
}
const pageParams = (params) => { const out = {}; params.forEach((v, k) => { if (k.startsWith('f_')) out[k.slice(2)] = v; }); return out; };

// « Tableaux de bord » in the mockup: each one a card — its first figures, who made it, when — and
// opened in full, recomputed each time, in the app as in Claude.
const widgetsAsBlocks = (d) => ({ blocks: d.widgets.map((w) => ({ block: 'sql', title: w.title, chart: w.chart, columns: w.columns, rows: w.rows, error: w.error })), filters: [], vocabulary: {} });
v2Pages.tableaux = async function (params) {
  const id = params.get('id');
  if (id) {
    const d = await api(inSpace('/dashboard'), { method: 'POST', body: { id } });
    crumbs([W.navDashboards, d.title]);
    return v2head(esc(d.title), esc(say(W.v2computedAt, { when: time(d.computedAt) })), '<a class="btn" href="#/tableaux">' + ic('i-left') + esc(W.navDashboards) + '</a><a class="btn" href="#/entree/' + esc(id) + '">' + ic('i-shape') + esc(W.fullEntry) + '</a>') + blocksHtml(widgetsAsBlocks(d));
  }
  const list = await api(inSpace('/entries?kind=Dashboard&limit=50'));
  const drawn = await Promise.all(list.slice(0, 8).map((d) => api(inSpace('/dashboard'), { method: 'POST', body: { id: d.id } }).catch(() => null)));
  const cardOf = (d, i) => {
    const w = drawn[i];
    const figures = w ? w.widgets.filter((x) => x.chart === 'number' && !x.error).slice(0, 2) : [];
    const firstBar = w ? w.widgets.find((x) => (x.chart === 'bar' || x.chart === 'line') && !x.error && x.rows.length) : null;
    let body = '';
    if (figures.length) body = '<div class="grid g2" style="gap:10px">' + figures.map((x) => { const y = x.columns.find((c) => x.rows[0] && !isNaN(Number(x.rows[0][c]))); return v2kpi(x.title, esc(y ? num(Number(x.rows[0][y])) : '—'), ''); }).join('') + '</div>';
    else if (firstBar) { const y = firstBar.columns.find((c) => firstBar.rows.some((r) => !isNaN(Number(r[c])) && r[c] !== null)); const vals = firstBar.rows.slice(-8).map((r) => Number(r[y]) || 0); const max = Math.max(1, ...vals); body = '<svg class="chart" viewBox="0 0 200 60">' + vals.map((v, j) => '<rect x="' + (j * 25 + 4) + '" y="' + (56 - (v / max) * 50) + '" width="16" height="' + (v / max) * 50 + '" fill="var(--primary)" rx="1"/>').join('') + '</svg>'; }
    else body = '<div class="cell-sub">' + esc(say(W.v2nWidgets, { n: w ? w.widgets.length : 0 })) + '</div>';
    return '<section class="panel"><div class="panel-head"><span class="left"><span class="app-icon" style="background:' + appColor(d.title) + '">' + ic('i-chart') + '</span><b style="color:var(--ink);font-size:13.5px">' + esc(d.title) + '</b></span><a class="btn small" href="#/tableaux?id=' + esc(d.id) + '">' + esc(W.open) + '</a></div><div class="panel-body pad">' + body + '<div class="cell-sub" style="margin-top:10px">' + esc(say(W.v2boardMeta, { when: day(d.createdAt), n: w ? w.widgets.length : 0 })) + '</div></div></section>';
  };
  return v2head(esc(W.navDashboards), esc(say(W.v2boardsSub, { n: list.length })), '<button class="btn" data-ask-board>' + ic('i-chat') + esc(W.v2askBoard) + '</button>') +
    (list.length ? '<div class="grid g2">' + list.map(cardOf).join('') + '</div>' : '<div class="panel"><div class="panel-body empty">' + esc(W.noDashboards) + '</div></div>') +
    '<div class="hint">' + ic('i-chat') + '<span>' + W.v2boardsHint + '</span></div>';
};

// An app, in the mockup: its icon and name, its tabs (its pages, its kinds, its views, its role),
// what the tab holds — a page in blocks, a kind in its explorer.
v2Pages.app = async function (params, name) {
  if (!name) return v2Pages.apps(new URLSearchParams());
  const kinds = knownKinds.length ? knownKinds : await api(inSpace('/kinds'));
  const models = kinds.filter((k) => k.model && k.model.app === name);
  const [appPages, views] = await Promise.all([api(inSpace('/pages?app=' + encodeURIComponent(name))), api(inSpace('/views?app=' + encodeURIComponent(name))).catch(() => [])]);
  const pageId = params.get('page') || (!params.get('kind') && !params.get('view') && appPages[0] ? appPages[0].id : null);
  const tabs = '<nav class="tabs">' +
    appPages.map((p) => '<a href="#/app/' + esc(encodeURIComponent(name)) + '?page=' + esc(encodeURIComponent(p.id)) + '"' + (p.id === pageId ? ' aria-current="page"' : '') + '>' + esc(tr(p.label) || p.title) + '</a>').join('') +
    models.map((k) => '<a href="#/app/' + esc(encodeURIComponent(name)) + '?kind=' + esc(encodeURIComponent(k.kind)) + '"' + (params.get('kind') === k.kind ? ' aria-current="page"' : '') + '>' + esc(kindLabel(k)) + '<span class="n">' + num(k.count || 0) + '</span></a>').join('') +
    views.map((v) => '<a href="#/app/' + esc(encodeURIComponent(name)) + '?view=' + esc(encodeURIComponent(v.id)) + '"' + (params.get('view') === v.id ? ' aria-current="page"' : '') + '>' + esc(tr(v.label) || v.title) + '</a>').join('') +
    '<a href="#/role/' + esc(encodeURIComponent(name)) + '">' + esc(W.v2appRoleTab) + '</a></nav>';
  const head = v2head(esc(name) + ' <span class="built">' + esc(say(W.v2nKinds, { n: models.length })) + '</span>', esc(W.v2appSub), '', v2app(name));
  crumbs([W.navApps, name]);
  if (pageId) {
    const drawn = await drawPageInto(pageId, pageParams(params));
    return head + tabs + blocksHtml(drawn);
  }
  const inner = await dayPages.app(params, name);
  return head + tabs + '<section class="panel"><div class="panel-body pad">' + inner.replace(/<nav class="tabs">[^]*?<[/]nav>/, '') + '</div></section>';
};
function bindBoards(root) {
  const ask = root.querySelector('[data-ask-board]');
  if (ask) ask.addEventListener('click', () => openDrawer(W.v2askBoard, '<p>' + esc(W.v2askBoardHow) + '</p>'));
}

// The settings pages, in the mockup's frame: her account, her spaces; the journal, her reminders
// and her files where the mockup puts them (the journal's drawer, the agenda, her documents).
v2Pages.compte = async function () {
  return v2head(esc(W.navAccount), esc(W.v2accountSub), '', '<span class="avatar" style="width:28px;height:28px">' + esc(String(me.person.name || '?').split(/ +/).map((w) => w.slice(0, 1)).join('').slice(0, 2).toUpperCase()) + '</span>') +
    (await settingsPages.compte()).replace('<section class="grid">', '<div class="x-grid">').replace(/<[/]section>$/, '</div>');
};
v2Pages.espaces = async function () {
  return v2head(esc(W.navSpaces), esc(W.v2spacesSub), '') + (await settingsPages.espaces()).replace('<section class="grid">', '<div class="x-grid">').replace(/<[/]section>$/, '</div>');
};
v2Pages.journal = async function () { setTimeout(journalDrawer, 0); return v2Pages[''](); };
v2Pages.rappels = async function () { setTimeout(() => { location.replace('#/agenda?v=rappels'); }, 0); return '<div class="empty">' + esc(W.loading) + '</div>'; };
v2Pages.fichiers = async function () { setTimeout(() => { location.replace('#/documents?s=deposes'); }, 0); return '<div class="empty">' + esc(W.loading) + '</div>'; };
v2Pages.document = async function (params, id) {
  const e = await api(inSpace('/entries/' + encodeURIComponent(id)));
  crumbs([W.navDocuments, e.title]);
  return v2head(esc(e.title), esc(kindName(e.kind) + ' · ' + say(W.chars, { n: num(String(e.data.text || '').length) })), '<a class="btn" href="#/documents">' + ic('i-left') + esc(W.navDocuments) + '</a><a class="btn" href="#/entree/' + esc(id) + '">' + ic('i-life') + esc(W.fullEntry) + '</a>') +
    '<section class="panel"><div class="panel-body">' + frame('/app/frame/document/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space)) + '</div></section>';
};
`;
