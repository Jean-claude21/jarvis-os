import { posix } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Actor, Tx } from './db';
import type { Blobs } from './files';
import { prefixedId } from './ids';
import { modelsOf, placeOf } from './models';
import { record, recordMany } from './journal';
import type { Origin } from './schemas';

// Her life leaves and enters as Markdown (spec 007, decision 0007): an entry is a file, its kind and
// fields in the front matter, its text below its title, its links as Markdown links.

/** One Markdown file of a folder, by its path in that folder (`/` separators). */
export interface MarkdownDoc {
  path: string;
  text: string;
}

/** A file read: what becomes an entry. */
export interface ReadDoc {
  path: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  origin: Record<string, Origin>;
  /** Links found in the file: a path in the folder, or a wiki name. */
  links: { target: string; role: string; wiki: boolean }[];
}

/** The role of a link found in a text, when the text does not name one. */
export const MENTION = 'mentionne';
/** The role of the link from a file to the file that describes its folder. */
export const PART_OF = 'fait partie de';
/** The field that holds an entry's text, below its title. */
export const TEXT_FIELD = 'texte';
/** The field that keeps where an imported entry came from: its path in the folder. */
export const SOURCE_FIELD = 'source';
/** The heading under which an export writes an entry's links. */
const LINKS_HEADING = 'Liens';
const ORIGIN_KEY = 'origine';
/** Front matter keys that describe the entry rather than fill its fields. */
const RESERVED = new Set(['kind', 'id', 'title', ORIGIN_KEY]);

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** « Jardin de roses » → « jardin-de-roses »: a file name that any system can carry. */
export const slugOf = (text: string) =>
  fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'entree';

/** « resolutions » → « Resolution », « cercle_2 » → « Cercle 2 »: a folder name as a kind. */
const kindOfFolder = (folder: string) => {
  const words = folder.replace(/[-_]+/g, ' ').trim();
  const single = /[^s]s$/i.test(words) && words.length > 3 ? words.slice(0, -1) : words;
  return single.charAt(0).toUpperCase() + single.slice(1);
};

/** A date (YAML reads `2026-09-01` as a Date) or any value, as JSON keeps it. */
function plain(value: unknown): unknown {
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, plain(inner)]));
  }
  return value;
}

function splitFrontMatter(text: string): { front: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { front: {}, body: text };
  try {
    const front = parseYaml(match[1]!) as unknown;
    if (front && typeof front === 'object' && !Array.isArray(front)) {
      return { front: plain(front) as Record<string, unknown>, body: text.slice(match[0].length) };
    }
  } catch {
    // A front matter that is not YAML stays in the text, as she wrote it.
  }
  return { front: {}, body: text };
}

/**
 * Reads one Markdown file: the kind `kinds` gives its path, else its front matter's (`kind`), else
 * its folders' (`kinds` names some folders, nearest first, and may rename a kind; else the parent
 * folder); the title from its first heading; the front
 * matter as fields; the text below the title; links to other files of the folder.
 */
export function readMarkdown(doc: MarkdownDoc, named: Record<string, string> = {}): ReadDoc {
  const kinds = Object.fromEntries(Object.entries(named).map(([key, kind]) => [fold(key), kind]));
  const { front, body } = splitFrontMatter(
    doc.text.charCodeAt(0) === 0xfeff ? doc.text.slice(1) : doc.text,
  );
  const parts = doc.path.split('/');
  const file = parts.at(-1)!.replace(/\.md$/i, '');
  // `_carte.md`, `README.md`, `index.md` speak for their folder.
  const describesFolder = describes(doc.path);
  const folders = parts.slice(0, describesFolder ? -2 : -1);
  const nearest = [...folders].reverse().find((folder) => kinds[fold(folder)]);
  const parent = folders.at(-1);
  const given = typeof front.kind === 'string' && front.kind.trim() ? front.kind.trim() : null;
  const kind =
    kinds[fold(doc.path)] ||
    (given && (kinds[fold(given)] ?? given)) ||
    (nearest && kinds[fold(nearest)]) ||
    (parent && !/^\d{4}(-\d{2})?$/.test(parent) ? kindOfFolder(parent) : 'Note');

  const heading = /^#[ \t]+(.+?)[ \t#]*$/m.exec(body);
  // A title, else a name (a skill's), in the front matter wins over the heading.
  const titled =
    [front.title, front.name]
      .find((one): one is string => typeof one === 'string' && one.trim() !== '')
      ?.trim() ?? null;
  const title = (
    titled ??
    heading?.[1]?.trim() ??
    (describesFolder ? parts.at(-2)! : file).replace(/[-_]+/g, ' ')
  ).slice(0, 300);
  let text = heading && !titled ? body.replace(heading[0], '') : body;

  // The links an export wrote under « Liens » carry their role; any other link « mentionne ».
  const links: ReadDoc['links'] = [];
  const section = new RegExp(`^## ${LINKS_HEADING}[ \\t]*\\r?\\n((?:[-*] .*(?:\\r?\\n|$))+)`, 'm');
  const written = section.exec(text);
  if (written) {
    for (const line of written[1]!.split(/\r?\n/)) {
      const one = /^[-*] (.+?) : \[[^\]]*\]\(([^)]+)\)/.exec(line);
      if (one) links.push({ target: safeDecode(one[2]!), role: one[1]!.trim(), wiki: false });
    }
    text = text.replace(written[0], '');
  }
  for (const match of text.matchAll(/\[[^\]]*\]\(<?([^)\s>]+?\.md)>?(?:#[^)]*)?\)/gi)) {
    if (!/^[a-z]+:/i.test(match[1]!)) {
      links.push({ target: safeDecode(match[1]!), role: MENTION, wiki: false });
    }
  }
  for (const match of text.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
    links.push({ target: match[1]!.trim(), role: MENTION, wiki: true });
  }

  const origin: Record<string, Origin> = {};
  const origins = front[ORIGIN_KEY];
  const data: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(front)) {
    if (!RESERVED.has(field) && value !== null && value !== undefined) data[field] = value;
  }
  if (!('date' in data)) {
    const day = /^(\d{4}-\d{2}-\d{2})/.exec(file);
    if (day) data.date = day[1];
  }
  const trimmed = text.trim();
  if (trimmed) data[TEXT_FIELD] = trimmed;
  data[SOURCE_FIELD] = doc.path;
  for (const field of Object.keys(data)) {
    const said =
      origins && typeof origins === 'object' ? (origins as Record<string, unknown>)[field] : null;
    origin[field] = said === 'said' || said === 'inferred' ? said : 'read';
  }
  return { path: doc.path, kind, title, data, origin, links };
}

/**
 * A file that speaks for its folder: `README.md`, `index.md`, or one word after `_` (`_carte.md`,
 * `_mois.md`); not `_a-ecrire.md`, which is a file like any other.
 */
const describes = (path: string) =>
  path.includes('/') && /(^|\/)(readme|index|skill|_[\p{L}\d]+)\.md$/iu.test(path);

const safeDecode = (text: string) => {
  try {
    return decodeURI(text);
  } catch {
    return text;
  }
};

export interface ImportReport {
  /** The journal line of the whole import: undoing it takes the import back. */
  journalId: number | null;
  created: number;
  updated: number;
  unchanged: number;
  links: number;
  /** Links whose other end is not in the folder. */
  unresolved: number;
}

type Existing = { id: string; kind: string; title: string; data: Record<string, unknown> };

/**
 * Imports a Markdown folder into a space: one entry per file (origin « read », its path kept in
 * `source`), links between them. Importing the same folder again changes what changed and adds
 * nothing twice. Every change is journaled, and one line names the import, so it is undone at once.
 */
export async function importMarkdown(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { docs: MarkdownDoc[]; kinds?: Record<string, string>; name?: string },
): Promise<ImportReport> {
  const read = input.docs.map((doc) => readMarkdown(doc, input.kinds));
  const report: ImportReport = {
    journalId: null,
    created: 0,
    updated: 0,
    unchanged: 0,
    links: 0,
    unresolved: 0,
  };
  const lines: number[] = [];

  const existing = new Map<string, Existing>(
    (
      await tx.query<Existing & { source: string }>(
        `select id, kind, title, data, data->>'source' as source from entry
          where space_id = $1 and archived_at is null and data ? 'source'`,
        [spaceId],
      )
    ).rows.map((row) => [row.source, row]),
  );
  // A kind as it was first written in this space (decision 0005), read once.
  const written = new Map<string, string>();
  for (const row of (
    await tx.query<{ kind: string }>(
      `select distinct on (jarvis_fold(kind)) kind from entry where space_id = $1
        order by jarvis_fold(kind), created_at`,
      [spaceId],
    )
  ).rows) {
    written.set(fold(row.kind), row.kind);
  }
  const kindOf = (kind: string) => {
    const key = fold(kind);
    if (!written.has(key)) written.set(key, kind);
    return written.get(key)!;
  };

  const idOf = new Map<string, string>();
  const created: { id: string; kind: string; title: string; data: unknown; origin: unknown }[] = [];
  for (const doc of read) {
    const kind = kindOf(doc.kind);
    const was = existing.get(doc.path);
    if (!was) {
      const id = prefixedId('ent');
      idOf.set(doc.path, id);
      created.push({ id, kind, title: doc.title, data: doc.data, origin: doc.origin });
      continue;
    }
    idOf.set(doc.path, was.id);
    // Fields she added in Jarvis stay; those the file holds are read again.
    const data = { ...was.data, ...doc.data };
    if (was.kind === kind && was.title === doc.title && same(was.data, data)) {
      report.unchanged += 1;
      continue;
    }
    const before = (
      await tx.query<Record<string, unknown>>(
        'select kind, title, data, origin, archived_at from entry where id = $1 for update',
        [was.id],
      )
    ).rows[0]!;
    const origin = { ...(before.origin as Record<string, Origin>), ...doc.origin };
    await tx.query(
      `update entry set kind = $2, title = $3, data = $4, origin = $5, updated_at = now()
        where id = $1`,
      [was.id, kind, doc.title, JSON.stringify(data), JSON.stringify(origin)],
    );
    lines.push(
      await record(tx, actor, {
        spaceId,
        command: 'entry.update',
        target: was.id,
        before,
        after: { kind, title: doc.title, data, origin, archived_at: null },
      }),
    );
    report.updated += 1;
  }

  for (let start = 0; start < created.length; start += 200) {
    const chunk = created.slice(start, start + 200);
    await tx.query(
      `insert into entry (id, space_id, kind, title, data, origin)
       select x.id, $2, x.kind, x.title, x.data, x.origin
         from jsonb_to_recordset($1) as x(id text, kind text, title text, data jsonb, origin jsonb)`,
      [JSON.stringify(chunk), spaceId],
    );
    lines.push(
      ...(await recordMany(
        tx,
        actor,
        chunk.map((one) => ({
          spaceId,
          command: 'entry.create' as const,
          target: one.id,
          before: null,
          after: {
            kind: one.kind,
            title: one.title,
            data: one.data,
            origin: one.origin,
            archived_at: null,
          },
        })),
      )),
    );
  }
  report.created = created.length;

  // Links: a path relative to the file, a path from the folder's root, or a wiki name.
  const byName = new Map<string, string>();
  for (const doc of read) {
    byName.set(fold(posix.basename(doc.path, '.md')), doc.path);
    byName.set(fold(doc.title), doc.path);
  }
  const wanted = new Map<string, { from: string; to: string; role: string }>();
  for (const doc of read) {
    for (const link of doc.links) {
      const path = link.wiki
        ? byName.get(fold(link.target))
        : [
            posix.normalize(posix.join(posix.dirname(doc.path), link.target)),
            posix.normalize(link.target),
          ]
            .map((one) => one.replace(/^\.\//, ''))
            .find((one) => idOf.has(one));
      const to = path ? idOf.get(path) : undefined;
      const from = idOf.get(doc.path)!;
      if (!to) {
        report.unresolved += 1;
        continue;
      }
      if (to !== from) wanted.set(`${from} ${to} ${link.role}`, { from, to, role: link.role });
    }
  }
  // Each file belongs to the nearest folder above it that a file describes.
  const folderOf = new Map<string, string>();
  for (const doc of read) {
    const folder = posix.dirname(doc.path);
    if (
      describes(doc.path) &&
      !/^(readme|index)$/i.test(posix.basename(folderOf.get(folder) ?? '', '.md'))
    ) {
      folderOf.set(folder, doc.path);
    }
  }
  for (const doc of read) {
    let folder = posix.dirname(doc.path);
    if (folderOf.get(folder) === doc.path) folder = posix.dirname(folder);
    while (folder !== '.' && !folderOf.has(folder)) folder = posix.dirname(folder);
    const whole = folderOf.get(folder);
    if (whole && whole !== doc.path) {
      const from = idOf.get(doc.path)!;
      const to = idOf.get(whole)!;
      wanted.set(`${from} ${to} ${PART_OF}`, { from, to, role: PART_OF });
    }
  }
  const links = [...wanted.values()].map((one) => ({ ...one, id: prefixedId('lnk') }));
  for (let start = 0; start < links.length; start += 500) {
    const { rows } = await tx.query<{ id: string; from_id: string; to_id: string; role: string }>(
      `insert into link (id, space_id, from_id, to_id, role)
       select x.id, $2, x.from, x.to, x.role
         from jsonb_to_recordset($1) as x(id text, "from" text, "to" text, role text)
       on conflict (from_id, to_id, role) do nothing returning id, from_id, to_id, role`,
      [JSON.stringify(links.slice(start, start + 500)), spaceId],
    );
    lines.push(
      ...(await recordMany(
        tx,
        actor,
        rows.map((row) => ({
          spaceId,
          command: 'link.add' as const,
          target: row.id,
          before: null,
          after: row,
        })),
      )),
    );
    report.links += rows.length;
  }

  if (lines.length > 0) {
    report.journalId = await record(tx, actor, {
      spaceId,
      command: 'import.run',
      target: prefixedId('imp'),
      before: null,
      after: {
        name: input.name ?? null,
        lines,
        created: report.created,
        updated: report.updated,
        links: report.links,
      },
    });
  }
  return report;
}

const same = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sorted((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** One file of an export: Markdown text, or the bytes of a file she gave. */
export interface ExportedFile {
  path: string;
  content: string | Uint8Array;
}

/**
 * A space as a folder (decision 0007): one folder per kind, one Markdown file per entry, the bytes
 * of her files beside their entry. Archived entries stay out. What `importMarkdown` reads back.
 */
export async function exportMarkdown(
  tx: Tx,
  spaceId: string,
  blobs?: Blobs,
): Promise<ExportedFile[]> {
  const { rows: entries } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    data: Record<string, unknown>;
    origin: Record<string, Origin>;
    createdAt: string;
  }>(
    `select id, kind, title, data, origin, to_char(created_at, 'YYYY-MM-DD') as "createdAt" from entry
      where space_id = $1 and archived_at is null order by created_at, id`,
    [spaceId],
  );
  const { rows: links } = await tx.query<{ from_id: string; to_id: string; role: string }>(
    `select l.from_id, l.to_id, l.role from link l
       join entry a on a.id = l.from_id and a.archived_at is null
       join entry b on b.id = l.to_id and b.archived_at is null
      where l.space_id = $1 order by l.created_at, l.id`,
    [spaceId],
  );
  const { rows: stored } = await tx.query<{ entry_id: string; name: string; storage_key: string }>(
    'select entry_id, name, storage_key from file where space_id = $1',
    [spaceId],
  );
  const fileOf = new Map(stored.map((row) => [row.entry_id, row]));

  // An imported entry goes back where it came from; any other where its kind's model says
  // (spec 012), else into its kind's folder.
  const rangementOf = new Map(
    (await modelsOf(tx, spaceId)).map((model) => [fold(model.kind), model.rangement]),
  );
  const taken = new Set<string>();
  const pathOf = new Map<string, string>();
  for (const entry of entries) {
    const source = entry.data[SOURCE_FIELD];
    let path =
      typeof source === 'string' &&
      /\.md$/i.test(source) &&
      !source.startsWith('/') &&
      !source.includes('..')
        ? source
        : (placeOf(rangementOf.get(fold(entry.kind)), entry, slugOf) ??
          `${slugOf(entry.kind)}/${slugOf(entry.title)}.md`);
    for (let n = 2; taken.has(path.toLowerCase()); n += 1) {
      path = path.replace(/(?:-\d+)?\.md$/i, `-${n}.md`);
    }
    taken.add(path.toLowerCase());
    pathOf.set(entry.id, path);
  }

  const out: ExportedFile[] = [];
  for (const entry of entries) {
    const path = pathOf.get(entry.id)!;
    const { [TEXT_FIELD]: text, ...fields } = entry.data;
    delete fields[SOURCE_FIELD];
    const origins = Object.fromEntries(
      Object.entries(entry.origin).filter(
        ([field, origin]) => origin !== 'read' && field in fields,
      ),
    );
    const front: Record<string, unknown> = { kind: entry.kind, id: entry.id, ...fields };
    if (Object.keys(origins).length > 0) front[ORIGIN_KEY] = origins;
    const file = fileOf.get(entry.id);
    const parts = [`---\n${stringifyYaml(front).trimEnd()}\n---\n`, `# ${entry.title}\n`];
    if (typeof text === 'string' && text.trim()) parts.push(`${text.trim()}\n`);
    if (file && blobs) {
      // The bytes beside the entry, under the name she gave them.
      let beside = posix.join(
        posix.dirname(path),
        `${slugOf(file.name.replace(/\.[^.]*$/, ''))}${/\.[a-z0-9]{1,8}$/i.exec(file.name)?.[0]?.toLowerCase() ?? ''}`,
      );
      for (let n = 2; taken.has(beside.toLowerCase()); n += 1) {
        beside = beside.replace(
          /(?:-\d+)?(\.[^./]*)?$/,
          (_all, ext: string | undefined) => `-${n}${ext ?? ''}`,
        );
      }
      taken.add(beside.toLowerCase());
      out.push({ path: beside, content: await blobs.get(file.storage_key) });
      parts.push(`[${file.name}](${encodeURI(posix.basename(beside))})\n`);
    }
    const mine = links.filter((link) => link.from_id === entry.id);
    if (mine.length > 0) {
      parts.push(
        `## ${LINKS_HEADING}\n${mine
          .map((link) => {
            const to = pathOf.get(link.to_id)!;
            const title = entries.find((one) => one.id === link.to_id)!.title;
            return `- ${link.role} : [${title.replace(/[[\]]/g, '')}](${encodeURI(posix.relative(posix.dirname(path), to))})`;
          })
          .join('\n')}\n`,
      );
    }
    out.push({ path, content: parts.join('\n') });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
