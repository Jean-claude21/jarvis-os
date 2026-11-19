import { z } from 'zod';
import type { Tx } from './db';

// When something starts (v3 D12, F6b): one vocabulary for every « quand » of the node — a rule's
// `when` (what Jarvis does by itself) and a skill's `triggers` (what her assistant follows). A
// kind saved, a field changed, a time, some days before a date, a phrase she says, a message that
// reaches her. Before F6b, skills (routines) had their own `trigger` (`phrases`, `repeat`,
// `saved`): migration 0037 wrote them in these words.

export const triggerSchema = z.union([
  /** An entry of this kind is saved. */
  z.object({ saved: z.string().trim().min(1).max(80) }),
  /** A field changes on an entry of this kind. */
  z.object({
    changed: z.object({
      kind: z.string().trim().min(1).max(80),
      field: z.string().trim().min(1).max(60),
    }),
  }),
  /** At a time: five fields (« 0 8 * * 6 »), on her clock or the zone given. */
  z.object({
    schedule: z.string().trim().min(9).max(60),
    timezone: z.string().max(60).optional(),
  }),
  /** Some days before a date of an entry of this kind. */
  z.object({
    before: z.object({
      kind: z.string().trim().min(1).max(80),
      field: z.string().trim().min(1).max(60),
      days: z.number().int().min(0).max(366),
    }),
  }),
  /** She says a phrase (« /bilan »), from any door: one phrase starts one thing in a space. */
  z.object({ phrase: z.string().trim().min(2).max(60) }),
  /** A message reaches her (any capture), with these words or any. */
  z.object({
    message: z.object({ contains: z.string().trim().min(1).max(80).optional() }),
  }),
]);
export type Trigger = z.infer<typeof triggerSchema>;

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** The phrases an entry answers to: a rule's `when`, a skill's `triggers`. */
export function phrasesOf(data: Record<string, unknown>): string[] {
  const all = [data.when, ...(Array.isArray(data.triggers) ? data.triggers : [])];
  return all.flatMap((one) =>
    one && typeof one === 'object' && typeof (one as { phrase?: unknown }).phrase === 'string'
      ? [(one as { phrase: string }).phrase]
      : [],
  );
}

/**
 * One phrase starts one thing (F6b): saving a rule or a skill whose phrase another rule or skill
 * of the space already answers to is refused, with the one that has it.
 */
export async function checkPhrases(tx: Tx, spaceId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { rows } = await tx.query<{ id: string; title: string; data: Record<string, unknown> }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) in ('rule', 'routine')
        and (data->'when' ? 'phrase' or data ? 'triggers')`,
    [spaceId],
  );
  const owners = new Map<string, { id: string; title: string }>();
  for (const row of rows) {
    for (const phrase of phrasesOf(row.data)) {
      const key = fold(phrase);
      const was = owners.get(key);
      if (was && was.id !== row.id && (ids.includes(row.id) || ids.includes(was.id))) {
        const [mine, other] = ids.includes(row.id) ? [row, was] : [was, row];
        throw new Error(
          `« ${phrase} » already starts « ${other.title} »: one phrase starts one thing. Give « ${mine.title} » another phrase.`,
        );
      }
      owners.set(key, { id: row.id, title: row.title });
    }
  }
}
