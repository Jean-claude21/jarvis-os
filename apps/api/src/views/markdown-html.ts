// Markdown as HTML for reading (specs 008, 083): what her documents and reviews use — headings,
// paragraphs, nested lists and tasks, quotes and callouts (« > [!NOTE] »), tables, code, diagrams
// (« ```mermaid », drawn by the reader), images, footnotes, emphasis, struck text, links. Every
// character of her text is escaped first; only the marks below become tags, so a document can never
// run a script in a view.

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** « Pourquoi ça compte » → « pourquoi-ca-compte »: an anchor for the table of contents. */
export const anchorOf = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

/** A footnote's place: its number in the order it is first called. */
interface Notes {
  order: string[];
  text: Map<string, string>;
}

function inline(raw: string, notes?: Notes): string {
  const codes: string[] = [];
  let text = escape(raw).replace(/`([^`\n]+)`/g, (_all, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `§code${codes.length - 1}§`;
  });
  text = text
    .replace(
      /!\[([^\]]*)\]\((https:[^)\s]+)\)/g,
      (_all, alt: string, src: string) => `<img src="${src}" alt="${alt}" loading="lazy">`,
    )
    .replace(/\[\^([^\]\s]+)\]/g, (all, id: string) => {
      if (!notes) return all;
      if (!notes.order.includes(id)) notes.order.push(id);
      const n = notes.order.indexOf(id) + 1;
      return `<sup class="fn"><a href="#fn-${anchorOf(id)}" id="fnref-${anchorOf(id)}">${n}</a></sup>`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_all, label: string, href: string) =>
      /^(https?:|mailto:)/i.test(href)
        ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>`
        : /^#[\w-]+$/.test(href)
          ? `<a href="${href}">${label}</a>`
          : `<span class="ref">${label}</span>`,
    )
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_all, name: string, label?: string) => `<span class="ref">${label ?? name}</span>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/ {2,}$/gm, '<br>');
  return text.replace(/§code(\d+)§/g, (_all, n: string) => codes[Number(n)]!);
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const CALLOUTS: Record<string, string> = {
  note: 'Note',
  tip: 'Astuce',
  important: 'À retenir',
  warning: 'Attention',
  caution: 'Prudence',
};

const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const indentOf = (line: string) => line.replace(/\t/g, '    ').match(/^ */)![0].length;

/** A list from line `start`, at the indentation of its first item, with its nested lists. */
function list(lines: string[], start: number, notes: Notes): { html: string; next: number } {
  const first = ITEM.exec(lines[start]!)!;
  const base = indentOf(lines[start]!);
  const ordered = /\d/.test(first[2]!);
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      // A blank line goes on only if the list does.
      const after = lines[i + 1];
      if (after !== undefined && ITEM.test(after) && indentOf(after) >= base) {
        i += 1;
        continue;
      }
      break;
    }
    const match = ITEM.exec(line);
    const depth = indentOf(line);
    if (match && depth === base) {
      items.push(match[3]!);
      i += 1;
      continue;
    }
    if (match && depth > base && items.length) {
      const inner = list(lines, i, notes);
      items[items.length - 1] += `\u0000${inner.html}`;
      i = inner.next;
      continue;
    }
    if (!match && depth > base && items.length) {
      items[items.length - 1] += ` ${line.trim()}`;
      i += 1;
      continue;
    }
    break;
  }
  const tag = ordered ? 'ol' : 'ul';
  const html = `<${tag}>${items
    .map((one) => {
      const [own, ...nested] = one.split('\u0000');
      const task = /^\[([ xX])\]\s+(.*)$/.exec(own!);
      const body = task
        ? `${task[1] === ' ' ? '☐' : '☑'} ${inline(task[2]!, notes)}`
        : inline(own!, notes);
      return `<li${task ? ' class="task"' : ''}>${body}${nested.join('')}</li>`;
    })
    .join('')}</${tag}>`;
  return { html, next: i };
}

function blocks(text: string, notes: Notes, used: Map<string, number>): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = /^(```|~~~)\s*([\w-]*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith(fence[1]!)) code.push(lines[i++]!);
      i += 1;
      const lang = (fence[2] ?? '').toLowerCase();
      out.push(
        lang === 'mermaid'
          ? `<pre class="mermaid">${escape(code.join('\n'))}</pre>`
          : `<pre><code${lang ? ` class="lang-${lang}" data-lang="${lang}"` : ''}>${escape(code.join('\n'))}</code></pre>`,
      );
      continue;
    }
    const note = /^\[\^([^\]\s]+)\]:\s*(.*)$/.exec(line);
    if (note) {
      const more: string[] = [note[2]!];
      i += 1;
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]!)) more.push(lines[i++]!.trim());
      notes.text.set(note[1]!, more.join(' '));
      continue;
    }
    const heading = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      let anchor = anchorOf(heading[2]!);
      const seen = used.get(anchor) ?? 0;
      used.set(anchor, seen + 1);
      if (seen) anchor = `${anchor}-${seen + 1}`;
      out.push(`<h${level} id="${anchor}">${inline(heading[2]!, notes)}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^ {0,3}([-*_])( *\1){2,} *$/.test(line)) {
      out.push('<hr>');
      i += 1;
      continue;
    }
    if (/^>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>/.test(lines[i]!)) quote.push(lines[i++]!.replace(/^> ?/, ''));
      const callout = /^\[!(\w+)\]\s*(.*)$/.exec(quote[0] ?? '');
      const kind = callout?.[1]?.toLowerCase();
      if (kind && CALLOUTS[kind]) {
        const title = callout?.[2]?.trim() || CALLOUTS[kind];
        out.push(
          `<div class="callout ${kind}"><p class="callout-t">${inline(title, notes)}</p>${blocks(quote.slice(1).join('\n'), notes, used)}</div>`,
        );
      } else {
        out.push(`<blockquote>${blocks(quote.join('\n'), notes, used)}</blockquote>`);
      }
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      const align = cells(lines[i + 1]!).map((one) =>
        /^:-+:$/.test(one) ? 'center' : /-+:$/.test(one) ? 'right' : '',
      );
      const at = (n: number) => (align[n] ? ` style="text-align:${align[n]}"` : '');
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]!)) rows.push(cells(lines[i++]!));
      out.push(
        `<div class="scroll"><table><thead><tr>${head.map((cell, n) => `<th${at(n)}>${inline(cell, notes)}</th>`).join('')}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${row.map((cell, n) => `<td${at(n)}>${inline(cell, notes)}</td>`).join('')}</tr>`,
          )
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (ITEM.test(line)) {
      const made = list(lines, i, notes);
      out.push(made.html);
      i = made.next;
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,6}\s|```|~~~|>|\s*([-*+]|\d+[.)])\s|\[\^[^\]\s]+\]:)/.test(lines[i]!)
    ) {
      paragraph.push(lines[i++]!);
    }
    if (paragraph.length === 0) {
      out.push(`<p>${inline(lines[i++]!, notes)}</p>`);
      continue;
    }
    out.push(`<p>${inline(paragraph.join('\n'), notes)}</p>`);
  }
  return out.join('\n');
}

/** Her Markdown as safe HTML; headings carry anchors for the table of contents. */
export function markdownHtml(text: string): string {
  const notes: Notes = { order: [], text: new Map() };
  const html = blocks(text, notes, new Map());
  const called = notes.order.filter((id) => notes.text.has(id));
  if (!called.length) return html;
  return `${html}\n<section class="footnotes"><ol>${called
    .map(
      (id) =>
        `<li id="fn-${anchorOf(id)}">${inline(notes.text.get(id)!)} <a href="#fnref-${anchorOf(id)}" aria-label="↩">↩</a></li>`,
    )
    .join('')}</ol></section>`;
}
