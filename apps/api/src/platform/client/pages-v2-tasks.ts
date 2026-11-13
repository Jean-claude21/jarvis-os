// Specs 057, 058 — « Activités »: everything she has to do, in one place, what needs her first — what waits
// for her yes, what is late, today, this week, later, without a date — each with what it concerns;
// and apart, « Travaux »: what programs did for her (executions), failed first.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no backticks, no dollar-brace, and no backslashes.
export const v2Tasks = `
const TASK_GROUPS = ['review', 'failed', 'late', 'today', 'week', 'later', 'undated'];
const taskDayOf = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };
const taskDue = (due) => {
  if (!due) return '';
  const only = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(due);
  const d = only ? new Date(due + 'T12:00:00') : new Date(due);
  if (isNaN(d.getTime())) return due;
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(locale, opts) + (only ? '' : ' · ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
};
const execTag = (s) => s === 'done' ? ['ok', W.tk_execDone] : s === 'failed' ? ['error', W.tk_execFailed] : ['info', W.tk_execRunning];
const countsText = (c) => ['created', 'updated', 'skipped'].filter((k) => c && c[k]).map((k) => say(W['tk_n_' + k], { n: c[k] })).join(' · ');

function taskRow(a) {
  const about = a.about.length ? '<div class="cell-sub">' + esc(W.tk_about) + ' ' + a.about.map((x) => '<a href="#/entree/' + esc(x.id) + '">' + esc(x.title) + '</a>').join(', ') + '</div>' : '';
  const sub = [kindName(a.kind), a.due ? taskDue(a.due) : null, a.who ? a.who : null].filter(Boolean).join(' · ');
  const actions = a.group === 'review'
    ? '<button class="btn small solid" data-task-set="' + esc(a.id) + '" data-status="planned">' + ic('i-check') + esc(W.tk_accept) + '</button><button class="btn small" data-task-set="' + esc(a.id) + '" data-status="cancelled">' + ic('i-x') + esc(W.tk_dismiss) + '</button>'
    : a.group === 'failed'
      ? '<a class="btn small" href="#/entree/' + esc(a.id) + '">' + ic('i-eye') + esc(W.tk_see) + '</a>'
      : '<button class="btn small" data-task-later="' + esc(a.id) + '" data-days="1">' + esc(W.tk_tomorrow) + '</button><button class="btn small" data-task-later="' + esc(a.id) + '" data-days="7">' + esc(W.tk_nextWeek) + '</button>';
  const box = a.group === 'review' || a.group === 'failed' ? '<span class="box" style="visibility:hidden"></span>' : '<button class="box task-done" data-task-set="' + esc(a.id) + '" data-status="done" title="' + esc(W.tk_done) + '" aria-label="' + esc(W.tk_done) + '">' + ic('i-check') + '</button>';
  return '<div class="task-row' + (a.group === 'late' ? ' late' : '') + '">' + box + '<div class="task-main"><a class="cell-title" href="#/entree/' + esc(a.id) + '">' + esc(a.title) + '</a><div class="cell-sub">' + esc(sub) + '</div>' + about + '</div><div class="task-actions">' + actions + '</div></div>';
}

function execRow(a) {
  const e = a.execution || {};
  const t = execTag(a.status);
  const when = e.started ? day(e.started) + ' · ' + new Date(e.started).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
  return '<a class="task-row exec" href="#/entree/' + esc(a.id) + '"><span class="tag ' + t[0] + '">' + esc(t[1]) + '</span><div class="task-main"><div class="cell-title">' + esc(a.title) + '</div><div class="cell-sub">' + esc([when, countsText(e.counts)].filter(Boolean).join(' · ')) + '</div>' + (e.error ? '<div class="cell-sub neg">' + esc(e.error) + '</div>' : '') + '</div></a>';
}

// The whole stream (spec 058): one line per activity, whatever it is, by when it happens.
const STREAM_PERIODS = ['today', 'week', 'month', 'upcoming', 'past', 'any'];
const streamIcon = (a) => a.kind === 'Execution' ? 'i-plug' : a.kind === 'Reminder' ? 'i-bell' : a.todo ? 'i-check' : 'i-cal';
const streamState = (a) => a.kind === 'Execution' ? execTag(a.status) : a.group === 'review' ? ['late', W.tk_g_review] : a.group === 'failed' ? ['error', W.tk_g_failed] : a.status === 'done' || a.status === 'sent' ? ['ok', a.todo ? W.tk_stDone : W.tk_stPast] : a.status === 'cancelled' ? ['neutral', W.tk_stCancelled] : a.group === 'late' ? ['error', W.tk_g_late] : ['info', W.tk_stPlanned];
function streamRow(a) {
  const t = streamState(a);
  const about = a.about.length ? '<div class="cell-sub">' + esc(W.tk_about) + ' ' + a.about.map((x) => '<a href="#/entree/' + esc(x.id) + '">' + esc(x.title) + '</a>').join(', ') + '</div>' : '';
  return '<div class="task-row stream"><span class="kind-ic" title="' + esc(kindName(a.kind)) + '">' + ic(streamIcon(a)) + '</span><div class="task-main"><a class="cell-title" href="#/entree/' + esc(a.id) + '">' + esc(a.title) + '</a><div class="cell-sub">' + esc([kindName(a.kind), a.at ? taskDue(a.at) : W.tk_g_undated].join(' · ')) + '</div>' + about + '</div><span class="tag ' + t[0] + '">' + esc(t[1]) + '</span></div>';
}

const tasksPages = {
  async activites(params) {
    const tab = params.get('tab') === 'all' ? 'all' : params.get('tab') === 'done' ? 'done' : 'todo';
    const kind = params.get('kind') || '';
    const period = STREAM_PERIODS.includes(params.get('period')) ? params.get('period') : 'week';
    const link = (t, extra) => '#/activites?tab=' + t + (kind ? '&kind=' + encodeURIComponent(kind) : '') + (extra || '');
    const tabs = '<div class="tabs">' +
      '<a href="' + link('todo') + '"' + (tab === 'todo' ? ' aria-current="page"' : '') + '>' + esc(W.tk_open) + '</a>' +
      '<a href="' + link('all', '&period=' + period) + '"' + (tab === 'all' ? ' aria-current="page"' : '') + '>' + esc(W.tk_allTab) + '</a>' +
      '<a href="' + link('done') + '"' + (tab === 'done' ? ' aria-current="page"' : '') + '>' + esc(W.tk_doneTab) + '</a></div>';
    const kindSelect = (kinds) => '<select class="field" data-task-kind aria-label="' + esc(W.tk_kind) + '"><option value="">' + esc(W.tk_allKinds) + '</option>' + kinds.map((k) => '<option value="' + esc(k) + '"' + (k === kind ? ' selected' : '') + '>' + esc(kindName(k)) + '</option>').join('') + '</select>';
    const hint = '<div class="hint">' + ic('i-chat') + '<span>' + esc(W.tk_hint) + '</span></div>';
    const col = (html) => '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + html + '</div>';
    const add = '<form class="panel task-add" data-task-add><input class="field" name="title" required maxlength="300" placeholder="' + esc(W.tk_addPlaceholder) + '"><input class="field" type="date" name="due" aria-label="' + esc(W.tk_due) + '"><button class="btn solid">' + ic('i-plus') + esc(W.tk_add) + '</button></form>';

    if (tab === 'all') {
      const items = await api(inSpace('/activities?scope=all&state=all&period=' + period + (kind ? '&kind=' + encodeURIComponent(kind) : '')));
      const kinds = Array.from(new Set(items.map((a) => a.kind).concat(kind ? [kind] : []))).sort();
      const periodSelect = '<select class="field" data-stream-period aria-label="' + esc(W.tk_period) + '">' + STREAM_PERIODS.map((p) => '<option value="' + p + '"' + (p === period ? ' selected' : '') + '>' + esc(W['tk_p_' + p]) + '</option>').join('') + '</select>';
      const filters = '<div class="task-filters">' + tabs + '<div class="task-selects">' + periodSelect + kindSelect(kinds) + '</div></div>';
      const list = items.length ? items.map(streamRow).join('') : '<div class="pad muted">' + esc(W.tk_streamNone) + '</div>';
      return filters + col(v2panel(W.navActivities, list, '<span class="count">' + items.length + '</span>', 'i-history') + hint);
    }

    const state = tab === 'done' ? 'done' : 'open';
    const [items, runs] = await Promise.all([
      api(inSpace('/activities?state=' + state + (kind ? '&kind=' + encodeURIComponent(kind) : ''))),
      api(inSpace('/activities?state=all&kind=Execution&limit=20')).catch(() => []),
    ]);
    const todo = items.filter((a) => a.kind !== 'Execution' || a.group === 'failed');
    const n = (g) => todo.filter((a) => a.group === g).length;
    const kinds = Array.from(new Set(items.map((a) => a.kind).concat(kind ? [kind] : []))).sort();
    const kpis = state === 'open' ? '<div class="grid g4">' +
      v2kpi(W.tk_g_review, String(n('review')), esc(W.tk_reviewHow), n('review') ? 'alert' : '') +
      v2kpi(W.tk_g_late, String(n('late')), esc(W.tk_lateHow), n('late') ? 'alert' : '') +
      v2kpi(W.tk_g_today, String(n('today')), '') +
      v2kpi(W.tk_g_week, String(n('week')), '') + '</div>' : '';
    const filters = '<div class="task-filters">' + tabs + '<div class="task-selects">' + kindSelect(kinds) + '</div></div>';
    let body = '';
    if (state === 'done') {
      body = v2panel(W.tk_doneTab, todo.length ? todo.map(taskRow).join('') : '<div class="pad muted">' + esc(W.tk_noneDone) + '</div>', '', 'i-check');
    } else {
      const panels = TASK_GROUPS.filter((g) => n(g)).map((g) => v2panel(W['tk_g_' + g], todo.filter((a) => a.group === g).map((a) => g === 'failed' && a.kind === 'Execution' ? execRow(a) : taskRow(a)).join(''), '<span class="count">' + n(g) + '</span>', g === 'review' ? 'i-spark' : g === 'failed' || g === 'late' ? 'i-alert' : 'i-cal'));
      body = panels.length ? panels.join('') : v2panel(W.tk_open, '<div class="pad muted">' + esc(W.tk_nothing) + '</div>', '', 'i-check');
    }
    const work = runs.length ? v2panel(W.tk_work, runs.map(execRow).join(''), '<span class="muted" style="font-size:12px">' + esc(W.tk_workHow) + '</span>', 'i-plug') : '';
    // The list takes the room; what programs did sits beside it, only when there is some.
    return kpis + (state === 'open' ? add : '') + filters + (work ? '<div class="grid g21">' + col(body) + col(work + hint) + '</div>' : col(body + hint));
  },
};
// The address of before (« Tâches ») opens the same page.
tasksPages.taches = tasksPages.activites;

function bindTasks(root) {
  const form = root.querySelector('form[data-task-add]');
  if (form) form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) return;
    const due = String(data.get('due') || '');
    try {
      await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: 'Task', title: title, data: due ? { due: due, status: 'planned' } : { status: 'planned' } }] } });
      toast(W.tk_added, null); show();
    } catch (error) { alert(error.message); }
  });
  // A filter changed: the same tab, the other filters kept.
  const refilter = (name, value) => {
    const [, query] = location.hash.split('?');
    const params = new URLSearchParams(query || '');
    if (value) params.set(name, value); else params.delete(name);
    location.hash = '#/activites?' + params.toString();
  };
  const pickKind = root.querySelector('[data-task-kind]');
  if (pickKind) pickKind.addEventListener('change', () => refilter('kind', pickKind.value));
  const pickPeriod = root.querySelector('[data-stream-period]');
  if (pickPeriod) pickPeriod.addEventListener('change', () => refilter('period', pickPeriod.value));
  root.querySelectorAll('[data-task-set]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id: b.dataset.taskSet, data: { status: b.dataset.status } }] } });
      toast(b.dataset.status === 'done' ? W.tk_markedDone : b.dataset.status === 'planned' ? W.tk_accepted : W.tk_dismissed, null); show();
    } catch (error) { b.disabled = false; alert(error.message); }
  }));
  root.querySelectorAll('[data-task-later]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id: b.dataset.taskLater, data: { due: taskDayOf(Number(b.dataset.days)) } }] } });
      toast(W.tk_moved, null); show();
    } catch (error) { b.disabled = false; alert(error.message); }
  }));
}
`;
