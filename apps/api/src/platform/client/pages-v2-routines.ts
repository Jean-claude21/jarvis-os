// I6 — drawn in J-C's mockup: an app that holds habits (the Routines app, or any app with a Habit
// model) opens on three tabs of its own: « Aujourd'hui » (the non-negotiables to check, the day's
// template from the agenda), « Habitudes » (each with its cadence, its streak, its last thirty days)
// and « Régularité » (the last 28 days, the daily rate, what slips). All computed from her entries.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no backticks, no dollar-brace, and no backslashes.
export const v2Routines = `
const HABIT_KINDS = ['habit', 'habitude'];
const isHabitApp = (models, name) => models.some((k) => HABIT_KINDS.includes(String(k.kind).toLowerCase())) || (name === 'Routines' && knownKinds.some((k) => HABIT_KINDS.includes(String(k.kind).toLowerCase()) && k.count));
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const cadenceWords = (text) => {
  const days = String(text || '').split(',').filter((d) => WEEK.includes(d));
  if (!days.length) return text || '—';
  if (days.length === 7) return W.rt_everyDay;
  if (days.join(',') === 'mon,tue,wed,thu,fri') return W.rt_weekdays;
  return days.map((d) => new Date(Date.UTC(2026, 10, 2 + WEEK.indexOf(d))).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })).join(', ');
};
const hm = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

async function habitsView(app, tab) {
  const board = await api('/habits/board?days=28');
  const hs = board.habits;
  if (!hs.length) return '<section class="panel"><div class="panel-body empty">' + esc(W.rt_noHabit) + '</div></section>';
  const today = board.days[board.days.length - 1];
  const avg = (list) => { const v = list.filter((x) => x.rate !== null).map((x) => x.rate); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };

  if (tab === 'habitudes') {
    return v2panel(W.rt_active, '<div class="scroll"><table><thead><tr><th>' + esc(W.rt_habit) + '</th><th>' + esc(W.rt_facet) + '</th><th>' + esc(W.rt_cadence) + '</th><th>' + esc(W.rt_time) + '</th><th>' + esc(W.rt_nn) + '</th><th class="n">' + esc(W.rt_streak) + '</th><th style="width:16%">' + esc(W.rt_30d) + '</th></tr></thead><tbody>' +
      hs.map((h) => { const r = h.rate30 === null ? null : Math.round(h.rate30); return '<tr class="row-click" data-go="#/entree/' + esc(h.id) + '"><td class="cell-title">' + esc(h.title) + '</td><td>' + (h.facet ? '<span class="tag neutral bare">' + esc(h.facet) + '</span>' : '<span class="faint">—</span>') + '</td><td class="mono">' + esc(cadenceWords(h.cadence)) + '</td><td class="mono faint">' + esc(h.time || '—') + '</td><td>' + (h.nonNegotiable ? '<span class="tag ok bare">' + esc(W.rt_yes) + '</span>' : '<span class="faint">' + esc(W.rt_no) + '</span>') + '</td><td class="n">' + esc(say(W.rv_days, { n: h.streak })) + '</td><td>' + (r === null ? '<span class="faint">—</span>' : '<div style="display:flex;gap:8px;align-items:center"><div class="bar ' + (r >= 80 ? 'ok' : r >= 60 ? 'warn' : '') + '" style="flex:1"><i style="width:' + r + '%"></i></div><span class="mono" style="font-size:12px;width:34px;text-align:right">' + r + '%</span></div>') + '</td></tr>'; }).join('') +
      '</tbody></table></div>', '', 'i-routine') +
      '<div class="hint">' + ic('i-chat') + '<span>' + W.rt_hint + '</span></div>';
  }

  if (tab === 'regularite') {
    const n = board.days.length;
    const level = { done: 'l3', todo: '', miss: '', off: 'off' };
    const heat = '<div class="pad scroll"><div class="heat" style="grid-template-columns:150px repeat(' + n + ', minmax(8px, 1fr));grid-template-rows:none;grid-auto-flow:row;min-width:560px"><span></span>' +
      board.days.map((d, i) => '<span class="day">' + (i % 3 === 0 || i === n - 1 ? Number(d.slice(8)) : '') + '</span>').join('') +
      hs.map((h) => '<span class="lbl">' + esc(h.title) + '</span>' + h.line.map((s, i) => '<span class="c ' + level[s] + (i === n - 1 ? ' today' : '') + '" title="' + esc(h.title + ' · ' + day(board.days[i]) + ' · ' + W['rv_' + (s === 'todo' ? 'off' : s)]) + '"></span>').join('')).join('') +
      '</div><div class="legend" style="margin-top:12px"><span><i style="background:var(--heat-3)"></i>' + esc(W.rv_done) + '</span><span><i style="background:var(--heat-0)"></i>' + esc(W.rv_miss) + '</span><span><i style="border:1px dashed var(--rule-strong)"></i>' + esc(W.rv_off) + '</span></div></div>';
    const pts = board.daily.map((x) => x.rate);
    const Wd = 520, H = 150;
    const x = (i) => 28 + (i / Math.max(1, pts.length - 1)) * (Wd - 36);
    const y = (v) => H - 20 - (v / 100) * (H - 34);
    const known = pts.map((v, i) => [v, i]).filter((p) => p[0] !== null);
    const line = '<svg class="chart" viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="' + esc(W.rt_dailyRate) + '">' + [0, 50, 100].map((v) => '<line x1="28" x2="' + Wd + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--rule)" stroke-dasharray="2 3"/><text x="22" y="' + (y(v) + 3) + '" text-anchor="end">' + v + '</text>').join('') +
      (known.length ? '<path d="M' + known.map((p) => x(p[1]) + ',' + y(p[0])).join(' L') + '" fill="none" stroke="var(--success)" stroke-width="2"/><circle cx="' + x(known[known.length - 1][1]) + '" cy="' + y(known[known.length - 1][0]) + '" r="3.5" fill="var(--success)"/>' : '') +
      '<text x="' + x(0) + '" y="' + (H - 4) + '">' + esc(day(board.days[0])) + '</text><text x="' + x(pts.length - 1) + '" y="' + (H - 4) + '" text-anchor="end">' + esc(day(today)) + '</text></svg>';
    const slipping = hs.filter((h) => h.rate30 !== null && h.rate30 < 70).sort((a, b) => a.rate30 - b.rate30);
    const slips = slipping.length ? '<div>' + slipping.map((h) => { const missed = h.line.map((s, i) => s === 'miss' ? board.days[i] : null).filter(Boolean); const byDay = {}; missed.forEach((d) => { const w = new Date(d + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long' }); byDay[w] = (byDay[w] || 0) + 1; }); const worst = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]; return '<div class="rule-line"><span class="tag ' + (h.rate30 < 50 ? 'error' : 'late') + '">' + Math.round(h.rate30) + '%</span><span><b>' + esc(h.title) + '</b><div class="cell-sub">' + esc(worst && worst[1] > 1 ? say(W.rt_mostlyOn, { day: worst[0], n: worst[1] }) : say(W.rt_missedN, { n: missed.length })) + '</div></span></div>'; }).join('') + '</div>' : '<div class="pad muted">' + esc(W.rt_slipsNone) + '</div>';
    return v2panel(say(W.rt_lastDays, { n: n }), heat, '<span class="muted" style="font-size:12px">' + esc(W.rt_fromChecks) + '</span>', 'i-routine') +
      '<div class="grid g2">' + v2panel(W.rt_dailyRate, '<div class="pad">' + line + '</div>', '<span class="muted mono" style="font-size:12px">%</span>', 'i-chart') + v2panel(W.rt_slips, slips, v2origin('inferred'), 'i-alert') + '</div>';
  }

  // Aujourd'hui.
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const agenda = await api('/agenda?from=' + encodeURIComponent(start.toISOString()) + '&to=' + encodeURIComponent(new Date(start.getTime() + 86400000).toISOString())).catch(() => ({ occurrences: [] }));
  const occ = agenda.occurrences.slice().sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const nowMs = Date.now();
  const tpl = occ.length ? '<ol class="template">' + occ.map((o) => { const s = new Date(o.start).getTime(); const e = o.end ? new Date(o.end).getTime() : s + 1800000; const cls = e < nowMs ? 'past' : s <= nowMs ? 'current' : ''; const mins = Math.round((e - s) / 60000); return '<li class="' + cls + '"><span class="h">' + esc(o.allDay ? W.rt_allDay : hm(o.start)) + '</span><span>' + esc(o.title) + '</span><span class="tag neutral bare">' + esc(o.allDay ? '—' : mins >= 60 ? (Math.round(mins / 6) / 10 + ' h').replace('.', ',') : mins + ' min') + '</span></li>'; }).join('') + '</ol>' : '<div class="pad muted">' + esc(W.rt_noTemplate) + '</div>';
  const nn = hs.some((h) => h.nonNegotiable) ? hs.filter((h) => h.nonNegotiable) : hs;
  const todays = nn.filter((h) => h.today !== null);
  const done = todays.filter((h) => h.today === 'done').length;
  const reg7 = avg(board.daily.slice(-7));
  const regBefore = avg(board.daily.slice(-14, -7));
  const best = hs.slice().sort((a, b) => b.streak - a.streak).filter((h) => h.streak > 0)[0];
  const left = todays.length - done;
  const rows = nn.map((h) => { const st = h.today; return '<button class="check-row ' + (st === 'done' ? 'done' : '') + (st === null ? ' off' : '') + '" data-habit-check="' + esc(h.id) + '" data-habit-title="' + esc(h.title) + '"' + (st !== 'todo' ? ' disabled' : '') + '><span class="box">' + ic('i-check') + '</span><span><span class="t">' + esc(h.title) + '</span><div class="cell-sub">' + esc([h.time, cadenceWords(h.cadence), st === null ? W.rt_notToday : null].filter(Boolean).join(' · ')) + '</div></span><span class="mono faint" style="font-size:12px">' + (h.streak ? esc(say(W.rt_streakN, { n: h.streak })) : '<span class="neg">' + esc(say(W.rt_streakN, { n: 0 })) + '</span>') + '</span></button>'; }).join('');
  return '<div class="grid g4">' +
    v2kpi(W.rt_nnKept, done + '<small>/ ' + todays.length + '</small>', esc(say(W.rt_atTime, { t: hm(new Date().toISOString()) }))) +
    v2kpi(W.rt_reg7, reg7 === null ? '—' : reg7 + ' %', reg7 !== null && regBefore !== null ? esc(say(W.rt_vsBefore, { n: (reg7 - regBefore >= 0 ? '+' : '') + (reg7 - regBefore) })) : '') +
    v2kpi(W.rt_longest, best ? esc(say(W.rv_days, { n: best.streak })) : '—', best ? esc(best.title) : '') +
    v2kpi(W.rt_leftToday, String(left), esc(left ? W.rt_leftHow : W.allDone), left ? 'alert' : '') + '</div>' +
    '<div class="grid g12">' + v2panel(W.rt_template, tpl, '<span class="pill"><span class="live"></span>' + esc(W.rt_now) + '</span>', 'i-cal') +
    '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + v2panel(W.rt_nnOfDay, '<div style="display:flex;gap:16px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--rule)"><div class="ring" style="--p:' + (todays.length ? Math.round((done / todays.length) * 100) : 0) + '"><span>' + done + '/' + todays.length + '</span></div><div><b>' + esc(left ? say(W.rt_left, { n: left }) : W.allDone) + '</b><div class="muted" style="font-size:13px">' + esc(W.rt_checkHow) + '</div></div></div>' + rows, '', 'i-check') + '</div></div>';
}

function bindRoutines(root) {
  root.querySelectorAll('[data-habit-check]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const today = localDay(new Date());
    try {
      await api(inSpace('/save'), { method: 'POST', body: { entries: [{ ref: 'c', kind: 'CheckIn', title: b.dataset.habitTitle, data: { date: today } }], links: [{ from: 'c', to: b.dataset.habitCheck, role: 'for' }] } });
      toast(W.rt_checked, null); show();
    } catch (error) { b.disabled = false; alert(error.message); }
  }));
}
`;
