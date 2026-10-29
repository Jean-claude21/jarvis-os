import type { Actor, Tx } from './db';
import { get, save } from './entries';
import { history, type JournalLine } from './journal';
import { TEXT_FIELD } from './markdown';

// A document is an entry whose text is Markdown in `texte` (spec 008): a theory, a review, a
// reflection. It is written and changed section by section, so a model never sends it whole again,
// and read the same way, so a long one never floods a conversation.

/** One section of a document: a heading, its level, and where its text lies. */
export interface Section {
  title: string;
  level: number;
  /** Characters of the section, its subsections included. */
  size: number;
  start: number;
  end: number;
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/gm;

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** The headings of a Markdown text, each with the extent of its section (up to the next of its level or above). */
export function outline(text: string): Section[] {
  const found = [...text.matchAll(HEADING)].map((match) => ({
    title: match[2]!.trim(),
    level: match[1]!.length,
    start: match.index,
  }));
  // Headings inside fenced code are not headings.
  const fences = [...text.matchAll(/^```[\s\S]*?^```/gm)].map((m) => [
    m.index,
    m.index + m[0].length,
  ]);
  const real = found.filter((one) => !fences.some(([a, b]) => one.start > a! && one.start < b!));
  return real.map((one, index) => {
    const next = real.slice(index + 1).find((other) => other.level <= one.level);
    const end = next ? next.start : text.length;
    return { ...one, end, size: end - one.start };
  });
}

/** The section a name designates: its exact title first, else the one title that contains it. */
function sectionOf(text: string, name: string): Section {
  const sections = outline(text);
  const wanted = fold(name.replace(/^#+\s*/, ''));
  const exact = sections.filter((one) => fold(one.title) === wanted);
  const near = exact.length ? exact : sections.filter((one) => fold(one.title).includes(wanted));
  if (near.length === 1) return near[0]!;
  const titles = sections.map((one) => `${'#'.repeat(one.level)} ${one.title}`).join(' · ');
  throw new Error(
    near.length
      ? `Several sections match « ${name} »: name it exactly. Sections: ${titles}`
      : `No section « ${name} ». Sections: ${titles || '(none)'}`,
  );
}

/** A change to a document's text. */
export type DocumentEdit =
  /** The whole text. */
  | { action: 'replace_all'; text: string }
  /** At the end of the document, or of a section. */
  | { action: 'append'; text: string; section?: string }
  /** A section, its heading included: give the heading again to keep it. */
  | { action: 'replace_section'; section: string; text: string }
  /** A new text right after a section (its subsections included). */
  | { action: 'insert_after'; section: string; text: string }
  /** One passage, found exactly once, replaced. */
  | { action: 'replace_text'; find: string; text: string };

const joined = (before: string, middle: string, after: string) => {
  const head = before.replace(/\s*$/, '');
  const tail = after.replace(/^\s*/, '');
  return [head, middle.trim(), tail].filter(Boolean).join('\n\n') + '\n';
};

/** The text after one change. */
export function applyEdit(text: string, edit: DocumentEdit): string {
  switch (edit.action) {
    case 'replace_all':
      return `${edit.text.trim()}\n`;
    case 'append': {
      if (!edit.section) return joined(text, edit.text, '');
      const one = sectionOf(text, edit.section);
      return joined(text.slice(0, one.end), edit.text, text.slice(one.end));
    }
    case 'replace_section': {
      const one = sectionOf(text, edit.section);
      return joined(text.slice(0, one.start), edit.text, text.slice(one.end));
    }
    case 'insert_after': {
      const one = sectionOf(text, edit.section);
      return joined(text.slice(0, one.end), edit.text, text.slice(one.end));
    }
    case 'replace_text': {
      const at = text.indexOf(edit.find);
      if (at < 0) throw new Error('This passage is not in the document: copy it exactly.');
      if (text.indexOf(edit.find, at + 1) >= 0) {
        throw new Error('This passage is in the document more than once: give a longer one.');
      }
      return text.slice(0, at) + edit.text + text.slice(at + edit.find.length);
    }
  }
}

/** A document as read: its outline always, its text whole or the sections asked. */
export interface DocumentRead {
  id: string;
  kind: string;
  title: string;
  size: number;
  outline: Omit<Section, 'start' | 'end'>[];
  /** The whole text, or the sections asked, one after the other. */
  text: string;
  partial: boolean;
  /** The changes of its text, the latest first: each can be undone. */
  versions: {
    journalId: number;
    at: string;
    door: string;
    client: string | null;
    size: number | null;
    undone: boolean;
  }[];
}

/** Above this size, a document is read by its outline and the sections asked. */
export const DOCUMENT_WHOLE_CHARS = 40_000;

const textOf = (data: Record<string, unknown>) =>
  typeof data[TEXT_FIELD] === 'string' ? (data[TEXT_FIELD] as string) : '';

/** Reads a document: whole when small or when asked, else its outline and the sections named. */
export async function readDocument(
  tx: Tx,
  spaceId: string,
  input: { id: string; sections?: string[]; whole?: boolean },
): Promise<DocumentRead> {
  const entry = await get(tx, spaceId, input.id);
  if (!entry) throw new Error(`No entry ${input.id} in this space.`);
  const text = textOf(entry.data);
  const sections = outline(text);
  let shown = text;
  let partial = false;
  if (input.sections?.length) {
    shown = input.sections
      .map((name) => {
        const one = sectionOf(text, name);
        return text.slice(one.start, one.end).trim();
      })
      .join('\n\n');
    partial = true;
  } else if (!input.whole && text.length > DOCUMENT_WHOLE_CHARS) {
    // The opening, then the outline says where to read on.
    shown = text
      .slice(0, sections[1]?.start ?? DOCUMENT_WHOLE_CHARS)
      .slice(0, DOCUMENT_WHOLE_CHARS);
    partial = true;
  }
  const lines: JournalLine[] = await history(tx, spaceId, { target: input.id, limit: 50 });
  const versions = lines
    .filter((line) => line.command === 'entry.update' || line.command === 'entry.create')
    .filter((line) => {
      const before = textOf(((line.before ?? {}) as { data?: Record<string, unknown> }).data ?? {});
      const after = textOf(((line.after ?? {}) as { data?: Record<string, unknown> }).data ?? {});
      return before !== after;
    })
    .map((line) => ({
      journalId: line.id,
      at: line.at,
      door: line.door,
      client: line.client,
      size:
        textOf(((line.after ?? {}) as { data?: Record<string, unknown> }).data ?? {}).length ||
        null,
      undone: line.undoneBy !== null,
    }));
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    size: text.length,
    outline: sections.map(({ title, level, size }) => ({ title, level, size })),
    text: shown,
    partial,
    versions,
  };
}

/** Writes a new document, or changes one by a single edit: journaled, so each version is kept. */
export async function writeDocument(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input:
    | { id?: undefined; kind?: string; title: string; text: string; data?: Record<string, unknown> }
    | { id: string; edit: DocumentEdit; title?: string },
): Promise<{ id: string; size: number; outline: Omit<Section, 'start' | 'end'>[] }> {
  let id: string;
  let text: string;
  if (input.id === undefined) {
    text = `${input.text.trim()}\n`;
    const saved = await save(tx, actor, spaceId, {
      entries: [
        {
          kind: input.kind ?? 'Document',
          title: input.title,
          data: { ...input.data, [TEXT_FIELD]: text },
        },
      ],
    });
    id = saved.entries[0]!.id;
  } else {
    const entry = await get(tx, spaceId, input.id);
    if (!entry) throw new Error(`No entry ${input.id} in this space.`);
    text = applyEdit(textOf(entry.data), input.edit);
    await save(tx, actor, spaceId, {
      entries: [
        {
          id: input.id,
          ...(input.title ? { title: input.title } : {}),
          data: { [TEXT_FIELD]: text },
        },
      ],
    });
    id = input.id;
  }
  return {
    id,
    size: text.length,
    outline: outline(text).map(({ title, level, size }) => ({ title, level, size })),
  };
}
