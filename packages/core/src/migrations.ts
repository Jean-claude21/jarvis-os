import { z } from 'zod';
import { readerOf } from './compute';
import type { Actor, Tx } from './db';
import { evaluate, isScope, parse } from './formula';
import { record } from './journal';
import { checkAgainst, modelOf } from './models';
import { trial, type Trial } from './trial';

// Migrations of her data (spec 014): when a model changes — a field renamed, split, computed once —
// every entry of the kind follows, tried first, each change journaled, and the whole undone at once.

export const migrationSchema = z.object({
  kind: z.string().trim().min(1).max(80),
  steps: z
    .array(
      z.union([
        z.object({ rename: z.object({ from: z.string().min(1).max(60), to: z.string().min(1).max(60) }) }),
        /** A field set from a formula of the entry (before this step): « montant * -1 », « 'sortie' ». */
        z.object({ set: z.object({ field: z.string().min(1).max(60), formula: z.string().min(1).max(1000) }) }),
        z.object({ remove: z.string().min(1).max(60) }),
      ]),
    )
    .min(1)
    .max(20),
  /** Only the entries where this formula holds. */
  where: z.string().min(1).max(1000).optional(),
  dryRun: z.boolean().default(true),
});
export type Migration = z.input<typeof migrationSchema>;

export interface MigrationReport {
  kind: string;
  matched: number;
  changed: number;
  /** Entries that will not follow the model once changed, and why (the first ten). */
  problems: { id: string; title: string; problems: string[] }[];
  sample: { id: string; title: string; before: Record<string, unknown>; after: Record<string, unknown> }[];
}

/** Changes every entry of a kind by its steps; with `dryRun` (the default), only tried. */
export async function migrateKind(tx: Tx, actor: Actor, spaceId: string, raw: Migration): Promise<Trial<MigrationReport>> {
  const input = migrationSchema.parse(raw);
  const reader = await readerOf(tx, spaceId);
  const rows = await reader.kindRows(input.kind, 10_000);
  await reader.around(rows.map((row) => row.id));
  const where = input.where ? parse(input.where) : null;
  const model = await modelOf(tx, spaceId, input.kind);
  const report: MigrationReport = { kind: input.kind, matched: 0, changed: 0, problems: [], sample: [] };
  const updates: { id: string; title: string; before: Record<string, unknown>; after: Record<string, unknown> }[] = [];
  for (const row of rows) {
    const view = reader.view(row);
    if (where && !(await evaluate(where, view, reader.clock))) continue;
    report.matched += 1;
    const after = { ...row.data };
    for (const step of input.steps) {
      if ('rename' in step) {
        if (step.rename.from in after) {
          after[step.rename.to] = after[step.rename.from];
          delete after[step.rename.from];
        }
      } else if ('set' in step) {
        const scope = { get: async (name: string) => (name in after ? after[name] : view.get(name)) };
        const value = await evaluate(parse(step.set.formula), scope, reader.clock);
        const plain = isScope(value) ? null : value;
        if (plain === null || plain === undefined) delete after[step.set.field];
        else after[step.set.field] = plain;
      } else {
        delete after[step.remove];
      }
    }
    if (JSON.stringify(after) === JSON.stringify(row.data)) continue;
    report.changed += 1;
    updates.push({ id: row.id, title: row.title, before: row.data, after });
    if (model) {
      const problems = checkAgainst(model, after, after, true);
      if (problems.length && report.problems.length < 10) report.problems.push({ id: row.id, title: row.title, problems });
    }
  }
  report.sample = updates.slice(0, 5);
  return trial(tx, input.dryRun, async () => {
    const lines: number[] = [];
    for (const update of updates) {
      const { rows: before } = await tx.query<Record<string, unknown>>('select kind, title, data, origin, archived_at from entry where id = $1', [update.id]);
      await tx.query('update entry set data = $2, updated_at = now() where id = $1', [update.id, JSON.stringify(update.after)]);
      const { rows: after } = await tx.query<Record<string, unknown>>('select kind, title, data, origin, archived_at from entry where id = $1', [update.id]);
      lines.push(await record(tx, actor, { spaceId, command: 'entry.update', target: update.id, before: before[0], after: after[0] }));
    }
    if (lines.length) {
      await record(tx, actor, { spaceId, command: 'migration.run', target: input.kind, before: null, after: { steps: input.steps, lines } });
    }
    return report;
  });
}
