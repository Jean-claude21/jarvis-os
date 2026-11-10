// I2 — her full agenda, drawn in J-C's mockup: Day (each occurrence with its state, the reminders
// attached), Week (events, blocks, deadlines, proposals, by space), Month (deadlines and events,
// day by day), Reminders (what will ring, where it comes from). Created by a click on a free time.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no dollar-brace, and every backslash written twice.

export const v2Agenda = `
// The spaces she shows in her agenda (all by default), kept on this device.
let agendaHidden = new Set();
try { agendaHidden = new Set(JSON.parse(localStorage.getItem('jarvis.agendaHidden') || '[]')); } catch {}
const SPACE_COLORS = ['var(--primary)', 'var(--ochre)', 'var(--info)', 'var(--success)', 'var(--verify)'];
const spaceColor = (id) => SPACE_COLORS[Math.max(0, me.spaces.findIndex((s) => s.id === id)) % SPACE_COLORS.length];
const localDay = (d) => d.toLocaleDateString('en-CA');
const hourOf = (iso) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
const hhmm = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const kindClass = (o) => o.proposed ? 'proposed' : o.type === 'deadline' ? 'due' : o.repeated ? 'routine' : 'event';
const OCC = [['done', 'v2occDone'], ['missed', 'v2occMissed'], ['postponed', 'v2occMoved']];
const occClass = { done: 'done', missed: 'miss', postponed: 'moved' };

Object.assign(v2Pages, {
  async agenda (params) {
    const view = ['jour', 'mois', 'rappels'].includes(params.get('v')) ? params.get('v') : 'semaine';
    const anchor = params.get('d') ? new Date(params.get('d') + 'T12:00:00') : new Date();
    const go = (v, d) => '#/agenda?v=' + v + '&d=' + localDay(d);
    let from;
    let to;
    if (view === 'jour') { from = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()); to = new Date(from.getTime() + 86400000); }
    else if (view === 'mois') { const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1); from = mondayOf(first); to = new Date(from.getTime() + 42 * 86400000); }
    else { from = mondayOf(anchor); to = new Date(from.getTime() + 7 * 86400000); }
    const data = view === 'rappels' ? null : await api('/agenda?from=' + encodeURIComponent(from.toISOString()) + '&to=' + encodeURIComponent(to.toISOString()));
    const all = data ? data.occurrences.filter((o) => !agendaHidden.has(o.spaceId)) : [];
    const step = (n) => view === 'jour' ? new Date(anchor.getTime() + n * 86400000) : view === 'mois' ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 15) : new Date(anchor.getTime() + n * 7 * 86400000);
    const segmented = '<div class="segmented">' + [['jour', W.v2day], ['semaine', W.v2weekV], ['mois', W.v2monthV], ['rappels', W.navReminders]].map((x) => '<button data-go="' + go(x[0], anchor) + '" aria-pressed="' + (view === x[0]) + '">' + esc(x[1]) + '</button>').join('') + '</div>';
    const nav = view === 'rappels' ? '' : '<div class="segmented"><button data-go="' + go(view, step(-1)) + '" aria-label="' + esc(W.prevWeek) + '">‹</button><button data-go="' + go(view, new Date()) + '">' + esc(W.today) + '</button><button data-go="' + go(view, step(1)) + '" aria-label="' + esc(W.nextWeek) + '">›</button></div>';
    const sub = view === 'jour' ? say(W.v2daySub, { day: anchor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) })
      : view === 'mois' ? say(W.v2monthSub, { month: anchor.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) })
      : view === 'rappels' ? W.v2remindersSub
      : say(W.v2weekSub, { from: from.toLocaleDateString(locale, { day: 'numeric', month: 'long' }), to: new Date(to.getTime() - 86400000).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) });
    const head = v2head(esc(W.navAgenda), esc(sub), segmented + nav + '<button class="btn" data-ical>' + ic('i-link') + esc(W.v2ical) + '</button>');
    const chips = me.spaces.length > 1 ? '<span class="muted" style="margin-left:auto">' + esc(W.navSpacesTitle) + ' :</span>' + me.spaces.map((s) => '<button class="chip" data-sp="' + esc(s.id) + '" aria-pressed="' + !agendaHidden.has(s.id) + '" style="' + (agendaHidden.has(s.id) ? 'opacity:.45;text-decoration:line-through' : '') + '"><span class="space-dot" style="background:' + spaceColor(s.id) + '"></span>' + esc(s.name) + '</button>').join('') : '';

    if (view === 'rappels') {
      const list = await api(inSpace('/entries?limit=200&kind=Reminder'));
      const rows = list.filter((r) => !['cancelled'].includes(r.data.status)).sort((a, b) => String(a.data.next || a.data.at || '').localeCompare(String(b.data.next || b.data.at || '')));
      const chain = (r) => { const st = r.data.status || 'planned'; return ['planned', 'sent', 'done'].map((s) => '<span class="tag ' + (s === st ? (s === 'done' ? 'ok' : 'info') : 'plain') + '">' + esc(W['st_' + s] || s) + '</span>').join(' ') + (['failed', 'to_fix'].includes(st) ? ' <span class="tag error">' + esc(W['st_' + st] || st) + '</span>' : ''); };
      return head + (chips ? '<div class="legend">' + chips + '</div>' : '') + v2panel(W.v2whatRings, rows.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2reminder) + '</th><th>' + esc(W.v2comesFrom) + '</th><th>' + esc(W.when) + '</th><th>' + esc(W.v2whereItIs) + '</th></tr></thead><tbody>' +
        rows.map((r) => '<tr><td><div class="cell-title"><a href="#/entree/' + esc(r.id) + '" style="color:inherit">' + esc(r.title) + '</a></div>' + (r.data.message ? '<div class="cell-sub">' + esc(r.data.message) + '</div>' : '') + '</td><td><div class="cell-sub">' + esc(r.data.before ? say(W.v2attached, { before: r.data.before }) : r.data.repeat ? W.v2repeats : W.v2alone) + '</div></td><td class="mono" style="font-size:12.5px">' + esc(r.data.next || r.data.at ? time(r.data.next || r.data.at) : '—') + '</td><td>' + chain(r) + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.v2noReminder) + '</div>', '<span class="muted" style="font-size:12px">' + rows.length + '</span>', 'i-bell') +
        '<div class="hint">' + ic('i-bell') + '<span>' + W.v2remindersHint + '</span></div>';
    }

    if (view === 'jour') {
      const today = localDay(new Date()) === localDay(anchor);
      const items = all.slice().sort((a, b) => a.start.localeCompare(b.start));
      const nowAt = new Date();
      const slots = [];
      let nowPlaced = !today;
      for (const o of items) {
        if (!nowPlaced && !o.allDay && new Date(o.start) > nowAt) { slots.push('<div class="slot now"><time style="color:var(--error)">' + esc(hhmm(nowAt.toISOString())) + '</time><span class="muted" style="font-size:12px">' + esc(W.v2now) + '</span><span></span></div>'); nowPlaced = true; }
        const st = o.repeated && o.status && occClass[o.status] ? o.status : null;
        const meta = [kindName(o.kind), o.space, o.repeated ? W.v2repeats : '', o.moved ? W.v2movedHere : '', o.end ? W.v2until + ' ' + hhmm(o.end) : ''].filter(Boolean).join(' · ');
        const occ = o.repeated && o.day ? '<div class="x-occ" role="group">' + OCC.map((x) => '<button class="' + occClass[x[0]] + '" data-occ="' + esc(o.id) + ':' + esc(o.day) + ':' + x[0] + ':' + esc(o.spaceId) + '" aria-pressed="' + (st === x[0]) + '">' + esc(W[x[1]]) + '</button>').join('') + '</div>' : '<a class="btn small" href="#/entree/' + esc(o.id) + '">' + esc(W.v2open) + '</a>';
        slots.push('<div class="slot' + (o.repeated ? ' tpl' : '') + '"><time>' + esc(o.allDay ? W.allDay : hhmm(o.start)) + '</time><div><b>' + esc(o.title) + '</b><div class="meta"><span class="cell-sub">' + esc(meta) + '</span></div></div>' + occ + '</div>');
      }
      if (!nowPlaced) slots.push('<div class="slot now"><time style="color:var(--error)">' + esc(hhmm(nowAt.toISOString())) + '</time><span class="muted" style="font-size:12px">' + esc(W.v2now) + '</span><span></span></div>');
      return head + (chips ? '<div class="legend">' + chips + '</div>' : '') + v2panel(anchor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }), items.length ? '<div class="x-day">' + slots.join('') + '</div>' : '<div class="pad muted">' + esc(W.noEvents) + '</div>', '<span class="muted" style="font-size:12px">' + esc(W.v2eachOcc) + '</span>', 'i-cal') +
        '<div class="hint">' + ic('i-plus') + '<span>' + esc(W.v2clickToAdd) + '</span></div>';
    }

    if (view === 'mois') {
      const month = anchor.getMonth();
      const todayKey = localDay(new Date());
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
        const k = localDay(d);
        const evs = all.filter((o) => localDay(new Date(o.start)) === k);
        const shown = evs.filter((o) => !o.repeated || o.type === 'deadline').slice(0, 3);
        const done = evs.filter((o) => o.repeated && o.status === 'done').length;
        const planned = evs.filter((o) => o.repeated).length;
        cells.push('<div class="md' + (d.getMonth() === month ? '' : ' out') + (k === todayKey ? ' today' : '') + '" data-go="' + go('jour', d) + '" style="cursor:pointer"><span class="d">' + d.getDate() + '</span>' +
          shown.map((o) => '<span class="ev" style="--c:' + (o.type === 'deadline' ? 'var(--error)' : spaceColor(o.spaceId)) + '">' + esc(o.title) + '</span>').join('') +
          (planned ? '<span class="dots" title="' + esc(say(W.v2keptOf, { n: done, of: planned })) + '">' + Array.from({ length: Math.min(planned, 6) }, (_, j) => '<i style="background:' + (j < done ? 'var(--success)' : 'var(--rule)') + '"></i>').join('') + '</span>' : '') + '</div>');
      }
      const names = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 9 + i).toLocaleDateString(locale, { weekday: 'short' }));
      return head + (chips ? '<div class="legend">' + chips + '</div>' : '') + v2panel(anchor.toLocaleDateString(locale, { month: 'long', year: 'numeric' }), '<div class="x-month">' + names.map((d) => '<div class="mh">' + esc(d) + '</div>').join('') + cells.join('') + '</div>', '<span class="muted" style="font-size:12px">' + esc(W.v2greenDots) + '</span>', 'i-cal');
    }

    // The week: 4:00 to 23:00, wider when something falls outside.
    const days = Array.from({ length: 7 }, (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i));
    const timed = all.filter((o) => !o.allDay);
    const lo = Math.max(0, Math.min(4, ...timed.map((o) => Math.floor(hourOf(o.start)))));
    const hi = Math.min(24, Math.max(23, ...timed.map((o) => Math.ceil(o.end ? (hourOf(o.end) || 24) : hourOf(o.start) + 1))));
    const hh = 40;
    const H = (hi - lo) * hh;
    const todayKey = localDay(new Date());
    const onDay = (d) => all.filter((o) => localDay(new Date(o.start)) === localDay(d));
    const cols = days.map((d) => {
      const k = localDay(d);
      const evs = onDay(d).map((o) => {
        if (o.allDay || o.type === 'deadline') return '<a class="ev due" href="#/entree/' + esc(o.id) + '" style="top:2px;height:22px"><b>⚑ ' + esc(o.title) + '</b></a>';
        const a = hourOf(o.start);
        const b = o.end ? (localDay(new Date(o.end)) === k ? hourOf(o.end) || 24 : hi) : a + 0.5;
        return '<a class="ev ' + kindClass(o) + '" href="#/entree/' + esc(o.id) + '" title="' + esc(kindName(o.kind) + ' · ' + o.space) + '" style="top:' + ((a - lo) * hh + 1) + 'px;height:' + Math.max((Math.min(b, hi) - a) * hh - 2, 18) + 'px;box-shadow:inset 3px 0 0 ' + spaceColor(o.spaceId) + '"><b>' + esc(o.title) + '</b><small>' + esc(hhmm(o.start) + (o.end ? '–' + hhmm(o.end) : '')) + '</small></a>';
      }).join('');
      const n = hourOf(new Date().toISOString());
      const now = k === todayKey && n >= lo && n <= hi ? '<div class="nowline" style="top:' + (n - lo) * hh + 'px"></div>' : '';
      return '<div class="col' + (k === todayKey ? ' today' : '') + '" data-day="' + k + '" data-lo="' + lo + '" style="height:' + H + 'px">' + evs + now + '</div>';
    }).join('');
    const legend = '<div class="legend"><span><i style="background:var(--paper);border:1px solid var(--ink)"></i>' + esc(W.legendEvent) + '</span><span><i style="background:var(--clay)"></i>' + esc(W.legendRepeated) + '</span><span><i style="border:1px solid var(--primary)"></i>' + esc(W.legendDeadline) + '</span><span><i style="background:var(--info-surface);border:1px dashed var(--info)"></i>' + esc(W.legendProposed) + '</span>' + chips + '</div>';
    return head + legend + v2panel(say(W.v2weekOf, { day: from.toLocaleDateString(locale, { day: 'numeric', month: 'long' }) }),
      '<div class="scroll"><div class="week"><div></div>' + days.map((d) => '<div class="wh' + (localDay(d) === todayKey ? ' today' : '') + '">' + esc(d.toLocaleDateString(locale, { weekday: 'short' }).toUpperCase()) + '<b>' + d.getDate() + '</b></div>').join('') +
      '<div class="gutter" style="height:' + H + 'px">' + Array.from({ length: hi - lo }, (_, i) => i % 2 === 0 ? '<span style="top:' + i * hh + 'px">' + String(lo + i).padStart(2, '0') + '</span>' : '').join('') + '</div>' + cols + '</div></div>',
      '<span class="muted" style="font-size:12px">' + String(lo).padStart(2, '0') + ':00 – ' + String(hi).padStart(2, '0') + ':00</span>', 'i-cal') +
      '<div class="hint">' + ic('i-plus') + '<span>' + esc(W.v2clickToAdd) + '</span></div>';
  },
});

// What the agenda does: a space shown or hidden, one occurrence's state, a time clicked, iCal.
function bindAgenda(root) {
  root.querySelectorAll('[data-sp]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.sp;
    if (agendaHidden.has(id)) agendaHidden.delete(id); else agendaHidden.add(id);
    try { localStorage.setItem('jarvis.agendaHidden', JSON.stringify([...agendaHidden])); } catch {}
    show();
  }));
  root.querySelectorAll('[data-occ]').forEach((b) => b.addEventListener('click', async () => {
    const [id, day, st, where] = b.dataset.occ.split(':');
    const again = b.getAttribute('aria-pressed') === 'true';
    b.disabled = true;
    try {
      await api('/entries/' + encodeURIComponent(id) + '/occurrences/' + day + '?space=' + encodeURIComponent(where), { method: 'POST', body: { status: again ? null : st } });
      toast(again ? W.v2occBack : W.v2occKept, null); show();
    } catch (error) { b.disabled = false; alert(error.message); }
  }));
  // A click on a free time of the week: something new at that hour, an hour long.
  root.querySelectorAll('.week .col[data-day]').forEach((col) => col.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    const box = col.getBoundingClientRect();
    const hour = Number(col.dataset.lo) + Math.floor((event.clientY - box.top) / 40);
    const start = col.dataset.day + 'T' + String(Math.min(hour, 23)).padStart(2, '0') + ':00';
    newEvent(start);
  }));
  const ical = root.querySelector('[data-ical]');
  if (ical) ical.addEventListener('click', async () => {
    if (!confirm(W.subscribeAsk)) return;
    try {
      const made = await api('/agenda/address', { method: 'POST', body: {} });
      openDrawer(W.v2ical, '<p class="muted">' + esc(W.subscribeLead) + '</p><p><code class="url">' + esc(made.url) + '</code></p>', '<a class="badge primary" href="' + esc(made.webcal) + '">' + esc(W.openPhone) + '</a>');
    } catch (error) { alert(error.message); }
  });
}

// Something new in her agenda, from a time: its title, its hour, how long; saved as an event.
function newEvent(start) {
  openDrawer(W.v2newEvent, '<div style="display:grid;gap:14px">' + [[W.title, '<input class="field" id="ne-title" autocomplete="off">'], [W.when, '<input class="field" id="ne-start" type="datetime-local" value="' + esc(start) + '">'], [W.v2duration, '<input class="field" id="ne-dur" type="number" min="5" step="5" value="60">']].map((f) => '<label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(f[0]) + f[1] + '</label>').join('') + '</div>', '<button class="primary" id="ne-save">' + esc(W.v2keep) + '</button>');
  document.getElementById('ne-title').focus();
  document.getElementById('ne-save').addEventListener('click', async () => {
    const title = document.getElementById('ne-title').value.trim();
    if (!title) return;
    try {
      const saved = await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: 'Event', title, data: { start: document.getElementById('ne-start').value, duration: Number(document.getElementById('ne-dur').value) || 60 } }] } });
      closeDrawer(); toast(W.added1.replace('{kind}', title), { id: saved.entries[0].id, spaceId: space }); show();
    } catch (error) { alert(error.message); }
  });
}
`;
