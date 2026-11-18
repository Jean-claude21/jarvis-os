import { z } from 'zod';
import type { Actor, Tx } from './db';
import { mergeProposals, type MergeProposal } from './common';
import { archive, save } from './entries';
import { record } from './journal';
import { MODEL_KIND, modelsOf } from './models';
import { PAGE_KIND } from './pages';
import { APP_KIND, roleSchema } from './roles';
import { RULE_KIND } from './rules';
import { AGENT_KIND } from './agent-node';
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
  /** The app's own release (v3 D14): a newer one updates what is installed, layer by layer. */
  release: z.number().int().min(1).default(1),
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
  /** Its agents (v3 D12): who runs its rules — one agent may serve several apps. */
  agents: z.array(piece).max(10).default([]),
  /** Its role among her apps (spec 033): what it covers, when it is concerned, its bridges. */
  role: roleSchema.optional(),
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
    release: 1,
    models: models.map((model) => ({
      title: model.kind,
      data: Object.fromEntries(
        Object.entries(model).filter(([key]) => key !== 'id' && key !== 'kind'),
      ),
    })),
    pages: await named(PAGE_KIND),
    rules: await named(RULE_KIND),
    scripts: await named(SCRIPT_KIND),
    agents: await named(AGENT_KIND),
  };
}

type Piece = { title: string; data: Record<string, unknown> };

/**
 * An app's pieces, by kind (models first): its role kept as an entry « App » (what it installed —
 * its release and the base of each piece — rides on it, v3 D14), its models, pages, scripts and
 * rules, its bridges as rules (spec 033).
 */
function piecesOf(bundle: z.infer<typeof bundleSchema>): [string, Piece[]][] {
  // Its role is kept as an entry « App »; its bridges become rules (spec 033), named so she sees
  // them among her rules, each undone with the install.
  const bridges = (bundle.role?.bridges ?? []).map((bridge) => ({
    title: `${bridge.from} → ${bridge.create}`,
    data: {
      app: bundle.app,
      bridge: true,
      when: { saved: bridge.from },
      ...(bridge.if ? { if: bridge.if } : {}),
      then: [
        {
          create: {
            kind: bridge.create,
            title: bridge.title,
            data: bridge.data,
            ...(bridge.link ? { link: bridge.link } : {}),
          },
        },
      ],
    },
  }));
  const groups: [string, Piece[]][] = [
    [
      APP_KIND,
      [
        {
          title: bundle.app,
          data: {
            ...(bundle.role ? { role: bundle.role } : {}),
            description: bundle.description ?? null,
          },
        },
      ],
    ],
    [MODEL_KIND, bundle.models.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } }))],
    [PAGE_KIND, bundle.pages.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } }))],
    [
      SCRIPT_KIND,
      bundle.scripts.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } })),
    ],
    [AGENT_KIND, bundle.agents.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } }))],
    [
      RULE_KIND,
      [
        ...bundle.rules.map((one) => ({ ...one, data: { app: bundle.app, ...one.data } })),
        ...bridges,
      ],
    ],
  ];
  return groups;
}

/**
 * What one entry of a kind would look like (v3 F7, « essai avec un exemple visible »): drawn from
 * its model alone — its fields in her words, each with a value of its type — so she sees the app
 * before she adds it. Nothing is written: an example is not her data.
 */
export interface Example {
  kind: string;
  label: string;
  title: string;
  fields: { name: string; label: string; type: string; value: unknown }[];
}

const SKIPPED = new Set(['link', 'formula', 'lines', 'file', 'button', 'list']);

/** An example entry for each kind an app brings (four at most, eight fields each). */
export function examplesOf(raw: Bundle, today = new Date()): Example[] {
  const bundle = bundleSchema.parse(raw);
  const day = today.toISOString().slice(0, 10);
  const valueOf = (field: { type: string; options?: string[] | undefined }): unknown => {
    switch (field.type) {
      case 'number':
      case 'rating':
        return 3;
      case 'amount':
        return 125;
      case 'progress':
        return 40;
      case 'duration':
        return '1 h 30';
      case 'date':
        return day;
      case 'datetime':
        return `${day}T09:00`;
      case 'time':
        return '09:00';
      case 'boolean':
        return true;
      case 'choice':
      case 'multi_choice':
        return field.options?.[0] ?? null;
      case 'url':
        return 'https://exemple.fr';
      case 'email':
        return 'contact@exemple.fr';
      case 'phone':
        return '06 12 34 56 78';
      case 'location':
        return 'Lyon';
      default:
        return 'Exemple';
    }
  };
  const said = (label: unknown, fallback: string) =>
    (label as { fr?: string; en?: string } | undefined)?.fr ??
    (label as { en?: string } | undefined)?.en ??
    fallback;
  return bundle.models.slice(0, 4).map((model) => {
    const data = model.data as {
      label?: unknown;
      fields?: { name: string; type: string; label?: unknown; options?: string[] }[];
    };
    const label = said(data.label, model.title);
    return {
      kind: model.title,
      label,
      title: `Exemple de ${label.toLowerCase()}`,
      fields: (data.fields ?? [])
        .filter((field) => !SKIPPED.has(field.type))
        .slice(0, 8)
        .map((field) => ({
          name: field.name,
          label: said(field.label, field.name.replace(/_/g, ' ')),
          type: field.type,
          value: valueOf(field),
        }))
        .filter((field) => field.value !== null),
    };
  });
}

export interface InstallReport {
  app: string;
  /** One example entry of each kind it brings, drawn from its models (v3 F7). */
  examples: Example[];
  created: string[];
  /** Already there (same kind and title): kept as they are. */
  kept: string[];
  /**
   * What she already keeps that this app can use (spec 034): her entries under another name of one
   * of its kinds (« Compte » for « Account »), each a merge to propose — never done without her yes.
   */
  reuse: MergeProposal[];
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
  const report: InstallReport = {
    app: bundle.app,
    examples: examplesOf(bundle),
    created: [],
    kept: [],
    reuse: [],
  };
  const groups = piecesOf(bundle);
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
    // What it installed, kept on its entry « App » (v3 D14): its release and each piece as shipped,
    // the base an update compares her changes with.
    await keepLayer(tx, actor, spaceId, bundle, groups, false);
    // Her entries this app can use, once its models are there (spec 034).
    const kinds = new Set(bundle.models.map((one) => one.title));
    report.reuse = (await mergeProposals(tx, spaceId)).filter((one) => kinds.has(one.to));
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

/** A piece's key in an app's layer: its kind and its title, folded. */
const keyOf = (kind: string, title: string) => `${fold(kind)}|${fold(title)}`;

/** What an app installed: its release and each piece as it shipped it. */
interface Layer {
  release: number;
  base: Record<string, Record<string, unknown>>;
}

async function appEntry(tx: Tx, spaceId: string, app: string) {
  const { rows } = await tx.query<{ id: string; data: Record<string, unknown> }>(
    `select id, data from entry where space_id = $1 and archived_at is null
        and kind = $2 and jarvis_fold(title) = jarvis_fold($3) limit 1`,
    [spaceId, APP_KIND, app],
  );
  return rows[0] ?? null;
}

/** Keeps what an app installed on its entry « App » (unless it is there and `replace` is false). */
async function keepLayer(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  bundle: z.infer<typeof bundleSchema>,
  groups: [string, Piece[]][],
  replace: boolean,
) {
  const entry = await appEntry(tx, spaceId, bundle.app);
  if (!entry || (entry.data.installed && !replace)) return;
  const base: Layer['base'] = {};
  for (const [kind, pieces] of groups)
    if (kind !== APP_KIND) for (const one of pieces) base[keyOf(kind, one.title)] = one.data;
  await save(tx, actor, spaceId, {
    entries: [{ id: entry.id, data: { installed: { release: bundle.release, base } } }],
  });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Three ways (v3 D14): what the app shipped then (`base`), what she made of it (`mine`), what it
 * ships now (`next`). A value she did not change takes the new one; a value she changed stays hers
 * — and when the app changed it too, it is a conflict, said. A model's fields are merged one by one,
 * by name: her own fields stay, a field she removed stays removed.
 */
function merge3(
  base: Record<string, unknown> | undefined,
  mine: Record<string, unknown>,
  next: Record<string, unknown>,
  conflicts: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...mine };
  for (const key of new Set([...Object.keys(next), ...Object.keys(base ?? {})])) {
    if (key === 'fields' && Array.isArray(next.fields) && Array.isArray(mine.fields)) {
      out.fields = mergeFields(
        (base?.fields as Record<string, unknown>[] | undefined) ?? [],
        mine.fields as Record<string, unknown>[],
        next.fields as Record<string, unknown>[],
        conflicts,
      );
      continue;
    }
    const was = base?.[key];
    if (same(mine[key], was)) {
      if (next[key] === undefined) delete out[key];
      else out[key] = next[key];
    } else if (!same(next[key], was)) conflicts.push(key);
  }
  return out;
}

function mergeFields(
  base: Record<string, unknown>[],
  mine: Record<string, unknown>[],
  next: Record<string, unknown>[],
  conflicts: string[],
) {
  const name = (field: Record<string, unknown>) => fold(String(field.name ?? ''));
  const out = [...mine];
  for (const field of next) {
    const at = out.findIndex((one) => name(one) === name(field));
    const was = base.find((one) => name(one) === name(field));
    if (at < 0) {
      if (!was) out.push(field); // new in the app
      continue; // she removed it: it stays removed
    }
    if (same(out[at], was)) out[at] = field;
    else if (!same(field, was)) conflicts.push(`fields.${String(field.name)}`);
  }
  // A field the app no longer ships goes, unless she changed it.
  return out.filter((one) => {
    const was = base.find((field) => name(field) === name(one));
    const still = next.some((field) => name(field) === name(one));
    return still || !was || !same(one, was);
  });
}

export interface UpdateReport {
  app: string;
  from: number;
  to: number;
  created: string[];
  updated: string[];
  /** Hers, kept as she made them, though the app changed them too: field by field. */
  conflicts: string[];
  /** Pieces she had set aside: they stay aside. */
  skipped: string[];
}

/**
 * Updates an installed app to a newer release (v3 D14), layer by layer: its new pieces are added,
 * what she did not change takes the new version, what she changed stays hers. One line in the
 * journal, undone at once.
 */
export async function updateApp(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  raw: Bundle,
  dryRun = true,
): Promise<Trial<UpdateReport>> {
  const bundle = bundleSchema.parse(raw);
  const entry = await appEntry(tx, spaceId, bundle.app);
  if (!entry) throw new Error(`« ${bundle.app} » is not installed in this space.`);
  const layer = (entry.data.installed as Layer | undefined) ?? { release: 0, base: {} };
  const report: UpdateReport = {
    app: bundle.app,
    from: layer.release,
    to: bundle.release,
    created: [],
    updated: [],
    conflicts: [],
    skipped: [],
  };
  const groups = piecesOf(bundle);
  return trial(tx, dryRun, async () => {
    if (bundle.release <= layer.release) return report;
    const { rows: before } = await tx.query<{ id: string | null }>(
      'select max(id)::text as id from journal',
    );
    for (const [kind, pieces] of groups) {
      if (kind === APP_KIND) continue;
      for (const one of pieces) {
        const name = `${kind} « ${one.title} »`;
        const key = keyOf(kind, one.title);
        const { rows } = await tx.query<{
          id: string;
          data: Record<string, unknown>;
          archived: boolean;
        }>(
          `select id, data, archived_at is not null as archived from entry
            where space_id = $1 and jarvis_fold(kind) = jarvis_fold($2)
              and jarvis_fold(title) = jarvis_fold($3)
            order by archived_at nulls first limit 1`,
          [spaceId, kind, one.title],
        );
        const mine = rows[0];
        if (!mine || mine.archived) {
          if (layer.base[key]) {
            report.skipped.push(name);
            continue;
          }
          await save(tx, actor, spaceId, {
            entries: [{ kind, title: one.title, data: one.data, origin: 'inferred' }],
          });
          report.created.push(name);
          continue;
        }
        const conflicts: string[] = [];
        const merged = merge3(layer.base[key], mine.data, one.data, conflicts);
        for (const field of conflicts) report.conflicts.push(`${name} : ${field}`);
        if (same(merged, mine.data)) continue;
        // Removed keys are written as null: the save takes them away.
        const data: Record<string, unknown> = { ...merged };
        for (const own of Object.keys(mine.data)) if (!(own in merged)) data[own] = null;
        await save(tx, actor, spaceId, { entries: [{ id: mine.id, data }] });
        report.updated.push(name);
      }
    }
    // Its role and description follow the app; its layer is the new release.
    const app = groups.find(([kind]) => kind === APP_KIND)![1][0]!;
    await save(tx, actor, spaceId, { entries: [{ id: entry.id, data: app.data }] });
    await keepLayer(tx, actor, spaceId, bundle, groups, true);
    const { rows: lines } = await tx.query<{ id: string }>(
      'select id::text as id from journal where id > $1::bigint and space_id = $2 order by id',
      [before[0]?.id ?? '0', spaceId],
    );
    if (lines.length)
      await record(tx, actor, {
        spaceId,
        command: 'app.update',
        target: bundle.app,
        before: { release: layer.release },
        after: { release: bundle.release, lines: lines.map((line) => Number(line.id)) },
      });
    return report;
  });
}

/** The release of each app installed in a space (to offer the newer ones). */
export async function installedReleases(tx: Tx, spaceId: string): Promise<Record<string, number>> {
  const { rows } = await tx.query<{ title: string; release: string | null }>(
    `select title, data->'installed'->>'release' as release from entry
      where space_id = $1 and archived_at is null and kind = $2`,
    [spaceId, APP_KIND],
  );
  return Object.fromEntries(rows.map((row) => [row.title, Number(row.release ?? 0)]));
}

export interface RemoveReport {
  app: string;
  /** Its pieces set aside: its role, pages, rules, scripts, the models of its own kinds. */
  removed: string[];
  /** Kept: the models of the common types (others use them) — and always every entry of hers. */
  kept: string[];
}

/**
 * Removes an app (spec 034): its pieces are set aside at once, one line in the journal, undone at
 * once; no entry of hers is touched, and the models of the common types stay for the others.
 */
export async function removeApp(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  app: string,
  dryRun = true,
  common: (kind: string) => boolean = () => false,
): Promise<Trial<RemoveReport>> {
  const report: RemoveReport = { app, removed: [], kept: [] };
  const { rows } = await tx.query<{ id: string; kind: string; title: string }>(
    `select id, kind, title from entry
      where space_id = $1 and archived_at is null
        and ((jarvis_fold(kind) in ('model', 'page', 'rule', 'script')
              and jarvis_fold(coalesce(data->>'app', '')) = jarvis_fold($2))
          or (kind = $3 and jarvis_fold(title) = jarvis_fold($2)))
      order by kind, title`,
    [spaceId, app, APP_KIND],
  );
  if (!rows.length) throw new Error(`No app « ${app} » in this space.`);
  return trial(tx, dryRun, async () => {
    const { rows: before } = await tx.query<{ id: string | null }>(
      'select max(id)::text as id from journal',
    );
    for (const row of rows) {
      if (row.kind === MODEL_KIND && common(row.title)) {
        report.kept.push(`${row.kind} « ${row.title} »`);
        continue;
      }
      await archive(tx, actor, { spaceId, id: row.id });
      report.removed.push(`${row.kind} « ${row.title} »`);
    }
    const { rows: lines } = await tx.query<{ id: string }>(
      'select id::text as id from journal where id > $1::bigint and space_id = $2 order by id',
      [before[0]?.id ?? '0', spaceId],
    );
    if (lines.length) {
      await record(tx, actor, {
        spaceId,
        command: 'app.remove',
        target: app,
        before: null,
        after: { lines: lines.map((line) => Number(line.id)) },
      });
    }
    return report;
  });
}
