// Markdown as HTML for reading (spec 008): what her documents use — headings, paragraphs, lists,
// quotes, tables, code, emphasis, links. Every character of her text is escaped first; only the
// marks below become tags, so a document can never run a script in a view.

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** « Pourquoi ça compte » → « pourquoi-ca-compte »: an anchor for the table of contents. */
export const anchorOf = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

function inline(raw: string): string {
  const codes: string[] = [];
  let text = escape(raw).replace(/`([^`]+)`/g, (_all, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `§code${codes.length - 1}§`;
  });
  text = text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_all, label: string, href: string) =>
      /^(https?:|mailto:)/i.test(href)
        ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>`
        : `<span class="ref">${label}</span>`,
    )
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_all, name: string, label?: string) => `<span class="ref">${label ?? name}</span>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
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

/** Her Markdown as safe HTML; headings carry anchors for the table of contents. */
export function markdownHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const used = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^```/.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i]!)) code.push(lines[i++]!);
      i += 1;
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      let anchor = anchorOf(heading[2]!);
      const seen = used.get(anchor) ?? 0;
      used.set(anchor, seen + 1);
      if (seen) anchor = `${anchor}-${seen + 1}`;
      out.push(`<h${level} id="${anchor}">${inline(heading[2]!)}</h${level}>`);
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
      out.push(`<blockquote>${markdownHtml(quote.join('\n'))}</blockquote>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]!)) rows.push(cells(lines[i++]!));
      out.push(
        `<div class="scroll"><table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    if (item.test(line)) {
      const ordered = /\d/.test(item.exec(line)![2]!);
      const items: string[] = [];
      while (i < lines.length && (item.test(lines[i]!) || /^\s{2,}\S/.test(lines[i]!))) {
        const match = item.exec(lines[i]!);
        if (match) items.push(match[3]!);
        else items[items.length - 1] += ` ${lines[i]!.trim()}`;
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(
        `<${tag}>${items
          .map((one) => {
            const task = /^\[([ xX])\]\s+(.*)$/.exec(one);
            return task
              ? `<li class="task">${task[1] === ' ' ? '☐' : '☑'} ${inline(task[2]!)}</li>`
              : `<li>${inline(one)}</li>`;
          })
          .join('')}</${tag}>`,
      );
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
      !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i]!)
    ) {
      paragraph.push(lines[i++]!);
    }
    if (paragraph.length === 0) {
      out.push(`<p>${inline(lines[i++]!)}</p>`);
      continue;
    }
    out.push(`<p>${inline(paragraph.join('\n'))}</p>`);
  }
  return out.join('\n');
}
