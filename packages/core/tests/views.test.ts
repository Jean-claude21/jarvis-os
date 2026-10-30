import { beforeAll, describe, expect, it } from 'vitest';
import { filterFormula, runView, save, viewsOf } from '../src';
import { person, type Person } from './people';

// Spec 015: views — filter on any field (through links too), sort, columns, table / kanban /
// calendar, kept as entries « View ».
let ama: Person;

beforeAll(async () => {
  ama = await person('Ama');
  await ama.as((tx) =>
    save(tx, ama.actor, ama.space, {
      entries: [
        {
          kind: 'Model',
          title: 'Fund',
          data: {
            fields: [
              { name: 'budget', type: 'amount' },
              { name: 'family', type: 'choice', options: ['needs', 'wants'] },
            ],
          },
        },
        {
          kind: 'Model',
          title: 'Transaction',
          data: {
            fields: [
              { name: 'amount', type: 'amount', required: true },
              { name: 'date', type: 'date' },
              {
                name: 'direction',
                type: 'choice',
                options: ['in', 'out'],
                optionLabels: { out: { fr: 'sortie' } },
              },
              { name: 'fund', type: 'link', target: 'Fund', inverse: 'allocations' },
            ],
          },
        },
        { ref: 'c', kind: 'Fund', title: 'Courses', data: { budget: 50000, family: 'needs' } },
        { ref: 'l', kind: 'Fund', title: 'Loisirs', data: { budget: 20000, family: 'wants' } },
        {
          kind: 'Transaction',
          title: 'Marché',
          data: { amount: 30000, date: '2026-10-12', direction: 'out', fund: 'c' },
        },
        {
          kind: 'Transaction',
          title: 'Cinéma',
          data: { amount: 5000, date: '2026-10-02', direction: 'out', fund: 'l' },
        },
        {
          kind: 'Transaction',
          title: 'Salaire',
          data: { amount: 300000, date: '2026-10-25', direction: 'in' },
        },
        {
          kind: 'Transaction',
          title: 'Épicerie',
          data: { amount: 12000, date: '2026-09-20', direction: 'out', fund: 'c' },
        },
      ],
    }),
  );
});

const clock = { now: new Date('2026-10-30T10:00:00Z') };

describe('a view', () => {
  it('turns each filter into a formula', () => {
    expect(filterFormula({ field: 'fund.title', op: 'eq', value: "L'épargne" })).toBe(
      "fund.title = 'L\\'épargne'",
    );
    expect(filterFormula({ field: 'date', op: 'last_days', value: 7 })).toBe('last_days(date, 7)');
    expect(filterFormula({ field: 'date de paiement', op: 'empty' })).toBe(
      "(`date de paiement` = null or `date de paiement` = '')",
    );
  });

  it('filters through a link, sorts, totals, and says what it can be shown as', async () => {
    const result = await ama.as((tx) =>
      runView(
        tx,
        ama.space,
        {
          kind: 'Transaction',
          filters: [
            { field: 'direction', op: 'eq', value: 'out' },
            { field: 'fund.family', op: 'eq', value: 'needs' },
          ],
          sort: [{ field: 'amount', desc: true }],
          columns: ['date', 'amount', 'fund'],
        },
        clock,
      ),
    );
    expect(result.types).toEqual(['table', 'kanban', 'calendar']);
    expect(result.rows.map((row) => [row.title, row.fund])).toEqual([
      ['Marché', 'Courses'],
      ['Épicerie', 'Courses'],
    ]);
    expect(result.totals).toEqual({ amount: 42000 });
    expect(result.fields.map((field) => field.path)).toContain('fund.budget');
  });

  it('shows the same entries as a kanban and as a calendar', async () => {
    const kanban = await ama.as((tx) =>
      runView(
        tx,
        ama.space,
        { kind: 'Transaction', type: 'kanban', filters: [{ field: 'date', op: 'this_month' }] },
        clock,
      ),
    );
    expect(kanban.kanban?.by).toBe('direction');
    expect(kanban.kanban?.columns.map((column) => [column.name, column.items.length])).toEqual([
      ['in', 1],
      ['out', 2],
    ]);
    const calendar = await ama.as((tx) =>
      runView(tx, ama.space, { kind: 'Transaction', type: 'calendar' }, clock),
    );
    expect(calendar.calendar?.items.find((item) => item.title === 'Salaire')?.day).toBe(
      '2026-10-25',
    );
  });

  it('groups a table', async () => {
    const result = await ama.as((tx) =>
      runView(
        tx,
        ama.space,
        { kind: 'Transaction', groupBy: 'date', sort: [{ field: 'date' }] },
        clock,
      ),
    );
    expect(result.groups?.map((group) => [group.name, group.rows.length])).toEqual([
      ['2026-09', 1],
      ['2026-10', 3],
    ]);
  });

  it('is kept as an entry « View », checked when saved', async () => {
    await expect(
      ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [
            {
              kind: 'View',
              title: 'Bad',
              data: { kind: 'Transaction', filters: [{ field: 'x', op: 'like' }] },
            },
          ],
        }),
      ),
    ).rejects.toThrow(/A « View » is/);
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'View',
            title: 'Spending',
            data: {
              kind: 'Transaction',
              type: 'kanban',
              filters: [{ field: 'direction', op: 'eq', value: 'out' }],
              label: { fr: 'Dépenses' },
              default: true,
            },
          },
        ],
      }),
    );
    expect(await ama.as((tx) => viewsOf(tx, ama.space, { kind: 'transaction' }))).toMatchObject([
      {
        title: 'Spending',
        kind: 'Transaction',
        type: 'kanban',
        label: { fr: 'Dépenses' },
        default: true,
      },
    ]);
  });
});
