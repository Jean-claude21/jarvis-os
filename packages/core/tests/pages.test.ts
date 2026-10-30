import { beforeAll, describe, expect, it } from 'vitest';
import { find, pagesOf, renderPage, runRequest, readerOf, save } from '../src';
import { person, type Person } from './people';

// Spec 014: declarative queries and pages — her Finances page, computed by the core.
let ama: Person;
const clock = { now: new Date('2026-10-30T10:00:00Z'), zone: 'Europe/Paris' };
const ids: Record<string, string> = {};

beforeAll(async () => {
  ama = await person('Ama');
  const saved = await ama.as((tx) =>
    save(tx, ama.actor, ama.space, {
      entries: [
        {
          kind: 'Model',
          title: 'Compte',
          data: {
            fields: [
              { name: 'initial', type: 'amount' },
              {
                name: 'solde',
                type: 'formula',
                formula:
                  "initial + sum(mouvements.montant where sens = 'entrée') - sum(mouvements.montant where sens = 'sortie')",
              },
            ],
            app: 'Finances',
          },
        },
        {
          kind: 'Model',
          title: 'Fonds',
          data: {
            fields: [
              { name: 'budget', type: 'amount' },
              {
                name: 'depense',
                type: 'formula',
                formula: 'sum(affectations.montant where month(date) = month(today()))',
              },
            ],
            app: 'Finances',
          },
        },
        {
          kind: 'Model',
          title: 'Mouvement',
          data: {
            fields: [
              { name: 'montant', type: 'amount', required: true },
              { name: 'date', type: 'date', required: true },
              { name: 'sens', type: 'choice', options: ['entrée', 'sortie'] },
              { name: 'compte', type: 'link', target: 'Compte', inverse: 'mouvements' },
              { name: 'fonds', type: 'link', target: 'Fonds', inverse: 'affectations' },
            ],
            app: 'Finances',
          },
        },
        {
          kind: 'Model',
          title: 'Obligation',
          data: {
            fields: [
              { name: 'montant', type: 'amount' },
              { name: 'due', type: 'date' },
              { name: 'etat', type: 'choice', options: ['à payer', 'payée'] },
            ],
            app: 'Finances',
          },
        },
        { ref: 'c', kind: 'Compte', title: 'Banque', data: { initial: 100000 } },
        { ref: 'courses', kind: 'Fonds', title: 'Courses', data: { budget: 50000 } },
        { ref: 'loisirs', kind: 'Fonds', title: 'Loisirs', data: { budget: 20000 } },
        {
          kind: 'Mouvement',
          title: 'Salaire',
          data: { montant: 300000, date: '2026-10-25', sens: 'entrée', compte: 'c' },
        },
        {
          kind: 'Mouvement',
          title: 'Marché',
          data: {
            montant: 30000,
            date: '2026-10-12',
            sens: 'sortie',
            compte: 'c',
            fonds: 'courses',
          },
        },
        {
          kind: 'Mouvement',
          title: 'Supermarché',
          data: {
            montant: 25000,
            date: '2026-10-20',
            sens: 'sortie',
            compte: 'c',
            fonds: 'courses',
          },
        },
        {
          kind: 'Mouvement',
          title: 'Cinéma',
          data: {
            montant: 5000,
            date: '2026-10-02',
            sens: 'sortie',
            compte: 'c',
            fonds: 'loisirs',
          },
        },
        {
          kind: 'Mouvement',
          title: 'Marché de septembre',
          data: {
            montant: 40000,
            date: '2026-09-14',
            sens: 'sortie',
            compte: 'c',
            fonds: 'courses',
          },
        },
        {
          kind: 'Obligation',
          title: 'Loyer',
          data: { montant: 120000, due: '2026-11-05', etat: 'à payer' },
        },
        {
          kind: 'Obligation',
          title: 'Électricité',
          data: { montant: 18000, due: '2026-10-08', etat: 'payée' },
        },
      ],
    }),
  );
  for (const one of saved.entries) ids[one.title] = one.id;
});

const page = {
  app: 'Finances',
  filters: [{ name: 'month', type: 'month' }],
  blocks: [
    {
      block: 'stat',
      title: 'Solde',
      query: { kind: 'Compte', aggregate: { total: 'sum(solde)' } },
    },
    {
      block: 'stat_delta',
      title: 'Dépenses du mois',
      query: {
        kind: 'Mouvement',
        where: "sens = 'sortie' and month(date) = {month}",
        aggregate: { total: 'sum(montant)' },
      },
    },
    { block: 'gauge', title: 'Budgets', kind: 'Fonds', value: 'depense', max: 'budget' },
    {
      block: 'bar',
      title: 'Par fonds',
      query: {
        kind: 'Mouvement',
        where: "sens = 'sortie' and month(date) = {month}",
        groupBy: 'fonds.title',
        aggregate: { total: 'sum(montant)' },
        sort: '-total',
      },
    },
    {
      block: 'line',
      title: 'Par mois',
      query: {
        kind: 'Mouvement',
        where: "sens = 'sortie'",
        groupBy: 'month(date)',
        aggregate: { total: 'sum(montant)' },
      },
    },
    {
      block: 'table',
      title: 'Mouvements',
      query: {
        kind: 'Mouvement',
        where: 'month(date) = {month}',
        fields: ['date', 'montant', 'compte'],
        sort: '-date',
      },
      total: 'montant',
    },
    {
      block: 'task_list',
      title: 'À payer',
      kind: 'Obligation',
      where: "etat = 'à payer'",
      detail: 'due',
      action: { label: 'Payée', set: { etat: 'payée' } },
    },
    { block: 'kanban', title: 'Obligations', kind: 'Obligation', by: 'etat' },
    {
      block: 'heatmap',
      title: 'Jours de dépense',
      kind: 'Mouvement',
      where: "sens = 'sortie'",
      days: 35,
    },
    { block: 'form', title: 'Ajouter', kind: 'Mouvement' },
    { block: 'stat', title: 'Cassé', query: { kind: 'Mouvement', where: 'sum(' } },
  ],
};

describe('a declarative query', () => {
  it('filters, groups and computes over models and formulas', async () => {
    const result = await ama.as(async (tx) =>
      runRequest(await readerOf(tx, ama.space, clock), {
        kind: 'Mouvement',
        where: "sens = 'sortie'",
        groupBy: 'fonds.title',
        aggregate: { total: 'sum(montant)', n: 'count()' },
        sort: '-total',
      }),
    );
    expect(result.columns).toEqual(['group', 'total', 'n']);
    expect(result.rows).toEqual([
      { group: 'Courses', total: 95000, n: 3 },
      { group: 'Loisirs', total: 5000, n: 1 },
    ]);
  });

  it('says when a filter is not the page’s', async () => {
    await expect(
      ama.as(async (tx) =>
        runRequest(
          await readerOf(tx, ama.space, clock),
          { kind: 'Mouvement', where: 'month(date) = {mois}' },
          { month: '2026-10' },
        ),
      ),
    ).rejects.toThrow(/« \{mois\} » is not a filter of this page \(month\)/);
  });
});

describe('a page', () => {
  it('is an entry « Page », checked when saved', async () => {
    await expect(
      ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [{ kind: 'Page', title: 'Vide', data: { blocks: [{ block: 'radar' }] } }],
        }),
      ),
    ).rejects.toThrow(/A « Page » is/);
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Page', title: 'Vue du mois', data: page }],
      }),
    );
    ids.page = saved.entries[0]!.id;
    expect(await ama.as((tx) => pagesOf(tx, ama.space, 'finances'))).toEqual([
      { id: ids.page, title: 'Vue du mois', app: 'Finances', order: 100 },
    ]);
  });

  it('computes every block for her month', async () => {
    const [entry] = await ama.as((tx) => find(tx, ama.space, { kind: 'Page' }));
    const drawn = await ama.as((tx) => renderPage(tx, ama.space, entry!, {}, clock));
    expect(drawn.params).toEqual({ month: '2026-10' });
    const [stat, delta, gauge, bar, line, table, tasks, kanban, heatmap, form, broken] =
      drawn.blocks;
    // 100 000 + 300 000 − 30 000 − 25 000 − 5 000 − 40 000.
    expect(stat).toMatchObject({ value: 300000 });
    expect(delta).toMatchObject({ value: 60000, previous: 40000, delta: 50 });
    expect(gauge?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Courses', value: 55000, max: 50000 }),
        expect.objectContaining({ label: 'Loisirs', value: 5000, max: 20000 }),
      ]),
    );
    expect(bar?.points).toEqual([
      { label: 'Courses', value: 55000 },
      { label: 'Loisirs', value: 5000 },
    ]);
    expect(line?.points).toEqual([
      { label: '2026-09', value: 40000 },
      { label: '2026-10', value: 60000 },
    ]);
    expect(table).toMatchObject({
      columns: ['title', 'date', 'montant', 'compte'],
      totalValue: 360000,
    });
    expect((table?.rows as { title: string; compte: string }[])[0]).toMatchObject({
      title: 'Salaire',
      compte: 'Banque',
    });
    expect(tasks?.items).toEqual([{ id: ids.Loyer, title: 'Loyer', detail: '2026-11-05' }]);
    expect(kanban?.columns).toEqual([
      { name: 'à payer', items: [{ id: ids.Loyer, title: 'Loyer' }] },
      { name: 'payée', items: [{ id: ids['Électricité'], title: 'Électricité' }] },
    ]);
    expect(heatmap).toMatchObject({ done: 3 });
    expect((form?.fields as { name: string }[]).map((one) => one.name)).toEqual([
      'montant',
      'date',
      'sens',
      'compte',
      'fonds',
    ]);
    expect(broken?.error).toMatch(/Formula/);

    const september = await ama.as((tx) =>
      renderPage(tx, ama.space, entry!, { month: '2026-09' }, clock),
    );
    expect(september.blocks[1]).toMatchObject({ value: 40000, previous: 0, delta: null });
  });

  it('shows a record with its relations', async () => {
    const drawn = await ama.as((tx) =>
      renderPage(
        tx,
        ama.space,
        {
          id: 'p',
          title: 'Compte',
          data: { blocks: [{ block: 'record', kind: 'Compte', relations: ['mouvements'] }] },
        },
        { record: ids.Banque! },
        clock,
      ),
    );
    const record = drawn.blocks[0]?.record as {
      fields: { name: string; value: unknown }[];
      relations: { rows: unknown[] }[];
    };
    expect(record.fields).toEqual([
      { name: 'initial', value: 100000, computed: false },
      { name: 'solde', value: 300000, computed: true },
    ]);
    expect(record.relations[0]?.rows).toHaveLength(5);
  });
});
