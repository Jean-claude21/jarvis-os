import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { Actor, Tx } from './db';
import { archive, save } from './entries';
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
  /**
   * Where new files go under (« next/ » on a copy): a copy reads the real files it was cloned
   * with, but never writes among them.
   */
  prefix?: string;
  /** A large file sent in parts (v3 médias): started, each part kept, then put together. */
  startUpload?(key: string, mediaType: string): Promise<string>;
  uploadPart?(key: string, uploadId: string, n: number, bytes: Uint8Array): Promise<string>;
  finishUpload?(key: string, uploadId: string, parts: { n: number; etag: string }[]): Promise<void>;
  abortUpload?(key: string, uploadId: string): Promise<void>;
}

/** A file sent in parts may be this large (a video, a long scan). */
export const LARGE_FILE_MAX_BYTES = 500 * 1024 * 1024;

/** A file's fingerprint (SHA-256): the same bytes, the same file — never kept twice. */
export const fingerprint = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** The file of her space with these very bytes, if she has it already. */
export async function fileWithPrint(
  tx: Tx,
  spaceId: string,
  print: string,
): Promise<string | null> {
  const { rows } = await tx.query<{ id: string }>(
    `select e.id from entry e join file f on f.entry_id = e.id
      where e.space_id = $1 and e.archived_at is null and jarvis_fold(e.kind) = 'fichier'
        and e.data->>'empreinte' = $2
      order by e.created_at limit 1`,
    [spaceId, print],
  );
  return rows[0]?.id ?? null;
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
  /** She had these very bytes already: this is that file, joined where the new one was going. */
  duplicate?: boolean;
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
  // The same bytes she already keeps: the file she has is joined where this one was going.
  const print = fingerprint(input.bytes);
  const same = await fileWithPrint(tx, input.spaceId, print);
  if (same) {
    if (input.links?.length)
      await save(tx, actor, input.spaceId, {
        links: input.links.map((link) => ({ ...link, from: same })),
      });
    const kept = await fileOf(tx, input.spaceId, same);
    if (kept) return { ...kept, duplicate: true };
  }
  const saved = await save(tx, actor, input.spaceId, {
    entries: [
      {
        ref: 'file',
        kind: 'Fichier',
        title: input.title?.trim() || name,
        data: {
          nom: name,
          type: input.mediaType,
          taille: input.bytes.byteLength,
          empreinte: print,
          ...input.data,
        },
        ...(input.origin ? { origin: input.origin } : {}),
      },
    ],
    links: (input.links ?? []).map((link) => ({ ...link, from: 'file' })),
  });
  const entryId = saved.entries[0]!.id;
  const storageKey = `${blobs.prefix ?? ''}${input.spaceId}/${entryId}`;
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
  /** Where its reading stands (pending, read, none, failed). */
  readState: string;
  /** What it is, once understood (v3 V7): invoice, contract… */
  genre: string | null;
}

/** Every file of a space, the latest first. */
export async function filesOf(tx: Tx, spaceId: string, limit = 500): Promise<FileRow[]> {
  const { rows } = await tx.query<FileRow & { size: string }>(
    `select f.entry_id as "entryId", f.name, f.media_type as "mediaType", f.size, e.title,
            to_char(f.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
            f.text is not null as read, f.read_state as "readState", e.data->>'genre' as genre,
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

/**
 * A file already in her storage (sent in parts): its entry and its row — the same as `addFile`,
 * without the bytes passing through here. Read later when it is not too large to read.
 */
export async function addStoredFile(
  tx: Tx,
  actor: Actor,
  input: {
    spaceId: string;
    storageKey: string;
    name: string;
    mediaType: string;
    size: number;
    empreinte?: string;
    title?: string;
    data?: Record<string, unknown>;
    links?: Omit<LinkInput, 'from'>[];
  },
): Promise<StoredFile> {
  const name = input.name.trim().slice(0, 200) || 'fichier';
  const saved = await save(tx, actor, input.spaceId, {
    entries: [
      {
        ref: 'file',
        kind: 'Fichier',
        title: input.title?.trim() || name,
        data: {
          nom: name,
          type: input.mediaType,
          taille: input.size,
          ...(input.empreinte ? { empreinte: input.empreinte } : {}),
          ...input.data,
        },
      },
    ],
    links: (input.links ?? []).map((link) => ({ ...link, from: 'file' })),
  });
  const entryId = saved.entries[0]!.id;
  const readable = READ_LATER.has(input.mediaType) && input.size <= FILE_MAX_BYTES;
  await tx.query(
    `insert into file (entry_id, space_id, storage_key, name, media_type, size, text, read_state)
     values ($1, $2, $3, $4, $5, $6, null, $7)`,
    [
      entryId,
      input.spaceId,
      input.storageKey,
      name,
      input.mediaType,
      input.size,
      readable ? 'pending' : 'none',
    ],
  );
  return {
    entryId,
    name,
    mediaType: input.mediaType,
    size: input.size,
    storageKey: input.storageKey,
  };
}

/** A version of a file she kept before replacing it. */
export interface FileVersion {
  n: number;
  nom: string;
  type: string;
  taille: number;
  key: string;
  at: string;
}

/**
 * A file replaced (v3 médias): the new bytes become the file — its entry, links and history
 * stay — and the old ones are kept as a version she can open again. Read again afterwards.
 */
export async function replaceFile(
  tx: Tx,
  actor: Actor,
  blobs: Blobs,
  spaceId: string,
  entryId: string,
  input: {
    name: string;
    mediaType: string;
    bytes?: Uint8Array;
    storageKey?: string;
    size?: number;
  },
): Promise<StoredFile> {
  const now = await fileOf(tx, spaceId, entryId);
  if (!now) throw new Error(`No stored file for entry ${entryId}.`);
  const { rows } = await tx.query<{ data: Record<string, unknown> }>(
    'select data from entry where id = $1 and space_id = $2',
    [entryId, spaceId],
  );
  const all = (rows[0]?.data.versions as FileVersion[] | undefined) ?? [];
  // Twenty versions at most: the oldest one's bytes go when a new one comes.
  const versions = all.slice(-19);
  for (const old of all.slice(0, -19)) await blobs.remove?.(old.key).catch(() => undefined);
  const n = (versions.at(-1)?.n ?? 0) + 1;
  const size = input.bytes?.byteLength ?? input.size ?? 0;
  if (!size) throw new Error('The file is empty.');
  let storageKey = input.storageKey;
  if (input.bytes) {
    if (size > FILE_MAX_BYTES)
      throw new Error(`The file is larger than ${FILE_MAX_BYTES / 1024 / 1024} MB.`);
    storageKey = `${blobs.prefix ?? ''}${spaceId}/${entryId}-v${n + 1}`;
    await blobs.put(storageKey, input.bytes, input.mediaType);
  }
  if (!storageKey) throw new Error('Give the new bytes, or where they were sent.');
  const name = input.name.trim().slice(0, 200) || now.name;
  const words = input.bytes ? wordsOf(input.bytes, input.mediaType) : null;
  await save(tx, actor, spaceId, {
    entries: [
      {
        id: entryId,
        data: {
          nom: name,
          type: input.mediaType,
          taille: size,
          empreinte: input.bytes ? fingerprint(input.bytes) : null,
          genre: null,
          facts: null,
          versions: [
            ...versions,
            {
              n,
              nom: now.name,
              type: now.mediaType,
              taille: now.size,
              key: now.storageKey,
              at: new Date().toISOString(),
            },
          ],
        },
      },
    ],
  });
  const readable = READ_LATER.has(input.mediaType) && size <= FILE_MAX_BYTES;
  await tx.query(
    `update file set storage_key = $3, name = $4, media_type = $5, size = $6, text = $7,
            read_state = $8, read_error = null, read_at = case when $8 = 'read' then now() end
      where entry_id = $1 and space_id = $2`,
    [
      entryId,
      spaceId,
      storageKey,
      name,
      input.mediaType,
      size,
      words,
      words !== null ? 'read' : readable ? 'pending' : 'none',
    ],
  );
  return { entryId, name, mediaType: input.mediaType, size, storageKey };
}

/**
 * A file erased for good (v3 médias), on her explicit yes: its bytes, its versions and its
 * thumbnail removed from storage, its row gone, its entry set aside and marked « effacé ». The
 * journal keeps that it existed; nothing can bring the bytes back.
 */
export async function eraseFile(
  tx: Tx,
  actor: Actor,
  blobs: Blobs,
  spaceId: string,
  entryId: string,
): Promise<{ removed: number }> {
  const now = await fileOf(tx, spaceId, entryId);
  if (!now) throw new Error(`No stored file for entry ${entryId}.`);
  if (!blobs.remove) throw new Error('This storage cannot erase a file.');
  const { rows } = await tx.query<{ data: Record<string, unknown> }>(
    'select data from entry where id = $1 and space_id = $2',
    [entryId, spaceId],
  );
  const versions = (rows[0]?.data.versions as FileVersion[] | undefined) ?? [];
  const keys = [now.storageKey, `${now.storageKey}.thumb.webp`, ...versions.map((one) => one.key)];
  let removed = 0;
  for (const key of keys) {
    // Bytes another file still points at stay.
    const { rows: shared } = await tx.query(
      'select 1 from file where storage_key = $1 and entry_id <> $2 limit 1',
      [key, entryId],
    );
    if (shared.length) continue;
    await blobs.remove(key).catch(() => undefined);
    removed += 1;
  }
  await tx.query('delete from file where entry_id = $1 and space_id = $2', [entryId, spaceId]);
  await save(tx, actor, spaceId, {
    entries: [{ id: entryId, data: { efface: true, versions: null, empreinte: null } }],
  });
  await archive(tx, actor, { spaceId, id: entryId });
  return { removed };
}
