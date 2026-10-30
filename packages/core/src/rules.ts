import type pg from 'pg';
import { z } from 'zod';
import { readerOf, type EntryView, type Reader } from './compute';
import { asPerson, type Actor, type Tx } from './db';
import { save } from './entries';
import type { SaveInput } from './schemas';
import { evaluate, isScope, parse, todayOf } from './formula';
import { runScript } from './scripts';
import { DEFAULT_ZONE, nextTime } from './time';
import { trial, type Trial } from './trial';

// Rules (spec 014): « when / if / then », said once, run by Jarvis. A rule is an entry of kind
// « Rule »; it runs when an entry of a kind is saved or one of its fields changes (inside the same
// save), on a schedule, or some days before a date (by the watcher). Its changes go through `save`
// as any door's: checked, journaled, undoable — and a rule's changes trigger rules three deep at most.

export const RULE_KIND = 'Rule';
export const RULE_DEPTH = 3;

const text = z.string().trim().min(1).max(2000);
/** A value to write: a number, a yes/no, a text with `{formula}` inside, or « =formula ». */
const value = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]);

export const actionSchema = z.union([
  z.object({
    create: z.object({
      kind: z.string().trim().min(1).max(80),
      title: text,
      data: z.record(z.string(), value).optional(),
      link: z.string().trim().min(1).max(80).optional(),
    }),
  }),
  z.object({ update: z.object({ set: z.record(z.string(), value) }) }),
  z.object({
    link: z.object({
      to: z.string().trim().min(1).max(64),
      role: z.string().trim().min(1).max(80),
    }),
  }),
  z.object({ remind: z.object({ text, at: z.string().max(200).optional() }) }),
  z.object({
    run_script: z.object({
      script: z.string().trim().min(1).max(120),
      params: z.record(z.string(), z.string()).optional(),
    }),
  }),
]);
export type Action = z.infer<typeof actionSchema>;

export const ruleDataSchema = z.object({
  when: z.union([
    z.object({ saved: z.string().trim().min(1).max(80) }),
    z.object({
      changed: z.object({
        kind: z.string().trim().min(1).max(80),
        field: z.string().trim().min(1).max(60),
      }),
    }),
    z.object({
      schedule: z.string().trim().min(9).max(60),
      timezone: z.string().max(60).optional(),
    }),
    z.object({
      before: z.object({
        kind: z.string().trim().min(1).max(80),
        field: z.string().trim().min(1).max(60),
        days: z.number().int().min(0).max(366),
      }),
    }),
  ]),
  if: z.string().trim().min(1).max(2000).optional(),
  then: z.array(actionSchema).min(1).max(10),
  active: z.boolean().optional(),
  app: z.string().trim().min(1).max(60).optional(),
  // Kept by Jarvis: the next scheduled run, the last day a « before » rule ran, its last error.
  next: z.string().optional(),
  last_run: z.string().optional(),
  error: z.string().optional(),
});
export type RuleData = z.infer<typeof ruleDataSchema>;

/** A rule's shape, checked; throws a sentence that says what to fix. */
export function checkRule(data: unknown): RuleData {
  const parsed = ruleDataSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'rule'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `A « ${RULE_KIND} » is { when: { saved: kind } | { changed: { kind, field } } | { schedule: "0 8 1 * *" } | { before: { kind, field, days } }, if?, then: [{ create: { kind, title, data? } } | { update: { set } } | { link: { to, role } } | { remind: { text, at? } } | { run_script: { script, params? } }] } — ${issues}.`,
    );
  }
  const rule = parsed.data;
  if (rule.if) parse(rule.if);
  for (const piece of templatesOf(rule)) for (const formula of formulasIn(piece)) parse(formula);
  if ('schedule' in rule.when)
    nextTime(rule.when.schedule, new Date(), rule.when.timezone ?? DEFAULT_ZONE);
  return rule;
}

function* templatesOf(rule: RuleData): Generator<string> {
  for (const action of rule.then) {
    const values =
      'create' in action
        ? [action.create.title, ...Object.values(action.create.data ?? {})]
        : 'update' in action
          ? Object.values(action.update.set)
          : 'remind' in action
            ? [action.remind.text, action.remind.at]
            : [];
    for (const one of values) if (typeof one === 'string') yield one;
  }
}

/** The formulas of a value: « =montant * 2 » is one; « Le fonds {fonds.title} » has one. */
function formulasIn(template: string): string[] {
  if (template.startsWith('=')) return [template.slice(1)];
  return [...template.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]!);
}

const fold = (one: string) => one.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const plain = (one: unknown): unknown =>
  Array.isArray(one)
    ? one.map(plain)
    : isScope(one)
      ? ((one as unknown as EntryView).row?.title ?? null)
      : (one ?? null);

/** A value written by a rule, its formulas computed for the entry (or for nothing). */
async function valueOf(raw: unknown, scope: EntryView | null, reader: Reader): Promise<unknown> {
  if (typeof raw !== 'string') return raw;
  const at = scope ?? { get: () => null };
  if (raw.startsWith('=')) return plain(await evaluate(parse(raw.slice(1)), at, reader.clock));
  let out = raw;
  for (const formula of formulasIn(raw)) {
    const computed = plain(await evaluate(parse(formula), at, reader.clock));
    out = out.replace(
      `{${formula}}`,
      computed === null
        ? ''
        : typeof computed === 'number'
          ? new Intl.NumberFormat('fr').format(computed)
          : String(computed),
    );
  }
  return out;
}

export interface RuleRow {
  id: string;
  title: string;
  data: RuleData;
}

/** The active rules of a space. */
export async function rulesOf(tx: Tx, spaceId: string): Promise<RuleRow[]> {
  const { rows } = await tx.query<{ id: string; title: string; data: unknown }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) = 'rule'
        and coalesce(data->>'active', 'true') <> 'false'
      order by created_at`,
    [spaceId],
  );
  return rows.flatMap((row) => {
    const parsed = ruleDataSchema.safeParse(row.data);
    return parsed.success ? [{ id: row.id, title: row.title, data: parsed.data }] : [];
  });
}

/** Runs a rule's actions for an entry (or none, for a schedule), if its condition holds. */
async function act(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  rule: RuleRow,
  entryId: string | null,
): Promise<boolean> {
  const reader = await readerOf(tx, spaceId);
  let scope: EntryView | null = null;
  if (entryId) {
    const [row] = await reader.rowsOf([entryId]);
    if (!row) return false;
    await reader.around([entryId]);
    scope = reader.view(row);
  }
  if (
    rule.data.if &&
    !(await evaluate(parse(rule.data.if), scope ?? { get: () => null }, reader.clock))
  )
    return false;
  const by: Actor = {
    ...actor,
    door: 'rule',
    client: `rule:${rule.title}`,
    depth: (actor.depth ?? 0) + 1,
  };
  const call = (input: SaveInput) => save(tx, by, spaceId, input);
  for (const action of rule.data.then) {
    if ('create' in action) {
      const data: Record<string, unknown> = {};
      for (const [name, raw] of Object.entries(action.create.data ?? {}))
        data[name] = await valueOf(raw, scope, reader);
      await call({
        entries: [
          {
            ref: 'new',
            kind: action.create.kind,
            title: String(await valueOf(action.create.title, scope, reader)),
            data,
            origin: 'inferred',
          },
        ],
        links:
          entryId && action.create.link
            ? [{ from: 'new', to: entryId, role: action.create.link }]
            : [],
      });
    } else if ('update' in action) {
      if (!entryId)
        throw new Error(
          `Rule « ${rule.title} »: « update » needs an entry, and a schedule gives none.`,
        );
      const data: Record<string, unknown> = {};
      for (const [name, raw] of Object.entries(action.update.set))
        data[name] = await valueOf(raw, scope, reader);
      await call({ entries: [{ id: entryId, data, origin: 'inferred' }] });
    } else if ('link' in action) {
      if (!entryId)
        throw new Error(
          `Rule « ${rule.title} »: « link » needs an entry, and a schedule gives none.`,
        );
      await call({ links: [{ from: entryId, to: action.link.to, role: action.link.role }] });
    } else if ('remind' in action) {
      const at = action.remind.at
        ? String(await valueOf(action.remind.at, scope, reader))
        : reader.clock.now.toISOString();
      await call({
        entries: [
          {
            ref: 'r',
            kind: 'Reminder',
            title: String(await valueOf(action.remind.text, scope, reader)),
            data: { at, status: 'planned' },
            origin: 'inferred',
          },
        ],
        links: entryId ? [{ from: 'r', to: entryId, role: 'for' }] : [],
      });
    } else if ('run_script' in action) {
      await runScript(tx, by, spaceId, {
        script: action.run_script.script,
        params: action.run_script.params ?? {},
        entryId: entryId ?? undefined,
      });
    }
  }
  return true;
}

/** What a save changed, for the rules to read. */
export interface Changed {
  id: string;
  kind: string;
  created: boolean;
  fields: string[];
}

/** After a save: the rules of its kinds, for each entry it made or changed. */
export async function runRulesAfterSave(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  changed: Changed[],
): Promise<void> {
  if ((actor.depth ?? 0) >= RULE_DEPTH || !changed.length) return;
  const rules = await rulesOf(tx, spaceId);
  if (!rules.length) return;
  for (const one of changed) {
    for (const rule of rules) {
      const when = rule.data.when;
      const fires =
        ('saved' in when && fold(when.saved) === fold(one.kind)) ||
        ('changed' in when &&
          fold(when.changed.kind) === fold(one.kind) &&
          one.fields.some((field) => fold(field) === fold(when.changed.field)));
      // A rule does not fire again on its own change.
      if (!fires || actor.client === `rule:${rule.title}`) continue;
      try {
        await act(tx, actor, spaceId, rule, one.id);
      } catch (error) {
        throw new Error(`Rule « ${rule.title} » failed: ${(error as Error).message}`);
      }
    }
  }
}

/** Tries a rule on an entry (or on nothing): what it would change, nothing changed. */
export async function testRule(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { rule: string; entryId?: string | undefined },
): Promise<Trial<{ matched: boolean }>> {
  const rule = (await rulesOf(tx, spaceId)).find(
    (one) => one.id === input.rule || fold(one.title) === fold(input.rule),
  );
  if (!rule) throw new Error(`No rule « ${input.rule} » in this space.`);
  return trial(tx, true, async () => ({
    matched: await act(tx, actor, spaceId, rule, input.entryId ?? null),
  }));
}

/** The rules that may be due, across spaces: who keeps each (the watcher, spec 006). */
export async function runDueRules(
  db: pg.Pool,
  now: Date,
): Promise<{ ran: number; failed: number }> {
  const report = { ran: 0, failed: 0 };
  const { rows } = await db.query<{ entry_id: string; space_id: string; persons: string[] }>(
    'select entry_id, space_id, persons from jarvis_due_rules($1)',
    [now.toISOString()],
  );
  for (const row of rows) {
    const keeper = row.persons[0];
    if (!keeper) continue;
    const actor: Actor = { person: keeper, door: 'watcher' };
    try {
      await asPerson(db, keeper, async (tx) => {
        const rule = (await rulesOf(tx, row.space_id)).find((one) => one.id === row.entry_id);
        if (!rule) return;
        const when = rule.data.when;
        const zone = 'schedule' in when ? (when.timezone ?? DEFAULT_ZONE) : DEFAULT_ZONE;
        const today = todayOf({ now, zone });
        if ('schedule' in when) {
          const due = rule.data.next ? new Date(rule.data.next) : null;
          if (due && due <= now) await act(tx, actor, row.space_id, rule, null);
          await save(tx, actor, row.space_id, {
            entries: [
              {
                id: rule.id,
                data: { next: nextTime(when.schedule, now, zone).toISOString(), error: null },
                origin: 'inferred',
              },
            ],
          });
        } else if ('before' in when) {
          if (rule.data.last_run === today) return;
          const target = new Date(Date.parse(`${today}T00:00:00Z`) + when.before.days * 86_400_000)
            .toISOString()
            .slice(0, 10);
          const { rows: entries } = await tx.query<{ id: string }>(
            `select id from entry where space_id = $1 and archived_at is null
               and jarvis_fold(kind) = jarvis_fold($2) and left(data->>$3, 10) = $4`,
            [row.space_id, when.before.kind, when.before.field, target],
          );
          for (const entry of entries) await act(tx, actor, row.space_id, rule, entry.id);
          await save(tx, actor, row.space_id, {
            entries: [{ id: rule.id, data: { last_run: today, error: null }, origin: 'inferred' }],
          });
        }
      });
      report.ran += 1;
    } catch (error) {
      report.failed += 1;
      await asPerson(db, keeper, (tx) =>
        save(tx, actor, row.space_id, {
          entries: [
            {
              id: row.entry_id,
              data: { error: (error as Error).message.slice(0, 500) },
              origin: 'inferred',
            },
          ],
        }),
      ).catch(() => undefined);
    }
  }
  return report;
}
