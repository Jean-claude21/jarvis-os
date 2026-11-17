// Facets (v3 D5): what a kind is, said once, and everything that follows from it. A kind that is
// « dated » shows on the agenda, the calendar and the timeline; « todo » on the day's list; « stages »
// as a board and a funnel; « amount » in totals… A model may say its facets; when it does not, they
// are read from what it already says (its fields, its workflow, `activity`, `total`) — so every
// model written before v3 has its facets too, with no change to the data.

import { z } from 'zod';
import type { ModelData, ModelField } from './models';

const name = z.string().trim().min(1).max(60);

export const facetSchema = z.discriminatedUnion('facet', [
  /** Has a day or an hour: the agenda, the calendar, the timeline, reminders. */
  z.object({
    facet: z.literal('dated'),
    start: name,
    end: name.optional(),
    /** A link to entries of the same kind that come first (« dépend de »): the timeline's arrows. */
    after: name.optional(),
  }),
  /** Something to do: done or not, late or not, on the day's list. */
  z.object({
    facet: z.literal('todo'),
    status: name.optional(),
    done: name.optional(),
    due: name.optional(),
  }),
  /** Comes back: a habit, its regularity, its next time. */
  z.object({ facet: z.literal('recurring'), repeat: name }),
  /** Has a target: an objective, its progress, its curve. */
  z.object({
    facet: z.literal('measurable'),
    target: name,
    current: name.optional(),
    unit: z.string().trim().min(1).max(20).optional(),
  }),
  /** Counts money: totals, budgets, charts. */
  z.object({ facet: z.literal('amount'), amount: name, currency: name.optional() }),
  /** Goes through steps: a board, a funnel, the time in each step. */
  z.object({ facet: z.literal('stages'), field: name }),
  /** Is a document or a file: preview, reading, what was read on it. */
  z.object({ facet: z.literal('document'), file: name.optional(), text: name.optional() }),
  /** Is someone: avatar or logo, how to reach them, the last time. */
  z.object({
    facet: z.literal('who'),
    kind: z.enum(['person', 'organization']),
    email: name.optional(),
    phone: name.optional(),
    domain: name.optional(),
    photo: name.optional(),
  }),
  /** Is somewhere: the map. */
  z.object({ facet: z.literal('place'), location: name }),
]);
export type Facet = z.infer<typeof facetSchema>;
export type FacetName = Facet['facet'];
export const FACET_NAMES: FacetName[] = [
  'dated',
  'todo',
  'recurring',
  'measurable',
  'amount',
  'stages',
  'document',
  'who',
  'place',
];

/** The fields a facet points to, to check they exist. */
export function fieldsOfFacet(facet: Facet): string[] {
  return Object.entries(facet)
    .filter(
      ([key, value]) =>
        key !== 'facet' && key !== 'unit' && key !== 'kind' && typeof value === 'string',
    )
    .map(([, value]) => value as string);
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** The fields of a model with those of the model it extends (its own win on a name). */
export function fieldsWithParent(model: ModelData, parent?: ModelData | null): ModelField[] {
  if (!parent) return model.fields;
  const own = new Set(model.fields.map((field) => fold(field.name)));
  return [...parent.fields.filter((field) => !own.has(fold(field.name))), ...model.fields];
}

const START = ['start', 'at', 'date', 'debut', 'published', 'when', 'quand', 'jour'];
const END = ['end', 'fin', 'until', 'to', 'jusqu_au', 'deadline', 'echeance'];
const DUE = ['due', 'echeance', 'deadline', 'follow_up', 'relance'];
const TARGET = ['target', 'cible', 'objectif', 'goal'];
const CURRENT = ['current', 'actuel', 'value', 'valeur', 'progress', 'progression'];

/**
 * A model's facets: those it says, else those read from it. A child (`extends`) has its parent's
 * facets unless it says its own.
 */
export function facetsOf(model: ModelData, parent?: ModelData | null): Facet[] {
  if (model.facets?.length) return model.facets;
  if (parent?.facets?.length && !model.fields.length) return parent.facets;
  const fields = fieldsWithParent(model, parent);
  const named = (names: string[], types?: string[]) =>
    names
      .map((one) =>
        fields.find((field) => fold(field.name) === one && (!types || types.includes(field.type))),
      )
      .find(Boolean) ?? null;
  const ofType = (...types: string[]) => fields.filter((field) => types.includes(field.type));
  const out: Facet[] = [];

  const dates = ofType('date', 'datetime');
  const start = named(START, ['date', 'datetime']) ?? dates[0] ?? null;
  if (start) {
    const end = named(END, ['date', 'datetime']);
    // What comes first: a link to its own kind named so (« dépend de », « après », « bloqué par »).
    const after = fields.find(
      (field) =>
        field.type === 'link' &&
        !!field.target &&
        /depend|apres|after|bloqu|block|preced/.test(fold(field.name)),
    );
    out.push({
      facet: 'dated',
      start: start.name,
      ...(end && end.name !== start.name ? { end: end.name } : {}),
      ...(after ? { after: after.name } : {}),
    });
  }
  if (model.activity) {
    const due = named(DUE, ['date', 'datetime']);
    out.push({
      facet: 'todo',
      ...(model.workflow ? { status: model.workflow.field } : {}),
      ...(!model.workflow && named(['done', 'fait'], ['boolean'])
        ? { done: named(['done', 'fait'], ['boolean'])!.name }
        : {}),
      ...(due ? { due: due.name } : {}),
    });
  }
  const repeat = named(['repeat', 'repetition', 'recurrence', 'frequence']);
  if (repeat) out.push({ facet: 'recurring', repeat: repeat.name });
  const target = named(TARGET, ['number', 'amount', 'progress', 'duration']);
  if (target) {
    const current = named(CURRENT, ['number', 'amount', 'progress', 'duration']);
    out.push({
      facet: 'measurable',
      target: target.name,
      ...(current ? { current: current.name } : {}),
      ...(target.unit ? { unit: target.unit } : {}),
    });
  }
  const amount = model.total
    ? fields.find((field) => fold(field.name) === fold(model.total!))
    : ofType('amount')[0];
  if (amount) {
    const currency = named(['currency', 'devise']);
    out.push({
      facet: 'amount',
      amount: amount.name,
      ...(currency ? { currency: currency.name } : {}),
    });
  }
  // Steps: its workflow, else a choice that holds a state (« status », « état »…).
  const state = model.workflow
    ? null
    : named(['status', 'statut', 'state', 'etat', 'stage', 'etape'], ['choice']);
  if (model.workflow) out.push({ facet: 'stages', field: model.workflow.field });
  else if (state) out.push({ facet: 'stages', field: state.name });
  const file = ofType('file')[0];
  const text = named(['text', 'texte', 'contenu', 'content'], ['long_text', 'text']);
  if (file || (text && text.type === 'long_text'))
    out.push({
      facet: 'document',
      ...(file ? { file: file.name } : {}),
      ...(text ? { text: text.name } : {}),
    });
  const email = ofType('email')[0];
  const phone = ofType('phone')[0];
  const domain = named(['domain', 'domaine', 'site', 'website'], ['url', 'text']);
  if (email || phone) {
    const organization = Boolean(domain) && !named(['birthday', 'anniversaire']);
    out.push({
      facet: 'who',
      kind: organization ? 'organization' : 'person',
      ...(email ? { email: email.name } : {}),
      ...(phone ? { phone: phone.name } : {}),
      ...(domain ? { domain: domain.name } : {}),
    });
  }
  const location = ofType('location')[0];
  if (location) out.push({ facet: 'place', location: location.name });
  return out;
}
