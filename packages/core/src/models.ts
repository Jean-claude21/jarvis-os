import { z } from 'zod';
import type { Tx } from './db';
import { minutesOf, TIME_FIELDS } from './time';

// Type models (spec 012): what a kind holds, said once. A model is an entry of kind « Modèle »
// whose title is the kind it describes; Claude writes it with her, like any entry. Once a kind has
// one, every save of that kind follows it — no « montant » one day and « prix » the next — and her
// export places each entry where the model says.

export const MODEL_KIND = 'Modèle';

export const NATURES = [
  'texte',
  'nombre',
  'montant',
  'date',
  'moment',
  'duree',
  'choix',
  'oui-non',
  'liste',
  'lien',
] as const;

export const modelFieldSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[\p{L}\d_ -]+$/u, 'A field name is letters, digits, spaces, - or _.'),
  nature: z.enum(NATURES),
  obligatoire: z.boolean().optional(),
  /** The choices of a « choix ». */
  choix: z.array(z.string().trim().min(1).max(80)).min(1).max(100).optional(),
  /** The kind a « lien » points to: the link's role is the field's name. */
  vers: z.string().trim().min(1).max(80).optional(),
  /** The currency of a « montant » (« XOF », « EUR »), the unit of a « nombre ». */
  unite: z.string().trim().min(1).max(20).optional(),
  aide: z.string().trim().max(300).optional(),
});
export type ModelField = z.infer<typeof modelFieldSchema>;

export const modelDataSchema = z
  .object({
    champs: z.array(modelFieldSchema).min(1).max(60),
    /** Fields not in the model are refused, unless the model is open. */
    ouvert: z.boolean().optional(),
    /**
     * Where her export puts each entry: « finances/{année}/{mois}/{titre}.md ». Words between
     * braces: année, mois, jour, date, titre, id, or any field of the entry.
     */
    rangement: z
      .string()
      .trim()
      .max(200)
      .regex(/\.md$/i, 'A rangement ends with .md.')
      .refine((path) => !path.startsWith('/') && !path.split('/').includes('..'), {
        message: 'A rangement stays inside her folder.',
      })
      .optional(),
    /** How the app shows the kind: its columns, the field it totals, what it groups by. */
    colonnes: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
    total: z.string().trim().min(1).max(60).optional(),
    regroupement: z.string().trim().min(1).max(60).optional(),
    /** The app it belongs to (« Finances »), for the platform's menu. */
    app: z.string().trim().min(1).max(60).optional(),
  })
  .superRefine((model, context) => {
    const names = new Set<string>();
    model.champs.forEach((field, index) => {
      const folded = fold(field.nom);
      if (names.has(folded)) {
        context.addIssue({
          code: 'custom',
          path: ['champs', index],
          message: `« ${field.nom} » twice.`,
        });
      }
      names.add(folded);
      if (field.nature === 'choix' && !field.choix) {
        context.addIssue({
          code: 'custom',
          path: ['champs', index],
          message: `« ${field.nom} » is a choix: give its choices.`,
        });
      }
    });
    for (const shown of [...(model.colonnes ?? []), model.total, model.regroupement]) {
      if (shown && !names.has(fold(shown)) && fold(shown) !== 'titre') {
        context.addIssue({ code: 'custom', message: `« ${shown} » is not a field of the model.` });
      }
    }
  });
export type ModelData = z.infer<typeof modelDataSchema>;

export interface Model extends ModelData {
  id: string;
  /** The kind it describes. */
  kind: string;
}

/** Fields every kind may carry: her text, its source, its time, its state (specs 006–011). */
export const COMMON_FIELDS = new Set([
  'texte',
  'source',
  'statut',
  'note',
  'fuseau',
  'sauf',
  'jusqu',
  'fin',
  'duree',
  'message',
  'prochaine',
  'dernier_envoi',
  'erreur',
  ...TIME_FIELDS,
]);

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** The model of a kind in a space, or null. */
export async function modelOf(tx: Tx, spaceId: string, kind: string): Promise<Model | null> {
  const { rows } = await tx.query<{ id: string; title: string; data: unknown }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null
        and jarvis_fold(kind) = jarvis_fold($2) and jarvis_fold(title) = jarvis_fold($3)
      order by created_at limit 1`,
    [spaceId, MODEL_KIND, kind],
  );
  const row = rows[0];
  if (!row) return null;
  const parsed = modelDataSchema.safeParse(row.data);
  return parsed.success ? { ...parsed.data, id: row.id, kind: row.title } : null;
}

/** Every model of a space. */
export async function modelsOf(tx: Tx, spaceId: string): Promise<Model[]> {
  const { rows } = await tx.query<{ id: string; title: string; data: unknown }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
      order by title`,
    [spaceId, MODEL_KIND],
  );
  return rows.flatMap((row) => {
    const parsed = modelDataSchema.safeParse(row.data);
    return parsed.success ? [{ ...parsed.data, id: row.id, kind: row.title }] : [];
  });
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** What is wrong with one value for its field, or null. */
function problemOf(field: ModelField, value: unknown): string | null {
  switch (field.nature) {
    case 'nombre':
    case 'montant':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'a number';
    case 'date':
      return typeof value === 'string' && ISO_DAY.test(value) ? null : 'a day (« 2026-10-30 »)';
    case 'moment':
      return typeof value === 'string' && (ISO_TIME.test(value) || ISO_DAY.test(value))
        ? null
        : 'a time (« 2026-10-30T14:00 »)';
    case 'duree':
      return minutesOf(value) !== null ? null : 'minutes (« 90 », « 1h30 »)';
    case 'choix':
      return typeof value === 'string' &&
        (field.choix ?? []).some((choice) => fold(choice) === fold(value))
        ? null
        : `one of: ${(field.choix ?? []).join(', ')}`;
    case 'oui-non':
      return typeof value === 'boolean' ? null : 'true or false';
    case 'liste':
      return Array.isArray(value) ? null : 'a list';
    case 'lien':
      return `a link « ${field.nom} »${field.vers ? ` to a « ${field.vers} »` : ''}, not a field`;
    default:
      return typeof value === 'string' ? null : 'text';
  }
}

/**
 * The problems of an entry's data against its model, in words the model can act on: a field the
 * model does not know, a value of the wrong nature, a required field missing (on creation) or
 * removed. Empty when it follows.
 */
export function checkAgainst(
  model: ModelData & { kind: string },
  given: Record<string, unknown>,
  result: Record<string, unknown>,
  creating: boolean,
): string[] {
  const byName = new Map(model.champs.map((field) => [fold(field.nom), field]));
  const problems: string[] = [];
  for (const [name, value] of Object.entries(given)) {
    if (value === null) {
      const field = byName.get(fold(name));
      if (field?.obligatoire) problems.push(`« ${name} » is required and cannot be removed`);
      continue;
    }
    const field = byName.get(fold(name));
    if (!field) {
      if (!model.ouvert && !COMMON_FIELDS.has(name)) {
        problems.push(`« ${name} » is not one of its fields`);
      }
      continue;
    }
    if (field.nom !== name) {
      problems.push(`write « ${field.nom} », not « ${name} »`);
      continue;
    }
    const wrong = problemOf(field, value);
    if (wrong) problems.push(`« ${name} » must be ${wrong}`);
  }
  if (creating) {
    for (const field of model.champs) {
      if (field.obligatoire && field.nature !== 'lien' && result[field.nom] === undefined) {
        problems.push(`« ${field.nom} » is required`);
      }
    }
  }
  return problems;
}

/** The sentence a door returns when a save does not follow a model. */
export function modelError(model: ModelData & { kind: string }, problems: string[]): Error {
  const fields = model.champs.map((field) => `${field.nom} (${field.nature})`).join(', ');
  return new Error(
    `« ${model.kind} » follows its model: ${problems.join('; ')}. Its fields: ${fields}. ` +
      'To change them, change the entry « Modèle » of that kind — after asking her.',
  );
}

/** Where her export puts an entry by its kind's model, or null when the model says nothing. */
export function placeOf(
  rangement: string | undefined,
  entry: { id: string; title: string; data: Record<string, unknown>; createdAt: string },
  slug: (text: string) => string,
): string | null {
  if (!rangement) return null;
  const dated = ['date', 'debut', 'quand', 'echeance']
    .map((field) => entry.data[field])
    .find(
      (value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value),
    );
  const day = (dated ?? entry.createdAt).slice(0, 10);
  const [year, month, date] = day.split('-') as [string, string, string];
  const words: Record<string, string> = {
    année: year,
    annee: year,
    mois: month,
    jour: date,
    date: day,
    titre: slug(entry.title),
    id: entry.id,
  };
  const path = rangement.replace(/\{([^{}]+)\}/g, (_, name: string) => {
    const key = name.trim();
    if (words[key] !== undefined) return words[key]!;
    const value = entry.data[key];
    return typeof value === 'string' || typeof value === 'number' ? slug(String(value)) : 'sans';
  });
  return path.split('/').includes('..') || path.startsWith('/') ? null : path;
}
