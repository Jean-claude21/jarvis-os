import type { Actor, Tx } from './db';
import { save } from './entries';
import { MODEL_KIND, modelDataSchema, modelsOf } from './models';

// « Suivre quelque chose » (v3, the collections model): she says what she wants to follow — « mes
// actions de grâce », « mes cultes » — and gets a collection: a kind with its fields, living in an
// app (one she has, or a new one). Her phrase gives a first draft she adjusts on screen; the facets
// come from the fields' types (a date → the agenda and the bilans). Jarvis invents nothing: a
// richer proposal is the assistant's, through the same model.

/** The field types she chooses from on screen, in her words. */
export const SIMPLE_TYPES = [
  'text',
  'long_text',
  'date',
  'datetime',
  'number',
  'amount',
  'choice',
  'multi_choice',
  'boolean',
  'rating',
  'duration',
  'link',
  'file',
  'location',
  'url',
] as const;

export interface DraftField {
  name: string;
  label: string;
  type: (typeof SIMPLE_TYPES)[number];
  options?: string[] | undefined;
  target?: string | undefined;
}
export interface CollectionDraft {
  kind: string;
  label: string;
  fields: DraftField[];
}

const LEAD =
  /^(je\s+(veux|voudrais|souhaite)\s+)?(commencer\s+à\s+|pouvoir\s+)?(suivre|noter|garder|tenir|compter|enregistrer|tracer|lister)\s+/i;
const DETERMINER = /^(mes|mon|ma|les|des|le|la|l['’]|un|une|tous\s+mes|toutes\s+mes)\s*/i;

/** « actions » → « action », « travaux » → « travail »; a word too short or not plural stays. */
function singular(word: string): string {
  if (word.length <= 3) return word;
  if (/aux$/i.test(word)) return word.replace(/aux$/i, 'al');
  if (/[sx]$/i.test(word) && !/(ss|is|us)$/i.test(word)) return word.slice(0, -1);
  return word;
}

/** A field's name in the data: her words, plain (« Pour quoi » → « pour_quoi »). */
export function fieldSlug(label: string): string {
  return (
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'champ'
  );
}

/**
 * Her phrase as a first draft: the thing's name, in the singular, and the two fields every kept
 * thing has a use for — when, and what she says of it. She changes the rest.
 */
export function draftCollection(phrase: string): CollectionDraft {
  const words = phrase
    .trim()
    .replace(LEAD, '')
    .replace(DETERMINER, '')
    .replace(/[.!?]+$/, '');
  if (!words) throw new Error('Say what you want to follow (« mes actions de grâce »).');
  const [first = '', ...rest] = words.split(/\s+/);
  const name = [singular(first), ...rest].join(' ');
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return {
    kind: label.slice(0, 80),
    label: label.slice(0, 80),
    fields: [
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'note', label: 'Note', type: 'long_text' },
    ],
  };
}

/**
 * The collection made: its model, in an app. A kind she already has is not made twice. One save,
 * journaled and undone like any other.
 */
export async function createCollection(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { kind: string; label: string; app: string; fields: DraftField[] },
): Promise<{ id: string; kind: string; app: string }> {
  const kind = input.kind.trim();
  const app = input.app.trim();
  if (!kind) throw new Error('A collection needs a name.');
  if (!app) throw new Error('A collection lives in an app: name it.');
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  if ((await modelsOf(tx, spaceId)).some((one) => fold(one.kind) === fold(kind)))
    throw new Error(`« ${kind} » already exists here.`);
  const seen = new Set<string>();
  const fields = input.fields.map((one) => {
    const name = fieldSlug(one.name || one.label);
    if (seen.has(name)) throw new Error(`Two fields are named « ${one.label} ».`);
    seen.add(name);
    if ((one.type === 'choice' || one.type === 'multi_choice') && !one.options?.length)
      throw new Error(`« ${one.label} » is a choice: give its options.`);
    if (one.type === 'link' && !one.target)
      throw new Error(`« ${one.label} » is a link: say to which collection.`);
    return {
      name,
      type: one.type,
      label: { fr: one.label.trim() || name },
      ...(one.options?.length ? { options: one.options.map((o) => o.trim()).filter(Boolean) } : {}),
      ...(one.type === 'link' ? { target: one.target } : {}),
    };
  });
  const data = modelDataSchema.parse({ app, label: { fr: input.label.trim() || kind }, fields });
  const saved = await save(tx, actor, spaceId, {
    entries: [{ kind: MODEL_KIND, title: kind, data, origin: 'said' }],
  });
  return { id: saved.entries[0]!.id, kind, app };
}

/** A collection moved to another app (or given one): its model says where it lives. */
export async function placeCollection(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  kind: string,
  app: string,
): Promise<{ kind: string; app: string }> {
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const model = (await modelsOf(tx, spaceId)).find((one) => fold(one.kind) === fold(kind));
  if (!model) throw new Error(`No collection « ${kind} » here.`);
  if (!app.trim()) throw new Error('Name the app.');
  await save(tx, actor, spaceId, { entries: [{ id: model.id, data: { app: app.trim() } }] });
  return { kind: model.kind, app: app.trim() };
}
