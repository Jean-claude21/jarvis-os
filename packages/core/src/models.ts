import { z } from 'zod';
import type { Tx } from './db';
import { parse } from './formula';
import { modelInNewWords } from './keywords';
import { minutesOf, TIME_FIELDS } from './time';

// Type models (specs 012, 014): what a kind holds, said once. A model is an entry of kind « Model »
// whose title is the kind it describes; Claude writes it with her, like any entry. Once a kind has
// one, every save of that kind follows it — fields, relations, lines, workflow — formulas are
// computed when read, and her export places each entry where the model says.

export const MODEL_KIND = 'Model';

export const TYPES = [
  'text',
  'number',
  'amount',
  'date',
  'datetime',
  'duration',
  'choice',
  'boolean',
  'list',
  'link',
  'formula',
  'lines',
  // Spec 016: the types of every day.
  'url',
  'email',
  'phone',
  'multi_choice',
  'file',
  'location',
  'rating',
  'progress',
  'button',
  'time',
  'long_text',
] as const;
export type FieldType = (typeof TYPES)[number];

const fieldName = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\d_ -]+$/u, 'A field name is letters, digits, spaces, - or _.');

/** What a person reads instead of a technical name, in her language: `{ fr: 'Montant', en: 'Amount' }`. */
export const labelSchema = z.object({
  fr: z.string().trim().min(1).max(80).optional(),
  en: z.string().trim().min(1).max(80).optional(),
});
export type Label = z.infer<typeof labelSchema>;

/** A field of a line (`lines`): no relation, formula or lines inside a line. */
export const lineFieldSchema = z.object({
  name: fieldName,
  label: labelSchema.optional(),
  /** What each option reads as: `{ out: { fr: 'sortie', en: 'out' } }`. */
  optionLabels: z.record(z.string(), labelSchema).optional(),
  type: z.enum([
    'text',
    'number',
    'amount',
    'date',
    'datetime',
    'duration',
    'choice',
    'boolean',
    'list',
    'url',
    'email',
    'phone',
    'multi_choice',
    'rating',
    'progress',
    'time',
    'long_text',
  ]),
  required: z.boolean().optional(),
  /** The value of a new entry when none is given: a value, or « =formula » (« =today() »). */
  default: z.union([z.string().max(500), z.number(), z.boolean()]).optional(),
  /** Bounds of a number, an amount, a rating, a progress, a date or a time. */
  min: z.union([z.number(), z.string().max(40)]).optional(),
  max: z.union([z.number(), z.string().max(40)]).optional(),
  /** No two entries of the kind share this value (case and accents aside). */
  unique: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(80)).min(1).max(100).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  help: z.string().trim().max(300).optional(),
});

export const modelFieldSchema = lineFieldSchema.extend({
  type: z.enum(TYPES),
  /** The kind a `link` points to; the link's role is the field's name. */
  target: z.string().trim().min(1).max(80).optional(),
  /** `one` (default): a new link replaces the old one; `many`: links add up. */
  cardinality: z.enum(['one', 'many']).optional(),
  /** The name the other side reads this relation by (« mouvements » of a Compte). */
  inverse: fieldName.optional(),
  /** The expression of a `formula`, computed when read. */
  formula: z.string().trim().min(1).max(2000).optional(),
  /** The fields of each line of a `lines`. */
  fields: z.array(lineFieldSchema).min(1).max(30).optional(),
  /** What a `button` does when pressed: fields to set, a rule or a script to run, on its entry. */
  action: z
    .object({
      set: z
        .record(z.string(), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]))
        .optional(),
      rule: z.string().trim().min(1).max(120).optional(),
      script: z.string().trim().min(1).max(120).optional(),
      label: labelSchema.optional(),
    })
    .optional(),
});
export type ModelField = z.infer<typeof modelFieldSchema>;

export const workflowSchema = z.object({
  /** The `choice` field that holds the state. */
  field: fieldName,
  /** The state of a new entry. */
  initial: z.string().trim().min(1).max(80).optional(),
  transitions: z
    .array(
      z.object({
        /** A state, several, or « * » for any. */
        from: z.union([
          z.string().trim().min(1).max(80),
          z.array(z.string().trim().min(1).max(80)).min(1),
        ]),
        to: z.string().trim().min(1).max(80),
        /** A formula that must hold for the change. */
        if: z.string().trim().min(1).max(1000).optional(),
        label: z.string().trim().min(1).max(80).optional(),
      }),
    )
    .min(1)
    .max(60),
});
export type Workflow = z.infer<typeof workflowSchema>;

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const modelDataSchema = z
  .object({
    fields: z.array(modelFieldSchema).min(1).max(60),
    /** What the kind reads as in the app: `{ fr: 'Mouvement', en: 'Transaction' }`. */
    label: labelSchema.optional(),
    /** Fields not in the model are refused, unless the model is open. */
    open: z.boolean().optional(),
    /**
     * Where her export puts each entry: « finances/{year}/{month}/{title}.md ». Words between
     * braces: year, month, day, date, title, id, or any field of the entry.
     */
    path: z
      .string()
      .trim()
      .max(200)
      .regex(/\.md$/i, 'A path ends with .md.')
      .refine((path) => !path.startsWith('/') && !path.split('/').includes('..'), {
        message: 'A path stays inside her folder.',
      })
      .optional(),
    /** How the app shows the kind: its columns, the field it totals, what it groups by. */
    columns: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
    total: z.string().trim().min(1).max(60).optional(),
    groupBy: z.string().trim().min(1).max(60).optional(),
    /** The app it belongs to (« Finances »), for the platform's menu. */
    app: z.string().trim().min(1).max(60).optional(),
    /** Where she files it, in her words (« Personnel », « Professionnel »): apps are grouped by it. */
    area: z.string().trim().min(1).max(60).optional(),
    workflow: workflowSchema.optional(),
  })
  .superRefine((model, context) => {
    const names = new Map<string, ModelField>();
    model.fields.forEach((field, index) => {
      const at = ['fields', index];
      const issue = (message: string) => context.addIssue({ code: 'custom', path: at, message });
      if (names.has(fold(field.name))) issue(`« ${field.name} » twice.`);
      names.set(fold(field.name), field);
      if (field.type === 'choice' && !field.options)
        issue(`« ${field.name} » is a choice: give its options.`);
      if (field.type === 'link' && !field.target)
        issue(`« ${field.name} » is a link: give its target kind.`);
      if (field.type === 'lines' && !field.fields)
        issue(`« ${field.name} » is lines: give the fields of a line.`);
      if (field.type === 'multi_choice' && !field.options)
        issue(`« ${field.name} » is a multi_choice: give its options.`);
      if (
        field.type === 'button' &&
        !field.action?.set &&
        !field.action?.rule &&
        !field.action?.script
      )
        issue(`« ${field.name} » is a button: give its action { set } or { rule } or { script }.`);
      if (typeof field.default === 'string' && field.default.startsWith('=')) {
        try {
          parse(field.default.slice(1));
        } catch (error) {
          issue((error as Error).message);
        }
      }
      if (field.type === 'formula') {
        if (!field.formula) issue(`« ${field.name} » is a formula: give its formula.`);
        else {
          try {
            parse(field.formula);
          } catch (error) {
            issue((error as Error).message);
          }
        }
      }
    });
    for (const shown of [...(model.columns ?? []), model.total, model.groupBy]) {
      if (shown && !names.has(fold(shown)) && fold(shown) !== 'title') {
        context.addIssue({ code: 'custom', message: `« ${shown} » is not a field of the model.` });
      }
    }
    if (model.workflow) {
      const field = names.get(fold(model.workflow.field));
      if (!field || field.type !== 'choice') {
        context.addIssue({
          code: 'custom',
          path: ['workflow'],
          message: `« ${model.workflow.field} » must be a choice field of the model.`,
        });
        return;
      }
      const states = new Set((field.options ?? []).map(fold));
      const known = (state: string) => state === '*' || states.has(fold(state));
      for (const one of model.workflow.transitions) {
        for (const state of [...[one.from].flat(), one.to]) {
          if (!known(state)) {
            context.addIssue({
              code: 'custom',
              path: ['workflow'],
              message: `« ${state} » is not one of ${field.options!.join(', ')}.`,
            });
          }
        }
        if (one.if) {
          try {
            parse(one.if);
          } catch (error) {
            context.addIssue({
              code: 'custom',
              path: ['workflow'],
              message: (error as Error).message,
            });
          }
        }
      }
      if (model.workflow.initial && !known(model.workflow.initial)) {
        context.addIssue({
          code: 'custom',
          path: ['workflow'],
          message: `« ${model.workflow.initial} » is not one of ${field.options!.join(', ')}.`,
        });
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
  'text',
  'source',
  'status',
  'note',
  'timezone',
  'except',
  'until',
  'end',
  'duration',
  'message',
  'next',
  'last_sent',
  'error',
  ...TIME_FIELDS,
]);

/** Reads a stored model, in the new words even if it was written in the old ones. */
function modelFrom(row: { id: string; title: string; data: unknown }): Model | null {
  const data =
    row.data && typeof row.data === 'object'
      ? modelInNewWords(row.data as Record<string, unknown>)
      : row.data;
  const parsed = modelDataSchema.safeParse(data);
  return parsed.success ? { ...parsed.data, id: row.id, kind: row.title } : null;
}

/** The model of a kind in a space, or null. */
export async function modelOf(tx: Tx, spaceId: string, kind: string): Promise<Model | null> {
  const { rows } = await tx.query<{ id: string; title: string; data: unknown }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null
        and jarvis_fold(kind) = jarvis_fold($2) and jarvis_fold(title) = jarvis_fold($3)
      order by created_at limit 1`,
    [spaceId, MODEL_KIND, kind],
  );
  return rows[0] ? modelFrom(rows[0]) : null;
}

/** Every model of a space. */
export async function modelsOf(tx: Tx, spaceId: string): Promise<Model[]> {
  const { rows } = await tx.query<{ id: string; title: string; data: unknown }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
      order by title`,
    [spaceId, MODEL_KIND],
  );
  return rows.flatMap((row) => modelFrom(row) ?? []);
}

/** A model's field by name, case and accents aside. */
export function fieldOf(model: ModelData, name: string): ModelField | undefined {
  return model.fields.find((field) => fold(field.name) === fold(name));
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** What is wrong with one value for its field, or null. */
function problemOf(
  field: z.infer<typeof lineFieldSchema> | ModelField,
  value: unknown,
): string | null {
  switch (field.type) {
    case 'number':
    case 'amount':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'a number';
    case 'date':
      return typeof value === 'string' && ISO_DAY.test(value) ? null : 'a day (« 2026-10-30 »)';
    case 'datetime':
      return typeof value === 'string' && (ISO_TIME.test(value) || ISO_DAY.test(value))
        ? null
        : 'a time (« 2026-10-30T14:00 »)';
    case 'duration':
      return minutesOf(value) !== null ? null : 'minutes (« 90 », « 1h30 »)';
    case 'choice':
      return typeof value === 'string' &&
        (field.options ?? []).some((option) => fold(option) === fold(value))
        ? null
        : `one of: ${(field.options ?? []).join(', ')}`;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'true or false';
    case 'list':
      return Array.isArray(value) ? null : 'a list';
    case 'link':
      return `an entry id (or a ref of this save)${'target' in field && field.target ? ` of a « ${field.target} »` : ''}`;
    case 'formula':
      return 'computed, never written';
    case 'lines':
      return 'a list of lines';
    case 'url':
      return typeof value === 'string' && /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value)
        ? null
        : 'a link (« https://… »)';
    case 'email':
      return typeof value === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
        ? null
        : 'an address (« name@example.org »)';
    case 'phone':
      return typeof value === 'string' && /^\+?[\d\s().-]{6,24}$/.test(value)
        ? null
        : 'a number (« +225 07 00 00 00 »)';
    case 'multi_choice':
      return Array.isArray(value) &&
        value.every(
          (one) =>
            typeof one === 'string' &&
            (field.options ?? []).some((option) => fold(option) === fold(one)),
        )
        ? null
        : `a list among: ${(field.options ?? []).join(', ')}`;
    case 'file':
      return typeof value === 'string' ||
        (Array.isArray(value) && value.every((one) => typeof one === 'string'))
        ? null
        : 'the id of a file entry (or a list of them)';
    case 'location':
      return locationOf(value) ? null : '{ address?, lat, lng } (degrees)';
    case 'rating': {
      const top = typeof field.max === 'number' ? field.max : 5;
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= top
        ? null
        : `a whole number from 0 to ${top}`;
    }
    case 'progress':
      return typeof value === 'number' && value >= 0 && value <= 100
        ? null
        : 'a percentage from 0 to 100';
    case 'button':
      return 'pressed, never written';
    case 'time':
      return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
        ? null
        : 'a time of day (« 07:15 »)';
    default:
      return typeof value === 'string' ? null : 'text';
  }
}

/** A place: `{ address?, lat, lng }`, or null when it is not one. */
export function locationOf(value: unknown): { address?: string; lat: number; lng: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { lat, lng, address } = value as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, ...(typeof address === 'string' ? { address } : {}) };
}

/** What is wrong with a value against its field's bounds, or null. */
function boundsOf(
  field: { type: string; min?: number | string | undefined; max?: number | string | undefined },
  value: unknown,
): string | null {
  if (field.min === undefined && field.max === undefined) return null;
  if (field.type === 'rating') return null;
  const comparable = typeof value === 'number' || typeof value === 'string' ? value : null;
  if (comparable === null) return null;
  if (field.min !== undefined && typeof field.min === typeof comparable && comparable < field.min)
    return `at least ${field.min}`;
  if (field.max !== undefined && typeof field.max === typeof comparable && comparable > field.max)
    return `at most ${field.max}`;
  return null;
}

/** The problems of the lines of a `lines` field. */
function linesProblems(field: ModelField, value: unknown): string[] {
  if (!Array.isArray(value)) return [`« ${field.name} » must be a list of lines`];
  const problems: string[] = [];
  const byName = new Map((field.fields ?? []).map((one) => [fold(one.name), one]));
  value.slice(0, 500).forEach((line, index) => {
    const at = `« ${field.name} » line ${index + 1}`;
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      problems.push(`${at} must be an object`);
      return;
    }
    for (const [name, one] of Object.entries(line as Record<string, unknown>)) {
      const sub = byName.get(fold(name));
      if (!sub) problems.push(`${at}: « ${name} » is not one of its fields`);
      else if (sub.name !== name) problems.push(`${at}: write « ${sub.name} », not « ${name} »`);
      else if (one !== null) {
        const wrong = problemOf(sub, one) ?? boundsOf(sub, one);
        if (wrong) problems.push(`${at}: « ${name} » must be ${wrong}`);
      }
    }
    for (const sub of field.fields ?? []) {
      if (sub.required && (line as Record<string, unknown>)[sub.name] === undefined)
        problems.push(`${at}: « ${sub.name} » is required`);
    }
  });
  if (value.length > 500) problems.push(`« ${field.name} » holds at most 500 lines`);
  return problems;
}

/**
 * The problems of an entry's data against its model, in words the model can act on: a field the
 * model does not know, a value of the wrong type, a formula written, a required field missing (on
 * creation) or removed. Links are taken out of the data before (`save`). Empty when it follows.
 */
export function checkAgainst(
  model: ModelData & { kind: string },
  given: Record<string, unknown>,
  result: Record<string, unknown>,
  creating: boolean,
): string[] {
  const problems: string[] = [];
  for (const [name, value] of Object.entries(given)) {
    const field = fieldOf(model, name);
    if (value === null) {
      if (field?.required) problems.push(`« ${name} » is required and cannot be removed`);
      continue;
    }
    if (!field) {
      if (!model.open && !COMMON_FIELDS.has(name))
        problems.push(`« ${name} » is not one of its fields`);
      continue;
    }
    if (field.name !== name) {
      problems.push(`write « ${field.name} », not « ${name} »`);
      continue;
    }
    if (field.type === 'lines') {
      problems.push(...linesProblems(field, value));
      continue;
    }
    const wrong = problemOf(field, value) ?? boundsOf(field, value);
    if (wrong) problems.push(`« ${name} » must be ${wrong}`);
  }
  if (creating) {
    for (const field of model.fields) {
      if (
        field.required &&
        !['link', 'formula', 'button'].includes(field.type) &&
        result[field.name] === undefined
      ) {
        problems.push(`« ${field.name} » is required`);
      }
    }
  }
  return problems;
}

/** The sentence a door returns when a save does not follow a model. */
export function modelError(model: ModelData & { kind: string }, problems: string[]): Error {
  const fields = model.fields
    .map((field) => `${field.name} (${field.type}${field.target ? ` → ${field.target}` : ''})`)
    .join(', ');
  return new Error(
    `« ${model.kind} » follows its model: ${problems.join('; ')}. Its fields: ${fields}. ` +
      `To change them, change the entry « ${MODEL_KIND} » of that kind — after asking her.`,
  );
}

const DATED = ['date', 'start', 'at', 'due'];

/** Where her export puts an entry by its kind's model, or null when the model says nothing. */
export function placeOf(
  path: string | undefined,
  entry: { id: string; title: string; data: Record<string, unknown>; createdAt: string },
  slug: (text: string) => string,
): string | null {
  if (!path) return null;
  const dated = DATED.map((field) => entry.data[field]).find(
    (value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value),
  );
  const day = (dated ?? entry.createdAt).slice(0, 10);
  const [year, month, date] = day.split('-') as [string, string, string];
  const words: Record<string, string> = {
    year,
    month,
    day: date,
    date: day,
    title: slug(entry.title),
    id: entry.id,
  };
  const placed = path.replace(/\{([^{}]+)\}/g, (_, name: string) => {
    const key = name.trim();
    if (words[key] !== undefined) return words[key]!;
    const value = entry.data[key];
    return typeof value === 'string' || typeof value === 'number' ? slug(String(value)) : 'none';
  });
  return placed.split('/').includes('..') || placed.startsWith('/') ? null : placed;
}
