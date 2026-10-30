import { beforeAll, describe, expect, it } from 'vitest';
import { exportMarkdown, find, modelOf, modelsOf, placeOf, save, slugOf } from '../src';
import { person, type Person } from './people';

// Spec 012: a kind with a model keeps its shape — no « montant » one day and « prix » the next.
let ama: Person;
const mouvement = {
  champs: [
    { nom: 'montant', nature: 'montant', obligatoire: true, unite: 'XOF' },
    { nom: 'date', nature: 'date', obligatoire: true },
    { nom: 'nature', nature: 'choix', choix: ['entrée', 'sortie', 'réaffectation'] },
    { nom: 'compte', nature: 'lien', vers: 'Compte' },
    { nom: 'confirme', nature: 'oui-non' },
  ],
  rangement: 'finances/{année}/{mois}/{titre}.md',
  colonnes: ['date', 'montant', 'nature'],
  total: 'montant',
  app: 'Finances',
};

beforeAll(async () => {
  ama = await person('Ama');
  await ama.as((tx) =>
    save(tx, ama.actor, ama.space, {
      entries: [{ kind: 'Modèle', title: 'Mouvement', data: mouvement }],
    }),
  );
});

const saving = (entry: Record<string, unknown>) =>
  ama.as((tx) => save(tx, ama.actor, ama.space, { entries: [entry] }));

describe('a model', () => {
  it('is an entry « Modèle » read back as the shape of its kind', async () => {
    const model = await ama.as((tx) => modelOf(tx, ama.space, 'mouvement'));
    expect(model?.kind).toBe('Mouvement');
    expect(model?.champs.map((one) => one.nom)).toEqual([
      'montant',
      'date',
      'nature',
      'compte',
      'confirme',
    ]);
    expect(await ama.as((tx) => modelsOf(tx, ama.space))).toHaveLength(1);
  });

  it('must itself be a model', async () => {
    await expect(
      saving({ kind: 'Modèle', title: 'Dépense', data: { champs: [] } }),
    ).rejects.toThrow(/champs/);
    await expect(
      saving({
        kind: 'Modèle',
        title: 'Dépense',
        data: { champs: [{ nom: 'poste', nature: 'choix' }] },
      }),
    ).rejects.toThrow(/give its choices/);
    await expect(
      saving({
        kind: 'Modèle',
        title: 'Dépense',
        data: { champs: [{ nom: 'x', nature: 'texte' }], rangement: '../out.md' },
      }),
    ).rejects.toThrow(/inside/);
  });
});

describe('a save of a kind with a model', () => {
  it('passes when it follows', async () => {
    const saved = await saving({
      kind: 'Mouvement',
      title: 'Petit-déjeuner',
      data: {
        montant: -650,
        date: '2026-10-30',
        nature: 'Sortie',
        confirme: true,
        texte: 'au marché',
      },
    });
    expect(saved.entries[0]?.created).toBe(true);
  });

  it('says what to fix: an unknown field, a wrong nature, a missing required one, a link given as a field', async () => {
    await expect(
      saving({ kind: 'Mouvement', title: 'Taxi', data: { prix: 500, date: '2026-10-30' } }),
    ).rejects.toThrow(
      /« prix » is not one of its fields.*« montant » is required.*Its fields: montant \(montant\)/,
    );
    await expect(
      saving({ kind: 'Mouvement', title: 'Taxi', data: { montant: '500', date: '30/10' } }),
    ).rejects.toThrow(/« montant » must be a number; « date » must be a day/);
    await expect(
      saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { montant: 500, date: '2026-10-30', nature: 'don' },
      }),
    ).rejects.toThrow(/one of: entrée, sortie, réaffectation/);
    await expect(
      saving({
        kind: 'Mouvement',
        title: 'Taxi',
        data: { montant: 500, date: '2026-10-30', compte: 'Espèces' },
      }),
    ).rejects.toThrow(/a link « compte » to a « Compte »/);
    await expect(
      saving({ kind: 'Mouvement', title: 'Taxi', data: { Montant: 500, date: '2026-10-30' } }),
    ).rejects.toThrow(/write « montant », not « Montant »/);
  });

  it('checks a change by the fields it gives, and keeps a required field', async () => {
    const [entry] = await ama.as((tx) => find(tx, ama.space, { kind: 'Mouvement' }));
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

describe('her export', () => {
  it('places an entry where its model says', async () => {
    const files = await ama.as((tx) => exportMarkdown(tx, ama.space));
    expect(files.map((one) => one.path)).toContain('finances/2026/10/petit-dejeuner.md');
  });

  it('reads the words of a rangement', () => {
    const entry = {
      id: 'ent_1',
      title: 'Gym du soir',
      data: { debut: '2026-11-03T18:30', poste: 'Santé' },
      createdAt: '2026-10-01',
    };
    expect(placeOf('vie/{année}-{mois}/{jour}-{titre}.md', entry, slugOf)).toBe(
      'vie/2026-11/03-gym-du-soir.md',
    );
    expect(placeOf('par-poste/{poste}/{id}.md', entry, slugOf)).toBe('par-poste/sante/ent_1.md');
    expect(placeOf(undefined, entry, slugOf)).toBeNull();
  });
});
