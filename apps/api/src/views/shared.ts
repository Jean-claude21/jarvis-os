import type { SharedPage } from '@jarvis-os/core';
import { viewPage } from './base';
import { viewWords } from './words';

// A public link (spec 016): what someone without an account sees — a form whose answer reaches her
// as « proposed », or a view of her collection, read-only. Served by the server; it calls only its
// own link (`POST /p/:key`).

const script = `
document.head.insertAdjacentHTML('beforeend', '<style>.field{display:grid;gap:4px;margin:10px 0}.field label{font-size:12px;color:var(--bark)}input,select,textarea{font:inherit;padding:7px 9px;border:1px solid var(--rule-strong);border-radius:2px;background:var(--paper);color:var(--ink)}.checks{display:flex;flex-wrap:wrap;gap:8px}.ok{background:var(--success-surface);color:var(--success);padding:12px;border-radius:2px}</style>');
const lang = () => (words === WORDS.en ? 'en' : 'fr');
const tr = (v) => (v && typeof v === 'object' ? v[lang()] || v.en || v.fr || '' : v);
const fmt = (v) => (v == null || v === '' ? '—' : typeof v === 'number' ? new Intl.NumberFormat(lang()).format(v) : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? (v.address || '') : String(v));
function render(data) {
  const root = document.getElementById('root');
  if (!data || data.error) { root.innerHTML = '<p class="empty">' + esc(words.closed) + '</p>'; return; }
  const head = '<header class="head"><div><div class="caps">Jarvis</div><h1>' + esc(tr(data.title)) + '</h1>' + (data.intro ? '<p class="muted">' + esc(data.intro) + '</p>' : '') + '</div></header>';
  if (data.mode === 'view') {
    const v = data.view;
    const cols = v.columns;
    root.innerHTML = head + '<div class="card wide"><div class="scroll"><table><thead><tr>' + cols.map((c) => '<th>' + esc(c === 'title' ? words.title : c) + '</th>').join('') + '</tr></thead><tbody>' +
      v.rows.map((r) => '<tr>' + cols.map((c) => '<td>' + esc(fmt(r[c])) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></div>';
    return;
  }
  const input = (f) => {
    const id = 'f_' + f.name;
    const opts = (f.options || []).map((o) => [o, f.optionLabels && f.optionLabels[o] ? tr(f.optionLabels[o]) : o]);
    if (f.type === 'choice') return '<select id="' + id + '"><option value=""></option>' + opts.map(([o, l]) => '<option value="' + esc(o) + '">' + esc(l) + '</option>').join('') + '</select>';
    if (f.type === 'multi_choice') return '<div class="checks" id="' + id + '">' + opts.map(([o, l]) => '<label><input type="checkbox" value="' + esc(o) + '"> ' + esc(l) + '</label>').join('') + '</div>';
    if (f.type === 'boolean') return '<select id="' + id + '"><option value=""></option><option value="true">✓</option><option value="false">—</option></select>';
    if (f.type === 'long_text') return '<textarea id="' + id + '" rows="4"></textarea>';
    if (f.type === 'rating') return '<select id="' + id + '"><option value=""></option>' + [1, 2, 3, 4, 5].map((n) => '<option value="' + n + '">' + '★'.repeat(n) + '</option>').join('') + '</select>';
    const type = { date: 'date', datetime: 'datetime-local', time: 'time', url: 'url', email: 'email', phone: 'tel', number: 'number', amount: 'number', progress: 'number' }[f.type] || 'text';
    return '<input id="' + id + '" type="' + type + '"' + (type === 'number' ? ' step="any"' : '') + '>';
  };
  root.innerHTML = head + '<form class="card" id="form" style="max-width:560px"><div class="field"><label>' + esc(words.name) + ' *</label><input id="f__title" required></div>' +
    data.fields.map((f) => '<div class="field"><label>' + esc((tr(f.label) || f.name) + (f.required ? ' *' : '') + (f.unit ? ' · ' + f.unit : '')) + '</label>' + input(f) + '</div>').join('') +
    '<p class="error-text" id="error"></p><button>' + esc(words.send) + '</button></form>';
  document.getElementById('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = { title: document.getElementById('f__title').value.trim(), data: {} };
    for (const f of data.fields) {
      const el = document.getElementById('f_' + f.name);
      if (f.type === 'multi_choice') { const picked = [...el.querySelectorAll('input:checked')].map((i) => i.value); if (picked.length) body.data[f.name] = picked; continue; }
      const v = el.value; if (v === '') continue;
      body.data[f.name] = ['number', 'amount', 'rating', 'progress'].includes(f.type) ? Number(v) : f.type === 'boolean' ? v === 'true' : v;
    }
    const res = await fetch(location.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const answer = await res.json().catch(() => ({}));
    if (!res.ok) { document.getElementById('error').textContent = answer.error || res.status; return; }
    root.innerHTML = head + '<p class="ok">' + esc(words.thanks) + '</p>';
  });
}
start(render);
`;

/** The page of a public link, its data given. */
export const sharedView = (data: SharedPage | { error: string }) =>
  viewPage({ title: 'Jarvis', words: viewWords.shared, script, data });
