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
.doc blockquote { background: #f6f0e9; border-radius: 8px; padding: 8px 14px; color: var(--bark); }
.doc pre { background: var(--sand); border: 1px solid var(--rule); border-radius: 2px; padding: 10px; overflow-x: auto; }
.doc code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; }
.doc hr { border: 0; border-top: 1px solid var(--rule); margin: 1.4em 0; }
.doc .ref { color: var(--primary); }
.doc a { color: var(--primary); }
.doc li.task { list-style: none; margin-left: -1.2em; }
.toc a { color: var(--ink); text-decoration: none; } .toc a:hover { color: var(--primary); }
.toc li { padding: 4px 0; border: 0; }
.doc .callout { border-radius: 10px; padding: 10px 14px; margin: 0 0 1em; background: #f4efe8; }
.doc .callout > :last-child { margin-bottom: 0; }
.doc .callout-t { font-weight: 700; margin: 0 0 4px; font-size: 14px; }
.doc .callout.note { background: #eef3f9; } .doc .callout.note .callout-t { color: #2f5f8f; }
.doc .callout.tip { background: #edf6f0; } .doc .callout.tip .callout-t { color: #2f7d55; }
.doc .callout.important { background: #f3eefa; } .doc .callout.important .callout-t { color: #6a4fa0; }
.doc .callout.warning { background: #fbf3e4; } .doc .callout.warning .callout-t { color: #8a5a0b; }
.doc .callout.caution { background: #fbecec; } .doc .callout.caution .callout-t { color: #9b1c3c; }
.doc pre.mermaid { background: #fff; text-align: center; border: 1px solid var(--rule); border-radius: 10px; padding: 14px; white-space: pre; }
.doc pre.mermaid svg { max-width: 100%; height: auto; }
.doc pre code[data-lang]::before { content: attr(data-lang); display: block; font-size: 11px; color: var(--bark); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .5px; }
.doc table { border-collapse: collapse; width: 100%; margin: 0 0 1em; font-size: 14px; }
.doc th, .doc td { border-bottom: 1px solid var(--rule); padding: 7px 10px; text-align: left; }
.doc th { background: var(--sand); font-weight: 600; }
.doc img { max-width: 100%; border-radius: 8px; }
.doc del { color: var(--bark); }
.doc ul ul, .doc ol ol, .doc ul ol, .doc ol ul { margin: 4px 0 4px; }
.doc sup.fn a { text-decoration: none; font-size: 11px; }
.doc .footnotes { border-top: 1px solid var(--rule); margin-top: 2em; padding-top: 10px; font-size: 13px; color: var(--bark); }
.reader { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; }
.toc-side { display: none; }
@media (min-width: 1000px) {
  .reader.with-toc { grid-template-columns: minmax(0, 760px) 220px; }
  .reader.with-toc .toc-side { display: block; position: sticky; top: 12px; align-self: start; max-height: calc(100vh - 24px); overflow-y: auto; font-size: 13px; }
  .reader.with-toc + .toc-fold, .toc-fold.wide-hide { display: none; }
}
.toc-side .caps { margin-bottom: 6px; } .toc-side ul { list-style: none; padding: 0; margin: 0; } .toc-side li { padding: 3px 0; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.actions a { text-decoration: none; }
@media print { .noprint { display: none !important; } body { padding: 0; } .doc { max-width: none; } }
`;

const script = `
document.head.insertAdjacentHTML('beforeend', '<style>${css.replace(/\n/g, ' ')}</style>');
let shown = null;
// Her diagrams (spec 083): Mermaid, loaded from Jarvis only when a document holds one; where it cannot
// load, the diagram stays as its text.
let mermaidLoading = null;
function drawDiagrams(root) {
  const nodes = Array.from(root.querySelectorAll('pre.mermaid'));
  if (!nodes.length) return;
  mermaidLoading = mermaidLoading || new Promise((done, fail) => {
    if (window.mermaid) { done(); return; }
    const tag = document.createElement('script');
    tag.src = '/vendor/mermaid.js'; tag.onload = done; tag.onerror = fail;
    document.head.appendChild(tag);
  });
  mermaidLoading.then(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (n, d) => (css.getPropertyValue(n) || '').trim() || d;
    const pal = ['#b0451f', '#c08a2c', '#3c6e9e', '#2f7d55', '#6a4fa0', '#c0447a', '#1e8580', '#8a867e'];
    const vars = { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px', primaryColor: '#f6ede4', primaryTextColor: v('--ink', '#2a1610'), primaryBorderColor: '#c9b3a4', lineColor: '#9a8276', secondaryColor: '#eef3f9', tertiaryColor: '#edf6f0', pieStrokeColor: '#fff', pieOuterStrokeColor: '#fff', pieTitleTextSize: '16px', pieSectionTextColor: '#fff' };
    pal.forEach((c, i) => { vars['pie' + (i + 1)] = c; vars['cScale' + i] = c; vars['cScaleLabel' + i] = '#fff'; });
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: vars });
    return window.mermaid.run({ nodes });
  }).catch(() => {});
}
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
    (toc.length > 2 ? '<details class="card noprint toc-fold wide-hide" style="margin-bottom:14px"><summary class="caps">' + esc(words.contents) + '</summary><ul class="list toc">' +
      toc.map((one) => '<li style="padding-left:' + (one.level - 1) * 14 + 'px"><a href="#' + esc(one.anchor) + '">' + esc(one.title) + '</a></li>').join('') + '</ul></details>' : '') +
    '<div class="reader' + (toc.length > 2 ? ' with-toc' : '') + '"><article class="doc">' + (data.html || '<p class="empty">' + esc(words.empty) + '</p>') + '</article>' +
    (toc.length > 2 ? '<aside class="toc-side noprint"><div class="caps">' + esc(words.contents) + '</div><ul class="toc">' + toc.map((one) => '<li style="padding-left:' + (one.level - 1) * 12 + 'px"><a href="#' + esc(one.anchor) + '">' + esc(one.title) + '</a></li>').join('') + '</ul></aside>' : '') + '</div>' +
    (data.versions.length ? '<details class="card noprint" style="margin-top:16px"><summary class="caps">' + esc(words.versions) + ' (' + data.versions.length + ')</summary><ul class="list">' +
      data.versions.map((v) => '<li><span>' + esc(when(v.at)) + ' <span class="muted">' + esc(say(words.by, { door: v.client || v.door })) + (v.size ? ' · <span class="num">' + v.size + '</span>' : '') + '</span></span>' +
        (v.undone ? '<span class="badge">' + esc(words.restored) + '</span>' : (host.inside ? '<button class="quiet" data-undo="' + v.journalId + '">' + esc(words.restore) + '</button>' : '')) + '</li>').join('') +
      '</ul><p class="error-text" id="undo-error"></p></details>' : '');
  drawDiagrams(root);
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
