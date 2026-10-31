// After a page is drawn, what its buttons, forms and drags do.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no `${`, and every backslash written twice.

export const bind = `
// What every page may hold: rows to open, undo, spaces and invitations, connections, import.
function bindCommon(root) {
  root.querySelectorAll('[data-go]').forEach((row) => row.addEventListener('click', (event) => { if (event.target.closest('input, a, button')) return; location.hash = row.dataset.go; }));
  root.querySelectorAll('a[data-space]').forEach((a) => a.addEventListener('click', () => choose(a.dataset.space, false)));
  root.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await api(inSpace('/undo'), { method: 'POST', body: { journalId: Number(b.dataset.undo) } }); show(); } catch (error) { fail(error); }
  }));
  const aside = document.getElementById('aside');
  if (aside) aside.addEventListener('click', async () => {
    const id = location.hash.split('/')[2];
    if (!confirm(say(W.setAsideAsk, { title: document.querySelector('.page h1').textContent }))) return;
    try { await api(inSpace('/entries/' + id + '/archive'), { method: 'POST' }); show(); } catch (error) { fail(error); }
  });
  root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = W.copied; } catch {}
  }));
  root.querySelectorAll('form[data-invite]').forEach((f) => f.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = f.querySelector('input').value;
    try {
      const made = await api('/spaces/' + encodeURIComponent(f.dataset.invite) + '/invitations', { method: 'POST', body: { email } });
      root.querySelector('[data-link="' + f.dataset.invite + '"]').innerHTML = '<p class="muted">' + esc(say(W.inviteLink, { email })) + '</p><div class="actions"><code class="url">' + esc(made.link) + '</code><button class="quiet" id="copy-invite">' + esc(W.copy) + '</button></div>';
      document.getElementById('copy-invite').addEventListener('click', async (e) => { await navigator.clipboard.writeText(made.link); e.target.textContent = W.copied; });
    } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
    const [s, i] = b.dataset.withdraw.split('/');
    try { await api('/spaces/' + s + '/invitations/' + i, { method: 'DELETE' }); show(); } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', async () => {
    const name = prompt(W.newName, b.dataset.name); if (!name) return;
    try { await api('/spaces/' + b.dataset.rename, { method: 'PATCH', body: { name } }); await load(); show(); } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-leave]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(say(W.leaveAsk, { space: b.dataset.name }))) return;
    try { await api('/spaces/' + b.dataset.leave + '/members/me', { method: 'DELETE' }); await load(); show(); } catch (error) { alert(error.message); }
  }));
  const created = document.getElementById('new-space');
  if (created) created.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await api('/spaces', { method: 'POST', body: { name: created.querySelector('input').value } }); await load(); show(); } catch (error) { alert(error.message); }
  });
  root.querySelectorAll('form[data-reach]').forEach((f) => f.addEventListener('submit', async (event) => {
    event.preventDefault();
    const spaces = [...f.querySelectorAll('input:checked')].map((i) => i.value);
    try { await api('/clients/' + encodeURIComponent(f.dataset.reach) + '/spaces', { method: 'PUT', body: { spaces } }); f.querySelector('button').textContent = W.saved; } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(say(W.revokeAsk, { client: b.dataset.name }))) return;
    try { await api('/connections/' + encodeURIComponent(b.dataset.revoke), { method: 'DELETE' }); show(); } catch (error) { alert(error.message); }
  }));
  const folder = document.getElementById('folder');
  if (folder) {
    let docs = [];
    folder.addEventListener('change', async () => {
      const files = [...folder.files].filter((f) => /\\.md$/i.test(f.name) && !/(^|\\/)(\\.|node_modules\\/)/.test(f.webkitRelativePath));
      docs = await Promise.all(files.map(async (f) => ({ path: f.webkitRelativePath.split('/').slice(1).join('/'), text: await f.text() })));
      const run = document.getElementById('import'); run.disabled = !docs.length; run.textContent = say(W.importRun, { n: docs.length });
    });
    document.getElementById('import').addEventListener('click', async (event) => {
      event.target.disabled = true;
      const report = document.getElementById('report');
      try {
        const raw = document.getElementById('kinds').value.trim();
        const done = await api(inSpace('/import'), { method: 'POST', body: Object.assign({ docs }, raw ? { kinds: JSON.parse(raw) } : {}) });
        report.innerHTML = '<p>' + esc(say(W.importDone, done)) + '</p>' + (done.journalId ? '<button class="quiet" data-undo="' + done.journalId + '">' + esc(W.importUndo) + '</button>' : '');
        bind();
      } catch (error) { report.innerHTML = '<p class="error-text">' + esc(say(W.failed, { reason: error.message })) + '</p>'; event.target.disabled = false; }
    });
  }
}

// Her views (spec 015): each change runs the view again; saving keeps it as an entry « View ».
function bindViews(root) {
  const ex = explorerNow;
  const change = (patch) => { if (!ex) return; Object.assign(ex.st.view, patch(Object.assign({ filters: [], sort: [] }, ex.r.view))); show(); };
  root.querySelectorAll('[data-vtype]').forEach((b) => b.addEventListener('click', () => change(() => ({ type: b.dataset.vtype }))));
  root.querySelectorAll('[data-vdel]').forEach((b) => b.addEventListener('click', () => change((v) => ({ filters: v.filters.filter((_, i) => i !== Number(b.dataset.vdel)) }))));
  root.querySelectorAll('[data-vsort]').forEach((s) => s.addEventListener('change', () => change(() => ({ sort: s.value ? [{ field: s.value, desc: false }] : [] }))));
  root.querySelectorAll('[data-vdir]').forEach((b) => b.addEventListener('click', () => change((v) => ({ sort: v.sort.length ? [{ field: v.sort[0].field, desc: !v.sort[0].desc }] : [] }))));
  root.querySelectorAll('[data-vhead]').forEach((th) => th.addEventListener('click', () => change((v) => ({ sort: [{ field: th.dataset.vhead, desc: v.sort[0] && v.sort[0].field === th.dataset.vhead ? !v.sort[0].desc : false }] }))));
  root.querySelectorAll('[data-vgroup]').forEach((s) => s.addEventListener('change', () => change(() => ({ groupBy: s.value || undefined }))));
  root.querySelectorAll('[data-vmonth]').forEach((b) => b.addEventListener('click', () => {
    const [y, m] = ex.st.month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + Number(b.dataset.vmonth), 1));
    ex.st.month = d.toISOString().slice(0, 7); show();
  }));
  root.querySelectorAll('[data-vfilter]').forEach((b) => b.addEventListener('click', () => {
    const fieldOf = (path) => ex.r.fields.find((f) => f.path === path) || { type: 'text' };
    const opsFor = (t) => ['amount', 'number', 'formula'].includes(t) ? ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty']
      : ['date', 'datetime'].includes(t) ? ['eq', 'gt', 'lt', 'this_month', 'last_days', 'empty', 'not_empty']
      : t === 'choice' ? ['eq', 'ne', 'empty', 'not_empty'] : t === 'boolean' ? ['eq'] : ['contains', 'not_contains', 'eq', 'ne', 'empty', 'not_empty'];
    const label = (f) => { const path = f.via && f.path.endsWith('.title') ? f.path.slice(0, -6) : f.path; const o = document.querySelector('[data-vsort] option[value="' + CSS.escape(path) + '"]'); return o ? o.textContent : f.path; };
    openDrawer(W.filter, '<div class="form-field"><label>' + esc(W.field) + '</label><select id="vf_field">' + ex.r.fields.filter((f) => f.type !== 'link').map((f) => '<option value="' + esc(f.path) + '">' + esc(label(f)) + '</option>').join('') + '</select></div>' +
      '<div class="form-field"><label>' + esc(W.condition) + '</label><select id="vf_op"></select></div><div class="form-field" id="vf_valuebox"><label>' + esc(W.value) + '</label><span id="vf_value"></span></div>',
      '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="vf_apply">' + esc(W.apply) + '</button>');
    const field = document.getElementById('vf_field'), op = document.getElementById('vf_op');
    const refresh = () => {
      const f = fieldOf(field.value);
      op.innerHTML = opsFor(f.type).map((o) => '<option value="' + o + '">' + esc(W['op_' + o]) + '</option>').join('');
      const value = () => {
        const box = document.getElementById('vf_value');
        document.getElementById('vf_valuebox').style.display = ['empty', 'not_empty', 'this_month'].includes(op.value) ? 'none' : '';
        box.innerHTML = f.type === 'choice' ? '<select id="vf_v">' + (f.options || []).map((o) => '<option value="' + esc(o) + '">' + esc(f.optionLabels && f.optionLabels[o] ? tr(f.optionLabels[o]) : o) + '</option>').join('') + '</select>'
          : f.type === 'boolean' ? '<select id="vf_v"><option value="true">✓</option><option value="false">—</option></select>'
          : '<input id="vf_v" type="' + (op.value === 'last_days' || ['amount', 'number', 'formula'].includes(f.type) ? 'number' : ['date', 'datetime'].includes(f.type) ? 'date' : 'text') + '" step="any">';
      };
      op.onchange = value; value();
    };
    field.onchange = refresh; refresh();
    document.getElementById('vf_apply').addEventListener('click', () => {
      const f = fieldOf(field.value); const el = document.getElementById('vf_v'); let value = el ? el.value : undefined;
      if (f.type === 'boolean') value = value === 'true';
      else if (value !== undefined && value !== '' && (op.value === 'last_days' || ['amount', 'number', 'formula'].includes(f.type))) value = Number(value);
      closeDrawer(); change((v) => ({ filters: v.filters.concat([{ field: field.value, op: op.value, ...(value === undefined || value === '' ? {} : { value }) }]) }));
    });
  }));
  root.querySelectorAll('[data-vcols]').forEach((b) => b.addEventListener('click', () => {
    const on = new Set(ex.r.columns);
    const label = (f) => { const o = document.querySelector('[data-vsort] option[value="' + CSS.escape(f.path) + '"]'); return o ? o.textContent : f.path; };
    openDrawer(W.columns, ex.r.fields.filter((f) => f.path !== 'title').map((f) => '<label class="check"><input type="checkbox" value="' + esc(f.path) + '"' + (on.has(f.path) ? ' checked' : '') + '> ' + esc(label(f)) + '</label>').join(''),
      '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="vc_apply">' + esc(W.apply) + '</button>');
    document.getElementById('vc_apply').addEventListener('click', () => {
      const columns = [...document.querySelectorAll('.drawer input[type=checkbox]:checked, #drawer input[type=checkbox]:checked')].map((i) => i.value);
      closeDrawer(); change(() => ({ columns }));
    });
  }));
  const keep = async (id) => {
    const view = Object.assign({}, ex.r.view, { kind: ex.kind }, ex.name ? { app: ex.name } : {});
    delete view.limit;
    if (id) { await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id, data: view }] } }); toast(W.viewUpdated, null); delete explorers[ex.key]; show(); return; }
    const title = prompt(W.viewName); if (!title) return;
    const saved = await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: 'View', title, data: Object.assign(view, { label: { [LANG]: title } }) }] } });
    location.hash = '#/app/' + encodeURIComponent(ex.name) + '?view=' + encodeURIComponent(saved.entries[0].id);
  };
  root.querySelectorAll('[data-vsave]').forEach((b) => b.addEventListener('click', () => keep(null).catch((e) => alert(e.message))));
  root.querySelectorAll('[data-vupdate]').forEach((b) => b.addEventListener('click', () => keep(ex.st.id).catch((e) => alert(e.message))));
  if (ex && ex.r.type === 'map') drawMap().catch(() => undefined);
  root.querySelectorAll('[data-press]').forEach((b) => b.addEventListener('click', async (event) => {
    event.stopPropagation();
    b.disabled = true;
    try {
      await api(inSpace('/entries/' + encodeURIComponent(b.dataset.id) + '/press'), { method: 'POST', body: { field: b.dataset.press } });
      toast(W.pressed, { id: b.dataset.id, spaceId: space }); show();
    } catch (error) { b.disabled = false; alert(error.message); }
  }));
  root.querySelectorAll('[data-vcard]').forEach((c) => c.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/plain', c.dataset.vcard); }));
  root.querySelectorAll('[data-vdrop]').forEach((col) => {
    col.addEventListener('dragover', (event) => { event.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', async (event) => {
      event.preventDefault(); col.classList.remove('over');
      const id = event.dataTransfer.getData('text/plain'); if (!id || col.dataset.vdrop === '—') return;
      try {
        await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id, data: { [ex.r.kanban.by]: col.dataset.vdrop } }] } });
        toast(W.moved, { id, spaceId: space }); show();
      } catch (error) { alert(error.message); }
    });
  });
}

// What she does on an entry: pick, act, files, areas, her zone, keys, Telegram, models, add.
function bindActions(root) {
  root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { pick = b.dataset.pick; reading = true; show(); }));
  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { reading = false; show(); }));
  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.id; const spaceId = b.dataset.space;
    try {
      const e = await api('/entries/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(spaceId));
      const data = {};
      const act = b.dataset.act;
      if (act === 'done') data.status = 'done';
      if (act === 'cancel' || act === 'refuse') data.status = 'cancelled';
      if (act === 'accept' || act === 'retry') data.status = 'planned';
      if (act === 'retry' && e.data.error !== undefined) data.error = null;
      if (act === 'later') {
        for (const f of ['at', 'due', 'start', 'end']) if (typeof e.data[f] === 'string') data[f] = dayLater(e.data[f]);
      }
      await api('/save?space=' + encodeURIComponent(spaceId), { method: 'POST', body: { entries: [{ id, data }] } });
      pick = null; reading = false;
      toast(say(W.doneToast, { title: e.title, what: W['t_' + act] }), { id, spaceId });
      show();
    } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', async (event) => {
    event.preventDefault();
    const id = b.dataset.file;
    const files = await api(inSpace('/files'));
    const f = files.find((one) => one.entryId === id); if (!f) return;
    const src = '/api/files/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space);
    let view = '';
    if (f.mediaType.startsWith('image/')) view = '<img alt="" src="' + esc(src) + '">';
    else if (f.mediaType === 'application/pdf') view = '<iframe src="' + esc(src) + '"></iframe>';
    else if (f.read) view = '<pre>' + esc((await (await fetch(src, { credentials: 'same-origin' })).text()).slice(0, 20000)) + '</pre>';
    else view = '<p class="muted">' + esc(W.noPreview) + '</p>';
    openDrawer(f.name, view + '<div class="field-row"><span class="caps">' + esc(W.added) + '</span><span>' + esc(time(f.createdAt)) + '</span><span></span></div>' +
      '<div class="field-row"><span class="caps">' + esc(W.kind) + '</span><span>' + esc(f.mediaType) + '</span><span></span></div>' +
      (f.links.length ? '<div class="chips">' + f.links.map((l) => '<a class="chip" href="#/entree/' + esc(l.id) + '">' + esc(l.title) + '<small>' + esc(l.role) + '</small></a>').join('') + '</div>' : ''),
      '<a class="badge" href="#/entree/' + esc(id) + '">' + esc(W.fullEntry) + '</a><a class="badge primary" href="' + esc(src) + '&download=1">' + esc(W.download) + '</a>');
  }));
  root.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', async () => {
    const area = prompt(say(W.fileInAsk, { app: b.dataset.area }));
    if (area === null) return;
    try { await api(inSpace('/apps/area'), { method: 'POST', body: { app: b.dataset.area, area: area.trim() } }); await drawApps(); show(); }
    catch (error) { alert(error.message); }
  }));
  const zoneSelect = document.getElementById('zone');
  if (zoneSelect) zoneSelect.addEventListener('change', async () => {
    try { await api('/me/zone', { method: 'POST', body: { zone: zoneSelect.value } }); toast(say(W.zoneSaved, { zone: zoneSelect.value }), null); }
    catch (error) { alert(error.message); }
  });
  const keyNew = document.getElementById('key-new');
  if (keyNew) keyNew.addEventListener('click', async () => {
    const name = prompt(W.keyName); if (!name) return;
    try {
      const made = await api('/me/keys', { method: 'POST', body: { name } });
      await show();
      document.getElementById('newkey').innerHTML = '<p class="badge read" style="white-space:normal">' + esc(W.keyOnce) + '</p><p><code class="url">' + esc(made.key) + '</code></p>';
    } catch (error) { alert(error.message); }
  });
  root.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(W.keyRevokeAsk)) return;
    try { await api('/me/keys/' + encodeURIComponent(b.dataset.revoke), { method: 'DELETE' }); show(); } catch (error) { alert(error.message); }
  }));
  // Her morning brief (spec 018): its hour, kept with her preferences; read or sent now.
  const briefAt = document.getElementById('brief-at');
  if (briefAt) {
    const keepBrief = (at) => { keepPrefs({ brief: at }); toast(at ? say(W.briefSaved, { at }) : W.briefOff, null); show(); };
    briefAt.addEventListener('change', () => { if (briefAt.value) keepBrief(briefAt.value); });
    document.getElementById('brief-off').addEventListener('click', () => keepBrief(null));
    document.getElementById('brief-show').addEventListener('click', async () => {
      try { const made = await api('/me/brief'); openDrawer(W.briefTitle, '<pre class="brief">' + esc(made.text) + '</pre>'); } catch (error) { alert(error.message); }
    });
    const send = document.getElementById('brief-send');
    if (send) send.addEventListener('click', async () => {
      try { const done = await api('/me/brief', { method: 'POST', body: {} }); toast(done.sent ? W.briefSent : W.briefNotSent, null); } catch (error) { alert(error.message); }
    });
  }
  const tgLink = document.getElementById('tg-link');
  if (tgLink) tgLink.addEventListener('click', async () => {
    try {
      const made = await api('/me/telegram', { method: 'POST', body: {} });
      document.getElementById('tg').innerHTML = '<p><a class="badge primary" target="_blank" rel="noopener" href="' + esc(made.link) + '">' + esc(W.telegramOpen) + '</a></p><p class="muted">' + esc(say(W.telegramThen, { minutes: made.minutes })) + '</p>';
    } catch (error) { alert(error.message); }
  });
  root.querySelectorAll('[data-role]').forEach((sel) => sel.addEventListener('change', async () => {
    const [spaceId, person] = sel.dataset.role.split('/');
    try { await api('/spaces/' + encodeURIComponent(spaceId) + '/members/' + encodeURIComponent(person) + '/role', { method: 'POST', body: { role: sel.value } }); toast(W.saved, null); }
    catch (error) { alert(error.message); show(); }
  }));
  root.querySelectorAll('[data-install]').forEach((b) => b.addEventListener('click', async () => {
    const name = b.dataset.install;
    try {
      const tried = await api(inSpace('/apps/install'), { method: 'POST', body: { name } });
      openDrawer(say(W.installWhat, { app: name }), '<ul class="list">' + tried.result.created.map((one) => '<li>' + esc(one) + '</li>').join('') + '</ul>' +
        (tried.result.kept.length ? '<p class="muted">' + esc(say(W.installKept, { n: tried.result.kept.length })) + '</p>' : '') + '<p class="error-text" id="i__error"></p>',
        '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="i__go">' + esc(W.install) + '</button>');
      document.getElementById('i__go').addEventListener('click', async () => {
        try {
          await api(inSpace('/apps/install'), { method: 'POST', body: { name, dryRun: false } });
          closeDrawer(); toast(say(W.installedToast, { app: name }), null); await drawApps(); location.hash = '#/app/' + encodeURIComponent(name);
        } catch (error) { document.getElementById('i__error').textContent = error.message; }
      });
    } catch (error) { alert(error.message); }
  }));
  root.querySelectorAll('[data-model]').forEach((b) => b.addEventListener('click', async () => {
    const k = (await api(inSpace('/kinds'))).find((one) => one.kind === b.dataset.model);
    if (!k || !k.model) return;
    openDrawer(say(W.modelOf, { kind: kindLabel(k) }), '<p class="muted">' + esc(W.modelLead) + '</p>' + k.model.fields.map((c) =>
      '<div class="field-row"><span class="caps">' + esc(fieldLabelOf(k.model, c.name)) + '</span><span>' + esc((W['ty_' + c.type] || c.type) + (c.options ? ' : ' + c.options.map((o) => optionLabelOf(k.model, c.name, o)).join(', ') : '') + (c.target ? ' → ' + c.target : '') + (c.formula ? ' = ' + c.formula : '') + (c.unit ? ' (' + c.unit + ')' : '')) + '</span><span class="badge">' + esc(c.type === 'formula' ? W.computedBadge : c.required ? W.required : W.optional) + '</span></div>').join('') +
      (k.model.workflow ? '<p><span class="caps">' + esc(W.workflow) + '</span><br>' + k.model.workflow.transitions.map((t) => esc([t.from].flat().join(' | ') + ' → ' + t.to + (t.if ? ' (' + t.if + ')' : ''))).join('<br>') + '</p>' : '') +
      (k.model.path ? '<p><span class="caps">' + esc(W.rangement) + '</span><br><code class="url">' + esc(k.model.path) + '</code></p>' : ''),
      '<a class="badge" href="#/entree/' + esc(k.model.id) + '">' + esc(W.fullEntry) + '</a>');
  }));
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', async () => {
    const k = (await api(inSpace('/kinds'))).find((one) => one.kind === b.dataset.add);
    if (!k || !k.model) return;
    const fields = k.model.fields.filter((c) => !['list', 'formula', 'lines', 'button'].includes(c.type));
    const targets = {};
    for (const c of fields) if (c.type === 'link' && c.target) targets[c.name] = await api(inSpace('/entries?limit=200&kind=' + encodeURIComponent(c.target)));
    const files = fields.some((c) => c.type === 'file') ? await api(inSpace('/files')) : [];
    const input = (c) => {
      const id = 'f_' + c.name;
      if (c.type === 'link') return '<select id="' + id + '"' + (c.cardinality === 'many' ? ' multiple' : '') + '><option value=""></option>' + (targets[c.name] || []).map((o) => '<option value="' + esc(o.id) + '">' + esc(o.title) + '</option>').join('') + '</select>';
      if (c.type === 'choice') return '<select id="' + id + '"><option value=""></option>' + c.options.map((o) => '<option value="' + esc(o) + '">' + esc(optionLabelOf(k.model, c.name, o)) + '</option>').join('') + '</select>';
      if (c.type === 'boolean') return '<select id="' + id + '"><option value=""></option><option value="true">✓</option><option value="false">—</option></select>';
      // The types of every day (spec 016).
      if (c.type === 'multi_choice') return '<div id="' + id + '" class="checks">' + c.options.map((o) => '<label class="check"><input type="checkbox" value="' + esc(o) + '"> ' + esc(optionLabelOf(k.model, c.name, o)) + '</label>').join('') + '</div>';
      if (c.type === 'rating') return '<select id="' + id + '"><option value=""></option>' + Array.from({ length: (typeof c.max === 'number' ? c.max : 5) + 1 }, (_, n) => '<option value="' + n + '">' + ('★'.repeat(n) || '0') + '</option>').join('') + '</select>';
      if (c.type === 'progress') return '<input id="' + id + '" type="number" min="0" max="100" step="1" placeholder="0–100">';
      if (c.type === 'long_text') return '<textarea id="' + id + '" rows="4"></textarea>';
      if (c.type === 'file') return '<select id="' + id + '"><option value=""></option>' + files.map((f) => '<option value="' + esc(f.entryId) + '">' + esc(f.name) + '</option>').join('') + '</select>';
      if (c.type === 'location') return '<div id="' + id + '" class="loc"><input data-part="address" placeholder="' + esc(W.address) + '"><input data-part="lat" type="number" step="any" placeholder="lat"><input data-part="lng" type="number" step="any" placeholder="lng"><button type="button" class="quiet mini" data-here>' + esc(W.here) + '</button></div>';
      const type = c.type === 'date' ? 'date' : c.type === 'datetime' ? 'datetime-local' : c.type === 'time' ? 'time' : c.type === 'url' ? 'url' : c.type === 'email' ? 'email' : c.type === 'phone' ? 'tel' : ['number', 'amount'].includes(c.type) ? 'number' : 'text';
      return '<input id="' + id + '" type="' + type + '"' + (type === 'number' ? ' step="any"' : '') + '>';
    };
    openDrawer(say(W.addOne, { kind: kindLabel(k) }), '<div class="form-field"><label>' + esc(W.title) + ' *</label><input id="f__title"></div>' +
      fields.map((c) => '<div class="form-field"><label>' + esc(fieldLabelOf(k.model, c.name) + (c.required ? ' *' : '') + (c.unit ? ' · ' + c.unit : '')) + '</label>' + input(c) + '</div>').join('') + '<p class="error-text" id="f__error"></p>',
      '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="f__save">' + esc(W.save) + '</button>');
    document.querySelectorAll('[data-here]').forEach((b) => b.addEventListener('click', () => {
      const box = b.parentElement;
      navigator.geolocation.getCurrentPosition((p) => {
        box.querySelector('[data-part=lat]').value = p.coords.latitude.toFixed(6);
        box.querySelector('[data-part=lng]').value = p.coords.longitude.toFixed(6);
      }, (e) => alert(e.message));
    }));
    document.getElementById('f__save').addEventListener('click', async () => {
      const data = {};
      for (const c of fields) {
        const el = document.getElementById('f_' + c.name);
        if (c.type === 'multi_choice') {
          const picked = [...el.querySelectorAll('input:checked')].map((i) => i.value);
          if (picked.length) data[c.name] = picked;
          continue;
        }
        if (c.type === 'location') {
          const part = (n) => el.querySelector('[data-part=' + n + ']').value.trim();
          if (part('lat') && part('lng')) data[c.name] = Object.assign({ lat: Number(part('lat')), lng: Number(part('lng')) }, part('address') ? { address: part('address') } : {});
          continue;
        }
        if (c.type === 'link' && c.cardinality === 'many') {
          const picked = [...el.selectedOptions].map((o) => o.value).filter(Boolean);
          if (picked.length) data[c.name] = picked;
          continue;
        }
        const v = el.value;
        if (v === '') continue;
        data[c.name] = ['number', 'amount', 'rating', 'progress'].includes(c.type) ? Number(v) : c.type === 'boolean' ? v === 'true' : v;
      }
      try {
        await api(inSpace('/save'), { method: 'POST', body: { entries: [{ kind: k.kind, title: document.getElementById('f__title').value.trim(), data }] } });
        closeDrawer(); toast(say(W.added1, { kind: k.kind }), null); show();
      } catch (error) { document.getElementById('f__error').textContent = error.message; }
    });
  }));
}

// Sharing a collection (spec 016): a public form, or a view to read; the link is shown once. Her
// calendar address; signing out.
function bindAccount(root) {
  root.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    const kind = b.dataset.share;
    const k = (await api(inSpace('/kinds'))).find((one) => one.kind === kind);
    const shares = (await api(inSpace('/shares'))).filter((one) => one.kind === kind || (one.view && one.view.kind === kind));
    const askable = k.model.fields.filter((c) => !['link', 'formula', 'lines', 'button', 'file', 'location', 'list'].includes(c.type));
    openDrawer(W.share, '<p class="muted">' + esc(W.shareLead) + '</p>' +
      '<div class="form-field"><label>' + esc(W.shareName) + '</label><input id="sh_name" value="' + esc(kindLabel(k)) + '"></div>' +
      '<div class="form-field"><label>' + esc(W.shareMode) + '</label><select id="sh_mode"><option value="form">' + esc(W.shareForm) + '</option><option value="view">' + esc(W.shareView) + '</option></select></div>' +
      '<div class="form-field" id="sh_fields"><label>' + esc(W.shareFields) + '</label>' + askable.map((c) => '<label class="check"><input type="checkbox" value="' + esc(c.name) + '" checked> ' + esc(fieldLabelOf(k.model, c.name)) + '</label>').join('') + '</div>' +
      '<div id="sh_link"></div>' +
      (shares.length ? '<h3 style="margin:14px 0 6px">' + esc(W.shareOpen) + '</h3><ul class="list">' + shares.map((one) => '<li><span>' + esc(one.title) + ' <span class="muted">· ' + esc(one.mode === 'form' ? W.shareForm : W.shareView) + '</span></span><button class="quiet mini" data-unshare="' + esc(one.id) + '">' + esc(W.shareClose) + '</button></li>').join('') + '</ul>' : '') +
      '<p class="error-text" id="sh_error"></p>',
      '<button class="quiet" data-close>' + esc(W.cancel) + '</button><button id="sh_make">' + esc(W.shareMake) + '</button>');
    const mode = document.getElementById('sh_mode');
    mode.onchange = () => { document.getElementById('sh_fields').style.display = mode.value === 'form' ? '' : 'none'; };
    document.querySelectorAll('[data-unshare]').forEach((x) => x.addEventListener('click', async () => {
      await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id: x.dataset.unshare, data: { active: false } }] } });
      x.closest('li').remove();
    }));
    document.getElementById('sh_make').addEventListener('click', async () => {
      const ex = explorerNow;
      const data = mode.value === 'form'
        ? { mode: 'form', kind, fields: [...document.querySelectorAll('#sh_fields input:checked')].map((i) => i.value) }
        : { mode: 'view', view: Object.assign({}, ex && ex.kind === kind ? ex.r.view : { kind }, { kind }) };
      try {
        const made = await api(inSpace('/shares'), { method: 'POST', body: { name: document.getElementById('sh_name').value, data } });
        document.getElementById('sh_link').innerHTML = '<p class="badge read" style="white-space:normal">' + esc(W.shareOnce) + '</p><p><code class="url">' + esc(made.link) + '</code></p>';
      } catch (error) { document.getElementById('sh_error').textContent = error.message; }
    });
  }));
  const sub = document.getElementById('subscribe');
  if (sub) sub.addEventListener('click', async () => {
    if (sub.dataset.done && !confirm(W.subscribeAsk)) return;
    try {
      const made = await api('/agenda/address', { method: 'POST', body: {} });
      document.getElementById('address').innerHTML = '<p><code class="url">' + esc(made.url) + '</code></p><div class="actions"><button class="quiet" id="copy-address">' + esc(W.copy) + '</button><a class="badge primary" href="' + esc(made.webcal) + '">' + esc(W.openPhone) + '</a></div>';
      document.getElementById('copy-address').addEventListener('click', async (e) => { await navigator.clipboard.writeText(made.url); e.target.textContent = W.copied; });
      sub.textContent = W.subscribeRenew; sub.dataset.done = '1';
    } catch (error) { alert(error.message); }
  });
  const out = document.getElementById('sign-out');
  if (out) out.addEventListener('click', async () => {
    await fetch('/auth/sign-out', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' });
    location.href = '/connexion';
  });
}

// After each page is drawn, its controls come alive.
function bind() {
  const root = page();
  bindEntries(root);
  bindCommon(root);
  bindViews(root);
  bindActions(root);
  bindAccount(root);
}
`;
