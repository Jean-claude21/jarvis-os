// The engine's keywords are English (decision 0008); her kinds, fields and values stay in her
// words. Specs 006–013 shipped French keywords: migration 0006 renamed what was stored, and for a
// while a save still accepts the old names, stores the new ones and says so.

/** Fields every entry may carry: time and state (old name → new name). */
export const FIELD_RENAMES: Readonly<Record<string, string>> = {
  debut: 'start',
  fin: 'end',
  duree: 'duration',
  quand: 'at',
  echeance: 'due',
  repete: 'repeat',
  sauf: 'except',
  jusqu: 'until',
  fuseau: 'timezone',
  statut: 'status',
  prochaine: 'next',
  dernier_envoi: 'last_sent',
  erreur: 'error',
};

/** The states an entry may be in (old value → new value). */
export const STATUS_RENAMES: Readonly<Record<string, string>> = {
  proposé: 'proposed',
  propose: 'proposed',
  fait: 'done',
  annulé: 'cancelled',
  annule: 'cancelled',
  envoyé: 'sent',
  envoye: 'sent',
  'non envoyé': 'failed',
  'non envoye': 'failed',
  'à corriger': 'to_fix',
  'a corriger': 'to_fix',
  'à venir': 'planned',
  'a venir': 'planned',
};

/** The states the engine knows; any other is hers. */
export const STATUSES = ['proposed', 'planned', 'done', 'cancelled', 'sent', 'failed', 'to_fix'];

/** States that close an entry: out of what comes and of what needs her. */
export const CLOSED = new Set(['done', 'sent', 'failed', 'cancelled']);

/** A model's keywords (old → new). */
export const MODEL_RENAMES: Readonly<Record<string, string>> = {
  champs: 'fields',
  ouvert: 'open',
  rangement: 'path',
  colonnes: 'columns',
  regroupement: 'groupBy',
};

/** A model field's keywords (old → new). */
export const MODEL_FIELD_RENAMES: Readonly<Record<string, string>> = {
  nom: 'name',
  nature: 'type',
  obligatoire: 'required',
  choix: 'options',
  vers: 'target',
  unite: 'unit',
  aide: 'help',
};

/** A field type's name (old → new). */
export const TYPE_RENAMES: Readonly<Record<string, string>> = {
  texte: 'text',
  nombre: 'number',
  montant: 'amount',
  moment: 'datetime',
  duree: 'duration',
  choix: 'choice',
  'oui-non': 'boolean',
  liste: 'list',
  lien: 'link',
  calcul: 'formula',
  lignes: 'lines',
};

/** The system kinds of the engine (old name → new name). */
export const KIND_RENAMES: Readonly<Record<string, string>> = { modele: 'Model' };

const renamed = (
  value: Record<string, unknown>,
  map: Readonly<Record<string, string>>,
  notes: string[],
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, one] of Object.entries(value)) {
    const to = map[key];
    if (to && !(to in value)) {
      out[to] = one;
      notes.push(`${key} → ${to}`);
    } else if (!to) out[key] = one;
  }
  return out;
};

/** A status in the new words. */
export function statusOf(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return STATUS_RENAMES[value.trim().toLowerCase()] ?? value;
}

/** A model's data in the new words, and what was renamed. */
export function modelInNewWords(data: Record<string, unknown>, notes: string[] = []) {
  const model = renamed(data, MODEL_RENAMES, notes);
  if (Array.isArray(model.fields)) {
    model.fields = model.fields.map((field: unknown) => {
      if (!field || typeof field !== 'object') return field;
      const one = renamed(field as Record<string, unknown>, MODEL_FIELD_RENAMES, notes);
      if (typeof one.type === 'string' && TYPE_RENAMES[one.type]) {
        notes.push(`${one.type} → ${TYPE_RENAMES[one.type]}`);
        one.type = TYPE_RENAMES[one.type];
      }
      return one;
    });
  }
  return model;
}

/**
 * An entry's data in the new words: old field names renamed, an old status translated. `null`
 * (a removal) is renamed too, so removing `debut` removes `start`.
 */
export function dataInNewWords(data: Record<string, unknown>, notes: string[] = []) {
  const out = renamed(data, FIELD_RENAMES, notes);
  if (out.status !== undefined && out.status !== null) {
    const status = statusOf(out.status);
    if (status !== out.status)
      notes.push(`status « ${String(out.status)} » → « ${String(status)} »`);
    out.status = status;
  }
  return out;
}
