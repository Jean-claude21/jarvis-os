// Spec 057 — « Tâches »: everything she has to do, in one place, what needs her first — what waits
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

const tasksPages = {
  async taches(params) {
    const kind = params.get('kind') || '';
    const state = params.get('state') === 'done' ? 'done' : 'open';
    const q = (extra) => inSpace('/activities?' + extra + (kind ? '&kind=' + encodeURIComponent(kind) : ''));
    const [items, runs] = await Promise.all([
      api(q('state=' + state)),
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
    const add = '<form class="panel task-add" data-task-add><input class="field" name="title" required maxlength="300" placeholder="' + esc(W.tk_addPlaceholder) + '"><input class="field" type="date" name="due" aria-label="' + esc(W.tk_due) + '"><button class="btn solid">' + ic('i-plus') + esc(W.tk_add) + '</button></form>';
    const filters = '<div class="task-filters"><div class="tabs">' +
      '<a href="#/taches' + (kind ? '?kind=' + encodeURIComponent(kind) : '') + '"' + (state === 'open' ? ' aria-current="page"' : '') + '>' + esc(W.tk_open) + '</a>' +
      '<a href="#/taches?state=done' + (kind ? '&kind=' + encodeURIComponent(kind) : '') + '"' + (state === 'done' ? ' aria-current="page"' : '') + '>' + esc(W.tk_doneTab) + '</a></div>' +
      '<select class="field" data-task-kind aria-label="' + esc(W.tk_kind) + '"><option value="">' + esc(W.tk_allKinds) + '</option>' + kinds.map((k) => '<option value="' + esc(k) + '"' + (k === kind ? ' selected' : '') + '>' + esc(kindName(k)) + '</option>').join('') + '</select></div>';
    let body = '';
    if (state === 'done') {
      body = v2panel(W.tk_doneTab, todo.length ? todo.map(taskRow).join('') : '<div class="pad muted">' + esc(W.tk_noneDone) + '</div>', '', 'i-check');
    } else {
      const panels = TASK_GROUPS.filter((g) => n(g)).map((g) => v2panel(W['tk_g_' + g], todo.filter((a) => a.group === g).map((a) => g === 'failed' && a.kind === 'Execution' ? execRow(a) : taskRow(a)).join(''), '<span class="count">' + n(g) + '</span>', g === 'review' ? 'i-spark' : g === 'failed' || g === 'late' ? 'i-alert' : 'i-cal'));
      body = panels.length ? panels.join('') : v2panel(W.navTasks, '<div class="pad muted">' + esc(W.tk_nothing) + '</div>', '', 'i-check');
    }
    const work = runs.length ? v2panel(W.tk_work, runs.map(execRow).join(''), '<span class="muted" style="font-size:12px">' + esc(W.tk_workHow) + '</span>', 'i-plug') : '';
    const hint = '<div class="hint">' + ic('i-chat') + '<span>' + esc(W.tk_hint) + '</span></div>';
    const col = (html) => '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + html + '</div>';
    // The list takes the room; what programs did sits beside it, only when there is some.
    return kpis + add + filters + (work ? '<div class="grid g21">' + col(body) + col(work + hint) + '</div>' : col(body + hint));
  },
};

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
  const pickKind = root.querySelector('[data-task-kind]');
  if (pickKind) pickKind.addEventListener('change', () => {
    const done = /state=done/.test(location.hash);
    const parts = [done ? 'state=done' : '', pickKind.value ? 'kind=' + encodeURIComponent(pickKind.value) : ''].filter(Boolean);
    location.hash = '#/taches' + (parts.length ? '?' + parts.join('&') : '');
  });
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
