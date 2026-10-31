// The Entries page (spec 017): statistics of a list, her preferences, search and selection.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const entries = `
// The statistics of a list (spec 017): how many, the streak, the active days, twelve weeks day by
// day, the hours, the splits and the figures. Shared by the Entries page and a collection.
const SERIES = ['var(--primary)', 'var(--info)', 'var(--ochre)', 'var(--success)', 'var(--bark)', 'var(--error)'];
function statsHtml(s) {
  const optionLabel = (o) => (o.label ? tr(o.label) : o.option);
  const max = Math.max(1, ...s.weeks.points.map((p) => p.n));
  const top = Math.max(1, ...s.days.map((d) => d.n));
  const today = s.days.length ? s.days[s.days.length - 1].day : '';
  const level = (n) => (n === 0 ? '' : n >= top * 0.75 ? 'l3' : n >= top * 0.4 ? 'l2' : 'l1');
  const hmax = s.hours ? Math.max(1, ...s.hours) : 1;
  return '<section class="stats">' +
    '<div class="kpi-card"><div class="caps">' + esc(W.total) + '</div><div class="kpi">' + num(s.total) + '</div><div class="muted">' + esc(say(W.thisMonthN, { n: s.thisMonth })) + '</div></div>' +
    (s.streak.best > 1 ? '<div class="kpi-card"><div class="caps">' + esc(W.streak) + '</div><div class="kpi">' + esc(say(W.streakN, { n: s.streak.current })) + '</div><div class="muted">' + esc(say(W.streakBest, { n: s.streak.best })) + '</div></div>' +
      '<div class="kpi-card"><div class="caps">' + esc(W.active30) + '</div><div class="kpi">' + esc(say(W.active30N, { n: s.active30 })) + '</div></div>' +
      '<div class="kpi-card"><div class="caps">' + esc(W.daysGrid) + '</div><div class="heat">' + s.days.map((d) => '<i class="' + level(d.n) + (d.day === today ? ' today' : '') + '" title="' + esc(day(d.day + 'T12:00:00') + ' : ' + d.n) + '"></i>').join('') + '</div></div>' : '') +
    (s.hours ? '<div class="kpi-card"><div class="caps">' + esc(W.hoursTitle) + '</div><div class="spark">' + s.hours.map((n, h) => '<span title="' + esc(String(h).padStart(2, '0') + ' h : ' + n) + '" style="height:' + Math.max(3, Math.round(n / hmax * 100)) + '%"></span>').join('') + '</div></div>' : '') +
    s.splits.filter((sp) => sp.counts.some((c) => c.n)).map((sp) => {
      return '<div class="kpi-card"><div class="caps">' + esc(say(W.byField, { field: tr(sp.label) || sp.field })) + '</div><div class="stack">' +
        sp.counts.filter((c) => c.n).map((c, i) => '<span title="' + esc(optionLabel(c) + ' : ' + c.n) + '" style="flex:' + c.n + ';background:' + SERIES[i % SERIES.length] + '"></span>').join('') + '</div><div class="legend">' +
        sp.counts.filter((c) => c.n).map((c, i) => '<span><i style="background:' + SERIES[i % SERIES.length] + '"></i>' + esc(optionLabel(c)) + ' ' + c.n + '</span>').join('') + '</div></div>';
    }).join('') +
    '<div class="kpi-card"><div class="caps">' + esc(say(W.perWeek, { field: tr(s.weeks.label) || (s.weeks.field === 'day' ? W.dayWord : s.weeks.field) })) + '</div><div class="spark">' +
      s.weeks.points.map((p) => '<span title="' + esc(p.week + ' : ' + p.n) + '" style="height:' + Math.max(3, Math.round(p.n / max * 100)) + '%"></span>').join('') + '</div></div>' +
    (s.habits || []).map((h) => '<div class="kpi-card habit"><div class="caps">' + esc(h.title) + '</div><div class="kpi">' + (h.rate30 === null ? '—' : esc(num(h.rate30)) + '<small> %</small>') + '</div>' +
      '<div class="bar"><i style="width:' + (h.rate30 || 0) + '%"></i></div><div class="muted">' + esc(say(W.habitDone, { done: h.done30, planned: h.planned30 })) + '</div>' +
      (h.rate !== null ? '<div class="muted">' + esc(say(W.habitSince, { rate: num(h.rate), done: h.done, planned: h.planned })) + '</div>' : '') +
      (h.missed.length ? '<div class="muted" style="font-size:12px">' + esc(say(W.habitMissed, { days: h.missed.slice(0, 5).map((d) => day(d + 'T12:00:00')).join(', ') + (h.missed.length > 5 ? '…' : '') })) + '</div>' : '') +
      '<div class="muted" style="font-size:12px">' + esc(say(W.habitFrom, { text: h.plan.text })) + '</div></div>').join('') +
    s.figures.map((f) => '<div class="kpi-card"><div class="caps">' + esc(say(f.kind === 'sum' ? W.sumOf : W.avgOf, { field: tr(f.label) || f.field })) + '</div><div class="kpi">' + num(f.value) + (f.unit ? '<small> ' + esc(f.unit) + '</small>' : '') + '</div></div>').join('') +
    '</section>';
}
// An entry's own day: « 31 août 2026 », or « août 2026 » when only the month is known.
const ownDay = (d) => d.length === 7 ? new Date(d + '-15T12:00:00').toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : day(d + 'T12:00:00');

// The Entries page (spec 017): her kinds found as she types, the list's form, its selection.
function bindEntries(root) {
  const params = () => new URLSearchParams((location.hash.split('?')[1]) || '');
  const go = (over) => { const p = params(); for (const [k, v] of Object.entries(over)) { if (v === null || v === '') p.delete(k); else p.set(k, v); } location.hash = '#/vie' + (p.toString() ? '?' + p.toString() : ''); };
  root.querySelectorAll('[data-kmode]').forEach((b) => b.addEventListener('click', () => { keepPrefs({ kinds: b.dataset.kmode }); show(); }));
  root.querySelectorAll('[data-mode]').forEach((a) => a.addEventListener('click', () => keepPrefs({ modes: { [a.dataset.modekey]: a.dataset.mode } })));
  // Drag and drop: a kind onto one of her groups; entries (the one dragged, or all those selected) onto a folder.
  const dropOn = (els, take) => els.forEach((el) => {
    el.addEventListener('dragover', (event) => { if (dragging) { event.preventDefault(); el.classList.add('drop-on'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drop-on'));
    el.addEventListener('drop', async (event) => { event.preventDefault(); el.classList.remove('drop-on'); const what = dragging; dragging = null; if (what) await take(what, el); });
  });
  let dragging = null;
  root.querySelectorAll('[data-dragkind]').forEach((a) => a.addEventListener('dragstart', () => { dragging = { kind: a.dataset.dragkind }; }));
  root.querySelectorAll('[data-drag]').forEach((r) => r.addEventListener('dragstart', () => {
    const chosen = [...root.querySelectorAll('[data-row]:checked')].map((c) => c.dataset.row);
    dragging = { ids: chosen.includes(r.dataset.drag) ? chosen : [r.dataset.drag] };
  }));
  dropOn(root.querySelectorAll('[data-dropgroup]'), async (what, el) => {
    if (!what.kind) return;
    try { await api(inSpace('/kinds/group'), { method: 'POST', body: { kind: what.kind, group: el.dataset.dropgroup || null } }); toast(say(W.groupedToast, { kind: what.kind, group: el.dataset.dropgroup || W.noGroup }), null); show(); } catch (error) { fail(error); }
  });
  dropOn(root.querySelectorAll('[data-dropfolder]'), async (what, el) => {
    if (!what.ids) return;
    try { await api(inSpace('/entries/bulk'), { method: 'POST', body: { ids: what.ids, folder: el.dataset.dropfolder || null } }); toast(say(W.filedToast, { n: what.ids.length }), { id: what.ids[0], spaceId: space }); show(); } catch (error) { fail(error); }
  });
  const kq = root.querySelector('[data-kq]');
  if (kq) kq.addEventListener('input', () => {
    const t = kq.value.trim().toLowerCase();
    root.querySelectorAll('[data-kname]').forEach((a) => { a.style.display = !t || a.dataset.kname.includes(t) ? '' : 'none'; });
    root.querySelectorAll('.ent-kinds details').forEach((d) => { const any = [...d.querySelectorAll('[data-kname]')].some((a) => a.style.display !== 'none'); d.style.display = any ? '' : 'none'; if (t) d.open = true; });
  });
  const form = root.querySelector('[data-entform]');
  if (form) {
    form.addEventListener('submit', (event) => { event.preventDefault(); const f = new FormData(form); go({ q: f.get('q'), from: f.get('from'), to: f.get('to'), sort: f.get('sort') === 'day' ? null : f.get('sort') }); });
    form.querySelector('[data-desc]').addEventListener('click', (event) => go({ desc: event.target.dataset.desc === 'true' ? null : 'false' }));
  }
  root.querySelectorAll('[data-krename]').forEach((b) => b.addEventListener('click', async () => {
    const to = prompt(say(W.renameKindAsk, { kind: b.dataset.krename }), b.dataset.krename); if (!to || !to.trim() || to.trim() === b.dataset.krename) return;
    try { const r = await api(inSpace('/kinds/rename'), { method: 'POST', body: { from: b.dataset.krename, to: to.trim() } }); toast(say(W.renamedToast, { kind: r.kind }), { id: r.kind, spaceId: space }); go({ kind: r.kind }); } catch (error) { fail(error); }
  }));
  root.querySelectorAll('[data-kgroup]').forEach((b) => b.addEventListener('click', async () => {
    const g = prompt(say(W.groupKindAsk, { kind: b.dataset.kgroup }), b.dataset.current); if (g === null) return;
    try { await api(inSpace('/kinds/group'), { method: 'POST', body: { kind: b.dataset.kgroup, group: g.trim() || null } }); toast(say(W.groupedToast, { kind: b.dataset.kgroup, group: g.trim() || W.noGroup }), null); show(); } catch (error) { fail(error); }
  }));
  const bar = root.querySelector('#entsel');
  if (!bar) return;
  const picked = () => [...root.querySelectorAll('[data-row]:checked')].map((c) => c.dataset.row);
  const refresh = () => { const n = picked().length; bar.classList.toggle('on', n > 0); root.querySelector('#entsel-n').textContent = say(W.selectedN, { n }); };
  root.querySelectorAll('[data-row]').forEach((c) => c.addEventListener('change', refresh));
  const all = root.querySelector('[data-all]');
  if (all) all.addEventListener('change', () => { root.querySelectorAll('[data-row]').forEach((c) => { c.checked = all.checked; }); refresh(); });
  root.querySelectorAll('[data-bulk]').forEach((b) => b.addEventListener('click', async () => {
    const ids = picked(); const what = b.dataset.bulk;
    if (what === 'none') { root.querySelectorAll('[data-row], [data-all]').forEach((c) => { c.checked = false; }); refresh(); return; }
    if (what === 'link') {
      openDrawer(W.linkTo, '<input type="search" class="field" id="lk_q" placeholder="' + esc(W.linkSearch) + '" style="width:100%"><div class="linkpick" id="lk_list"></div>');
      const q = document.getElementById('lk_q'); let timer;
      const find = async () => {
        const found = q.value.trim() ? await api(inSpace('/list?limit=15&sort=title&desc=false&text=' + encodeURIComponent(q.value.trim()))) : { rows: [] };
        document.getElementById('lk_list').innerHTML = found.rows.filter((e) => !ids.includes(e.id)).map((e) => '<button class="quiet" data-linkto="' + esc(e.id) + '" data-linktitle="' + esc(e.title) + '">' + esc(e.title) + ' <span class="muted">' + esc(kindName(e.kind)) + '</span></button>').join('') || empty();
        document.querySelectorAll('[data-linkto]').forEach((x) => x.addEventListener('click', async () => {
          try { await api(inSpace('/entries/bulk'), { method: 'POST', body: { ids, link: { to: x.dataset.linkto, role: 'for' } } }); closeDrawer(); toast(say(W.linkedToast, { n: ids.length, title: x.dataset.linktitle }), { id: ids[0], spaceId: space }); show(); } catch (error) { fail(error); }
        }));
      };
      q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(find, 250); }); q.focus();
      return;
    }
    let body; let said;
    if (what === 'folder') { const f = prompt(W.folderAsk, params().get('folder') || ''); if (f === null) return; body = { ids, folder: f.trim() || null }; said = W.filedToast; }
    else if (what === 'kind') { const k = prompt(W.kindAsk, params().get('kind') || ''); if (!k || !k.trim()) return; body = { ids, kind: k.trim() }; said = W.retypedToast; }
    else { if (!confirm(say(W.asideAsk, { n: ids.length }))) return; body = { ids, archive: true }; said = W.asideToast; }
    try { await api(inSpace('/entries/bulk'), { method: 'POST', body }); toast(say(said, { n: ids.length }), { id: ids[0], spaceId: space }); show(); } catch (error) { fail(error); }
  }));
}
`;
