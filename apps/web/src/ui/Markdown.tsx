import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useEffect, useMemo, useRef } from 'react';
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
  // Callouts (« > [!IMPORTANT] À retenir »), as GitHub draws them: a tinted box with its word.
  const CALLOUTS: Record<string, string> = {
    NOTE: 'Note',
    TIP: 'Conseil',
    IMPORTANT: 'Important',
    WARNING: 'Attention',
    CAUTION: 'Prudence',
  };
  for (const quote of [...box.querySelectorAll('blockquote')]) {
    const first = quote.querySelector('p');
    const found = first
      ? /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(first.innerHTML)
      : null;
    if (!first || !found) continue;
    const tone = found[1]!.toUpperCase();
    first.innerHTML = first.innerHTML.slice(found[0].length);
    const rest = first.innerHTML.split(/<br\s*\/?>|\n/i);
    const head = document.createElement('p');
    head.className = 'callout-t';
    // « [!IMPORTANT] À retenir » keeps her words as the title; alone, the callout's own word.
    head.innerHTML = rest[0]?.trim() && rest.length > 1 ? rest.shift()! : CALLOUTS[tone]!;
    first.innerHTML = rest.join('<br>');
    if (!first.textContent?.trim()) first.remove();
    const box2 = document.createElement('div');
    box2.className = `callout ${tone.toLowerCase()}`;
    box2.append(head, ...quote.childNodes);
    quote.replaceWith(box2);
  }
  // Diagrams (« ```mermaid »): kept as their text, drawn once the page shows them.
  for (const code of [...box.querySelectorAll('pre > code.language-mermaid')]) {
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = code.textContent ?? '';
    code.parentElement!.replaceWith(pre);
  }
  // Titles get an anchor, for the table of contents.
  let n = 0;
  for (const title of [...box.querySelectorAll('h1, h2, h3')]) title.id = `t-${(n += 1)}`;
  // Wide tables scroll in their own frame, never the page.
  for (const table of [...box.querySelectorAll('table')]) {
    const frame = document.createElement('div');
    frame.className = 'md-table';
    table.replaceWith(frame);
    frame.appendChild(table);
  }
  return box.innerHTML;
}

// Mermaid is served by Jarvis (no CDN), loaded only when a text holds a diagram; where it cannot
// load, the diagram stays as its text.
let mermaidLoading: Promise<void> | null = null;
type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  run: (options: { nodes: Element[] }) => Promise<void>;
};
function drawDiagrams(root: HTMLElement) {
  const nodes = [...root.querySelectorAll('pre.mermaid:not([data-processed])')];
  if (!nodes.length) return;
  mermaidLoading ??= new Promise<void>((done, fail) => {
    if ((window as unknown as { mermaid?: MermaidApi }).mermaid) return done();
    const tag = document.createElement('script');
    tag.src = '/vendor/mermaid.js';
    tag.onload = () => done();
    tag.onerror = () => fail(new Error('mermaid'));
    document.head.appendChild(tag);
  });
  void mermaidLoading
    .then(() => {
      const mermaid = (window as unknown as { mermaid: MermaidApi }).mermaid;
      const css = getComputedStyle(document.documentElement);
      const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      const palette = [
        '#b0451f',
        '#c08a2c',
        '#3c6e9e',
        '#2f7d55',
        '#6a4fa0',
        '#c0447a',
        '#1e8580',
        '#8a867e',
      ];
      const vars: Record<string, string> = {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        primaryColor: v('--sand', '#f6ede4'),
        primaryTextColor: v('--ink', '#2a1610'),
        primaryBorderColor: v('--rule-strong', '#c9b3a4'),
        lineColor: v('--bark', '#9a8276'),
        pieStrokeColor: '#fff',
        pieOuterStrokeColor: '#fff',
        pieSectionTextColor: '#fff',
      };
      palette.forEach((color, at) => {
        vars[`pie${at + 1}`] = color;
        vars[`cScale${at}`] = color;
        vars[`cScaleLabel${at}`] = '#fff';
      });
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: vars,
      });
      return mermaid.run({ nodes });
    })
    .catch(() => undefined);
}

export function Markdown({
  text,
  className,
  contents = false,
}: {
  text: string;
  className?: string;
  /** A long text read as a document: its titles listed beside it on a wide screen. */
  contents?: boolean;
}) {
  const html = useMemo(() => markdownHtml(text), [text]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) drawDiagrams(ref.current);
  }, [html]);
  const titles = useMemo(() => {
    if (!contents) return [];
    const box = document.createElement('div');
    box.innerHTML = html;
    return [...box.querySelectorAll('h1, h2, h3')].map((one) => ({
      id: one.id,
      level: Number(one.tagName.slice(1)),
      text: one.textContent ?? '',
    }));
  }, [html, contents]);
  const body = (
    <div ref={ref} className={cn('md', className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
  if (titles.length < 3) return body;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_200px]">
      {body}
      <nav aria-label="Sommaire" className="hidden xl:block">
        <div className="sticky top-3 grid gap-1 text-[12.5px]">
          <b className="font-mono text-[11px] tracking-[0.06em] text-bark uppercase">Sommaire</b>
          {titles.map((one) => (
            <a
              key={one.id}
              href={`#${one.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(one.id)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="truncate text-ink hover:text-primary"
              style={{ paddingLeft: (one.level - 1) * 10 }}
            >
              {one.text}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
