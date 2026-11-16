// Spec 076 — the side card: a click on an entry anywhere opens it beside the page, as Gr8r Studio's
// drawer, without leaving what she was looking at. Its fields with their labels (corrected in place),
// its long texts folded, its web address as a link, its links (opened in the same card), its notes
// and its story; « Ouvrir en grand » for the whole card page. A click with Ctrl or ⌘ still opens the
// page.
// Part of the script of her web account (see `../page.ts`): plain browser JavaScript inside a
// template literal — no dollar-brace, and every backslash written twice.

export const v2Peek = `
let peekAt = null;
const PEEK_LONG = 160;
const isWeb = (v) => typeof v === 'string' && v.slice(0, 4) === 'http' && v.indexOf(' ') < 0 && v.indexOf('://') > 0;
const hostOf = (v) => v.split('://')[1].split('/')[0].replace('www.', '');

async function peek(id, where) {
  const sp = where || space;
  const q = (p) => p + (p.indexOf('?') >= 0 ? '&' : '?') + 'space=' + encodeURIComponent(sp);
  let e; let notes; let hist;
  try {
    [e, notes, hist] = await Promise.all([
      api(q('/entries/' + encodeURIComponent(id))),
      api(q('/entries/' + encodeURIComponent(id) + '/comments')).catch(() => []),
      api(q('/history?limit=12&target=' + encodeURIComponent(id))).catch(() => []),
    ]);
  } catch { location.hash = '#/entree/' + id; return; }
  peekAt = { id, space: sp };
  const k = knownKinds.find((one) => one.kind === e.kind);
  const model = k && k.model;
  const order = (model ? model.fields.map((f) => f.name) : []).filter((f) => f in e.data);
  const rest = Object.keys(e.data).filter((f) => !order.includes(f) && !['text', 'source', 'occurrences', 'said'].includes(f));
  const TIMES = ['start', 'end', 'at', 'due', 'date', 'next'];
  const names = order.concat(rest).filter((f) => !(model && (model.fields.find((x) => x.name === f) || {}).type === 'link')).sort((x, y) => (TIMES.includes(x) ? TIMES.indexOf(x) : 99) - (TIMES.includes(y) ? TIMES.indexOf(y) : 99));
  const raw = (v) => typeof v === 'object' && v !== null ? JSON.stringify(v) : v == null ? '' : String(v);
  const long = (v) => typeof v === 'string' && !isWeb(v) && v.length > PEEK_LONG;
  const props = names.filter((f) => !long(e.data[f])).map((f) => {
    const v = e.data[f];
    const value = isWeb(v)
      ? '<a class="link" data-web target="_blank" rel="noopener" href="' + esc(v) + '">' + esc(hostOf(v)) + ' ↗</a>'
      : '<span class="x-edit" contenteditable="true" spellcheck="false" data-field="' + esc(f) + '" data-raw="' + esc(raw(v)) + '">' + esc(shown(model, f, v, e.data)) + '</span>';
    return '<dt>' + esc(labelOf(model, f)) + '</dt><dd>' + value + '</dd>';
  }).join('');
  const texts = names.filter((f) => long(e.data[f])).map((f) => '<section class="pk-text"><h4>' + esc(labelOf(model, f)) + '</h4><div class="pk-body">' + esc(e.data[f]) + '</div><button class="btn small ghost" data-more>' + esc(W.pkMore) + '</button></section>').join('');
  const roleWords = (r) => W['role_' + r] || String(r).replace(/_/g, ' ');
  const linked = e.links.out.filter((l) => l.entry.kind !== 'Comment').map((l) => [l, true]).concat(e.links.in.filter((l) => l.entry.kind !== 'Comment').map((l) => [l, false]));
  const links = linked.length ? '<ul class="pk-links">' + linked.map(([l, out]) => '<li><span class="muted">' + esc(out ? roleWords(l.role) : say(W.v2linkedBy, { role: roleWords(l.role) })) + '</span> <a href="#/entree/' + esc(l.entry.id) + '" data-space="' + esc(sp) + '">' + esc(l.entry.title) + '</a> <span class="cell-sub">' + esc(kindName(l.entry.kind)) + '</span></li>').join('') + '</ul>' : '<p class="muted pk-none">' + esc(W.v2noLink) + '</p>';
  const noteList = notes.map((n) => '<li><time>' + esc(time(n.createdAt)) + '</time><span>' + esc(n.data.text) + '</span></li>').join('');
  const storyList = hist.map((h) => '<li><time>' + esc(new Date(h.at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</time><span>' + esc(said(h.command)) + ' <small class="muted">' + esc(h.client || h.door || '') + '</small></span></li>').join('');
  const web = names.map((f) => e.data[f]).find(isWeb);
  drawer().innerHTML =
    '<div class="pk-head"><span class="pk-path">' + esc(kindName(e.kind)) + ' · ' + esc(spaceName()) + '</span><span class="pk-acts">' +
      (web ? '<a class="icon-btn" data-web target="_blank" rel="noopener" href="' + esc(web) + '" title="' + esc(W.pkOpenSite) + '" aria-label="' + esc(W.pkOpenSite) + '">↗</a>' : '') +
      '<button class="icon-btn" data-copy title="' + esc(W.pkCopy) + '" aria-label="' + esc(W.pkCopy) + '">' + ic('i-link') + '</button>' +
      '<a class="icon-btn" data-full href="#/entree/' + esc(id) + '" title="' + esc(W.pkFull) + '" aria-label="' + esc(W.pkFull) + '">' + ic('i-panel') + '</a>' +
      '<button class="icon-btn" data-close aria-label="' + esc(W.close || '×') + '"><svg class="i"><use href="#i-x"/></svg></button></span></div>' +
    '<div class="pk-scroll"><h2 class="pk-title">' + esc(e.title) + '</h2>' +
      (props ? '<dl class="pk-props">' + props + '</dl>' : '') + texts +
      '<section class="pk-sec"><h4>' + esc(W.v2linkedTo) + '</h4>' + links + '</section>' +
      '<section class="pk-sec"><div class="pk-tabs" role="tablist"><button role="tab" aria-selected="true" data-tab="notes">' + esc(W.v2notes) + ' <span class="n">' + notes.length + '</span></button><button role="tab" aria-selected="false" data-tab="story">' + esc(W.pkStory) + ' <span class="n">' + hist.length + '</span></button></div>' +
      '<div data-pane="notes"><ul class="pk-list">' + noteList + '</ul><textarea class="field" id="pk-note" rows="2" placeholder="' + esc(W.v2aNote) + '"></textarea><div class="pk-row-end"><button class="btn small" data-note>' + esc(W.v2addNote) + '</button></div></div>' +
      '<div data-pane="story" hidden><ul class="pk-list">' + (storyList || '<li class="muted">' + esc(W.v2nothingYet) + '</li>') + '</ul></div></section>' +
    '</div>';
  drawer().classList.add('open');
  drawer().classList.add('pk');
  document.getElementById('scrim').classList.add('open');
  bindPeek(drawer(), e, model);
}

function bindPeek(root, e, model) {
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  root.querySelectorAll('[data-full]').forEach((a) => a.addEventListener('click', closeDrawer));
  const copy = root.querySelector('[data-copy]');
  if (copy) copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.origin + '/app#/entree/' + e.id); toast(W.pkCopied, null); } catch {} });
  root.querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', () => { const box = b.parentElement; box.classList.toggle('open'); b.textContent = box.classList.contains('open') ? W.pkLess : W.pkMore; }));
  root.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => {
    root.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    root.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t.dataset.tab; });
  }));
  const where = (p) => p + (p.indexOf('?') >= 0 ? '&' : '?') + 'space=' + encodeURIComponent(peekAt.space);
  root.querySelectorAll('.x-edit[data-field]').forEach((el) => {
    const words = el.textContent; const was = el.dataset.raw; let cancelled = false;
    el.addEventListener('focus', () => { cancelled = false; el.textContent = was; });
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); } if (ev.key === 'Escape') { ev.stopPropagation(); cancelled = true; el.blur(); } });
    el.addEventListener('blur', async () => {
      const now = el.textContent.trim();
      if (cancelled || now === was.trim()) { el.textContent = words; return; }
      const field = el.dataset.field;
      try {
        await api(where('/save'), { method: 'POST', body: { entries: [{ id: e.id, data: { [field]: typed(model, field, now, e.data[field]) }, origin: 'said' }] } });
        toast(say(W.v2fixed, { field: labelOf(model, field) }), { id: e.id, spaceId: peekAt.space });
        peek(e.id, peekAt.space);
      } catch (error) { el.textContent = words; alert(error.message); }
    });
  });
  const add = root.querySelector('[data-note]');
  if (add) add.addEventListener('click', async () => {
    const text = root.querySelector('#pk-note').value.trim();
    if (!text) return;
    add.disabled = true;
    try { await api(where('/entries/' + encodeURIComponent(e.id) + '/comments'), { method: 'POST', body: { text } }); toast(W.v2noteKept, null); peek(e.id, peekAt.space); } catch (error) { add.disabled = false; alert(error.message); }
  });
}

// Every link to an entry opens the side card; Ctrl, ⌘, Shift or a middle click keep the page.
document.addEventListener('click', (ev) => {
  if (ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
  const a = ev.target.closest && ev.target.closest('a[href^="#/entree/"], [data-go^="#/entree/"]');
  if (!a || a.hasAttribute('data-full') || a.closest('#side')) return;
  // A row that opens an entry: its own buttons, boxes and other links keep their gesture.
  if (a.tagName !== 'A') {
    const own = ev.target.closest('a[href], button, input, select, textarea, label, [contenteditable="true"]');
    if (own && a.contains(own)) return;
  }
  ev.preventDefault();
  ev.stopPropagation();
  const target = a.getAttribute('href') || a.dataset.go;
  peek(decodeURIComponent(target.slice(9).split('?')[0]), a.dataset.space || null);
}, true);
// The drawer closes as a side card too: its width comes back.
const closePeekWidth = new MutationObserver(() => { const d = drawer(); if (!d.classList.contains('open') && d.classList.contains('pk')) d.classList.remove('pk'); });
closePeekWidth.observe(drawer(), { attributes: true, attributeFilter: ['class'] });
`;
