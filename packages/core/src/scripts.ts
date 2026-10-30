import { z } from 'zod';
import { withComputed } from './compute';
import type { Actor, Tx } from './db';
import { save } from './entries';
import { todayOf } from './formula';
import type { LinkInput, EntryInput } from './schemas';
import { trial, type Trial } from './trial';

// Scripts (spec 014, decision 0008): the escape hatch, for what models, formulas and rules cannot
// say — reading a bank's statement, a computation of her own. A script computes, Jarvis writes:
// `run(input)` receives the entries it declared it reads (and a file, an entry, her parameters)
// and returns the changes it wants; Jarvis checks each against what it declared it writes, then
// saves them as any door does. The engine that runs the code is a port: the core names none.

export const SCRIPT_KIND = 'Script';

/** Runs a script's code: `run(input)` in an isolated engine, with a time and memory limit. */
export interface ScriptRunner {
  run(
    code: string,
    input: unknown,
    limits: { ms: number; memoryMb: number },
  ): Promise<{ output: unknown; logs: string[] }>;
}

let runner: ScriptRunner | null = null;

/** The engine scripts run in, given by the door that starts (the API). */
export function useScriptRunner(given: ScriptRunner | null): void {
  runner = given;
}

const kinds = z.array(z.string().trim().min(1).max(80)).max(20);

export const scriptDataSchema = z.object({
  /** The kinds whose entries it receives (with their formulas). */
  reads: kinds.default([]),
  /** The kinds it may create or change. */
  writes: kinds.min(1),
  /** JavaScript defining `function run(input) { … return [changes] }`. */
  code: z.string().min(10).max(50_000),
  /** What it does, in her words. */
  description: z.string().max(2000).optional(),
  app: z.string().trim().min(1).max(60).optional(),
  timeout: z.number().int().min(100).max(5000).optional(),
});
export type ScriptData = z.infer<typeof scriptDataSchema>;

/** What a script may return: changes Jarvis will check and save. */
const changeSchema = z.union([
  z.object({
    create: z.object({
      ref: z.string().max(40).optional(),
      kind: z.string().min(1).max(80),
      title: z.string().min(1).max(300),
      data: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({
    update: z.object({
      id: z.string().min(1).max(64),
      title: z.string().min(1).max(300).optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({
    link: z.object({
      from: z.string().min(1).max(64),
      to: z.string().min(1).max(64),
      role: z.string().min(1).max(80),
    }),
  }),
  z.object({
    remind: z.object({ text: z.string().min(1).max(500), at: z.string().max(40).optional() }),
  }),
]);
export const scriptOutputSchema = z.array(changeSchema).max(500);

/** A script's shape, checked; throws a sentence that says what to fix. */
export function checkScript(data: unknown): ScriptData {
  const parsed = scriptDataSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'script'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `A « ${SCRIPT_KIND} » is { reads?: [kinds], writes: [kinds], code: "function run(input) { … return [changes] }", description? } — ${issues}.`,
    );
  }
  if (!/function\s+run\s*\(|run\s*=\s*(\(|function|async)/.test(parsed.data.code)) {
    throw new Error(
      `A « ${SCRIPT_KIND} »'s code defines \`function run(input)\` and returns its changes.`,
    );
  }
  return parsed.data;
}

const fold = (one: string) => one.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export interface ScriptRun {
  script: string;
  changes: number;
  logs: string[];
  saved: { created: number; updated: number; links: number };
}

/**
 * Runs a script of the space: its input gathered, its code run by the engine, its changes checked
 * against what it declared and saved — or, with `dryRun`, only tried.
 */
export async function runScript(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: {
    script: string;
    params?: Record<string, string>;
    fileId?: string | undefined;
    entryId?: string | undefined;
    dryRun?: boolean;
  },
): Promise<Trial<ScriptRun>> {
  if (!runner) throw new Error('Scripts cannot run here: no engine was given.');
  const { rows } = await tx.query<{ id: string; title: string; data: unknown }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) = 'script'
        and (id = $2 or jarvis_fold(title) = jarvis_fold($2))
      order by created_at limit 1`,
    [spaceId, input.script],
  );
  const row = rows[0];
  if (!row) throw new Error(`No script « ${input.script} » in this space.`);
  const script = checkScript(row.data);

  const entries: Record<string, unknown[]> = {};
  for (const kind of script.reads) {
    const { rows: found } = await tx.query<{
      id: string;
      kind: string;
      title: string;
      data: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    }>(
      `select id, kind, title, data, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
              to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
         from entry where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
        order by created_at limit 2000`,
      [spaceId, kind],
    );
    entries[kind] = (await withComputed(tx, spaceId, found)).map((one) => ({
      id: one.id,
      title: one.title,
      data: one.data,
      computed: one.computed ?? {},
      created: one.createdAt,
    }));
  }
  let file: { name: string; text: string | null } | null = null;
  if (input.fileId) {
    const { rows: files } = await tx.query<{ name: string; text: string | null }>(
      'select name, text from file where entry_id = $1 and space_id = $2',
      [input.fileId, spaceId],
    );
    if (!files[0]) throw new Error(`No file ${input.fileId} in this space.`);
    file = files[0];
  }
  let entry: unknown = null;
  if (input.entryId) {
    const { rows: one } = await tx.query(
      'select id, kind, title, data from entry where id = $1 and space_id = $2',
      [input.entryId, spaceId],
    );
    entry = one[0] ?? null;
  }

  const { output, logs } = await runner.run(
    script.code,
    { entries, file, entry, params: input.params ?? {}, today: todayOf({ now: new Date() }) },
    { ms: script.timeout ?? 2000, memoryMb: 64 },
  );
  const parsed = scriptOutputSchema.safeParse(output);
  if (!parsed.success) {
    throw new Error(
      `Script « ${row.title} » must return a list of { create } | { update } | { link } | { remind }: ${parsed.error.issues[0]?.message ?? ''}`,
    );
  }
  const allowed = new Set(script.writes.map(fold));
  const toSave: EntryInput[] = [];
  const links: LinkInput[] = [];
  for (const [index, change] of parsed.data.entries()) {
    if ('create' in change) {
      if (!allowed.has(fold(change.create.kind)))
        throw new Error(
          `Script « ${row.title} » may not write a « ${change.create.kind} » (it writes ${script.writes.join(', ')}).`,
        );
      toSave.push({
        ref: change.create.ref ?? `c${index}`,
        kind: change.create.kind,
        title: change.create.title,
        data: change.create.data ?? {},
        origin: 'inferred',
      });
    } else if ('update' in change) {
      const { rows: kindRows } = await tx.query<{ kind: string }>(
        'select kind from entry where id = $1 and space_id = $2',
        [change.update.id, spaceId],
      );
      const kind = kindRows[0]?.kind;
      if (!kind)
        throw new Error(`Script « ${row.title} »: no entry ${change.update.id} in this space.`);
      if (!allowed.has(fold(kind)))
        throw new Error(
          `Script « ${row.title} » may not change a « ${kind} » (it writes ${script.writes.join(', ')}).`,
        );
      toSave.push({
        id: change.update.id,
        ...(change.update.title ? { title: change.update.title } : {}),
        data: change.update.data ?? {},
        origin: 'inferred',
      });
    } else if ('link' in change) {
      links.push(change.link);
    } else {
      if (!allowed.has('rappel'))
        throw new Error(
          `Script « ${row.title} » may not write a « Rappel » (it writes ${script.writes.join(', ')}).`,
        );
      toSave.push({
        kind: 'Rappel',
        title: change.remind.text,
        data: { at: change.remind.at ?? new Date().toISOString(), status: 'planned' },
        origin: 'inferred',
      });
    }
  }
  const by: Actor = {
    ...actor,
    door: 'script',
    client: `script:${row.title}`,
    depth: (actor.depth ?? 0) + 1,
  };
  return trial(tx, input.dryRun ?? false, async () => {
    const saved = { created: 0, updated: 0, links: 0 };
    // In batches (a save holds 50 entries, 100 links); refs are kept across them.
    const ids = new Map<string, string>();
    for (let i = 0; i < toSave.length; i += 50) {
      const result = await save(tx, by, spaceId, { entries: toSave.slice(i, i + 50) });
      for (const one of result.entries) {
        if (one.ref) ids.set(one.ref, one.id);
        if (one.created) saved.created += 1;
        else saved.updated += 1;
      }
    }
    const resolved = links.map((one) => ({
      ...one,
      from: ids.get(one.from) ?? one.from,
      to: ids.get(one.to) ?? one.to,
    }));
    for (let i = 0; i < resolved.length; i += 100) {
      saved.links += (
        await save(tx, by, spaceId, { links: resolved.slice(i, i + 100) })
      ).links.length;
    }
    return { script: row.title, changes: parsed.data.length, logs, saved };
  });
}
