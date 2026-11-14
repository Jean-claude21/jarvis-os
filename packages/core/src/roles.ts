import { z } from 'zod';
import type { Tx } from './db';
import type { Actor } from './db';
import { find, save } from './entries';
import { modelsOf } from './models';

// The apps, linked (spec 033, plan v2 A1–A4). Each app says its role, in data: what it covers, when
// it is concerned (her words, the kinds it watches), what it reads and writes, what to ask when
// something is missing, its own instructions (read only when concerned), and its bridges to the
// others. Jarvis shows assistants one line per app, finds the apps a sentence touches without any
// AI, and keeps the bridges as rules: visible, journaled, undone like any.

const words = z.union([
  z.string().max(1000),
  z.object({ fr: z.string().max(1000).optional(), en: z.string().max(1000).optional() }),
]);

/** A bridge: when an entry of `from` is saved, the kind of another app receives its own entry. */
export const bridgeSchema = z.object({
  from: z.string().trim().min(1).max(80),
  create: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(300),
  data: z.record(z.string(), z.union([z.string().max(1000), z.number(), z.boolean(), z.null()])),
  /** The link from the new entry to the one saved. */
  link: z.string().trim().min(1).max(80).optional(),
  if: z.string().trim().min(1).max(1000).optional(),
});
export type Bridge = z.infer<typeof bridgeSchema>;

export const appPatternSchema = z.object({
  about: words,
  kind: z.string().trim().min(1).max(80),
  /** A formula on each entry (« category = 'Transport' »). */
  where: z.string().trim().min(1).max(500).optional(),
  /** A field added up instead of counting (« amount »). */
  sum: z.string().trim().min(1).max(60).optional(),
  /** How much it must move, in percent, to come back to her (30 by default). */
  rise: z.number().min(5).max(1000).optional(),
});
export type AppPattern = z.infer<typeof appPatternSchema>;

export const roleSchema = z.object({
  covers: words,
  /** Her words that concern it (« achat », « payé »): accents and case aside. */
  intents: z.array(z.string().trim().min(1).max(60)).max(60).default([]),
  /** The kinds it watches (its own, or common types it reads). */
  watches: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  reads: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  writes: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  /** What to ask her when it is missing (« Sur quel compte ? »). */
  ask: z.array(words).max(20).default([]),
  /** Its own instructions, read only when it is concerned. */
  instructions: words.optional(),
  bridges: z.array(bridgeSchema).max(20).default([]),
  /** What it watches for in her life (spec 050): counted (or summed) over 30 days against the 30 before. */
  patterns: z.array(appPatternSchema).max(20).default([]),
  /**
   * The capabilities of the Atelier it uses (spec 060): « offres_emploi », « pdf »… — Jarvis reaches
   * them itself; she never connects or names them.
   */
  capabilities: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-z0-9_]+$/)
        .max(60),
    )
    .max(20)
    .default([]),
});
export type Role = z.infer<typeof roleSchema>;

/** The kind that keeps an installed app and its role. */
export const APP_KIND = 'App';

export interface AppInSpace {
  app: string;
  role: Role;
  /** The kinds its models describe. */
  kinds: string[];
  /** Read from her own entry « App », else deduced from its models. */
  declared: boolean;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The apps of a space with their roles; an app installed before roles gets one from its models. */
export async function appsOf(
  tx: Tx,
  spaceId: string,
  known: Record<string, Role> = {},
): Promise<AppInSpace[]> {
  const kindsOf = new Map<string, string[]>();
  for (const model of await modelsOf(tx, spaceId)) {
    if (!model.app) continue;
    kindsOf.set(model.app, [...(kindsOf.get(model.app) ?? []), model.kind]);
  }
  const apps = new Map<string, AppInSpace>();
  for (const entry of await find(tx, spaceId, { kind: APP_KIND, limit: 100 })) {
    const parsed = roleSchema.safeParse(entry.data.role ?? {});
    if (!parsed.success) continue;
    apps.set(entry.title, {
      app: entry.title,
      role: parsed.data,
      kinds: kindsOf.get(entry.title) ?? [],
      declared: true,
    });
  }
  for (const [app, kinds] of kindsOf) {
    if (apps.has(app)) continue;
    const shipped = Object.entries(known).find(([name]) => fold(name) === fold(app))?.[1];
    apps.set(app, {
      app,
      role:
        shipped ?? roleSchema.parse({ covers: kinds.join(', '), watches: kinds, writes: kinds }),
      kinds,
      declared: false,
    });
  }
  return [...apps.values()].sort((a, b) => a.app.localeCompare(b.app));
}

const say = (value: z.infer<typeof words> | undefined, lang: 'fr' | 'en') =>
  value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : (value[lang] ?? value.fr ?? value.en ?? '');

/** One line per app, for every assistant connected (A2): short, always current. */
export function appLines(apps: AppInSpace[], lang: 'fr' | 'en' = 'fr'): string[] {
  return apps.map((one) => {
    const when = [...one.role.intents.slice(0, 8), ...one.role.watches.slice(0, 4)].join(', ');
    return `« ${one.app} »: ${say(one.role.covers, lang)}${when ? ` — concerned by: ${when}` : ''}`;
  });
}

/**
 * The apps a sentence touches (A3), without any AI: her words that one of them names, or a kind it
 * watches; for each, its instructions, what to ask, and the fields of the kinds it writes.
 */
export async function appsTouched(
  tx: Tx,
  spaceId: string,
  sentence: string,
  known: Record<string, Role> = {},
  lang: 'fr' | 'en' = 'fr',
) {
  const said = ` ${fold(sentence).replace(/[^\p{L}\p{N}€$]+/gu, ' ')} `;
  const models = await modelsOf(tx, spaceId);
  const touched = [];
  for (const one of await appsOf(tx, spaceId, known)) {
    const because = [
      ...one.role.intents.filter(
        (word) => said.includes(` ${fold(word)} `) || (/^[€$]$/.test(word) && said.includes(word)),
      ),
      ...one.role.watches.filter((kind) => said.includes(` ${fold(kind)} `)),
    ];
    if (!because.length) continue;
    touched.push({
      app: one.app,
      because,
      covers: say(one.role.covers, lang),
      instructions: say(one.role.instructions, lang),
      ask: one.role.ask.map((question) => say(question, lang)),
      fields: Object.fromEntries(
        (one.role.writes.length ? one.role.writes : one.kinds).map((kind) => [
          kind,
          (models.find((model) => fold(model.kind) === fold(kind))?.fields ?? [])
            .filter((field) => field.type !== 'formula')
            .map((field) => ({
              name: field.name,
              type: field.type,
              required: field.required === true,
            })),
        ]),
      ),
    });
  }
  return touched;
}

/**
 * A bridge made on demand (A4), by Claude or the app: a rule of the app that owns it, named
 * « from → to », marked as a bridge — visible among her rules, journaled, undone like any save.
 */
export async function createBridge(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { app: string; bridge: Bridge },
) {
  const bridge = bridgeSchema.parse(input.bridge);
  return save(tx, actor, spaceId, {
    entries: [
      {
        kind: 'Rule',
        title: `${bridge.from} → ${bridge.create}`,
        data: {
          app: input.app,
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
      },
    ],
  });
}

/** The bridges of a space: its rules marked as such. */
export async function bridgesOf(tx: Tx, spaceId: string) {
  const { rows } = await tx.query<{
    id: string;
    title: string;
    app: string | null;
    active: boolean;
  }>(
    `select id, title, data->>'app' as app, coalesce((data->>'active')::boolean, true) as active
       from entry where space_id = $1 and kind = 'Rule' and archived_at is null
        and (data->>'bridge')::boolean is true order by title`,
    [spaceId],
  );
  return rows;
}
