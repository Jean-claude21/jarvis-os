import type { Actor, Tx } from './db';
import { get, save, type Entry } from './entries';

// A note on an entry (spec 039, plan v2 C8): a « Comment » linked to it (`on`), her words as she
// said them, who wrote it and when. Any entry may have some; in a shared space each member sees
// them. Journaled, undone at once — and set aside like any entry.

export const COMMENT_KIND = 'Comment';

/** Her note on an entry. */
export async function comment(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  id: string,
  text: string,
): Promise<Entry> {
  const words = text.trim();
  if (!words) throw new Error('A comment needs words.');
  if (words.length > 4000) throw new Error('A comment is larger than 4000 characters.');
  const on = await get(tx, spaceId, id);
  if (!on) throw new Error(`No entry ${id} in this space.`);
  const saved = await save(tx, actor, spaceId, {
    entries: [
      {
        ref: 'c',
        kind: COMMENT_KIND,
        title: words.length > 80 ? `${words.slice(0, 77)}…` : words,
        data: { text: words, by: actor.person },
        origin: 'said',
      },
    ],
    links: [{ from: 'c', to: id, role: 'on' }],
  });
  return (await get(tx, spaceId, saved.entries[0]!.id))!;
}

/** The notes on an entry, the oldest first. */
export async function commentsOf(tx: Tx, spaceId: string, id: string): Promise<Entry[]> {
  const { rows } = await tx.query<{ id: string }>(
    `select e.id from link l join entry e on e.id = l.from_id
      where l.space_id = $1 and l.to_id = $2 and jarvis_fold(l.role) = 'on'
        and jarvis_fold(e.kind) = 'comment' and e.archived_at is null
      order by e.created_at, e.id limit 200`,
    [spaceId, id],
  );
  const out: Entry[] = [];
  for (const row of rows) {
    const one = await get(tx, spaceId, row.id);
    if (one) {
      const entry: Entry & { links?: unknown } = { ...one };
      delete entry.links;
      out.push(entry);
    }
  }
  return out;
}
