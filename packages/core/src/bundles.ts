import { z } from 'zod';
import type { Actor, Tx } from './db';
import { save } from './entries';
import { record } from './journal';
import { MODEL_KIND, modelsOf } from './models';
import { PAGE_KIND } from './pages';
import { RULE_KIND } from './rules';
import { SCRIPT_KIND } from './scripts';
import { trial, type Trial } from './trial';

// Apps as bundles (spec 014): the models, pages, rules and scripts of one app, exported at once and
// installed at once — Finances or Routines in one sentence, then adjusted in conversation.

const piece = z.object({
  title: z.string().trim().min(1).max(120),
  data: z.record(z.string(), z.unknown()),
});

export const bundleSchema = z.object({
  app: z.string().trim().min(1).max(60),
  version: z.literal(1).default(1),
  description: z
    .union([
      z.string().max(2000),
      z.object({ fr: z.string().max(2000).optional(), en: z.string().max(2000).optional() }),
    ])
    .optional(),
  models: z.array(piece).max(40).default([]),
  pages: z.array(piece).max(40).default([]),
  rules: z.array(piece).max(40).default([]),
  scripts: z.array(piece).max(20).default([]),
});
export type Bundle = z.input<typeof bundleSchema>;

const fold = (one: string) => one.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Every piece of an app in a space: its models, and the pages, rules, scripts that name it. */
export async function exportApp(
  tx: Tx,
  spaceId: string,
  app: string,
): Promise<z.infer<typeof bundleSchema>> {
  const models = (await modelsOf(tx, spaceId)).filter(
    (model) => model.app && fold(model.app) === fold(app),
  );
  const named = async (kind: string) => {
    const { rows } = await tx.query<{ title: string; data: Record<string, unknown> }>(
      `select title, data from entry
        where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
          and jarvis_fold(coalesce(data->>'app', '')) = jarvis_fold($3)
        order by created_at`,
      [spaceId, kind, app],
    );
    // What Jarvis keeps for itself (a rule's next run, its last error) does not travel.
    const kept = (data: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(data).filter(([key]) => !['next', 'last_run', 'error'].includes(key)),
      );
    return rows.map((row) => ({ title: row.title, data: kept(row.data) }));
  };
  if (!models.length && !(await named(PAGE_KIND)).length)
    throw new Error(`No app « ${app} » in this space.`);
  return {
    app,
    version: 1,
    models: models.map((model) => ({
      title: model.kind,
      data: Object.fromEntries(
        Object.entries(model).filter(([key]) => key !== 'id' && key !== 'kind'),
      ),
    })),
    pages: await named(PAGE_KIND),
    rules: await named(RULE_KIND),
    scripts: await named(SCRIPT_KIND),
  };
}

export interface InstallReport {
  app: string;
  created: string[];
  /** Already there (same kind and title): kept as they are. */
  kept: string[];
}

/** Puts an app's pieces in a space — models first; what is there already is kept. */
export async function installApp(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  raw: Bundle,
  dryRun = true,
): Promise<Trial<InstallReport>> {
  const bundle = bundleSchema.parse(raw);
  const report: InstallReport = { app: bundle.app, created: [], kept: [] };
  const groups: [string, { title: string; data: Record<string, unknown> }[]][] = [
    [MODEL_KIND, bundle.models.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } }))],
    [PAGE_KIND, bundle.pages.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } }))],
    [
      SCRIPT_KIND,
      bundle.scripts.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } })),
    ],
    [RULE_KIND, bundle.rules.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } }))],
  ];
  return trial(tx, dryRun, async () => {
    const { rows: before } = await tx.query<{ id: string | null }>(
      'select max(id)::text as id from journal',
    );
    for (const [kind, pieces] of groups) {
      for (const one of pieces) {
        const { rows } = await tx.query(
          `select 1 from entry where space_id = $1 and archived_at is null
              and jarvis_fold(kind) = jarvis_fold($2) and jarvis_fold(title) = jarvis_fold($3) limit 1`,
          [spaceId, kind, one.title],
        );
        if (rows.length) {
          report.kept.push(`${kind} « ${one.title} »`);
          continue;
        }
        await save(tx, actor, spaceId, {
          entries: [{ kind, title: one.title, data: one.data, origin: 'inferred' }],
        });
        report.created.push(`${kind} « ${one.title} »`);
      }
    }
    const { rows: lines } = await tx.query<{ id: string }>(
      'select id::text as id from journal where id > $1::bigint and space_id = $2 order by id',
      [before[0]?.id ?? '0', spaceId],
    );
    if (lines.length) {
      await record(tx, actor, {
        spaceId,
        command: 'app.install',
        target: bundle.app,
        before: null,
        after: { lines: lines.map((line) => Number(line.id)) },
      });
    }
    return report;
  });
}
