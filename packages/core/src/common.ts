import type { Actor, Tx } from './db';
import { archive } from './entries';
import { renameKind } from './lists';
import { modelsOf } from './models';
import { migrateKind, type MigrationReport } from './migrations';

// The common types (spec 032, plan v2 T1): what every life holds and every app shares — never
// created twice under another name. And the duplicates a life already has (T2): proposed to merge,
// never merged without her yes, each merge tried first and undone at once.

export interface CommonKind {
  kind: string;
  label: { fr: string; en: string };
  /** Other names she or an assistant may give it (folded: accents and case aside). */
  aliases: string[];
  /** Its usual fields, in the engine's words. */
  fields: string[];
}

export const COMMON_KINDS: CommonKind[] = [
  {
    kind: 'Person',
    label: { fr: 'Personne', en: 'Person' },
    aliases: ['personne', 'personnes', 'contact', 'contacts', 'people', 'persons'],
    fields: ['relation', 'circle', 'phone', 'email', 'birthday', 'last_contact'],
  },
  {
    kind: 'Account',
    label: { fr: 'Compte', en: 'Account' },
    aliases: ['compte', 'comptes', 'moyen de paiement', 'moyens de paiement', 'accounts'],
    fields: ['type', 'opening_balance', 'currency'],
  },
  {
    kind: 'Transaction',
    label: { fr: 'Mouvement', en: 'Transaction' },
    aliases: [
      'mouvement',
      'mouvements',
      'depense',
      'depenses',
      'paiement',
      'paiement d abonnement',
      'subscriptionpayment',
      'transactions',
    ],
    fields: ['amount', 'date', 'direction', 'account', 'category', 'currency'],
  },
  {
    kind: 'Event',
    label: { fr: 'Événement', en: 'Event' },
    aliases: ['evenement', 'evenements', 'rendez-vous', 'rdv', 'events'],
    fields: ['start', 'end', 'place', 'with'],
  },
  {
    kind: 'Task',
    label: { fr: 'Tâche', en: 'Task' },
    aliases: ['tache', 'taches', 'todo', 'a faire', 'tasks'],
    fields: ['due', 'status', 'priority', 'project'],
  },
  {
    kind: 'Place',
    label: { fr: 'Lieu', en: 'Place' },
    aliases: ['lieu', 'lieux', 'endroit', 'adresse', 'places'],
    fields: ['address', 'city', 'country'],
  },
  {
    kind: 'Organization',
    label: { fr: 'Organisation', en: 'Organization' },
    aliases: ['organisation', 'organisations', 'entreprise', 'societe', 'organizations'],
    fields: ['type', 'website', 'phone'],
  },
  {
    kind: 'Fichier',
    label: { fr: 'Fichier', en: 'File' },
    aliases: ['file', 'files', 'fichiers'],
    fields: ['nom', 'type', 'taille'],
  },
];

/** The kinds of the shipped apps that are not common but have their own duplicates. */
const APP_KINDS: { kind: string; aliases: string[] }[] = [
  { kind: 'Fund', aliases: ['fonds', 'enveloppe', 'enveloppes', 'funds'] },
  { kind: 'Bill', aliases: ['facture', 'factures', 'bills'] },
];

/** Her words for a field, and the engine's (a merge renames them). */
export const FIELD_SYNONYMS: Readonly<Record<string, string>> = {
  montant: 'amount',
  sens: 'direction',
  solde_initial: 'opening_balance',
  budget_mensuel: 'monthly_budget',
  devise: 'currency',
  paid_on: 'date',
  cercle: 'circle',
  'derniere-interaction': 'last_contact',
  derniere_interaction: 'last_contact',
  echeance: 'due',
  adresse: 'address',
  ville: 'city',
  pays: 'country',
  telephone: 'phone',
};

/** What a merge sets beyond the renames, by the folded name of the kind merged. */
const SETS: Readonly<Record<string, { field: string; formula: string }[]>> = {
  depense: [{ field: 'direction', formula: "'out'" }],
  depenses: [{ field: 'direction', formula: "'out'" }],
  subscriptionpayment: [{ field: 'direction', formula: "'out'" }],
  'paiement d abonnement': [{ field: 'direction', formula: "'out'" }],
};

/** « entrée » / « sortie » in her words, the engine's « in » / « out ». */
const DIRECTION_OF_SENS = "if(sens = 'entrée' or sens = 'entree' or sens = 'in', 'in', 'out')";

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’_]/g, ' ').trim().toLowerCase();

/** The common or app kind a name stands for, or null. */
export function canonicalKind(name: string): string | null {
  const folded = fold(name);
  for (const one of [...COMMON_KINDS, ...APP_KINDS]) {
    if (fold(one.kind) === folded) return one.kind;
    if (one.aliases.includes(folded)) return one.kind;
  }
  return null;
}

/**
 * An entry written under another name of a common type her space already uses (spec 032): its
 * kind becomes the common one, its fields the engine's words (« montant » → « amount »), and what
 * the name implied is set (a « dépense » goes out). Null when the name is not another name.
 */
export function asCommon(
  name: string,
  data: Record<string, unknown> | undefined,
): { kind: string; data: Record<string, unknown> } | null {
  const kind = canonicalKind(name);
  if (!kind || kind === name) return null;
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(data ?? {})) {
    const to = FIELD_SYNONYMS[fold(field).replace(/ /g, '_')] ?? FIELD_SYNONYMS[field];
    if (field === 'sens' && to === 'direction') {
      out.direction = /^(entr[ée]e|in)$/i.test(String(value)) ? 'in' : 'out';
    } else {
      out[to && !(to in (data ?? {})) ? to : field] = value;
    }
  }
  for (const set of SETS[fold(name)] ?? []) {
    if (!(set.field in out)) out[set.field] = set.formula.replace(/^'|'$/g, '');
  }
  return { kind, data: out };
}

export type MergeStep =
  | { rename: { from: string; to: string } }
  | { set: { field: string; formula: string } }
  | { remove: string };

export interface MergeProposal {
  from: string;
  to: string;
  count: number;
  toCount: number;
  /** The fields renamed or set on the way. */
  steps: MergeStep[];
  /** The name of the kind merged into, in her languages, when it is a common type. */
  toLabel?: { fr: string; en: string };
}

/** The fields of a kind's entries in a space. */
async function fieldsOf(tx: Tx, spaceId: string, kind: string): Promise<string[]> {
  const { rows } = await tx.query<{ key: string }>(
    `select distinct k as key from entry, jsonb_object_keys(data) k
      where space_id = $1 and kind = $2 and archived_at is null`,
    [spaceId, kind],
  );
  return rows.map((row) => row.key);
}

/** The steps that bring a kind's fields to the engine's words. */
function stepsFor(from: string, fields: string[]): MergeStep[] {
  const steps: MergeStep[] = [];
  for (const field of fields) {
    const to = FIELD_SYNONYMS[fold(field).replace(/ /g, '_')] ?? FIELD_SYNONYMS[field];
    if (!to || fields.includes(to)) continue;
    if (field === 'sens' && to === 'direction') {
      steps.push({ set: { field: 'direction', formula: DIRECTION_OF_SENS } }, { remove: 'sens' });
    } else {
      steps.push({ rename: { from: field, to } });
    }
  }
  for (const set of SETS[fold(from)] ?? []) {
    if (
      !fields.includes(set.field) &&
      !steps.some((step) => 'set' in step && step.set.field === set.field)
    ) {
      steps.push({ set });
    }
  }
  return steps;
}

const SYSTEM = new Set([
  'model',
  'page',
  'rule',
  'script',
  'view',
  'share',
  'area',
  'charter',
  'routine',
  'channel',
  'reminder',
]);

/**
 * The merges Jarvis proposes in a space: a kind that is another name of a common or app kind, and
 * the variants of one name (« Doc », « Document », « document »), into the most used.
 */
export async function mergeProposals(
  tx: Tx,
  spaceId: string,
  dismissed: string[] = [],
): Promise<MergeProposal[]> {
  const { rows } = await tx.query<{ kind: string; count: number }>(
    `select kind, count(*)::int as count from entry
      where space_id = $1 and archived_at is null group by kind order by count desc`,
    [spaceId],
  );
  const counts = new Map(rows.map((row) => [row.kind, row.count]));
  const models = new Map((await modelsOf(tx, spaceId)).map((one) => [fold(one.kind), one]));
  const proposals: MergeProposal[] = [];
  const taken = new Set<string>();
  for (const { kind, count } of rows) {
    if (SYSTEM.has(fold(kind))) continue;
    const canonical = canonicalKind(kind);
    let to: string | null = null;
    if (canonical && canonical !== kind) to = canonical;
    else if (!canonical) {
      // Variants of one name: the most used of those that fold alike (a plural, « Doc »).
      const base = fold(kind).replace(/s$/, '').replace(/^doc$/, 'document');
      const twin = rows.find(
        (other) =>
          other.kind !== kind &&
          fold(other.kind).replace(/s$/, '').replace(/^doc$/, 'document') === base &&
          (other.count > count || (other.count === count && other.kind < kind)),
      );
      to = twin?.kind ?? null;
    }
    if (!to || taken.has(kind) || dismissed.includes(`${kind}→${to}`)) continue;
    // A kind an app owns (« SubscriptionPayment » of Subscriptions) stays: its app works on it. It
    // meets the common type by a bridge (plan v2 A4), not by a merge. An older model of the same
    // app (« Mouvement » of Finances, before « Transaction ») merges.
    const own = models.get(fold(kind));
    const target = models.get(fold(to));
    if (own?.app && own.app !== target?.app) continue;
    taken.add(kind);
    const fields = await fieldsOf(tx, spaceId, kind);
    proposals.push({
      from: kind,
      to,
      count,
      toCount: counts.get(to) ?? 0,
      steps: stepsFor(kind, fields),
      ...(COMMON_KINDS.find((one) => one.kind === to)
        ? { toLabel: COMMON_KINDS.find((one) => one.kind === to)!.label }
        : {}),
    });
  }
  return proposals;
}

/**
 * A merge: the kind's fields brought to the engine's words, then its entries become the other kind.
 * Tried first (`dryRun`, the default); applied, both are journaled and each can be undone.
 */
export async function mergeKind(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { from: string; to: string; steps?: MergeStep[]; dryRun?: boolean },
): Promise<{
  from: string;
  to: string;
  entries: number;
  fields: MigrationReport | null;
  applied: boolean;
}> {
  const dryRun = input.dryRun ?? true;
  const steps = input.steps ?? [];
  const tried = steps.length
    ? await migrateKind(tx, actor, spaceId, { kind: input.from, steps, dryRun })
    : null;
  const report = tried?.result ?? null;
  if (dryRun) {
    const { rows } = await tx.query<{ n: number }>(
      `select count(*)::int as n from entry where space_id = $1 and kind = $2 and archived_at is null`,
      [spaceId, input.from],
    );
    return {
      from: input.from,
      to: input.to,
      entries: rows[0]?.n ?? 0,
      fields: report,
      applied: false,
    };
  }
  // When both kinds have a model, the one merged in is set aside (journaled, undoable): its
  // entries follow the model of the kind they join, which stays the only one.
  const models = await modelsOf(tx, spaceId);
  const own = models.find((one) => fold(one.kind) === fold(input.from));
  const target = models.find((one) => fold(one.kind) === fold(input.to));
  if (own && target) await archive(tx, actor, { spaceId, id: own.id });
  const renamed = await renameKind(tx, actor, spaceId, { from: input.from, to: input.to });
  return {
    from: input.from,
    to: renamed.kind,
    entries: renamed.entries,
    fields: report,
    applied: true,
  };
}
