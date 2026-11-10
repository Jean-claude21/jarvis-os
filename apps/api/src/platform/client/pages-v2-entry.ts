// I3 / C1 — an entry's card, drawn in J-C's mockup: « what has Jarvis kept, exactly? » Its fields in
// its model's order with their labels, dates in her words, each value corrected in place (written
// « said »), its links as sentences, the apps it touches, its notes, its history (undone from here),
// and « see the structure ».
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no dollar-brace, and every backslash written twice.

export const v2Entry = `
let showStructure = false;
// A field's label: her model's, else the usual one of the engine's words, else its name.
const labelOf = (model, name) => { const l = fieldLabelOf(model, name); return l !== name ? l : W['lbl_' + name] || name; };
const DATE_ONLY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const DATE_TIME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}/;
// A value as she reads it: a date in words, an amount with its currency, a choice by its label.
function shown(model, name, v, data) {
  if (v === null || v === undefined || v === '') return '—';
  const f = model && model.fields.find((x) => x.name === name);
  if (typeof v === 'string' && DATE_ONLY.test(v)) return new Date(v + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (typeof v === 'string' && DATE_TIME.test(v)) return new Date(v.length === 16 ? v + ':00' : v).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  if (f && f.type === 'amount' && typeof v === 'number') return money2(v, data.currency);
  if (typeof v === 'number') return num(v);
  if (typeof v === 'boolean') return v ? W.yes : W.no;
  if (f && f.type === 'choice') return optionLabelOf(model, name, v);
  if (Array.isArray(v)) return v.map((x) => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
// What she types, back to the value Jarvis keeps: a number stays a number.
function typed(model, name, text, before) {
  const f = model && model.fields.find((x) => x.name === name);
  const t = text.trim();
  if (((f && ['number', 'amount', 'duration'].includes(f.type)) || typeof before === 'number') && /^-?[0-9 ]+([.,][0-9]+)?$/.test(t)) return Number(t.replace(/ /g, '').replace(',', '.'));
  if (typeof before === 'boolean') return [W.yes.toLowerCase(), 'true', 'oui', 'yes'].includes(t.toLowerCase());
  return t;
}

Object.assign(v2Pages, {
  async entree (params, id) {
    const [e, hist, notes] = await Promise.all([
      api(inSpace('/entries/' + encodeURIComponent(id))),
      api(inSpace('/history?limit=30&target=' + encodeURIComponent(id))),
      api(inSpace('/entries/' + encodeURIComponent(id) + '/comments')).catch(() => []),
    ]);
    const k = knownKinds.find((one) => one.kind === e.kind);
    const model = k && k.model;
    // Its fields: the model's order first, with their labels; what the model does not know after.
    const order = (model ? model.fields.map((f) => f.name) : []).filter((f) => f in e.data);
    const rest = Object.keys(e.data).filter((f) => !order.includes(f) && !['text', 'source', 'occurrences', 'said'].includes(f));
    const names = order.concat(rest).filter((f) => !(model && (model.fields.find((x) => x.name === f) || {}).type === 'link'));
    const who = (o) => o === 'said' ? W.v2byYou : o === 'read' ? W.v2readFrom : W.v2byJarvis;
    const rows = names.map((f) => '<tr><td class="muted">' + esc(labelOf(model, f)) + '</td><td><b class="x-edit" contenteditable="true" spellcheck="false" data-field="' + esc(f) + '" data-raw="' + esc(typeof e.data[f] === 'object' && e.data[f] !== null ? JSON.stringify(e.data[f]) : e.data[f] == null ? '' : String(e.data[f])) + '">' + esc(shown(model, f, e.data[f], e.data)) + '</b></td><td>' + v2origin(e.origin[f] || 'said') + '</td><td><div class="cell-sub">' + esc(who(e.origin[f] || 'said')) + '</div></td></tr>').join('') +
      Object.entries(e.computed || {}).map(([f, v]) => '<tr><td class="muted">' + esc(labelOf(model, f)) + '</td><td><b>' + esc(v === null ? '—' : typeof v === 'number' ? num(v) : String(v)) + '</b></td><td><span class="origin inferred">' + esc(W.v2computed) + '</span></td><td><div class="cell-sub">' + esc(W.v2formula) + '</div></td></tr>').join('');
    // Its links, as sentences: « payé avec Mobile money A · Compte ».
    const roleWords = (r) => W['role_' + r] || String(r).replace(/_/g, ' ');
    const sentence = (l, out) => '<a href="#/entree/' + esc(l.entry.id) + '">' + ic(out ? 'i-link' : 'i-left') + '<span>' + esc(out ? roleWords(l.role) : say(W.v2linkedBy, { role: roleWords(l.role) })) + ' <b>' + esc(l.entry.title) + '</b> <em>· ' + esc(kindName(l.entry.kind)) + '</em></span></a>';
    const links = e.links.out.filter((l) => l.entry.kind !== 'Comment').map((l) => sentence(l, true)).concat(e.links.in.filter((l) => l.entry.kind !== 'Comment').map((l) => sentence(l, false)));
    // The apps it touches: its own, and those of what it is linked to.
    const appOf = (kind) => { const one = knownKinds.find((x) => x.kind === kind); return one && one.model && one.model.app; };
    const apps = [...new Set([appOf(e.kind)].concat(e.links.out.concat(e.links.in).map((l) => appOf(l.entry.kind))).filter(Boolean))];
    const story = hist.length ? '<div class="pad"><ul class="x-tl">' + hist.map((h) => '<li><time>' + esc(new Date(h.at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</time><i' + (h.undoneBy ? ' style="background:var(--rule)"' : h.door === 'web' ? ' style="background:var(--info)"' : '') + '></i><span>' + esc(said(h.command)) + (h.undoneBy ? ' · ' + esc(W.undone) : '') + '<small>' + esc(say(W.by, { who: h.client || (h.actor === me.person.id && me.person.name) || h.actor, door: h.door })) + '</small>' + (h.undoneBy || h.command === 'journal.undo' ? '' : '<button class="btn small" style="margin-top:4px" data-undo="' + h.id + '">' + esc(W.undo) + '</button>') + '</span></li>').join('') + '</ul></div>' : '<div class="pad muted">' + esc(W.v2nothingYet) + '</div>';
    const notesHtml = '<div class="pad" style="display:flex;flex-direction:column;gap:10px">' + notes.map((n) => '<div class="x-q"><span class="cell-sub">' + esc(time(n.createdAt)) + '</span><span>' + esc(n.data.text) + '</span></div>').join('') +
      '<div class="x-q"><textarea id="note-on" placeholder="' + esc(W.v2aNote) + '"></textarea><div style="display:flex;justify-content:flex-end"><button class="btn small" data-note-on="' + esc(e.id) + '">' + ic('i-plus') + esc(W.v2addNote) + '</button></div></div></div>';
    let text = '';
    if (typeof e.data.text === 'string') {
      const d = await api(inSpace('/documents/' + encodeURIComponent(id)));
      text = v2panel(W.text, '<div class="pad"><div class="doc">' + d.html + '</div></div>', '<a class="btn small" href="#/document/' + esc(id) + '">' + esc(W.open) + '</a>', 'i-doc');
    }
    const structure = JSON.stringify({ kind: e.kind, title: e.title, space: spaceName(), data: e.data, origin: e.origin, links: e.links.out.map((l) => ({ role: l.role, to: kindName(l.entry.kind) + ' · ' + l.entry.title })).concat(e.links.in.map((l) => ({ role: '← ' + l.role, from: kindName(l.entry.kind) + ' · ' + l.entry.title }))) }, null, 2);
    const created = hist.length ? hist[hist.length - 1] : null;
    const sub = kindName(e.kind) + ' · ' + spaceName() + (created ? ' · ' + say(W.v2keptOn, { when: time(created.at), who: created.client || created.door }) : '') + (e.archivedAt ? ' · ' + W.archived : '');
    const lead = '<span class="app-icon" style="background:' + appColor(apps[0] || e.kind) + ';color:var(--on-primary);font:700 12px/1 Archivo,sans-serif">' + esc(String(apps[0] || kindName(e.kind)).slice(0, 1).toUpperCase()) + '</span>';
    return v2head(esc(e.title), esc(sub), '<button class="btn" data-structure>' + ic('i-shape') + esc(showStructure ? W.v2hideStructure : W.v2seeStructure) + '</button>' + (e.archivedAt ? '' : '<button class="btn" id="aside">' + esc(W.setAside) + '</button>'), lead) +
      (apps.length ? '<div class="chips" style="margin:-4px 0 4px"><span class="muted" style="font-size:13px;align-self:center">' + esc(W.v2touchedBy) + '</span>' + apps.map((a) => v2touch(a, '#/app/' + encodeURIComponent(a))).join('') + '</div>' : '') +
      '<div class="x-grid">' +
      v2panel(W.v2whatKept, rows ? '<div class="scroll"><table><thead><tr><th>' + esc(W.v2field) + '</th><th>' + esc(W.v2value) + '</th><th>' + esc(W.v2originH) + '</th><th>' + esc(W.v2who) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="pad muted" style="font-size:12.5px">' + esc(W.v2clickToFix) + '</div>' : '<div class="pad muted">' + esc(W.v2noField) + '</div>', '', 'i-life') +
      '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
      v2panel(W.v2linkedTo, links.length ? '<div class="pad x-rel">' + links.join('') + '</div>' : '<div class="pad muted">' + esc(W.v2noLink) + '</div>', '', 'i-link') +
      v2panel(W.v2notes, notesHtml, '', 'i-chat') +
      v2panel(W.v2itsStory, story, '', 'i-history') +
      '</div></div>' + text +
      (showStructure ? v2panel(W.v2structure, '<div class="pad"><pre class="x-tech">' + esc(structure) + '</pre><p class="muted" style="font-size:12.5px;margin:10px 0 0">' + esc(W.v2structureNote) + '</p></div>', '', 'i-shape') : '') +
      (await hasRelations(e.kind) ? v2panel(W.relations, frame('/app/frame/record/' + encodeURIComponent(id) + '?space=' + encodeURIComponent(space)), '', 'i-link') : '');
  },
});

// What the card does: a value corrected in place, a note added, the structure shown.
function bindEntry(root) {
  const toggle = root.querySelector('[data-structure]');
  if (toggle) toggle.addEventListener('click', () => { showStructure = !showStructure; show(); });
  const id = (location.hash.match(/entree[/]([^?]+)/) || [])[1];
  root.querySelectorAll('.x-edit[data-field]').forEach((el) => {
    // Read in her words; corrected as Jarvis keeps it (« 2026-11-12 »), so nothing turns into words.
    const words = el.textContent;
    const raw = el.dataset.raw;
    let cancelled = false;
    el.addEventListener('focus', () => { cancelled = false; el.textContent = raw; });
    el.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); el.blur(); } if (event.key === 'Escape') { cancelled = true; el.blur(); } });
    el.addEventListener('blur', async () => {
      const now = el.textContent.trim();
      if (cancelled || now === raw.trim() || !id) { el.textContent = words; return; }
      const before = words;
      const entry = await api(inSpace('/entries/' + id));
      const k = knownKinds.find((one) => one.kind === entry.kind);
      const field = el.dataset.field;
      try {
        await api(inSpace('/save'), { method: 'POST', body: { entries: [{ id: decodeURIComponent(id), data: { [field]: typed(k && k.model, field, now, entry.data[field]) }, origin: 'said' }] } });
        toast(say(W.v2fixed, { field: labelOf(k && k.model, field) }), { id: decodeURIComponent(id), spaceId: space }); show();
      } catch (error) { el.textContent = before; alert(error.message); }
    });
  });
  const add = root.querySelector('[data-note-on]');
  if (add) add.addEventListener('click', async () => {
    const text = root.querySelector('#note-on').value.trim();
    if (!text) return;
    add.disabled = true;
    try { await api(inSpace('/entries/' + encodeURIComponent(add.dataset.noteOn) + '/comments'), { method: 'POST', body: { text } }); toast(W.v2noteKept, null); show(); } catch (error) { add.disabled = false; alert(error.message); }
  });
}
`;
