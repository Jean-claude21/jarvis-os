import { viewPage } from './base';
import { viewWords } from './words';

// The entry view (`ui://jarvis/entry`): one entry, each field with where it comes from, its links
// both ways, its history — each change undoable from the view, through the server's `undo` tool.
const script = `
let shown = null;
const originOf = (entry, field) => (entry.origin && entry.origin[field]) || 'said';
const value = (v) => v !== null && typeof v === 'object' ? esc(JSON.stringify(v)) : esc(v);
function link(direction, one) {
  return '<li><span><span class="muted">' + esc(direction === 'out' ? words.to : words.from) + ' ' + esc(one.role) + '</span> ' +
    '<strong>' + esc(one.entry.title) + '</strong></span><span class="badge">' + esc(one.entry.kind) + '</span></li>';
}
function change(line) {
  const when = new Date(line.at).toLocaleString(words === WORDS.en ? 'en' : 'fr', { dateStyle: 'short', timeStyle: 'short' });
  const undoable = !line.undoneBy && line.command !== 'journal.undo' && !String(line.command).startsWith('space.');
  return '<li><span class="dot"></span><span style="flex:1"><strong>' + esc(line.command) + '</strong> <span class="muted">' +
    esc(say(words.by, { who: line.client || line.actor, door: line.door })) + '</span><br><span class="muted num">' + esc(when) + '</span></span>' +
    (line.undoneBy ? '<span class="badge">' + esc(words.undone) + '</span>' : undoable ? '<button class="quiet" data-undo="' + line.id + '">' + esc(words.undo) + '</button>' : '') + '</li>';
}
function render(data) {
  const root = document.getElementById('root');
  if (!data || !data.entry) { root.innerHTML = '<p class="empty">' + esc(words.nothing) + '</p>'; return; }
  shown = data;
  const e = data.entry; const fields = Object.keys(e.data || {});
  const links = [...(e.links.out || []).map((l) => link('out', l)), ...(e.links.in || []).map((l) => link('in', l))];
  root.innerHTML = '<header class="head"><div><div class="caps">' + esc(e.kind) + '</div><h1>' + esc(e.title) + '</h1>' +
    '<div class="meta"><span class="badge">' + esc(data.space) + '</span>' + (e.archivedAt || e.archived_at ? '<span class="badge error">' + esc(words.archived) + '</span>' : '') + '</div></div></header>' +
    '<section class="grid">' +
    '<article class="card wide"><h2>' + esc(words.fields) + '</h2>' + (fields.length ? '<table><tbody>' + fields.map((f) =>
      '<tr><td class="caps" style="width:34%">' + esc(f) + '</td><td>' + value(e.data[f]) + '</td><td class="n"><span class="badge ' + esc(originOf(e, f)) + '">' + esc(words[originOf(e, f)] || originOf(e, f)) + '</span></td></tr>').join('') +
      '</tbody></table>' : '<p class="empty">' + esc(words.noFields) + '</p>') + '</article>' +
    '<article class="card"><h2>' + esc(words.links) + '</h2>' + (links.length ? '<ul class="list">' + links.join('') + '</ul>' : '<p class="empty">' + esc(words.noLinks) + '</p>') + '</article>' +
    '<article class="card"><h2>' + esc(words.history) + '</h2><ul class="list">' + data.history.map(change).join('') + '</ul><p class="error-text" id="undo-error"></p></article>' +
    '</section>';
  root.querySelectorAll('[data-undo]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await callTool('undo', { journalId: Number(button.dataset.undo), space: shown.spaceId });
      render(await callTool('show_entry', { id: shown.entry.id, space: shown.spaceId }));
    } catch (error) {
      document.getElementById('undo-error').textContent = say(words.undoFailed, { reason: error.message });
      button.disabled = false;
    }
  }));
}
start(render);
`;

/** The entry view; with `data`, a plain page showing it at once. */
export const entryView = (data?: Record<string, unknown>) =>
  viewPage({ title: 'Jarvis — entrée', words: viewWords.entry, script, ...(data ? { data } : {}) });
