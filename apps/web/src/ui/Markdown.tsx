import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';
import { cn } from './index';

// Her Markdown, read as a page (v3 D17, the v2 reader): titles, lists, tables, quotes, code, task
// boxes, links — GitHub's flavour, made safe (no script, no style, no frame). A link to the web
// opens it; a link to another file of a notes folder (« ../personnes/frederic.md ») stays a word,
// its path on hover: Jarvis does not guess where that file went.

marked.use({ gfm: true, breaks: false });

/** A front matter (« --- name: … --- ») is not part of what she reads. */
const withoutFrontMatter = (text: string) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

export function markdownHtml(text: string): string {
  const html = marked.parse(withoutFrontMatter(text), { async: false }) as string;
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'form', 'button'],
    ADD_TAGS: [],
  });
  // Links: the web opens apart; a relative path stays a word.
  const box = document.createElement('div');
  box.innerHTML = clean;
  for (const link of [...box.querySelectorAll('a')]) {
    const href = link.getAttribute('href') ?? '';
    if (/^(https?:|mailto:|tel:)/i.test(href)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer');
    } else {
      const word = document.createElement('span');
      word.className = 'md-ref';
      word.title = href;
      word.innerHTML = link.innerHTML;
      link.replaceWith(word);
    }
  }
  // Task boxes (« - [x] ») stay read-only marks; no other field survives.
  for (const input of [...box.querySelectorAll('input')]) {
    const mark = document.createElement('span');
    mark.className = 'md-box';
    mark.textContent = (input as HTMLInputElement).checked ? '☑' : '☐';
    if (input.getAttribute('type') === 'checkbox') input.replaceWith(mark);
    else input.remove();
  }
  // Wide tables scroll in their own frame, never the page.
  for (const table of [...box.querySelectorAll('table')]) {
    const frame = document.createElement('div');
    frame.className = 'md-table';
    table.replaceWith(frame);
    frame.appendChild(table);
  }
  return box.innerHTML;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => markdownHtml(text), [text]);
  return <div className={cn('md', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
