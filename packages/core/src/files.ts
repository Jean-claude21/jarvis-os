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
}

export const FILE_MAX_BYTES = 20 * 1024 * 1024;
const TEXT_MAX_CHARS = 20_000;

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
  await blobs.put(storageKey, input.bytes, input.mediaType);
  await tx.query(
    `insert into file (entry_id, space_id, storage_key, name, media_type, size, text)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entryId,
      input.spaceId,
      storageKey,
      name,
      input.mediaType,
      input.bytes.byteLength,
      wordsOf(input.bytes, input.mediaType),
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
