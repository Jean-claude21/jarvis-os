// I9 / I5 / I8 / I10 — drawn in J-C's mockup: a space's page (its charter, its routines in five
// parts, and in a shared space who does what, what happened, the money in common), her documents in
// one place (written, kept, Drive, OneDrive, received by messages), « Mes données » (the ground made
// visible), a search that answers, and the first launch.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no dollar-brace, and every backslash written twice.

export const v2Life = `
let whoFilter = 'all';
const initials = (t) => String(t || '?').split(/ +/).map((w) => w.slice(0, 1)).join('').slice(0, 2).toUpperCase();
const MEMBER_COLORS = ['var(--primary)', 'var(--ochre)', 'var(--info)', 'var(--success)', 'var(--verify)'];
const sizeOf = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';

Object.assign(v2Pages, {
  // I9 — a space's page; in a shared space, the life in common.
  async espace (params, id) {
    const spaces = await api('/spaces');
    const s = spaces.find((x) => x.id === (id || space)) || spaces[0];
    const inS = (path) => path + (path.includes('?') ? '&' : '?') + 'space=' + encodeURIComponent(s.id);
    const [charters, routines] = await Promise.all([api(inS('/entries?kind=Charter&limit=5')), api(inS('/entries?kind=Routine&limit=50'))]);
    const color = (person) => MEMBER_COLORS[Math.max(0, s.members.findIndex((m) => m.person === person)) % MEMBER_COLORS.length];
    const nameOf = (person) => person === me.person.id ? W.v2you : ((s.members.find((m) => m.person === person) || {}).name || '?');
    const av = (person, size) => person ? '<span title="' + esc(nameOf(person)) + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;display:inline-grid;place-items:center;font-size:' + Math.round(size / 2.4) + 'px;font-weight:700;color:var(--on-primary);background:' + color(person) + ';flex:none">' + esc(initials(nameOf(person))) + '</span>' : '<span title="' + esc(W.v2nobody) + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;display:inline-grid;place-items:center;border:1.5px dashed var(--rule-strong);color:var(--faint);font-size:12px;flex:none">?</span>';
    const charter = charters[0];
    const charterHtml = charter ? '<div class="pad"><p class="context" style="margin-top:0">' + esc(String(charter.data.text || '').replace(/[#>*_]+/g, '').replace(/ +/g, ' ').trim().slice(0, 420)) + (String(charter.data.text || '').length > 420 ? '…' : '') + '</p><p class="muted" style="font-size:12.5px">' + esc(say(W.chars, { n: num(String(charter.data.text || '').length) })) + ' · ' + esc(W.v2keptAsIs) + ' · <a href="#/entree/' + esc(charter.id) + '">' + esc(W.v2readAll) + '</a></p></div>' : '<div class="pad muted">' + esc(W.noCharter) + '</div>';
    const part = (r, k) => { const t = r.data.trigger || {}; return k === 'when' ? (t.repeat || (t.phrases || []).join(', ') || r.data.when || '—') : k === 'prep' ? (r.data.prepare || []).map((p) => typeof p === 'string' ? W['prep_' + p] || p : p.find ? kindName(p.find.kind) : '').join(', ') : k === 'result' ? (r.data.result && r.data.result.kind ? kindName(r.data.result.kind) : '—') : ''; };
    const routinesHtml = routines.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2routine) + '</th><th>' + esc(W.v2trigger) + '</th><th>' + esc(W.v2jarvisPrepares) + ' <small class="faint">' + esc(W.v2noAi) + '</small></th><th>' + esc(W.v2produces) + '</th></tr></thead><tbody>' + routines.map((r) => '<tr data-go="#/entree/' + esc(r.id) + '" style="cursor:pointer"><td><div class="cell-title">' + esc(r.title) + '</div>' + (r.data.instructions ? '' : '<div class="cell-sub">' + esc(W.v2asText) + ' · <button class="btn small" data-structure-routine="' + esc(r.id) + ':' + esc(s.id) + '">' + esc(W.v2structureIt) + '</button></div>') + '</td><td class="mono" style="font-size:12px">' + esc(part(r, 'when')) + '</td><td><div class="cell-sub">' + esc(part(r, 'prep') || '—') + '</div></td><td><div class="cell-sub">' + esc(part(r, 'result')) + '</div></td></tr>').join('') + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.v2noRoutine) + '</div>';
    let shared = '';
    if (!s.personal) {
      const [tasks, hist, moves] = await Promise.all([api(inS('/entries?kind=Task&limit=100')), api(inS('/history?limit=12')), api(inS('/entries?kind=Transaction&limit=500&from=' + new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)))]);
      const open = tasks.filter((t) => !['done', 'cancelled'].includes(String(t.data.status)));
      const shown = open.filter((t) => { const w = t.data.who || null; return whoFilter === 'all' || (whoFilter === 'me' && w === me.person.id) || (whoFilter === 'others' && w && w !== me.person.id) || (whoFilter === 'none' && !w); });
      const members = '<div style="display:flex;gap:6px;align-items:center">' + s.members.map((m) => av(m.person, 28)).join('') + '<span class="muted" style="font-size:12.5px;margin-left:6px">' + esc(s.members.map((m) => nameOf(m.person)).join(', ')) + '</span></div>';
      const filters = [['all', W.v2all], ['me', W.v2toYou], ['others', W.v2toOthers], ['none', W.v2toNobody]];
      const rows = shown.map((t) => { const w = t.data.who || null; return '<tr><td style="width:40px">' + av(w, 26) + '</td><td><div class="cell-title"><a href="#/entree/' + esc(t.id) + '" style="color:inherit">' + esc(t.title) + '</a></div><div class="cell-sub">' + esc(t.data.due ? day(t.data.due) : t.data.at ? time(t.data.at) : W.v2noDate) + '</div></td><td style="text-align:right">' + (w ? (w === me.person.id ? '<span class="tag info">' + esc(W.v2toYouTag) + '</span>' : '<span class="tag plain">' + esc(say(W.v2toTag, { who: nameOf(w) })) + '</span>') : '<button class="btn small" data-take="' + esc(t.id) + ':' + esc(s.id) + '">' + ic('i-hand') + esc(W.v2iTake) + '</button>') + '</td></tr>'; }).join('');
      const feed = hist.length ? '<div class="pad"><ul class="x-tl">' + hist.map((h) => '<li><time>' + esc(new Date(h.at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</time><i style="background:' + color(h.actor) + '"></i><span>' + esc(nameOf(h.actor)) + ' · ' + esc(said(h.command)) + '<small>' + esc((h.after && h.after.title) || (h.before && h.before.title) || '') + '</small></span></li>').join('') + '</ul></div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>';
      // The money in common this month: what each member paid (its « who »), against equal shares.
      const out = moves.filter((m) => (m.data.direction || 'out') === 'out' && typeof m.data.amount === 'number');
      const paid = s.members.map((m) => [m.person, out.filter((x) => x.data.who === m.person).reduce((a, x) => a + Math.abs(x.data.amount), 0)]);
      const total = paid.reduce((a, x) => a + x[1], 0);
      const share = s.members.length ? total / s.members.length : 0;
      const owed = paid.map((x) => [x[0], x[1] - share]).sort((a, b) => b[1] - a[1]);
      const balance = owed.length > 1 && total ? say(W.v2owes, { who: nameOf(owed[owed.length - 1][0]), to: nameOf(owed[0][0]), amount: money2(owed[0][1]) }) : W.v2nothingShared;
      shared = '<div class="x-grid">' +
        v2panel(W.v2whoDoesWhat, '<div class="pad" style="display:flex;flex-direction:column;gap:12px">' + members + '<div class="segmented">' + filters.map((f) => '<button data-who-filter="' + f[0] + '" aria-pressed="' + (whoFilter === f[0]) + '">' + esc(f[1]) + '</button>').join('') + '</div></div><div class="scroll"><table><tbody>' + (rows || '<tr><td class="muted">' + esc(W.v2nothingHere) + '</td></tr>') + '</tbody></table></div><div class="pad muted" style="font-size:12.5px">' + esc(W.v2reminderGoes) + '</div>', '<span class="muted" style="font-size:12px">' + open.length + '</span>', 'i-hand') +
        v2panel(W.v2whatHappened, feed, '', 'i-history') + '</div>' +
        v2panel(W.v2moneyInCommon, '<div class="pad" style="display:flex;flex-direction:column;gap:12px"><div class="x-cmp">' + paid.map((x) => '<span>' + esc(nameOf(x[0])) + '</span><div class="bars"><i class="real" style="width:' + (total ? (x[1] / total) * 100 : 0) + '%"></i></div><span class="v">' + esc(money2(x[1])) + '</span>').join('') + '</div><p class="context" style="margin:0">' + esc(say(W.v2sharedTotal, { total: money2(total), share: money2(share) })) + ' <b>' + esc(balance) + '</b> <span class="origin inferred">' + esc(W.v2computed) + '</span></p></div>', '<span class="tag info">' + esc(W.v2halfHalf) + '</span>', 'i-scale');
    }
    const dot = '<span class="space-dot" style="background:' + MEMBER_COLORS[Math.max(0, me.spaces.findIndex((x) => x.id === s.id)) % MEMBER_COLORS.length] + ';width:14px;height:14px;border-radius:50%;display:inline-block;margin-right:10px"></span>';
    return v2head(esc(s.name), esc(say(W.v2spaceSub, { kind: s.personal ? W.own : W.shared, n: s.members.length })), '<a class="btn" href="#/vie">' + ic('i-life') + esc(W.v2itsEntries) + '</a><a class="btn" href="#/espaces">' + ic('i-gear') + esc(W.v2manage) + '</a>', dot) +
      '<div style="display:flex;flex-direction:column;gap:16px">' +
      v2panel(charter ? W.charter + ' · ' + charter.title : W.charter, charterHtml, charter ? '<a class="btn small" href="#/entree/' + esc(charter.id) + '">' + esc(W.v2edit) + '</a>' : '', 'i-lock') +
      v2panel(W.v2spaceRoutines, routinesHtml, '', 'i-routine') + '</div>' + shared +
      '<div class="hint">' + ic('i-alert') + '<span>' + W.v2charterHint + '</span></div>';
  },

  // I5 — her documents in one place: written, kept by Jarvis, Drive, OneDrive, received by messages.
  async documents (params) {
    const src = ['ecrits', 'deposes', 'gdrive', 'onedrive', 'messages'].includes(params.get('s')) ? params.get('s') : 'ecrits';
    const [written, files, connectors] = await Promise.all([
      api(inSpace('/query'), { method: 'POST', body: { sql: "select id, kind, title, length(data->>'text') as taille, updated_at from my_entries where length(data->>'text') > 400 and archived_at is null order by updated_at desc limit 300" } }),
      api(inSpace('/files')),
      api('/connectors').catch(() => []),
    ]);
    const has = (word) => connectors.some((c) => String(c.name || c.url || '').toLowerCase().includes(word));
    const received = files.filter((f) => /telegram|whatsapp|mail/i.test(f.title + ' ' + f.name));
    const sources = [['ecrits', W.v2srcWritten, written.rows.length, 'i-doc'], ['deposes', W.v2srcKept, files.length, 'i-lock'], ['gdrive', 'Google Drive', has('drive') ? '' : '—', 'i-plug'], ['onedrive', 'OneDrive', has('onedrive') ? '' : '—', 'i-plug'], ['messages', W.v2received, received.length, 'i-chat']];
    const side = '<section class="panel"><div class="panel-head"><span class="left caps">' + ic('i-file') + esc(W.v2sources) + '</span></div><div class="panel-body pad"><div class="x-src">' + sources.map((x) => '<button data-go="#/documents?s=' + x[0] + '" aria-pressed="' + (src === x[0]) + '">' + ic(x[3]) + esc(x[1]) + '<span class="n">' + esc(String(x[2])) + '</span></button>').join('') + '</div><p class="muted" style="font-size:12px;margin:12px 4px 0">' + esc(W.v2sourcesNote) + '</p></div></section>';
    const typeOf = (f) => f.mediaType.startsWith('image/') ? 'img' : f.mediaType === 'application/pdf' ? 'pdf' : f.mediaType.includes('csv') || f.mediaType.includes('sheet') ? 'csv' : 'md';
    const fileRows = (list) => list.length ? '<div class="scroll"><table style="min-width:560px"><thead><tr><th>' + esc(W.fileName) + '</th><th>' + esc(W.added) + '</th><th>' + esc(W.v2linkedToH) + '</th><th></th></tr></thead><tbody>' + list.map((f) => '<tr><td><div class="fname"><span class="ficon ' + typeOf(f) + '">' + esc(typeOf(f).toUpperCase()) + '</span><div><div class="cell-title" style="overflow-wrap:anywhere">' + esc(f.name) + '</div><div class="cell-sub">' + esc(sizeOf(f.size)) + (f.read ? ' · ' + esc(W.fileRead) : '') + '</div></div></div></td><td class="cell-sub">' + esc(day(f.createdAt)) + '</td><td>' + (f.links.length ? f.links.map((l) => '<a class="tag ok" href="#/entree/' + esc(l.id) + '">' + esc(l.title) + '</a>').join(' ') : '<a class="btn small" href="#/entree/' + esc(f.entryId) + '">' + ic('i-link') + esc(W.v2linkToEntry) + '</a>') + '</td><td style="white-space:nowrap"><button class="btn small" data-file="' + esc(f.entryId) + '">' + ic('i-eye') + esc(W.preview) + '</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.noFiles) + '</div>';
    let main;
    if (src === 'ecrits') main = v2panel(W.v2srcWritten, written.rows.length ? '<div class="scroll"><table style="min-width:520px"><thead><tr><th>' + esc(W.v2document) + '</th><th>' + esc(W.v2nature) + '</th><th class="n">' + esc(W.size) + '</th><th></th></tr></thead><tbody>' + written.rows.map((d) => '<tr><td><div class="fname"><span class="ficon md">TXT</span><div class="cell-title">' + esc(d.title) + '</div></div></td><td class="cell-sub">' + esc(kindName(d.kind)) + ' · ' + esc(day(d.updated_at)) + '</td><td class="n cell-sub">' + esc(say(W.chars, { n: num(d.taille) })) + '</td><td><a class="btn small" href="#/document/' + esc(d.id) + '">' + ic('i-eye') + esc(W.v2read) + '</a></td></tr>').join('') + '</tbody></table></div><div class="pad muted" style="font-size:12.5px">' + esc(W.v2writtenNote) + '</div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>', '<span class="tag plain">' + written.rows.length + '</span>', 'i-doc');
    else if (src === 'deposes') main = v2panel(W.v2srcKept, fileRows(files), '<span class="tag plain">' + esc(sizeOf(files.reduce((a, f) => a + f.size, 0))) + '</span>', 'i-lock');
    else if (src === 'messages') main = v2panel(W.v2received, '<div class="pad" style="padding-bottom:0"><div class="x-path"><b>' + esc(W.v2receivedWhere) + '</b> · ' + esc(W.v2receivedNote) + '</div></div>' + fileRows(received), '', 'i-chat');
    else main = v2panel(src === 'gdrive' ? 'Google Drive' : 'OneDrive', '<div class="pad" style="display:flex;flex-direction:column;gap:12px"><p class="context" style="margin:0">' + esc(say(W.v2driveNote, { name: src === 'gdrive' ? 'Google Drive' : 'OneDrive' })) + '</p><div><a class="btn solid" href="#/connexions?tab=mcps">' + ic('i-plug') + esc(say(W.v2connect, { name: src === 'gdrive' ? 'Google Drive' : 'OneDrive' })) + '</a></div></div>', '<span class="tag neutral">' + esc(W.v2toConnect) + '</span>', 'i-plug');
    return v2head(esc(W.navDocuments), esc(W.v2documentsSub), '<a class="btn" href="#/vie">' + ic('i-life') + esc(W.navEntries) + '</a>', '<span class="app-icon" style="background:var(--ink);color:var(--on-ink)">' + ic('i-doc') + '</span>') + '<div class="x-files">' + side + '<div style="min-width:0">' + main + '</div></div>';
  },

  // The ground made visible: what Jarvis keeps, how it is filed, the proof it is safe.
  async donnees () {
    const [merges, kinds, out, backups] = await Promise.all([
      api(inSpace('/kinds/merges')).catch(() => []),
      api(inSpace('/kinds')),
      api('/outbox?days=7').catch(() => []),
      api(inSpace('/backups')).catch(() => []),
    ]);
    const entries = kinds.reduce((a, k) => a + (k.count || 0), 0);
    const files = await api(inSpace('/files')).catch(() => []);
    const last = backups[0];
    const COMMONS = ['Person', 'Account', 'Transaction', 'Event', 'Task', 'Place', 'Organization', 'Fichier', 'Goal'];
    const doubt = new Map(merges.map((m) => [m.from, m]));
    const top = kinds.filter((k) => !['Model', 'Rule', 'Script', 'Page', 'View', 'App', 'Channel'].includes(k.kind)).sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 14);
    const typesHtml = '<div class="scroll"><table><thead><tr><th>' + esc(W.v2kind) + '</th><th class="n">' + esc(W.navEntries) + '</th><th>' + esc(W.v2nature) + '</th><th>' + esc(W.v2app) + '</th></tr></thead><tbody>' + top.map((k) => { const d = doubt.get(k.kind); return '<tr><td><b>' + esc(kindLabel(k)) + '</b>' + (d ? '<div class="cell-sub">' + esc(say(W.v2looksLike, { kind: kindName(d.to) })) + '</div>' : '') + '</td><td class="n">' + num(k.count || 0) + '</td><td>' + (d ? '<span class="tag late">' + esc(W.v2double) + '</span>' : COMMONS.includes(k.kind) ? '<span class="tag info">' + esc(W.v2common) + '</span>' : '<span class="tag plain">' + esc(W.v2yours) + '</span>') + '</td><td>' + (d ? '<a class="btn small" href="#/ranger">' + esc(W.v2mergeDo) + '</a>' : '<span class="cell-sub">' + esc((k.model && k.model.app) || '—') + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    const byChannel = {};
    for (const m of out) { const c = m.channel || 'app'; byChannel[c] = byChannel[c] || { sent: 0, failed: 0 }; if (m.state === 'sent' || m.state === 'acted') byChannel[c].sent++; else if (m.state === 'failed') byChannel[c].failed++; }
    const sentHtml = Object.keys(byChannel).length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2channel) + '</th><th class="n">' + esc(W.v2sent) + '</th><th>' + esc(W.v2problem) + '</th></tr></thead><tbody>' + Object.entries(byChannel).map(([c, v]) => '<tr><td>' + esc(c) + '</td><td class="n">' + v.sent + '</td><td>' + (v.failed ? '<span class="tag late">' + esc(say(W.v2failedN, { n: v.failed })) + '</span>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="pad muted">' + esc(W.v2nothingSent) + '</div>';
    const watch = [];
    for (const m of merges.slice(0, 3)) watch.push('<a href="#/ranger">' + ic('i-shape', 'color:var(--verify)') + '<span><b>' + esc(m.from) + '</b> ' + esc(say(W.v2looksLike, { kind: kindName(m.to) })) + ' <em>· ' + esc(W.v2toSort) + '</em></span></a>');
    for (const [c, v] of Object.entries(byChannel)) if (v.failed) watch.push('<a href="#/connexions">' + ic('i-alert', 'color:var(--error)') + '<span><b>' + esc(c) + '</b> : ' + esc(say(W.v2failedN, { n: v.failed })) + '</span></a>');
    return v2head(esc(W.navData), esc(W.v2dataSub), '<a class="btn" href="' + esc('/api/export?space=' + encodeURIComponent(space)) + '">' + ic('i-down') + esc(W.v2exportMd) + '</a>', '<span class="app-icon" style="background:var(--ink);color:var(--on-ink)">' + ic('i-box') + '</span>') +
      '<div class="grid g4">' + v2kpi(W.navEntries, num(entries), esc(say(W.v2inSpaces, { n: me.spaces.length }))) + v2kpi(W.navFiles, num(files.length) + ' · ' + esc(sizeOf(files.reduce((a, f) => a + f.size, 0))), esc(W.v2keptByJarvis)) + v2kpi(W.v2types, num(top.length), esc(say(W.v2doubtsN, { n: merges.length }))) + v2kpi(W.v2lastBackup, last ? esc(day(last.day)) : '—', last ? esc(sizeOf(last.size || 0)) : esc(W.v2noBackup), last ? '' : 'alert') + '</div>' +
      v2panel(W.v2howFiled, '<div class="pad"><div class="x-struct">' + [['Espace', W.v2structSpace], ['Type', W.v2structKind], ['Entrée', W.v2structEntry], ['Liens', W.v2structLinks], ['Histoire', W.v2structStory]].map((x, i) => '<div><b>' + esc([W.space, W.v2kind, W.v2entry, W.links, W.history][i]) + '</b>' + esc(x[1]) + '</div>').join('') + '</div></div>', '', 'i-shape') +
      '<div class="x-grid">' + v2panel(W.v2yourTypes, typesHtml, '<a class="btn small" href="#/collections">' + esc(W.navModels) + '</a>', 'i-shape') + v2panel(W.v2sentByJarvis, sentHtml, '<span class="tag ok">' + esc(W.v2watcherOn) + '</span>', 'i-bell') + '</div>' +
      (watch.length ? v2panel(W.v2toWatch, '<div class="pad x-rel">' + watch.join('') + '</div>', '', 'i-alert') : '') +
      // Her import and export, as before.
      (await settingsPages.donnees());
  },

  // I10 — the first launch: her spaces, what she already has, her connections, her rhythm.
  async bienvenue (params) {
    const step = Math.max(0, Math.min(3, Number(params.get('e') || 0)));
    const steps = [W.v2stepSpaces, W.v2stepHave, W.v2stepConnect, W.v2stepRhythm];
    await prefsNow();
    const zone = await api('/me/zone').catch(() => ({ zone: '' }));
    const body = [
      '<div class="x-across">' + [[W.v2aloneTitle, W.v2aloneSub, true], [W.v2two, W.v2twoSub], [W.v2family, W.v2familySub], [W.v2work, W.v2workSub]].map((x, i) => '<label class="x-app' + (x[2] ? ' write' : '') + '" style="cursor:pointer"><span class="top"><input type="checkbox" data-space-kind="' + i + '"' + (x[2] ? ' checked disabled' : '') + '> ' + esc(x[0]) + '</span><p>' + esc(x[1]) + '</p></label>').join('') + '</div>',
      '<div class="x-across">' + [[W.v2myNotes, W.v2myNotesSub, 'i-doc', '#/donnees'], [W.v2aSheet, W.v2aSheetSub, 'i-file', '#/donnees'], [W.v2fromZero, W.v2fromZeroSub, 'i-spark', '']].map((x) => '<a class="x-app" href="' + (x[3] || '#/bienvenue?e=2') + '" style="color:inherit;text-decoration:none"><div class="top">' + ic(x[2]) + esc(x[0]) + '</div><p>' + esc(x[1]) + '</p></a>').join('') + '</div><div class="hint" style="margin-top:12px">' + ic('i-lock') + '<span>' + W.v2readHint + '</span></div>',
      '<div class="x-across">' + [['Claude', '#/connexions'], ['Telegram', '#/compte'], ['Google Agenda', '#/agenda'], ['Gmail', '#/connexions?tab=mcps'], ['Google Drive', '#/connexions?tab=mcps']].map((x) => '<a class="x-app" href="' + x[1] + '" style="color:inherit;text-decoration:none"><div class="top">' + ic('i-plug') + esc(x[0]) + '</div><p>' + esc(W.v2connectIt) + '</p></a>').join('') + '</div>',
      '<div class="form" style="padding:0;display:grid;gap:14px"><label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.v2briefAt) + '<input class="field" type="time" id="w-brief" value="' + esc((prefs && prefs.brief) || '07:00') + '"></label><label style="display:grid;gap:6px;font-weight:600;font-size:13px">' + esc(W.v2zone) + '<input class="field" id="w-zone" value="' + esc(zone.zone || Intl.DateTimeFormat().resolvedOptions().timeZone) + '"></label></div>',
    ][step];
    return v2head(esc(W.v2welcome), esc(W.v2welcomeSub), '') +
      '<div class="x-steps">' + steps.map((x, i) => '<span class="' + (i === step ? 'on' : i < step ? 'done' : '') + '"><i>' + (i < step ? '✓' : i + 1) + '</i>' + esc(x) + '</span>').join('') + '</div>' +
      v2panel(steps[step], '<div class="pad" style="display:flex;flex-direction:column;gap:14px">' + body + '<div style="display:flex;justify-content:space-between"><button class="btn" data-go="#/bienvenue?e=' + Math.max(0, step - 1) + '"' + (step ? '' : ' disabled') + '>' + esc(W.back) + '</button><button class="btn solid" data-welcome-next="' + step + '">' + esc(step === 3 ? W.v2openNow : W.v2continue) + '</button></div></div>', '<span class="muted" style="font-size:12px">' + (step + 1) + ' / 4</span>', 'i-spark');
  },
});

// What these pages do: take a task, filter by person, the first launch's steps.
function bindLife(root) {
  root.querySelectorAll('[data-who-filter]').forEach((b) => b.addEventListener('click', () => { whoFilter = b.dataset.whoFilter; show(); }));
  root.querySelectorAll('[data-take]').forEach((b) => b.addEventListener('click', async () => {
    const [id, where] = b.dataset.take.split(':');
    b.disabled = true;
    try { await api('/save?space=' + encodeURIComponent(where), { method: 'POST', body: { entries: [{ id, data: { who: me.person.id } }] } }); toast(W.v2taken, { id, spaceId: where }); show(); } catch (error) { b.disabled = false; alert(error.message); }
  }));
  root.querySelectorAll('[data-structure-routine]').forEach((b) => b.addEventListener('click', async (event) => {
    event.stopPropagation();
    const [id, where] = b.dataset.structureRoutine.split(':');
    b.disabled = true;
    try { await api('/routines/' + encodeURIComponent(id) + '/structure?space=' + encodeURIComponent(where), { method: 'POST', body: {} }); toast(W.v2structureProposed, null); counts(); } catch (error) { b.disabled = false; alert(error.message); }
  }));
  const next = root.querySelector('[data-welcome-next]');
  if (next) next.addEventListener('click', async () => {
    const step = Number(next.dataset.welcomeNext);
    try {
      if (step === 0) {
        const names = [null, W.v2two, W.v2family, W.v2work];
        for (const box of root.querySelectorAll('[data-space-kind]:checked:not([disabled])')) {
          const name = names[Number(box.dataset.spaceKind)];
          if (name && !me.spaces.some((s) => s.name === name)) await api('/spaces', { method: 'POST', body: { name } });
        }
        me = await api('/me'); drawSpaces();
      }
      if (step === 3) {
        keepPrefs({ brief: root.querySelector('#w-brief').value || null });
        const zone = root.querySelector('#w-zone').value.trim();
        if (zone) await api('/me/zone', { method: 'POST', body: { zone } });
        location.hash = '#/'; return;
      }
      location.hash = '#/bienvenue?e=' + (step + 1);
    } catch (error) { alert(error.message); }
  });
}

// I8 — a question in the search box: the figure, computed from her entries, and what justifies it.
async function answer(q) {
  try {
    const a = await api('/answer?q=' + encodeURIComponent(q));
    const value = (n) => a.currency ? money2(n, a.currency) : num(n);
    const diff = a.previous ? Math.round((a.figure / a.previous - 1) * 100) : null;
    const max = Math.max(1, ...a.weeks.map((w) => w.value));
    openDrawer(q, '<div class="v2" style="display:flex;flex-direction:column;gap:16px"><span class="muted" style="font-size:12px">' + esc(W.v2computedNever) + '</span>' +
      '<div class="x-big">' + esc(value(a.figure)) + '<small>' + esc(say(W.v2answerOf, { words: a.question.words.join(' ') || W.v2everything, from: day(a.question.from), to: day(new Date(new Date(a.question.to).getTime() - 86400000).toISOString()) })) + '</small></div>' +
      '<p class="context" style="margin:0">' + esc(say(a.currency ? W.v2answerSum : W.v2answerCount, { n: a.count })) + (diff !== null ? ' <b>' + esc(say(diff >= 0 ? W.v2moreThan : W.v2lessThan, { n: Math.abs(diff), before: value(a.previous) })) + '</b>' : '') + '</p>' +
      (a.weeks.length ? '<div class="x-cmp">' + a.weeks.map((w) => '<span>' + esc(day(w.from)) + '</span><div class="bars"><i class="real" style="width:' + (w.value / max) * 100 + '%"></i></div><span class="v">' + esc(value(w.value)) + '</span>').join('') + '</div>' : '') +
      (a.top.length ? '<div class="scroll"><table><thead><tr><th>' + esc(a.currency ? W.v2largest : W.v2latest) + '</th><th class="n">' + esc(a.currency ? W.v2amount : W.v2day) + '</th></tr></thead><tbody>' + a.top.map((t) => '<tr><td><a href="#/entree/' + esc(t.id) + '">' + esc(t.title) + '</a> <span class="cell-sub">· ' + esc(day(t.day)) + '</span></td><td class="n">' + esc(a.currency ? value(t.value) : day(t.day)) + '</td></tr>').join('') + '</tbody></table></div>' : '') + '</div>',
      '<a class="btn" href="#/vie?q=' + encodeURIComponent(a.question.words.join(' ')) + '">' + esc(W.v2seeEntries) + '</a><button class="primary" data-close>' + esc(W.v2understood2) + '</button>');
  } catch (error) { alert(error.message); }
}
`;
