// The pages of her day: « Maintenant », her apps, home, agenda, reminders.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const dayPages = `
const dayPages = {
  // « Maintenant » (spec 013): what needs her, the chosen thing, her day, what she can do.
  async '' () {
    const now = await api('/now');
    const groups = ['fix', 'late', 'proposed', 'today', 'week'];
    const items = now.items;
    const sel = items.find((i) => i.id === pick) || items[0];
    const when = (i) => i.when ? (i.allDay ? day(i.when) : time(i.when)) : '';
    const list = items.length ? groups.map((g) => {
      const rows = items.filter((i) => i.group === g);
      return rows.length ? '<div class="gt">' + esc(W['g_' + g]) + ' · ' + rows.length + '</div>' + rows.map((i) =>
        '<button class="row' + (sel && i.id === sel.id ? ' on' : '') + '" data-pick="' + esc(i.id) + '"><span><div class="t">' + esc(i.title) + '</div><div class="s">' + esc(kindName(i.kind) + ' · ' + i.space + (i.when ? ' · ' + when(i) : '')) + '</div></span><span class="tag ' + esc(g) + '">' + esc(W['r_' + i.reason] || i.reason) + '</span></button>').join('') : '';
    }).join('') : '<p class="empty">' + esc(W.allClear) + '</p>';
    let detail = '<div class="pane"><div class="pb pad"><p class="empty">' + esc(W.allClear) + '</p></div></div>';
    if (sel) {
      const e = await api('/entries/' + encodeURIComponent(sel.id) + '?space=' + encodeURIComponent(sel.spaceId));
      const fields = Object.keys(e.data).filter((f) => !['text', 'source'].includes(f)).slice(0, 8);
      const value = (v) => v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v);
      const links = e.links.out.concat(e.links.in);
      const acts = [];
      if (sel.group === 'proposed') acts.push(['accept', W.a_accept, W.a_acceptWhy, true], ['refuse', W.a_refuse, W.a_refuseWhy]);
      else if (sel.group === 'fix') acts.push(['retry', W.a_retry, W.a_retryWhy, true], ['done', W.a_done, W.a_doneWhy]);
      else {
        acts.push(['done', W.a_done, W.a_doneWhy, sel.group === 'late']);
        if (e.data.at || e.data.due || e.data.start) acts.push(['later', W.a_later, W.a_laterWhy, sel.group !== 'late']);
        acts.push(['cancel', W.a_cancel, W.a_cancelWhy]);
      }
      detail = '<button class="quiet back" data-back>← ' + esc(W.back) + '</button>' +
        '<section class="pane"><div class="ph"><span>' + esc(kindName(sel.kind) + ' · ' + W['g_' + sel.group]) + '</span><span class="tag ' + esc(sel.group) + '">' + esc(W['r_' + sel.reason] || sel.reason) + '</span></div><div class="pb pad subject">' +
        '<div class="caps">' + esc(sel.space) + '</div><h2>' + esc(e.title) + '</h2>' + (sel.when ? '<p class="muted" style="margin:0 0 10px">' + esc(when(sel)) + '</p>' : '') +
        (typeof e.data.text === 'string' ? '<p style="margin:0 0 10px">' + esc(e.data.text.slice(0, 400)) + (e.data.text.length > 400 ? '…' : '') + '</p>' : '') +
        fields.map((f) => '<div class="field-row"><span class="caps">' + esc(f) + '</span><span>' + esc(value(e.data[f])) + '</span>' + originBadge(e.origin[f] || 'said') + '</div>').join('') +
        (links.length ? '<div class="chips" style="margin-top:12px">' + links.map((l) => '<a class="chip" href="#/entree/' + esc(l.entry.id) + '">' + esc(l.entry.title) + '<small>' + esc(l.role) + '</small></a>').join('') + '</div>' : '') +
        '<div class="actions" style="margin-top:12px"><a class="link" href="#/entree/' + esc(e.id) + '">' + esc(W.fullEntry) + ' →</a></div></div></section>' +
        dayBand(now.day, sel.id) +
        '<div class="choices">' + acts.map((a) => '<div class="choice' + (a[3] ? ' main' : '') + '"><b>' + esc(a[1]) + '</b><p>' + esc(a[2]) + '</p><button class="' + (a[3] ? '' : 'quiet') + '" data-act="' + a[0] + '" data-id="' + esc(sel.id) + '" data-space="' + esc(sel.spaceId) + '">' + esc(a[1]) + '</button></div>').join('') + '</div>';
    }
    const counts = groups.map((g) => items.filter((i) => i.group === g).length);
    return '<p class="lead">' + esc(say(W.nowLead, { fix: counts[0], late: counts[1], proposed: counts[2], today: counts[3] })) + '</p>' +
      '<div class="board' + (reading ? ' reading' : '') + '"><section class="pane"><div class="ph"><span>' + esc(W.navNow) + '</span><span>' + items.length + '</span></div><div class="pb">' + list + '</div></section>' +
      '<div class="detail">' + detail + '</div></div>';
  },

  // An app (spec 013): the kinds whose model names it, each a table with its columns and total.
  async app (params, name) {
    const kinds = await api(inSpace('/kinds'));
    if (!name) {
      const apps = [...new Set(kinds.filter((k) => k.model && k.model.app).map((k) => k.model.app))];
      const shipped = await api('/apps');
      return '<p class="lead">' + esc(W.appsLead) + '</p>' +
        (apps.length ? '<section class="grid">' + apps.map((a) => card(a, '<p class="muted">' + esc(areaOfApp(kinds, a) || W.unfiled) + '</p><div class="actions"><a class="link" href="#/app/' + esc(encodeURIComponent(a)) + '">' + esc(W.open) + ' →</a><button class="quiet" data-area="' + esc(a) + '">' + esc(W.fileIn) + '</button></div>')).join('') + '</section>' : '') +
        '<h2 style="margin:22px 0 10px">' + esc(W.shippedApps) + '</h2><section class="grid">' + shipped.map((a) => card(a.app, '<p class="muted">' + esc(tr(a.description)) + '</p><div class="actions">' +
          (apps.includes(a.app) ? '<span class="badge said">' + esc(W.installed) + '</span>' : '<button data-install="' + esc(a.app) + '">' + esc(W.install) + '</button>') + '</div>')).join('') + '</section>' +
        card(W.newApp, '<p class="muted">' + esc(W.newAppHow) + '</p>', true);
    }
    const models = kinds.filter((k) => k.model && k.model.app === name);
    const appPages = await api(inSpace('/pages?app=' + encodeURIComponent(name)));
    if (!models.length && !appPages.length) return empty(W.noApp);
    const pageTabs = appPages.map((p) => '<a class="' + (p.id === params.get('page') || (!params.get('page') && !params.get('kind') && !params.get('view') && p === appPages[0]) ? 'on' : '') + '" href="#/app/' + esc(encodeURIComponent(name)) + '?page=' + esc(encodeURIComponent(p.id)) + '">' + esc(tr(p.label) || p.title) + '</a>').join('');
    const kindTabs = (on) => models.map((k) => '<a class="' + (k.kind === on ? 'on' : '') + '" href="#/app/' + esc(encodeURIComponent(name)) + '?kind=' + esc(encodeURIComponent(k.kind)) + '">' + esc(kindLabel(k)) + ' <span class="muted num">' + k.count + '</span></a>').join('');
    const shownPage = params.get('page') ? appPages.find((p) => p.id === params.get('page')) : !params.get('kind') && !params.get('view') ? appPages[0] : null;
    if (shownPage) {
      const q = new URLSearchParams(params); q.delete('page'); q.set('space', space);
      return '<nav class="tabs">' + pageTabs + kindTabs(null) + (await api(inSpace('/views?app=' + encodeURIComponent(name)))).map((v) => '<a href="#/app/' + esc(encodeURIComponent(name)) + '?view=' + esc(encodeURIComponent(v.id)) + '">' + esc(tr(v.label) || v.title) + '</a>').join('') + '</nav>' + frame('/app/frame/page/' + encodeURIComponent(shownPage.id) + '?' + q.toString());
    }
    // Her views (spec 015): the entries of a kind, filtered, sorted, as a table, a kanban or a calendar.
    const views = await api(inSpace('/views?app=' + encodeURIComponent(name)));
    const viewTabs = (on) => views.map((v) => '<a class="' + (v.id === on ? 'on' : '') + '" href="#/app/' + esc(encodeURIComponent(name)) + '?view=' + esc(encodeURIComponent(v.id)) + '">' + esc(tr(v.label) || v.title) + '</a>').join('');
    const saved = params.get('view') ? views.find((v) => v.id === params.get('view')) : null;
    const current = saved ? models.find((k) => k.kind === saved.kind) || models[0] : models.find((k) => k.kind === params.get('kind')) || models[0];
    const fallback = !saved && !params.get('kind') ? null : views.find((v) => v.kind === current.kind && v.default);
    const key = saved ? 'v:' + saved.id : 'k:' + current.kind;
    const st = explorers[key] || (explorers[key] = { id: saved ? saved.id : fallback ? fallback.id : null, view: saved || fallback ? {} : { kind: current.kind }, month: new Date().toISOString().slice(0, 7) });
    const { r, html } = await explore(key, st, { app: name, kind: current.kind, model: current.model });
    const tabs = '<nav class="tabs">' + pageTabs + kindTabs(saved ? null : current.kind) + viewTabs(saved ? saved.id : null) + '</nav>';
    return '<div class="head"><div><p class="lead" style="margin:0">' + esc(saved ? tr(saved.label) || saved.title : kindLabel(current)) + ' · ' + r.rows.length + '</p></div><div class="actions"><button class="quiet" data-model="' + esc(current.kind) + '">' + esc(W.seeModel) + '</button><button data-add="' + esc(current.kind) + '">' + esc(say(W.addOne, { kind: kindLabel(current) })) + '</button></div></div>' + tabs +
      card('', html, true);
  },

  async accueil () { return pages.__home(); },

  async __home () {
    const o = await api('/overview');
    const here = o.spaces.find((s) => s.id === space) || o.spaces[0];
    const max = Math.max(1, ...o.changes.map((c) => c.n));
    const total = o.changes.reduce((sum, c) => sum + c.n, 0);
    return '<p class="lead">' + esc(W.homeLead) + '</p>' +
      '<section class="kpis">' +
      card('', '<div class="caps">' + esc(W.entries) + '</div><div class="kpi">' + num(here.entries) + '</div>') +
      card('', '<div class="caps">' + esc(W.documents) + '</div><div class="kpi">' + num(here.documents) + '</div>') +
      card('', '<div class="caps">' + esc(W.reminders) + '</div><div class="kpi">' + num(here.reminders) + '</div>') +
      card('', '<div class="caps">' + esc(W.changes) + '</div><div class="kpi">' + num(total) + '</div><div class="spark">' +
        o.changes.map((c) => '<span title="' + esc(c.day + ' : ' + c.n) + '" style="height:' + Math.round(c.n / max * 100) + '%"></span>').join('') + '</div>') +
      '</section><section class="grid">' +
      card(W.upcoming, o.upcoming.length ? '<ul class="list">' + o.upcoming.map((u) =>
        '<li><span><a class="link" href="#/entree/' + esc(u.id) + '">' + esc(u.title) + '</a> <span class="muted">' + esc(u.kind) + ' · ' + esc(u.space) + '</span></span><span class="num">' + esc(time(u.when)) + '</span></li>').join('') + '</ul>' : empty(W.noUpcoming)) +
      card(W.recent, o.recent.length ? '<ul class="list">' + o.recent.map((r) => {
        const what = (r.after && r.after.title) || (r.before && r.before.title) || said(r.command);
        return '<li><span>' + esc(what) + ' <span class="muted">' + esc(said(r.command)) + ' · ' + esc(r.space) + '</span></span><span class="muted">' + esc(time(r.at)) + '</span></li>';
      }).join('') + '</ul>' : empty()) +
      '</section>';
  },

  async agenda (params) {
    // The week of the hash (?w=<Monday ISO>), else this one; the server says where Monday starts.
    const from = params.get('w');
    const data = await api('/agenda' + (from ? '?from=' + encodeURIComponent(from) : ''));
    const start = new Date(data.from);
    const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000 + 3600000));
    const key = (d) => d.toLocaleDateString('en-CA');
    const todayKey = key(new Date());
    const hourOf = (iso) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };
    const timed = data.occurrences.filter((o) => !o.allDay);
    const lo = Math.max(0, Math.min(7, ...timed.map((o) => Math.floor(hourOf(o.start)))));
    const hi = Math.min(24, Math.max(22, ...timed.map((o) => Math.ceil(o.end ? (hourOf(o.end) || 24) : hourOf(o.start) + 1))));
    const H = 40;
    const hhmm = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const href = (o) => '#/entree/' + esc(o.id);
    const cls = (o) => (o.proposed ? ' proposed' : '') + (o.repeated ? ' repeated' : '') + (o.type === 'moment' ? ' moment' : '');
    const label = (o) => (o.proposed ? W.proposed + ' · ' : '') + o.title;
    const onDay = (d) => data.occurrences.filter((o) => key(new Date(o.start)) === key(d));
    const shift = (n) => '#/agenda?w=' + encodeURIComponent(new Date(start.getTime() + n * 7 * 86400000).toISOString());
    const bar = '<div class="week-bar"><h2>' + esc(say(W.weekOf, { day: day(days[0].toISOString()) })) + '</h2>' +
      '<a class="badge" href="' + shift(-1) + '">‹ ' + esc(W.prevWeek) + '</a><a class="badge" href="#/agenda">' + esc(W.today) + '</a><a class="badge" href="' + shift(1) + '">' + esc(W.nextWeek) + ' ›</a></div>';
    let grid = '<div class="week"><div></div>' + days.map((d) => '<div class="wh' + (key(d) === todayKey ? ' today' : '') + '">' + esc(d.toLocaleDateString(locale, { weekday: 'short' })) + '<b>' + d.getDate() + '</b></div>').join('');
    grid += '<div class="gut"></div>' + days.map((d) => '<div class="allday">' + onDay(d).filter((o) => o.allDay).map((o) => '<a class="chip-ev' + (o.type === 'deadline' ? '' : ' day') + cls(o) + '" href="' + href(o) + '" title="' + esc(o.kind + ' · ' + o.space) + '">' + (o.type === 'deadline' ? '⚑ ' : '') + esc(label(o)) + '</a>').join('') + '</div>').join('');
    grid += '<div class="gut" style="height:' + (hi - lo) * H + 'px">' + Array.from({ length: hi - lo }, (_, i) => '<span style="top:' + i * H + 'px">' + String(lo + i).padStart(2, '0') + '</span>').join('') + '</div>';
    grid += days.map((d) => {
      const evs = onDay(d).filter((o) => !o.allDay).map((o) => {
        const a = hourOf(o.start);
        const b = o.end ? (key(new Date(o.end)) === key(d) ? hourOf(o.end) : hi) : a + 0.5;
        return '<a class="ev' + cls(o) + '" href="' + href(o) + '" title="' + esc(o.kind + ' · ' + o.space) + '" style="top:' + ((a - lo) * H + 1) + 'px;height:' + Math.max((Math.min(b, hi) - a) * H - 2, 20) + 'px"><b>' + esc(label(o)) + '</b><small>' + esc(hhmm(o.start) + (o.end ? '–' + hhmm(o.end) : '')) + '</small></a>';
      }).join('');
      const nowAt = hourOf(new Date().toISOString());
      const now = key(d) === todayKey && nowAt >= lo && nowAt <= hi ? '<div class="nowline" style="top:' + (nowAt - lo) * H + 'px"></div>' : '';
      return '<div class="col' + (key(d) === todayKey ? ' today' : '') + '" style="height:' + (hi - lo) * H + 'px">' + evs + now + '</div>';
    }).join('') + '</div>';
    const list = '<div class="days">' + days.map((d) => {
      const items = onDay(d);
      return card(d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }), items.length ? '<ul class="list">' + items.map((o) =>
        '<li><span><a class="link" href="' + href(o) + '">' + esc(label(o)) + '</a> <span class="muted">' + esc(o.kind + ' · ' + o.space) + '</span></span><span class="num">' + esc(o.allDay ? W.allDay : hhmm(o.start)) + '</span></li>').join('') + '</ul>' : empty(W.noEvents));
    }).join('') + '</div>';
    const legend = '<div class="legend"><span><i></i>' + esc(W.legendEvent) + '</span><span><i style="background:var(--clay);border-color:transparent"></i>' + esc(W.legendRepeated) + '</span><span><i style="border-color:var(--primary)"></i>' + esc(W.legendDeadline) + '</span><span><i style="background:var(--info-surface);border:1px dashed var(--info)"></i>' + esc(W.legendProposed) + '</span></div>';
    const phone = card(W.subscribe, '<p class="muted">' + esc(W.subscribeLead) + '</p><p class="badge ' + (data.linked ? 'said' : '') + '" style="white-space:normal">' + esc(data.linked ? W.subscribeOn : W.subscribeOff) + '</p><div id="address"></div><div class="actions" style="margin-top:10px"><button id="subscribe"' + (data.linked ? ' data-done="1"' : '') + '>' + esc(data.linked ? W.subscribeRenew : W.subscribe) + '</button></div>', true);
    return '<p class="lead">' + esc(W.agendaLead) + '</p>' + bar + grid + list + legend + '<div class="grid" style="margin-top:16px">' + phone + '</div>';
  },

  async rappels () {
    const list = await api(inSpace('/entries?limit=200&kind=Reminder'));
    const canal = await api('/entries?kind=Channel&limit=1&space=' + encodeURIComponent(me.space.id));
    return '<p class="badge ' + (canal.length ? 'said' : 'error') + '" style="white-space:normal;margin-bottom:14px">' + esc(canal.length ? W.channelOn : W.channelOff) + '</p>' +
      card('', list.length ? '<div class="scroll"><table class="rows"><thead><tr><th>' + esc(W.title) + '</th><th>' + esc(W.when) + '</th><th>' + esc(W.repeats) + '</th><th>' + esc(W.status) + '</th></tr></thead><tbody>' +
        list.map((r) => '<tr data-go="#/entree/' + esc(r.id) + '"><td>' + esc(r.title) + (r.data.message ? '<div class="muted">' + esc(r.data.message) + '</div>' : '') + '</td><td class="num">' + esc(time(r.data.next || r.data.at)) + '</td><td class="num">' + esc(r.data.repeat || '') + '</td><td><span class="badge">' + esc(r.data.status ? W['st_' + r.data.status] || r.data.status : '—') + '</span></td></tr>').join('') +
        '</tbody></table></div>' : empty(), true);
  },
};
`;
