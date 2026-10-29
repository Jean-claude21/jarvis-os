import type { Actor, Tx } from './db';
import { prefixedId } from './ids';
import { record } from './journal';
import {
  findInputSchema,
  saveInputSchema,
  type EntryInput,
  type FindInput,
  type LinkInput,
  type Origin,
  type SaveInput,
} from './schemas';

export interface Entry {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  origin: Record<string, Origin>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface LinkView {
  id: string;
  role: string;
  /** The entry at the other end. */
  entry: { id: string; kind: string; title: string };
}

const columns = `id, kind, title, data, origin,
  to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
  to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt",
  to_char(archived_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "archivedAt"`;

/** What the journal keeps of an entry: enough to put it back. */
const snapshotOf = async (tx: Tx, id: string) =>
  (
    await tx.query<Record<string, unknown>>(
      'select kind, title, data, origin, archived_at from entry where id = $1',
      [id],
    )
  ).rows[0] ?? null;

function originsFor(input: EntryInput, fields: string[]): Record<string, Origin> {
  const given = input.origin ?? 'said';
  return Object.fromEntries(
    fields.map((field) => [field, typeof given === 'string' ? given : (given[field] ?? 'said')]),
  );
}

export interface Saved {
  entries: { ref: string | null; id: string; kind: string; title: string; created: boolean }[];
  links: { id: string; from: string; to: string; role: string }[];
  unlinked: number;
}

/**
 * One save of what she said: new entries and changes to existing ones, the links among them, the
 * links taken away — every change journaled. A field given `null` is removed.
 */
export async function save(tx: Tx, actor: Actor, spaceId: string, raw: SaveInput): Promise<Saved> {
  const input = saveInputSchema.parse(raw);
  const refs = new Map<string, string>();
  const saved: Saved = { entries: [], links: [], unlinked: 0 };

  for (const one of input.entries) {
    const given = one.data ?? {};
    const kept = Object.keys(given).filter((field) => given[field] !== null);
    if (!one.id) {
      if (!one.kind || !one.title) throw new Error('A new entry needs a kind and a title.');
      const id = prefixedId('ent');
      const data = Object.fromEntries(kept.map((field) => [field, given[field]]));
      await tx.query(
        'insert into entry (id, space_id, kind, title, data, origin) values ($1, $2, $3, $4, $5, $6)',
        [
          id,
          spaceId,
          one.kind,
          one.title,
          JSON.stringify(data),
          JSON.stringify(originsFor(one, kept)),
        ],
      );
      await record(tx, actor, {
        spaceId,
        command: 'entry.create',
        target: id,
        before: null,
        after: await snapshotOf(tx, id),
      });
      if (one.ref) refs.set(one.ref, id);
      saved.entries.push({
        ref: one.ref ?? null,
        id,
        kind: one.kind,
        title: one.title,
        created: true,
      });
      continue;
    }
    const { rows } = await tx.query<{
      kind: string;
      title: string;
      data: Record<string, unknown>;
      origin: Record<string, Origin>;
    }>('select kind, title, data, origin from entry where id = $1 and space_id = $2 for update', [
      one.id,
      spaceId,
    ]);
    const current = rows[0];
    if (!current) throw new Error(`No entry ${one.id} in this space.`);
    const before = await snapshotOf(tx, one.id);
    const data = { ...current.data };
    const origin = { ...current.origin, ...originsFor(one, kept) };
    for (const [field, value] of Object.entries(given)) {
      if (value === null) {
        delete data[field];
        delete origin[field];
      } else {
        data[field] = value;
      }
    }
    const kind = one.kind ?? current.kind;
    const title = one.title ?? current.title;
    await tx.query(
      `update entry set kind = $2, title = $3, data = $4, origin = $5, updated_at = now()
        where id = $1`,
      [one.id, kind, title, JSON.stringify(data), JSON.stringify(origin)],
    );
    const after = await snapshotOf(tx, one.id);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await record(tx, actor, { spaceId, command: 'entry.update', target: one.id, before, after });
    }
    if (one.ref) refs.set(one.ref, one.id);
    saved.entries.push({ ref: one.ref ?? null, id: one.id, kind, title, created: false });
  }

  const resolve = async (link: LinkInput) => {
    const from = refs.get(link.from) ?? link.from;
    const to = refs.get(link.to) ?? link.to;
    const { rows } = await tx.query<{ id: string }>(
      'select id from entry where space_id = $1 and id = any($2)',
      [spaceId, [from, to]],
    );
    const found = new Set(rows.map((row) => row.id));
    for (const end of [from, to]) {
      if (!found.has(end)) throw new Error(`No entry ${end} in this space to link.`);
    }
    return { from, to, role: link.role };
  };

  for (const link of input.links) {
    const { from, to, role } = await resolve(link);
    const id = prefixedId('lnk');
    const { rows } = await tx.query<{ id: string }>(
      `insert into link (id, space_id, from_id, to_id, role) values ($1, $2, $3, $4, $5)
       on conflict (from_id, to_id, role) do nothing returning id`,
      [id, spaceId, from, to, role],
    );
    if (rows[0]) {
      await record(tx, actor, {
        spaceId,
        command: 'link.add',
        target: id,
        before: null,
        after: { id, from_id: from, to_id: to, role },
      });
    }
    saved.links.push({ id: rows[0]?.id ?? id, from, to, role });
  }

  for (const link of input.unlink) {
    const { from, to, role } = await resolve(link);
    const { rows } = await tx.query<{ id: string }>(
      'delete from link where space_id = $1 and from_id = $2 and to_id = $3 and role = $4 returning id',
      [spaceId, from, to, role],
    );
    for (const row of rows) {
      await record(tx, actor, {
        spaceId,
        command: 'link.remove',
        target: row.id,
        before: { id: row.id, from_id: from, to_id: to, role },
        after: null,
      });
      saved.unlinked += 1;
    }
  }
  return saved;
}

/** One entry, with its links both ways. */
export async function get(
  tx: Tx,
  spaceId: string,
  id: string,
): Promise<(Entry & { links: { out: LinkView[]; in: LinkView[] } }) | null> {
  const { rows } = await tx.query<Entry>(
    `select ${columns} from entry where id = $1 and space_id = $2`,
    [id, spaceId],
  );
  const entry = rows[0];
  if (!entry) return null;
  const ends = async (direction: 'out' | 'in') =>
    (
      await tx.query<{ id: string; role: string; entry_id: string; kind: string; title: string }>(
        direction === 'out'
          ? `select l.id, l.role, e.id as entry_id, e.kind, e.title from link l
               join entry e on e.id = l.to_id where l.from_id = $1 order by l.created_at`
          : `select l.id, l.role, e.id as entry_id, e.kind, e.title from link l
               join entry e on e.id = l.from_id where l.to_id = $1 order by l.created_at`,
        [id],
      )
    ).rows.map((row) => ({
      id: row.id,
      role: row.role,
      entry: { id: row.entry_id, kind: row.kind, title: row.title },
    }));
  return { ...entry, links: { out: await ends('out'), in: await ends('in') } };
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Entries by words (in the title, the fields and a text file's words, accents and case aside,
 * every word present), by
 * kind, by the day they were created; the latest first. Archived ones only when asked.
 */
export async function find(tx: Tx, spaceId: string, raw: FindInput = {}): Promise<Entry[]> {
  const input = findInputSchema.parse(raw);
  const words = fold(input.text ?? '')
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const { rows } = await tx.query<Entry>(
    `select ${columns} from entry
      where space_id = $1
        and ($2::boolean or archived_at is null)
        and ($3::text is null or lower(kind) = lower($3))
        and ($4::date is null or created_at >= $4::date)
        and ($5::date is null or created_at < $5::date + 1)
        and (select bool_and(jarvis_fold(title || ' ' || data::text || ' ' || jarvis_file_words(id))
                             like '%' || word || '%')
               from unnest($6::text[]) as word) is not false
      order by updated_at desc limit $7`,
    [
      spaceId,
      input.archived,
      input.kind ?? null,
      input.from ?? null,
      input.to ?? null,
      words,
      input.limit,
    ],
  );
  return rows;
}

export interface Kind {
  kind: string;
  count: number;
  fields: string[];
}

/** The kinds of things in a space, the most used first, with the fields each uses. */
export async function kinds(tx: Tx, spaceId: string): Promise<Kind[]> {
  const { rows } = await tx.query<Kind>(
    `select e.kind, count(distinct e.id)::int as count,
            coalesce(array_agg(distinct f.key) filter (where f.key is not null), '{}') as fields
       from entry e left join lateral jsonb_object_keys(e.data) as f(key) on true
      where e.space_id = $1 and e.archived_at is null
      group by e.kind order by count desc, e.kind`,
    [spaceId],
  );
  return rows;
}

/** Sets an entry aside (never erased); journaled, so undone like any change. */
export async function archive(
  tx: Tx,
  actor: Actor,
  input: { spaceId: string; id: string },
): Promise<void> {
  const before = await snapshotOf(tx, input.id);
  const { rowCount } = await tx.query(
    `update entry set archived_at = now(), updated_at = now()
      where id = $1 and space_id = $2 and archived_at is null`,
    [input.id, input.spaceId],
  );
  if (!rowCount) throw new Error(`No entry ${input.id} to set aside in this space.`);
  await record(tx, actor, {
    spaceId: input.spaceId,
    command: 'entry.archive',
    target: input.id,
    before,
    after: await snapshotOf(tx, input.id),
  });
}
