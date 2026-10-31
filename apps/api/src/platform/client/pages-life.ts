// The pages of her life: files, collections, entries, documents, dashboards.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const lifePages = `
const lifePages = {
  // Her files (spec 013): what each is, what Jarvis read of it, what it is linked to.
  async fichiers (params) {
    const files = await api(inSpace('/files'));
    const typeOf = (f) => f.mediaType.startsWith('image/') ? 'img' : f.mediaType === 'application/pdf' ? 'pdf' : f.mediaType.startsWith('text/') || f.mediaType.includes('json') || f.mediaType.includes('csv') ? 'text' : 'other';
    const t = params.get('t') || '';
    const shown = files.filter((f) => !t || typeOf(f) === t);
    const size = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';
    const filters = ['', 'pdf', 'img', 'text', 'other'].map((k) => '<a class="badge' + (k === t ? ' primary' : '') + '" href="#/fichiers' + (k ? '?t=' + k : '') + '">' + esc(W['ft_' + (k || 'all')]) + ' ' + files.filter((f) => !k || typeOf(f) === k).length + '</a>').join(' ');
    return '<p class="lead">' + esc(say(W.filesLead, { n: files.length, size: size(files.reduce((a, f) => a + f.size, 0)) })) + '</p><div class="actions" style="margin-bottom:12px">' + filters + '</div>' +
      card('', shown.length ? '<div class="scroll"><table><thead><tr><th>' + esc(W.fileName) + '</th><th>' + esc(W.links) + '</th><th>' + esc(W.added) + '</th><th class="n">' + esc(W.size) + '</th><th></th></tr></thead><tbody>' +
        shown.map((f) => '<tr><td><div class="fname"><span class="ficon">' + esc(typeOf(f).toUpperCase()) + '</span><span style="min-width:0"><a class="link" href="#" data-file="' + esc(f.entryId) + '" style="overflow-wrap:anywhere">' + esc(f.name) + '</a><div class="muted" style="font-size:12px">' + esc(f.title !== f.name ? f.title : f.mediaType) + (f.read ? ' · ' + esc(W.fileRead) : '') + '</div></span></div></td>' +
          '<td><div class="chips">' + f.links.map((l) => '<a class="chip" href="#/entree/' + esc(l.id) + '">' + esc(l.title) + '<small>' + esc(l.role) + '</small></a>').join('') + '</div></td><td class="muted">' + esc(day(f.createdAt)) + '</td><td class="n num">' + esc(size(f.size)) + '</td>' +
          '<td style="text-align:right;white-space:nowrap"><button class="quiet" data-file="' + esc(f.entryId) + '">' + esc(W.preview) + '</button> <a class="badge primary" href="/api/files/' + esc(f.entryId) + '?download=1&space=' + esc(encodeURIComponent(space)) + '">' + esc(W.download) + '</a></td></tr>').join('') +
        '</tbody></table></div>' : empty(W.noFiles), true);
  },

  // Her collections (spec 016): every kind with a model, opened on its own, its statistics on top.
  async collections (params, kind) {
    if (!kind) {
      const list = await api(inSpace('/collections'));
      if (!list.length) return '<p class="lead">' + esc(W.collectionsLead) + '</p>' + card('', empty(W.noCollections), true);
      const groups = {};
      for (const c of list) (groups[c.area || ''] = groups[c.area || ''] || []).push(c);
      const names = Object.keys(groups).sort((x, y) => (x === '') - (y === '') || x.localeCompare(y));
      return '<p class="lead">' + esc(W.collectionsLead) + '</p>' + names.map((n) => '<h2 style="margin:18px 0 8px">' + esc(n || W.unfiled) + '</h2><section class="grid">' +
        groups[n].map((c) => card(tr(c.label) || c.kind, '<div class="kpi">' + num(c.count) + '</div><p class="muted">' + esc(c.app ? say(W.inApp, { app: c.app }) : W.noAppYet) + '</p><a class="link" href="#/collections/' + esc(encodeURIComponent(c.kind)) + '">' + esc(W.open) + ' →</a>')).join('') + '</section>').join('');
    }
    const name = decodeURIComponent(kind);
    const k = knownKinds.find((one) => one.kind === name) || (await api(inSpace('/kinds'))).find((one) => one.kind === name);
    if (!k || !k.model) return empty(W.noCollections);
    const s = await api(inSpace('/collections/' + encodeURIComponent(name) + '/stats'));
    const stats = statsHtml(s);
    const views = await api(inSpace('/views?kind=' + encodeURIComponent(name)));
    const saved = params.get('view') ? views.find((v) => v.id === params.get('view')) : null;
    const fallback = saved ? null : views.find((v) => v.default);
    const key = saved ? 'v:' + saved.id : 'c:' + name;
    const st = explorers[key] || (explorers[key] = { id: saved ? saved.id : fallback ? fallback.id : null, view: saved || fallback ? {} : { kind: name }, month: new Date().toISOString().slice(0, 7) });
    const { html } = await explore(key, st, { app: k.model.app || null, kind: name, model: k.model });
    const tabs = '<nav class="tabs"><a class="' + (saved ? '' : 'on') + '" href="#/collections/' + esc(encodeURIComponent(name)) + '">' + esc(W.allEntries) + '</a>' +
      views.map((v) => '<a class="' + (saved && v.id === saved.id ? 'on' : '') + '" href="#/collections/' + esc(encodeURIComponent(name)) + '?view=' + esc(encodeURIComponent(v.id)) + '">' + esc(tr(v.label) || v.title) + '</a>').join('') + '</nav>';
    return '<div class="head"><div><div class="caps">' + esc(k.model.area || W.unfiled) + (k.model.app ? ' · ' + esc(k.model.app) : '') + '</div><h1>' + esc(kindLabel(k)) + '</h1></div><div class="actions">' +
      '<button class="quiet" data-model="' + esc(name) + '">' + esc(W.seeModel) + '</button><button class="quiet" data-share="' + esc(name) + '">' + esc(W.share) + '</button><button data-add="' + esc(name) + '">' + esc(say(W.addOne, { kind: kindLabel(k) })) + '</button></div></div>' +
      stats + tabs + card('', html, true);
  },

  // Her entries (spec 017): the kinds flat or in her groups; the list searched, filtered by period
  // and folder, flat, by period or by folder; entries selected and filed at once; its statistics.
  async vie (params) {
    const kinds = await api(inSpace('/kinds'));
    knownKinds = kinds;
    const kind = params.get('kind') || ''; const q = params.get('q') || '';
    const from = params.get('from') || ''; const to = params.get('to') || ''; const folder = params.get('folder') || '';
    const sort = params.get('sort') || 'day'; const desc = params.get('desc') !== 'false';
    const pref = await prefsNow();
    const mode = params.get('mode') || (pref.modes && pref.modes[kind || '*']) || 'flat';
    const qs = new URLSearchParams();
    for (const [k, v] of [['kind', kind], ['text', q], ['from', from], ['to', to], ['folder', folder], ['sort', sort], ['desc', String(desc)]]) if (v) qs.set(k, v);
    qs.set('limit', '1000');
    const list = await api(inSpace('/list?' + qs.toString()));
    const stats = kind ? await api(inSpace('/list/stats?' + qs.toString())) : null;
    const link = (over) => { const p = new URLSearchParams(params); for (const [k, v] of Object.entries(over)) { if (v === null || v === '') p.delete(k); else p.set(k, v); } const t = p.toString(); return '#/vie' + (t ? '?' + t : ''); };

    // The kinds: flat (the most used first) or in her groups, Jarvis's own last.
    const kmode = kindsMode();
    const SYS = '~system';
    const kindRow = (k) => '<a href="' + esc(link({ kind: k.kind, folder: null })) + '" draggable="' + (kmode === 'flat' ? 'false' : 'true') + '" data-dragkind="' + esc(k.kind) + '" data-kname="' + esc((kindLabel(k) + ' ' + k.kind).toLowerCase()) + '" class="' + (k.kind === kind ? 'on' : '') + '"><span>' + esc(kindLabel(k)) + '</span><span class="muted num">' + k.count + '</span></a>';
    let kindsHtml;
    if (kmode === 'flat') kindsHtml = kinds.filter((k) => k.count).map(kindRow).join('');
    else {
      const groups = {};
      for (const k of kinds.filter((one) => one.count)) { const g = k.system && !k.group ? SYS : k.group || ''; (groups[g] = groups[g] || []).push(k); }
      const names = Object.keys(groups).sort((x, y) => (x === SYS) - (y === SYS) || (x === '') - (y === '') || x.localeCompare(y));
      kindsHtml = names.map((n) => '<details' + (n === SYS ? '' : ' open') + '><summary class="caps"' + (n === SYS ? '' : ' data-dropgroup="' + esc(n) + '"') + '><span>' + esc(n === SYS ? W.systemGroup : n || W.noGroup) + '</span><span class="num">' + groups[n].reduce((t, k) => t + k.count, 0) + '</span></summary>' + groups[n].map(kindRow).join('') + '</details>').join('');
    }
    const nav = '<nav class="card facets ent-kinds"><div class="head" style="margin:0;align-items:center"><span class="caps">' + esc(W.kinds) + '</span>' +
      '<div class="seg"><button class="' + (kmode === 'flat' ? 'on' : 'quiet') + '" data-kmode="flat">' + esc(W.kindsFlat) + '</button><button class="' + (kmode === 'flat' ? 'quiet' : 'on') + '" data-kmode="grouped">' + esc(W.kindsGrouped) + '</button></div></div>' +
      '<input type="search" data-kq placeholder="' + esc(W.kindSearch) + '" style="margin-top:8px">' +
      '<div class="kscroll"><a href="' + esc(link({ kind: null, folder: null })) + '" class="' + (kind ? '' : 'on') + '"><span>' + esc(W.all) + '</span></a>' + kindsHtml + '</div></nav>';

    // The list: flat, by period (year › month) or by folder (a tree).
    const k = kinds.find((one) => one.kind === kind);
    const check = (e) => '<td class="pick"><input type="checkbox" data-row="' + esc(e.id) + '"></td>';
    const dayCell = (e) => '<td class="muted" style="white-space:nowrap"' + (e.dayFrom === 'made' ? ' title="' + esc(W.madeHint) + '"' : '') + '>' + esc(ownDay(e.day)) + (e.dayFrom === 'made' ? ' *' : '') + '</td>';
    const line = (e, withFolder) => '<tr draggable="true" data-drag="' + esc(e.id) + '" data-go="#/entree/' + esc(e.id) + '">' + check(e) + '<td>' + esc(e.title) + '</td>' + (kind ? '' : '<td><span class="badge">' + esc(kindName(e.kind)) + '</span></td>') + dayCell(e) +
      (withFolder ? '<td class="muted">' + (e.folder ? '<a class="link" href="' + esc(link({ folder: e.folder })) + '">' + esc(e.folder.split('/').slice(-2).join('/')) + '</a>' : '') + '</td>' : '') + '</tr>';
    const headRow = (withFolder) => '<tr><th class="pick"><input type="checkbox" data-all></th><th>' + esc(W.title) + '</th>' + (kind ? '' : '<th>' + esc(W.kind) + '</th>') + '<th>' + esc(W.dayCol) + '</th>' + (withFolder ? '<th>' + esc(W.folderCol) + '</th>' : '') + '</tr>';
    const span = kind ? 3 : 4;
    let body = '';
    if (!list.rows.length) body = empty();
    else if (mode === 'period') {
      let year = null; let month = null; const out = [];
      for (const e of list.rows) {
        const y = e.day.slice(0, 4); const m = e.day.slice(0, 7);
        if (y !== year) { year = y; month = null; out.push('<tr class="period year"><td colspan="' + span + '">' + esc(y) + ' · ' + list.rows.filter((x) => x.day.slice(0, 4) === y).length + '</td></tr>'); }
        if (m !== month) { month = m; out.push('<tr class="period"><td colspan="' + span + '">' + esc(new Date(m + '-15T12:00:00').toLocaleDateString(locale, { month: 'long' })) + ' · ' + list.rows.filter((x) => x.day.slice(0, 7) === m).length + '</td></tr>'); }
        out.push(line(e, false));
      }
      body = '<div class="ent-scroll"><table class="rows"><thead>' + headRow(false) + '</thead><tbody>' + out.join('') + '</tbody></table></div>';
    } else if (mode === 'folder') {
      const root = { name: '', path: '', kids: {}, rows: [] };
      for (const e of list.rows) {
        let at = root;
        for (const part of (e.folder || '').split('/').filter(Boolean)) { const path = at.path ? at.path + '/' + part : part; at = at.kids[part] || (at.kids[part] = { name: part, path, kids: {}, rows: [] }); }
        at.rows.push(e);
      }
      const count = (n) => n.rows.length + Object.values(n.kids).reduce((t, c) => t + count(c), 0);
      const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
      const entryRow = (e) => '<div class="fe" draggable="true" data-drag="' + esc(e.id) + '"><input type="checkbox" data-row="' + esc(e.id) + '"><a href="#/entree/' + esc(e.id) + '">' + esc(e.title) + '</a><span class="muted" style="margin-left:auto;white-space:nowrap">' + esc(ownDay(e.day)) + '</span></div>';
      const node = (n, depth, only) => '<details' + (depth < 1 || only ? ' open' : '') + '><summary data-dropfolder="' + esc(n.path) + '"><span>' + esc(n.name) + '</span><span class="grow"></span><span class="muted num">' + count(n) + '</span><a class="link" href="' + esc(link({ folder: n.path, mode: null })) + '">→</a></summary>' +
        Object.values(n.kids).sort(byName).map((c, _, all) => node(c, depth + 1, all.length === 1)).join('') + n.rows.map(entryRow).join('') + '</details>';
      body = '<div class="ent-scroll ftree">' + Object.values(root.kids).sort(byName).map((c) => node(c, 0, false)).join('') +
        (root.rows.length ? '<details open><summary data-dropfolder=""><span>' + esc(W.noFolder) + '</span><span class="grow"></span><span class="muted num">' + root.rows.length + '</span></summary>' + root.rows.map(entryRow).join('') + '</details>' : '') + '</div>';
    } else {
      body = '<div class="ent-scroll"><table class="rows"><thead>' + headRow(true) + '</thead><tbody>' + list.rows.map((e) => line(e, true)).join('') + '</tbody></table></div>';
    }
    const opt = (v, label, on) => '<option value="' + v + '"' + (v === on ? ' selected' : '') + '>' + esc(label) + '</option>';
    const tools = '<form class="ent-tools" data-entform>' +
      '<input type="search" name="q" value="' + esc(q) + '" placeholder="' + esc(W.listSearch) + '">' +
      '<label class="vsel">' + esc(W.fromDay) + ' <input type="date" name="from" value="' + esc(from) + '"></label><label class="vsel">' + esc(W.toDay) + ' <input type="date" name="to" value="' + esc(to) + '"></label>' +
      '<select name="sort">' + opt('day', W.sortDay, sort) + opt('title', W.sortTitle, sort) + opt('updated', W.sortUpdated, sort) + '</select>' +
      '<button type="button" class="quiet" data-desc="' + (desc ? 'false' : 'true') + '">' + (desc ? '↓' : '↑') + '</button><button>' + esc(W.apply) + '</button></form>' +
      '<div class="ent-tools"><div class="actions">' + [['flat', W.modeFlat], ['period', W.modePeriod], ['folder', W.modeFolder]].map(([m, label]) => '<a class="badge' + (m === mode ? ' primary' : '') + '" data-mode="' + m + '" data-modekey="' + esc(kind || '*') + '" href="' + esc(link({ mode: m })) + '">' + esc(label) + '</a>').join('') + '</div>' +
      (folder ? '<span class="chip">' + esc(say(W.inFolder, { folder })) + ' <a class="x" href="' + esc(link({ folder: null })) + '" aria-label="' + esc(W.remove) + '">✕</a></span>' : '') +
      '<span class="grow"></span><span class="muted">' + esc(list.truncated ? say(W.shownOf, { n: list.rows.length, total: list.total }) : String(list.total)) + '</span></div>';
    const sel = '<div class="ent-sel" id="entsel"><b id="entsel-n"></b><span class="grow"></span><button class="quiet" data-bulk="folder">' + esc(W.fileInFolder) + '</button><button class="quiet" data-bulk="kind">' + esc(W.retype) + '</button><button class="quiet" data-bulk="link">' + esc(W.linkTo) + '</button><button class="quiet" data-bulk="archive">' + esc(W.setAside) + '</button><button class="quiet" data-bulk="none">' + esc(W.unselect) + '</button></div>';
    const head = '<div class="head" style="margin:0"><div>' + (k && k.group ? '<div class="caps">' + esc(k.group) + '</div>' : '') + '<h2 style="margin:0">' + esc(kind ? kindName(kind) : q ? '« ' + q + ' »' : W.all) + '</h2></div>' +
      (kind ? '<div class="actions"><button class="quiet" data-kgroup="' + esc(kind) + '" data-current="' + esc((k && k.group) || '') + '">' + esc(W.groupKind) + '</button><button class="quiet" data-krename="' + esc(kind) + '">' + esc(W.renameKind) + '</button></div>' : '') + '</div>';
    return '<div class="ent">' + nav + '<section class="card ent-main">' + head + (stats ? statsHtml(stats) : '') + tools + sel + body + '</section></div>';
  },

  async entree (params, id) {
    const e = await api(inSpace('/entries/' + encodeURIComponent(id)));
    const hist = await api(inSpace('/history?limit=20&target=' + encodeURIComponent(id)));
    const fields = Object.keys(e.data).filter((f) => f !== 'text' && f !== 'source');
    const value = (v) => v !== null && typeof v === 'object' ? '<code>' + esc(JSON.stringify(v)) + '</code>' : esc(v);
    let text = '';
    if (typeof e.data.text === 'string') {
      const d = await api(inSpace('/documents/' + encodeURIComponent(id)));
      text = card(W.text, '<div class="actions" style="margin-bottom:8px"><a class="link" href="#/document/' + esc(id) + '">' + esc(W.open) + ' →</a></div><div class="doc">' + d.html + '</div>', true);
    }
    const link = (l, dir) => '<li><span>' + (dir === 'out' ? '→ ' : '← ') + '<span class="muted">' + esc(l.role) + '</span> <a class="link" href="#/entree/' + esc(l.entry.id) + '">' + esc(l.entry.title) + '</a></span><span class="badge">' + esc(l.entry.kind) + '</span></li>';
    const links = e.links.out.map((l) => link(l, 'out')).concat(e.links.in.map((l) => link(l, 'in')));
    return '<div class="head"><div><div class="caps">' + esc(kindName(e.kind)) + (e.archivedAt ? ' · ' + esc(W.archived) : '') + '</div><h1>' + esc(e.title) + '</h1>' +
      (e.data.source ? '<div class="meta muted">' + esc(say(W.source, { path: e.data.source })) + '</div>' : '') + '</div>' +
      '<div class="actions">' + (e.archivedAt ? '' : '<button class="quiet" id="aside">' + esc(W.setAside) + '</button>') + '</div></div>' +
      '<section class="grid">' +
      card(W.fields, fields.length || e.computed ? fields.map((f) => '<div class="field-row"><span class="caps">' + esc(f) + '</span><span>' + (f === 'status' ? esc(W['st_' + e.data[f]] || e.data[f]) : value(e.data[f])) + '</span>' + originBadge(e.origin[f] || 'said') + '</div>').join('') +
        Object.entries(e.computed || {}).map(([f, v]) => '<div class="field-row"><span class="caps">' + esc(f) + '</span><span class="num">' + esc(typeof v === 'number' ? num(v) : v === null ? '—' : String(v)) + '</span><span class="badge">' + esc(W.computedBadge) + '</span></div>').join('') : empty()) +
      card(W.links, links.length ? '<ul class="list">' + links.join('') + '</ul>' : empty()) +
      text +
      card(W.history, '<ul class="list">' + hist.map((h) => '<li><span>' + esc(said(h.command)) + ' <span class="muted">' + esc(say(W.by, { who: h.client || h.actor === me.person.id && me.person.name || h.actor, door: h.door })) + ' · ' + esc(time(h.at)) + '</span></span>' +
        (h.undoneBy ? '<span class="badge">' + esc(W.undone) + '</span>' : h.command === 'journal.undo' ? '' : '<button class="quiet" data-undo="' + h.id + '">' + esc(W.undo) + '</button>') + '</li>').join('') + '</ul>', true) +
      '</section>' + (await hasRelations(e.kind) ? '<h2 style="margin:20px 0 8px">' + esc(W.relations) + '</h2>' + frame('/app/frame/record/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space)) : '');
  },

  async documents () {
    const r = await api(inSpace('/query'), { method: 'POST', body: { sql: "select id, kind, title, length(data->>'text') as taille, updated_at from my_entries where length(data->>'text') > 400 and archived_at is null order by updated_at desc limit 300" } });
    return card('', r.rows.length ? '<div class="scroll"><table class="rows"><thead><tr><th>' + esc(W.title) + '</th><th>' + esc(W.kind) + '</th><th class="n">' + esc(W.size) + '</th><th>' + esc(W.updated) + '</th></tr></thead><tbody>' +
      r.rows.map((d) => '<tr data-go="#/document/' + esc(d.id) + '"><td>' + esc(d.title) + '</td><td><span class="badge">' + esc(d.kind) + '</span></td><td class="n num">' + esc(say(W.chars, { n: num(d.taille) })) + '</td><td class="muted">' + esc(day(d.updated_at)) + '</td></tr>').join('') +
      '</tbody></table></div>' : empty(), true);
  },

  async document (params, id) {
    return '<p><a class="link" href="#/entree/' + esc(id) + '">← ' + esc(W.fields) + ', ' + esc(W.links) + '</a></p>' + frame('/app/frame/document/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space));
  },

  async tableaux (params) {
    const id = params.get('id');
    if (id) return '<p><a class="link" href="#/tableaux">← ' + esc(W.back) + '</a></p>' + frame('/app/frame/dashboard/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space));
    const list = await api(inSpace('/entries?kind=' + encodeURIComponent('Dashboard')));
    return list.length ? '<section class="grid">' + list.map((d) => card(d.title, '<p class="muted">' + esc(day(d.updatedAt)) + '</p><a class="link" href="#/tableaux?id=' + esc(d.id) + '">' + esc(W.open) + ' →</a>')).join('') + '</section>' : card('', empty(W.noDashboards));
  },
};
`;
