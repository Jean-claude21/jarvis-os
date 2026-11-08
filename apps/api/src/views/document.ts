import type { DocumentRead } from '@jarvis-os/core';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { viewPage } from './base';
import { anchorOf, markdownHtml } from './markdown-html';
import { viewWords } from './words';

/** How long a reading link lives: a day, to read or download it at leisure. */
export const DOCUMENT_HOURS = 24;

const grantSchema = z.object({
  person: z.string().min(1),
  spaceId: z.string().min(1),
  id: z.string().min(1),
  until: z.number().int(),
});
export type DocumentGrant = z.infer<typeof grantSchema>;

const sign = (body: string, secret: string) =>
  createHmac('sha256', `document:${secret}`).update(body).digest('base64url');

/** A reading link's token: one document of one person, until when — signed by the server. */
export function documentToken(grant: DocumentGrant, secret: string): string {
  const body = Buffer.from(JSON.stringify(grant)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function readDocumentToken(token: string, secret: string, now = Date.now()): DocumentGrant {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new Error('This reading link is not valid.');
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new Error('This reading link is not valid.');
  }
  const grant = grantSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
  if (grant.until < now) throw new Error('This reading link has expired: ask for a new one.');
  return grant;
}

/** What the document view shows. */
export interface DocumentShown {
  id: string;
  title: string;
  kind: string;
  space: string;
  spaceId: string;
  size: number;
  partial: boolean;
  html: string;
  outline: { title: string; level: number; anchor: string }[];
  versions: DocumentRead['versions'];
  /** The reading link: `?format=md` for the Markdown file. */
  link: string;
}

/** Her text without its first heading when that heading is the title the view already shows. */
function withoutTitle(text: string, title: string): string {
  const first = /^\s*# +(.+?)[ #]*(?:\r?\n|$)/.exec(text);
  return first && anchorOf(first[1]!) === anchorOf(title) ? text.slice(first[0].length) : text;
}

export function documentShown(
  read: DocumentRead,
  where: { space: string; spaceId: string; link: string },
): DocumentShown {
  const used = new Map<string, number>();
  return {
    id: read.id,
    title: read.title,
    kind: read.kind,
    ...where,
    size: read.size,
    partial: read.partial,
    html: markdownHtml(withoutTitle(read.text, read.title)),
    outline: read.outline.map((one) => {
      const anchor = anchorOf(one.title);
      const seen = used.get(anchor) ?? 0;
      used.set(anchor, seen + 1);
      return {
        title: one.title,
        level: one.level,
        anchor: seen ? `${anchor}-${seen + 1}` : anchor,
      };
    }),
    versions: read.versions,
  };
}

const css = `
.doc { max-width: 760px; }
.doc h1, .doc h2, .doc h3, .doc h4 { margin: 1.4em 0 0.5em; }
.doc h1 { font-size: 22px; } .doc h2 { font-size: 18px; } .doc h3 { font-size: 15px; }
.doc p, .doc ul, .doc ol, .doc blockquote, .doc pre { margin: 0 0 0.9em; }
.doc p, .doc li { font-size: 15px; line-height: 1.65; }
.doc blockquote { border-left: 3px solid var(--primary); padding: 2px 0 2px 14px; color: var(--bark); }
.doc pre { background: var(--sand); border: 1px solid var(--rule); border-radius: 2px; padding: 10px; overflow-x: auto; }
.doc code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; }
.doc hr { border: 0; border-top: 1px solid var(--rule); margin: 1.4em 0; }
.doc .ref { color: var(--primary); }
.doc a { color: var(--primary); }
.doc li.task { list-style: none; margin-left: -1.2em; }
.toc a { color: var(--ink); text-decoration: none; } .toc a:hover { color: var(--primary); }
.toc li { padding: 4px 0; border: 0; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.actions a { text-decoration: none; }
@media print { .noprint { display: none !important; } body { padding: 0; } .doc { max-width: none; } }
`;

const script = `
document.head.insertAdjacentHTML('beforeend', '<style>${css.replace(/\n/g, ' ')}</style>');
let shown = null;
function render(data) {
  const root = document.getElementById('root');
  if (!data || !data.id) { root.innerHTML = '<p class="empty">' + esc(words.nothing) + '</p>'; return; }
  shown = data;
  const when = (at) => new Date(at).toLocaleString(words === WORDS.en ? 'en' : 'fr', { dateStyle: 'medium', timeStyle: 'short' });
  const toc = data.outline.filter((one) => one.level <= 3);
  root.innerHTML = '<header class="head"><div><div class="caps">' + esc(data.kind) + ' · ' + esc(data.space) + '</div><h1>' + esc(data.title) + '</h1>' +
    '<div class="meta"><span class="muted num">' + esc(say(words.chars, { n: new Intl.NumberFormat().format(data.size) })) + '</span></div></div>' +
    '<div class="actions noprint">' +
    (data.link ? '<a href="' + esc(data.link) + '?format=md" target="_blank" rel="noopener"><button class="quiet">' + esc(words.markdown) + '</button></a>' +
      '<a href="' + esc(data.link) + '" target="_blank" rel="noopener"><button>' + esc(words.print) + '</button></a>' : '<button onclick="print()">' + esc(words.print) + '</button>') +
    '</div></header>' +
    (data.partial ? '<p class="badge read noprint" style="white-space:normal;margin-bottom:12px">' + esc(words.partial) + '</p>' : '') +
    (toc.length > 2 ? '<details class="card noprint" style="margin-bottom:14px"><summary class="caps">' + esc(words.contents) + '</summary><ul class="list toc">' +
      toc.map((one) => '<li style="padding-left:' + (one.level - 1) * 14 + 'px"><a href="#' + esc(one.anchor) + '">' + esc(one.title) + '</a></li>').join('') + '</ul></details>' : '') +
    '<article class="doc">' + (data.html || '<p class="empty">' + esc(words.empty) + '</p>') + '</article>' +
    (data.versions.length ? '<details class="card noprint" style="margin-top:16px"><summary class="caps">' + esc(words.versions) + ' (' + data.versions.length + ')</summary><ul class="list">' +
      data.versions.map((v) => '<li><span>' + esc(when(v.at)) + ' <span class="muted">' + esc(say(words.by, { door: v.client || v.door })) + (v.size ? ' · <span class="num">' + v.size + '</span>' : '') + '</span></span>' +
        (v.undone ? '<span class="badge">' + esc(words.restored) + '</span>' : (host.inside ? '<button class="quiet" data-undo="' + v.journalId + '">' + esc(words.restore) + '</button>' : '')) + '</li>').join('') +
      '</ul><p class="error-text" id="undo-error"></p></details>' : '');
  root.querySelectorAll('[data-undo]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await callTool('undo', { journalId: Number(button.dataset.undo), space: shown.spaceId });
      render(await callTool('read_document', { id: shown.id, space: shown.spaceId }));
    } catch (error) {
      document.getElementById('undo-error').textContent = say(words.restoreFailed, { reason: error.message });
      button.disabled = false;
    }
  }));
}
start(render);
`;

/** The document view (`ui://jarvis/document`), also the printable page of a reading link. */
export const documentView = (data?: DocumentShown) =>
  viewPage({
    title: data ? data.title : 'Jarvis — document',
    words: viewWords.document,
    script,
    ...(data ? { data } : {}),
  });
