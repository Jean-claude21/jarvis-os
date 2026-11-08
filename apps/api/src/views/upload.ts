import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { viewPage } from './base';
import { viewWords } from './words';

/** How long an upload link lives. */
export const UPLOAD_MINUTES = 30;

const grantSchema = z.object({
  person: z.string().min(1),
  spaceId: z.string().min(1),
  /** Where the files go: links from each new file (`to` an entry, a `role`). */
  links: z.array(z.object({ to: z.string(), role: z.string() })).max(20),
  /** Expiry, in milliseconds since the epoch. */
  until: z.number().int(),
});
export type UploadGrant = z.infer<typeof grantSchema>;

const sign = (body: string, secret: string) =>
  createHmac('sha256', `upload:${secret}`).update(body).digest('base64url');

/**
 * An upload link's token (decision 0006): who, which space, which links, until when — signed with
 * the server's secret. Bytes then go straight to the server, never through the model.
 */
export function uploadToken(grant: UploadGrant, secret: string): string {
  const body = Buffer.from(JSON.stringify(grant)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

/** The grant a token carries, or why it opens nothing. */
export function readUploadToken(token: string, secret: string, now = Date.now()): UploadGrant {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new Error('This upload link is not valid.');
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new Error('This upload link is not valid.');
  }
  const grant = grantSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
  if (grant.until < now) throw new Error('This upload link has expired: ask for a new one.');
  return grant;
}

// The upload view (`ui://jarvis/upload`), also served as a plain page at the link itself.
const script = `
let target = null;
function render(data) {
  const root = document.getElementById('root');
  if (!data || !data.url) { root.innerHTML = '<p class="empty">' + esc(words.nothing) + '</p>'; return; }
  target = data;
  const time = new Date(data.expiresAt).toLocaleTimeString(words === WORDS.en ? 'en' : 'fr', { hour: '2-digit', minute: '2-digit' });
  root.innerHTML = '<header class="head"><div><div class="caps">' + esc(say(words.into, { space: data.space })) + '</div><h1>' + esc(words.title) + '</h1></div></header>' +
    '<p class="muted" style="margin:0 0 12px">' + esc(words.lead) + '</p>' +
    '<label id="zone" class="card" style="display:grid;place-items:center;gap:8px;padding:28px 16px;border-style:dashed;border-color:var(--rule-strong);cursor:pointer;text-align:center">' +
    '<input id="files" type="file" multiple hidden><span class="badge primary">' + esc(words.choose) + '</span><span class="muted">' + esc(words.drop) + '</span></label>' +
    '<ul class="list" id="sent"></ul><p class="muted">' + esc(say(words.expires, { time })) + '</p>';
  const zone = document.getElementById('zone');
  document.getElementById('files').addEventListener('change', (event) => send([...event.target.files]));
  zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.style.borderColor = 'var(--primary)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = 'var(--rule-strong)'; });
  zone.addEventListener('drop', (event) => { event.preventDefault(); zone.style.borderColor = 'var(--rule-strong)'; send([...event.dataTransfer.files]); });
}
async function send(files) {
  const list = document.getElementById('sent'); const kept = [];
  for (const file of files) {
    const item = document.createElement('li'); item.textContent = say(words.sending, { name: file.name }); list.appendChild(item);
    const form = new FormData(); form.append('file', file);
    try {
      const response = await fetch(target.url, { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || response.status);
      item.innerHTML = '<span>' + esc(say(words.kept, { name: file.name })) + '</span><span class="badge said">' + esc(data.entryId) + '</span>';
      kept.push({ name: file.name, entryId: data.entryId });
    } catch (error) {
      item.innerHTML = '<span class="error-text">' + esc(say(words.failed, { name: file.name, reason: error.message })) + '</span>';
    }
  }
  if (kept.length) tellModel(say(words.told, { names: kept.map((k) => k.name + ' (' + k.entryId + ')').join(', ') }), { kept });
}
start(render);
`;

export const uploadView = (data?: { url: string; expiresAt: string; space: string }) =>
  viewPage({
    title: 'Jarvis — envoyer un fichier',
    words: viewWords.upload,
    script,
    ...(data ? { data } : {}),
  });
