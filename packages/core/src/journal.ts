import type { Actor, Tx } from './db';

export type Command =
  | 'entry.create'
  | 'entry.update'
  | 'entry.archive'
  | 'link.add'
  | 'link.remove'
  | 'journal.undo'
  // A Markdown folder imported (spec 007): undone at once, each of its changes with it.
  | 'import.run'
  // A migration of a kind's entries, an app installed (spec 014): undone at once, like an import.
  | 'migration.run'
  | 'app.install'
  // Many entries filed, retyped or set aside, a kind renamed (spec 017): undone at once.
  | 'entries.change'
  | 'kind.rename'
  // Who belongs to a space (spec 004): journaled, never undone through `undo`.
  | 'space.create'
  | 'space.rename'
  | 'space.invite'
  | 'space.withdraw'
  | 'space.join'
  | 'space.leave'
  | 'space.role';

export interface JournalLine {
  id: number;
  at: string;
  command: Command;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor: string;
  door: string;
  client: string | null;
  undoneBy: number | null;
}

/** Every change, with what it was before and what it became (constitution V). */
export async function record(
  tx: Tx,
  actor: Actor,
  line: {
    spaceId: string;
    command: Command;
    target: string;
    before: unknown;
    after: unknown;
  },
): Promise<number> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into journal (space_id, command, target, before, after, actor, door, client)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [
      line.spaceId,
      line.command,
      line.target,
      line.before === null ? null : JSON.stringify(line.before),
      line.after === null ? null : JSON.stringify(line.after),
      actor.person,
      actor.door,
      actor.client ?? null,
    ],
  );
  return Number(rows[0]!.id);
}

/** Many changes at once (an import): their journal ids, in no particular order. */
export async function recordMany(
  tx: Tx,
  actor: Actor,
  lines: { spaceId: string; command: Command; target: string; before: unknown; after: unknown }[],
): Promise<number[]> {
  if (lines.length === 0) return [];
  const { rows } = await tx.query<{ id: string }>(
    `insert into journal (space_id, command, target, before, after, actor, door, client)
     select x.space_id, x.command, x.target, x.before, x.after, $2, $3, $4
       from jsonb_to_recordset($1) as x(space_id text, command text, target text, before jsonb, after jsonb)
     returning id`,
    [
      JSON.stringify(
        lines.map((line) => ({
          space_id: line.spaceId,
          command: line.command,
          target: line.target,
          before: line.before,
          after: line.after,
        })),
      ),
      actor.person,
      actor.door,
      actor.client ?? null,
    ],
  );
  return rows.map((row) => Number(row.id));
}

/** The latest changes of a space, or of one entry, newest first. */
export async function history(
  tx: Tx,
  spaceId: string,
  options: { target?: string; limit?: number } = {},
): Promise<JournalLine[]> {
  const { rows } = await tx.query<JournalLine & { id: string; undoneBy: string | null }>(
    `select id, to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as at, command,
            target, before, after, actor, door, client, undone_by as "undoneBy"
       from journal where space_id = $1 and ($2::text is null or target = $2)
      order by id desc limit $3`,
    [spaceId, options.target ?? null, Math.min(options.limit ?? 50, 500)],
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    undoneBy: row.undoneBy === null ? null : Number(row.undoneBy),
  }));
}

/**
 * Takes a change back: what it changed returns to what it was, and the undo is journaled too. A
 * created entry is set aside, never erased. A change already undone, or an undo, cannot be undone.
 */
export async function undo(
  tx: Tx,
  actor: Actor,
  input: { spaceId: string; journalId: number },
): Promise<{ undone: number; by: number }> {
  const { rows } = await tx.query<{
    command: Command;
    target: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    undone_by: string | null;
  }>(
    'select command, target, before, after, undone_by from journal where id = $1 and space_id = $2 for update',
    [input.journalId, input.spaceId],
  );
  const line = rows[0];
  if (!line) throw new Error(`No change ${input.journalId} in this space.`);
  if (line.undone_by !== null) throw new Error(`Change ${input.journalId} is already undone.`);
  if (line.command === 'journal.undo') throw new Error('An undo cannot be undone.');
  if (line.command.startsWith('space.')) {
    throw new Error('Who belongs to a space is not undone: invite, withdraw or leave instead.');
  }
  if (
    line.command === 'import.run' ||
    line.command === 'migration.run' ||
    line.command === 'app.install' ||
    line.command === 'entries.change' ||
    line.command === 'kind.rename'
  ) {
    // Its changes, the latest first; those already undone stay as they are.
    const done = ((line.after?.lines as number[] | undefined) ?? []).slice().sort((a, b) => b - a);
    const { rows: open } = await tx.query<{ id: string }>(
      'select id from journal where id = any($1) and space_id = $2 and undone_by is null',
      [done, input.spaceId],
    );
    const still = new Set(open.map((row) => Number(row.id)));
    for (const id of done) {
      if (still.has(id)) await undo(tx, actor, { spaceId: input.spaceId, journalId: id });
    }
    const by = await record(tx, actor, {
      spaceId: input.spaceId,
      command: 'journal.undo',
      target: line.target,
      before: line.after,
      after: { undoes: input.journalId },
    });
    await tx.query('update journal set undone_by = $2 where id = $1', [input.journalId, by]);
    return { undone: input.journalId, by };
  }
  const current = async () =>
    (
      await tx.query<Record<string, unknown>>(
        'select kind, title, data, origin, archived_at from entry where id = $1',
        [line.target],
      )
    ).rows[0] ?? null;
  const before = line.command.startsWith('entry.') ? await current() : line.after;
  switch (line.command) {
    case 'entry.create':
      await tx.query('update entry set archived_at = now(), updated_at = now() where id = $1', [
        line.target,
      ]);
      break;
    case 'entry.update':
    case 'entry.archive': {
      const was = line.before!;
      await tx.query(
        `update entry set kind = $2, title = $3, data = $4, origin = $5, archived_at = $6,
                          updated_at = now() where id = $1`,
        [
          line.target,
          was.kind,
          was.title,
          JSON.stringify(was.data),
          JSON.stringify(was.origin),
          was.archived_at ?? null,
        ],
      );
      break;
    }
    case 'link.add':
      await tx.query('delete from link where id = $1', [line.target]);
      break;
    case 'link.remove': {
      const was = line.before as { id: string; from_id: string; to_id: string; role: string };
      await tx.query(
        `insert into link (id, space_id, from_id, to_id, role) values ($1, $2, $3, $4, $5)
         on conflict do nothing`,
        [was.id, input.spaceId, was.from_id, was.to_id, was.role],
      );
      break;
    }
  }
  const after = line.command.startsWith('entry.') ? await current() : line.before;
  const by = await record(tx, actor, {
    spaceId: input.spaceId,
    command: 'journal.undo',
    target: line.target,
    before,
    after: { ...(after ?? {}), undoes: input.journalId },
  });
  await tx.query('update journal set undone_by = $2 where id = $1', [input.journalId, by]);
  return { undone: input.journalId, by };
}
