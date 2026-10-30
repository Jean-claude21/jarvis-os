import { beforeAll, describe, expect, it } from 'vitest';
import {
  computedOf,
  exportMarkdown,
  find,
  get,
  modelOf,
  modelsOf,
  placeOf,
  save,
  slugOf,
} from '../src';
import { person, type Person } from './people';

// Specs 012 and 014: a kind with a model keeps its shape; its relations are links, its formulas
// are computed when read, its lines and its workflow are checked.
let ama: Person;
const compte = {
  fields: [
    { name: 'solde_initial', type: 'amount', unit: 'XOF' },
    {
      name: 'solde',
      type: 'formula',
      formula:
        "solde_initial + sum(mouvements.montant where nature = 'entrée') - sum(mouvements.montant where nature = 'sortie')",
    },
    {
      name: 'derniers_jours',
      type: 'formula',
      formula: 'count(mouvements where last_days(date, 7))',
    },
  ],
  app: 'Finances',
};
const mouvement = {
  fields: [
    { name: 'montant', type: 'amount', required: true, unit: 'XOF' },
    { name: 'date', type: 'date', required: true },
    { name: 'nature', type: 'choice', options: ['entrée', 'sortie', 'réaffectation'] },
    { name: 'compte', type: 'link', target: 'Compte', required: true, inverse: 'mouvements' },
    { name: 'confirme', type: 'boolean' },
  ],
  path: 'finances/{year}/{month}/{title}.md',
  columns: ['date', 'montant', 'nature'],
  total: 'montant',
  app: 'Finances',
};
let especes: string;
let banque: string;

beforeAll(async () => {
  ama = await person('Ama');
  const saved = await ama.as((tx) =>
    save(tx, ama.actor, ama.space, {
      entries: [
        { kind: 'Model', title: 'Compte', data: compte },
        { kind: 'Model', title: 'Mouvement', data: mouvement },
        { kind: 'Compte', title: 'Espèces', data: { solde_initial: 10000 } },
        { kind: 'Compte', title: 'Banque', data: { solde_initial: 0 } },
      ],
    }),
  );
  especes = saved.entries[2]!.id;
  banque = saved.entries[3]!.id;
});

const saving = (entry: Record<string, unknown>, links: Record<string, unknown>[] = []) =>
  ama.as((tx) => save(tx, ama.actor, ama.space, { entries: [entry], links } as never));

const today = new Date().toISOString().slice(0, 10);

describe('a model', () => {
  it('is an entry « Model » read back as the shape of its kind', async () => {
    const model = await ama.as((tx) => modelOf(tx, ama.space, 'mouvement'));
    expect(model?.kind).toBe('Mouvement');
    expect(model?.fields.map((one) => one.name)).toEqual([
      'montant',
      'date',
      'nature',
      'compte',
      'confirme',
    ]);
    expect(await ama.as((tx) => modelsOf(tx, ama.space))).toHaveLength(2);
  });

  it('must itself be a model', async () => {
    await expect(saving({ kind: 'Model', title: 'Dépense', data: { fields: [] } })).rejects.toThrow(
      /fields/,
    );
    await expect(
      saving({
        kind: 'Model',
        title: 'Dépense',
        data: { fields: [{ name: 'poste', type: 'choice' }] },
      }),
    ).rejects.toThrow(/give its options/);
    await expect(
      saving({
        kind: 'Model',
        title: 'Dépense',
        data: { fields: [{ name: 'x', type: 'text' }], path: '../out.md' },
      }),
    ).rejects.toThrow(/inside/);
    await expect(
      saving({
        kind: 'Model',
        title: 'Dépense',
        data: { fields: [{ name: 'x', type: 'formula', formula: 'sum(a' }] },
      }),
    ).rejects.toThrow(/Formula « sum\(a »/);
    await expect(
      saving({ kind: 'Model', title: 'Dépense', data: { fields: [{ name: 'x', type: 'link' }] } }),
    ).rejects.toThrow(/give its target/);
  });

  it('accepts the old words, stores the new ones and says so', async () => {
    const saved = await saving({
      kind: 'Modèle',
      title: 'Ancien',
      data: { champs: [{ nom: 'poids', nature: 'nombre', obligatoire: true }] },
    });
    expect(saved.notes.join(' ')).toMatch(/Model.*champs → fields.*nom → name.*nombre → number/);
    const model = await ama.as((tx) => modelOf(tx, ama.space, 'Ancien'));
    expect(model?.fields[0]).toMatchObject({ name: 'poids', type: 'number', required: true });
    const entry = await saving({
      kind: 'Rendez-vous',
      title: 'Dentiste',
      data: { debut: '2026-11-03T14:00', statut: 'proposé' },
    });
    const [found] = await ama.as((tx) => find(tx, ama.space, { kind: 'Rendez-vous' }));
    expect(found?.data).toEqual({ start: '2026-11-03T14:00', status: 'proposed' });
    expect(entry.notes[0]).toMatch(/debut → start.*status « proposé » → « proposed »/);
  });
});

describe('a save of a kind with a model', () => {
  it('passes when it follows, its link field becoming a link', async () => {
    const saved = await saving({
      kind: 'Mouvement',
      title: 'Petit-déjeuner',
      data: {
        montant: 650,
        date: today,
        nature: 'Sortie',
        confirme: true,
        texte: 'au marché',
        compte: especes,
      },
    });
    expect(saved.entries[0]?.created).toBe(true);
    expect(saved.links).toEqual([
      expect.objectContaining({ from: saved.entries[0]!.id, to: especes, role: 'compte' }),
    ]);
    const entry = await ama.as((tx) => get(tx, ama.space, saved.entries[0]!.id));
    expect(entry?.data).not.toHaveProperty('compte');
  });

  it('says what to fix: an unknown field, a wrong type, a missing required one', async () => {
    await expect(
      saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { prix: 500, date: '2026-10-30', compte: especes },
      }),
    ).rejects.toThrow(
      /« prix » is not one of its fields.*« montant » is required.*Its fields: montant \(amount\)/,
    );
    await expect(
      saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { montant: '500', date: '30/10', compte: especes },
      }),
    ).rejects.toThrow(/« montant » must be a number; « date » must be a day/);
    await expect(
      saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { montant: 500, date: '2026-10-30', nature: 'don', compte: especes },
      }),
    ).rejects.toThrow(/one of: entrée, sortie, réaffectation/);
    await expect(
      saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { Montant: 500, date: '2026-10-30', compte: especes },
      }),
    ).rejects.toThrow(/write « montant », not « Montant »/);
  });

  it('keeps relations right: the target kind, one link for « one », a required link', async () => {
    await expect(
      saving({ kind: 'Mouvement', title: 'Taxi', data: { montant: 500, date: today } }),
    ).rejects.toThrow(/« compte » is required/);
    const [note] = (await saving({ kind: 'Note', title: 'Une note', data: {} })).entries;
    await expect(
      saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { montant: 500, date: today, compte: note!.id },
      }),
    ).rejects.toThrow(/links a « Compte », and .* is a « Note »/);
    await expect(
      saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { montant: 500, date: today, compte: [especes, banque] },
      }),
    ).rejects.toThrow(/links one « Compte », not 2/);
    const [taxi] = (
      await saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { montant: 500, date: today, nature: 'sortie', compte: especes },
      })
    ).entries;
    const moved = await saving({ id: taxi!.id, data: { compte: banque } });
    expect(moved.unlinked).toBe(1);
    const entry = await ama.as((tx) => get(tx, ama.space, taxi!.id));
    expect(entry?.links.out.map((one) => one.entry.title)).toEqual(['Banque']);
    await saving({ id: taxi!.id, data: { compte: especes } });
  });

  it('checks a change by the fields it gives, and keeps a required field', async () => {
    const [entry] = await ama.as((tx) => find(tx, ama.space, { kind: 'Mouvement', text: 'Petit' }));
    await saving({ id: entry!.id, data: { nature: 'sortie' } });
    await expect(saving({ id: entry!.id, data: { montant: null } })).rejects.toThrow(
      /cannot be removed/,
    );
    await expect(saving({ id: entry!.id, data: { prix: 3 } })).rejects.toThrow(
      /not one of its fields/,
    );
  });

  it('lets a kind without a model say anything', async () => {
    const saved = await saving({
      kind: 'Note',
      title: 'Libre',
      data: { humeur: 'bonne', prix: 3 },
    });
    expect(saved.entries[0]?.created).toBe(true);
  });
});

describe('formulas', () => {
  it('are computed when read, across the inverse relation, never stored', async () => {
    await saving({
      kind: 'Mouvement',
      title: 'Salaire',
      data: { montant: 5000, date: today, nature: 'entrée', compte: especes },
    });
    const comptes = await ama.as((tx) => find(tx, ama.space, { kind: 'Compte' }));
    const computed = await ama.as((tx) => computedOf(tx, ama.space, comptes));
    // 10 000 + 5 000 − 650 (petit-déjeuner) − 500 (taxi).
    expect(computed[especes]).toEqual({ solde: 13850, derniers_jours: 3 });
    expect(computed[banque]).toEqual({ solde: 0, derniers_jours: 0 });
    await expect(saving({ id: especes, data: { solde: 1 } })).rejects.toThrow(
      /computed, never written/,
    );
  });
});

describe('lines and workflows', () => {
  beforeAll(async () => {
    await saving({
      kind: 'Model',
      title: 'Facture',
      data: {
        fields: [
          {
            name: 'lignes',
            type: 'lines',
            fields: [
              { name: 'article', type: 'text', required: true },
              { name: 'montant', type: 'amount' },
            ],
          },
          { name: 'total', type: 'formula', formula: 'sum(lignes.montant)' },
          { name: 'etat', type: 'choice', options: ['brouillon', 'validée', 'payée'] },
        ],
        workflow: {
          field: 'etat',
          initial: 'brouillon',
          transitions: [
            { from: 'brouillon', to: 'validée', if: 'total > 0' },
            { from: 'validée', to: 'payée' },
          ],
        },
      },
    });
  });

  it('checks each line and totals them', async () => {
    await expect(
      saving({ kind: 'Facture', title: 'F1', data: { lignes: [{ montant: 3 }] } }),
    ).rejects.toThrow(/« lignes » line 1: « article » is required/);
    const [facture] = (
      await saving({
        kind: 'Facture',
        title: 'F2',
        data: {
          lignes: [
            { article: 'Riz', montant: 1200 },
            { article: 'Huile', montant: 800 },
          ],
        },
      })
    ).entries;
    const [row] = await ama.as((tx) => find(tx, ama.space, { kind: 'Facture' }));
    expect(row?.data.etat).toBe('brouillon');
    expect((await ama.as((tx) => computedOf(tx, ama.space, [row!])))[facture!.id]).toEqual({
      total: 2000,
    });
  });

  it('allows only its transitions, when their condition holds', async () => {
    const [vide] = (await saving({ kind: 'Facture', title: 'Vide', data: {} })).entries;
    await expect(saving({ id: vide!.id, data: { etat: 'payée' } })).rejects.toThrow(
      /cannot go from « brouillon » to « payée »/,
    );
    await expect(saving({ id: vide!.id, data: { etat: 'validée' } })).rejects.toThrow(
      /total > 0 must hold/,
    );
    await expect(
      saving({ kind: 'Facture', title: 'Directe', data: { etat: 'payée' } }),
    ).rejects.toThrow(/starts as « brouillon »/);
    const [row] = await ama.as((tx) => find(tx, ama.space, { kind: 'Facture', text: 'F2' }));
    await saving({ id: row!.id, data: { etat: 'validée' } });
    await saving({ id: row!.id, data: { etat: 'payée' } });
  });
});

describe('her export', () => {
  it('places an entry where its model says', async () => {
    const files = await ama.as((tx) => exportMarkdown(tx, ama.space));
    expect(files.map((one) => one.path)).toContain(
      `finances/${today.slice(0, 4)}/${today.slice(5, 7)}/petit-dejeuner.md`,
    );
  });

  it('reads the words of a path, new and old', () => {
    const entry = {
      id: 'ent_1',
      title: 'Gym du soir',
      data: { start: '2026-11-03T18:30', poste: 'Santé' },
      createdAt: '2026-10-01',
    };
    expect(placeOf('vie/{year}-{month}/{day}-{title}.md', entry, slugOf)).toBe(
      'vie/2026-11/03-gym-du-soir.md',
    );
    expect(placeOf('vie/{année}-{mois}/{jour}-{titre}.md', entry, slugOf)).toBe(
      'vie/2026-11/03-gym-du-soir.md',
    );
    expect(placeOf('par-poste/{poste}/{id}.md', entry, slugOf)).toBe('par-poste/sante/ent_1.md');
    expect(placeOf(undefined, entry, slugOf)).toBeNull();
  });
});
