import type pg from 'pg';
import type { Actor, Tx } from './db';
import { save } from './entries';
import type { LinkInput, Origin } from './schemas';

/**
 * Where the bytes of her files live: a port, so the core names no storage vendor. Keys are
 * `<space>/<entry>`.
 */
export interface Blobs {
  put(key: string, bytes: Uint8Array, mediaType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  /** A link that opens the file without a token, for `seconds`. */
  link(key: string, seconds: number): Promise<string>;
  /** The bytes removed, when the storage allows it (spec 022: old backups). */
  remove?(key: string): Promise<void>;
}

export const FILE_MAX_BYTES = 20 * 1024 * 1024;

/** Files whose words are read after the upload, by the watcher (spec 026): PDF, Word, photos. */
export const READ_LATER = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** A file waiting to be read, with a member of its space to read it as. */
export interface FileToRead {
  entryId: string;
  spaceId: string;
  person: string;
  storageKey: string;
  mediaType: string;
}

/** The files waiting to be read, the oldest first. */
export async function filesToRead(db: pg.Pool, max: number): Promise<FileToRead[]> {
  const { rows } = await db.query<{
    entry_id: string;
    space_id: string;
    person: string;
    storage_key: string;
    media_type: string;
  }>('select * from jarvis_files_to_read($1)', [max]);
  return rows.map((row) => ({
    entryId: row.entry_id,
    spaceId: row.space_id,
    person: row.person,
    storageKey: row.storage_key,
    mediaType: row.media_type,
  }));
}

/** What a file says, once read: its words kept for `find`, or why it could not be read. */
export async function setFileWords(
  tx: Tx,
  entryId: string,
  outcome: { text: string | null } | { error: string },
): Promise<void> {
  if ('error' in outcome) {
    await tx.query(
      `update file set read_state = 'failed', read_error = $2, read_at = now() where entry_id = $1`,
      [entryId, outcome.error.slice(0, 500)],
    );
    return;
  }
  const text = outcome.text?.replace(/\s+\n/g, '\n').trim().slice(0, READ_MAX_CHARS) || null;
  await tx.query(
    `update file set text = $2, read_state = $3, read_error = null, read_at = now() where entry_id = $1`,
    [entryId, text, text ? 'read' : 'none'],
  );
}
const TEXT_MAX_CHARS = 20_000;
/** A read document keeps more: a contract, a statement of several pages. */
const READ_MAX_CHARS = 200_000;

export interface StoredFile {
  entryId: string;
  name: string;
  mediaType: string;
  size: number;
  storageKey: string;
}

/** Words a file says, when it is text: kept so `find` reaches them. */
function wordsOf(bytes: Uint8Array, mediaType: string): string | null {
  const textual =
    mediaType.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/csv'].includes(mediaType);
  if (!textual) return null;
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).slice(0, TEXT_MAX_CHARS);
}

/**
 * A file she gives: an entry of kind `Fichier` (its title, fields and links like any entry), the
 * bytes in her space's storage, and its words when it is text — journaled like any save.
 */
export async function addFile(
  tx: Tx,
  actor: Actor,
  blobs: Blobs,
  input: {
    spaceId: string;
    name: string;
    mediaType: string;
    bytes: Uint8Array;
    title?: string;
    data?: Record<string, unknown>;
    origin?: Origin;
    /** Links from this file, e.g. `{ to: 'ent_…', role: 'pièce de' }`. */
    links?: Omit<LinkInput, 'from'>[];
  },
): Promise<StoredFile> {
  if (input.bytes.byteLength === 0) throw new Error('The file is empty.');
  if (input.bytes.byteLength > FILE_MAX_BYTES) {
    throw new Error(`The file is larger than ${FILE_MAX_BYTES / 1024 / 1024} MB.`);
  }
  const name = input.name.trim().slice(0, 200) || 'fichier';
  const saved = await save(tx, actor, input.spaceId, {
    entries: [
      {
        ref: 'file',
        kind: 'Fichier',
        title: input.title?.trim() || name,
        data: { nom: name, type: input.mediaType, taille: input.bytes.byteLength, ...input.data },
        ...(input.origin ? { origin: input.origin } : {}),
      },
    ],
    links: (input.links ?? []).map((link) => ({ ...link, from: 'file' })),
  });
  const entryId = saved.entries[0]!.id;
  const storageKey = `${input.spaceId}/${entryId}`;
  const words = wordsOf(input.bytes, input.mediaType);
  await blobs.put(storageKey, input.bytes, input.mediaType);
  await tx.query(
    `insert into file (entry_id, space_id, storage_key, name, media_type, size, text, read_state, read_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, case when $8 = 'read' then now() end)`,
    [
      entryId,
      input.spaceId,
      storageKey,
      name,
      input.mediaType,
      input.bytes.byteLength,
      words,
      words !== null ? 'read' : READ_LATER.has(input.mediaType) ? 'pending' : 'none',
    ],
  );
  return { entryId, name, mediaType: input.mediaType, size: input.bytes.byteLength, storageKey };
}

/** A file of her space, by its entry. */
export async function fileOf(tx: Tx, spaceId: string, entryId: string): Promise<StoredFile | null> {
  const { rows } = await tx.query<StoredFile & { size: string }>(
    `select entry_id as "entryId", name, media_type as "mediaType", size, storage_key as "storageKey"
       from file where space_id = $1 and entry_id = $2`,
    [spaceId, entryId],
  );
  const row = rows[0];
  return row ? { ...row, size: Number(row.size) } : null;
}

/** One of her files as the platform lists it (spec 013): what it is, when, by whom, what it is for. */
export interface FileRow {
  entryId: string;
  name: string;
  mediaType: string;
  size: number;
  title: string;
  createdAt: string;
  /** The entries it is linked to, either way, with the role. */
  links: { id: string; title: string; kind: string; role: string }[];
  /** Whether its words were kept (text files), so `find` reaches them. */
  read: boolean;
}

/** Every file of a space, the latest first. */
export async function filesOf(tx: Tx, spaceId: string, limit = 500): Promise<FileRow[]> {
  const { rows } = await tx.query<FileRow & { size: string }>(
    `select f.entry_id as "entryId", f.name, f.media_type as "mediaType", f.size, e.title,
            to_char(f.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
            f.text is not null as read,
            coalesce((
              select json_agg(json_build_object('id', o.id, 'title', o.title, 'kind', o.kind, 'role', l.role))
                from link l join entry o on o.id = case when l.from_id = f.entry_id then l.to_id else l.from_id end
               where (l.from_id = f.entry_id or l.to_id = f.entry_id) and o.archived_at is null
            ), '[]'::json) as links
       from file f join entry e on e.id = f.entry_id
      where f.space_id = $1 and e.archived_at is null
      order by f.created_at desc limit $2`,
    [spaceId, limit],
  );
  return rows.map((row) => ({ ...row, size: Number(row.size) }));
}
