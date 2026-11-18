import { beforeAll, describe, expect, it } from 'vitest';
import {
  composeBlock,
  createCollection,
  draftCollection,
  fieldSlug,
  placeCollection,
  pagePeriod,
  renderPage,
  save,
  weekOf,
  type KindShape,
} from '../src';
import { person, type Person } from './people';

// v3 F4: a page composed on screen from plain answers, and the « Revue » format — a period moved
// back and forth, what stood out in it, her words for it.
const expense: KindShape = {
  kind: 'Expense',
  fields: [
    { name: 'amount', type: 'amount' },
    { name: 'category', type: 'choice', options: ['food', 'home'] },
    { name: 'date', type: 'date' },
    { name: 'note', type: 'long_text' },
  ],
  facets: [
    { facet: 'dated', start: 'date' },
    { facet: 'amount', amount: 'amount' },
  ],
};
const deal: KindShape = {
  kind: 'Deal',
  fields: [{ name: 'stage', type: 'choice', options: ['lead', 'talk', 'won'] }],
  facets: [{ facet: 'stages', field: 'stage' }],
};

describe('composing a block', () => {
  it('writes a block from her answers, in her words', () => {
    expect(
      composeBlock(
        { component: 'barres', kind: 'Expense', group: 'category', measure: 'amount' },
        expense,
      ),
    ).toMatchObject({
      block: 'bar',
      query: { kind: 'Expense', groupBy: 'category', aggregate: { amount: 'sum(amount)' } },
    });
    expect(
      composeBlock({ component: 'chiffre', kind: 'Expense', inPeriod: true }, expense),
    ).toMatchObject({
      block: 'stat',
      query: { where: "date >= '{from}' and date < '{to}'", aggregate: { n: 'count()' } },
    });
    expect(composeBlock({ component: 'entonnoir', kind: 'Deal' }, deal)).toMatchObject({
      block: 'funnel',
      by: 'stage',
      steps: ['lead', 'talk', 'won'],
    });
    expect(
      composeBlock({ component: 'faits marquants', parts: ['done', 'money'] }, null),
    ).toMatchObject({
      block: 'highlights',
      parts: ['done', 'money'],
    });
  });

  it('says what is missing', () => {
    expect(() => composeBlock({ component: 'kanban', kind: 'Expense' }, expense)).toThrow(/stages/);
    expect(() =>
      composeBlock({ component: 'bar', kind: 'Expense', measure: 'note' }, expense),
    ).toThrow(/not a number/);
    expect(() => composeBlock({ component: 'sql' }, null)).toThrow(/assistant/);
  });
});

describe('the review format', () => {
  let ama: Person;
  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('knows its weeks, months and any days', () => {
    expect(weekOf('2026-11-18')).toBe('2026-W47');
    expect(pagePeriod('2026-W47', '2026-11-18')).toEqual({
      period: '2026-W47',
      unit: 'week',
      from: '2026-11-16',
      to: '2026-11-23',
    });
    expect(pagePeriod('2026-12', '2026-11-18')).toMatchObject({
      from: '2026-12-01',
      to: '2027-01-01',
    });
    expect(pagePeriod('week', '2027-01-01').period).toBe('2026-W53');
    expect(pagePeriod('2026-11-10..2026-11-16', '2026-11-18')).toMatchObject({
      unit: 'days',
      from: '2026-11-10',
      to: '2026-11-17',
    });
  });

  it('draws what a period gave', async () => {
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Task', title: 'Envoyer le devis', data: { status: 'done' } }],
      }),
    );
    const today = new Date().toISOString().slice(0, 10);
    const page = await ama.as((tx) =>
      renderPage(
        tx,
        ama.space,
        {
          id: 'try',
          title: 'Essai',
          data: {
            format: 'review',
            filters: [{ name: 'period', type: 'period', default: `${today}..${today}` }],
            blocks: [{ block: 'highlights' }],
          },
        },
        {},
        { now: new Date(), zone: 'UTC' },
      ),
    );
    expect(page.period?.unit).toBe('days');
    const highlights = page.blocks[0]!;
    expect(highlights.error).toBeUndefined();
    expect(highlights.title).toEqual({ fr: 'Ce qui a marqué', en: 'What stood out' });
    expect((highlights.figures as { made: number }).made).toBeGreaterThanOrEqual(1);
  });
});

describe('following something', () => {
  let ama: Person;
  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('drafts a collection from her phrase', () => {
    expect(draftCollection('je veux suivre mes actions de grâce')).toMatchObject({
      kind: 'Action de grâce',
      fields: [
        { name: 'date', type: 'date' },
        { name: 'note', type: 'long_text' },
      ],
    });
    expect(draftCollection('mes cultes').kind).toBe('Culte');
    expect(fieldSlug('Pour quoi ?')).toBe('pour_quoi');
  });

  it('makes it in an app, once, and moves it', async () => {
    const made = await ama.as((tx) =>
      createCollection(tx, ama.actor, ama.space, {
        kind: 'Action de grâce',
        label: 'Action de grâce',
        app: 'Vie spirituelle',
        fields: [
          { name: '', label: 'Date', type: 'date' },
          { name: '', label: 'Genre', type: 'choice', options: ['provision', 'porte ouverte'] },
        ],
      }),
    );
    expect(made.app).toBe('Vie spirituelle');
    await expect(
      ama.as((tx) =>
        createCollection(tx, ama.actor, ama.space, {
          kind: 'action de grace',
          label: '',
          app: 'Autre',
          fields: [{ name: '', label: 'Date', type: 'date' }],
        }),
      ),
    ).rejects.toThrow(/already exists/);
    await expect(
      ama.as((tx) =>
        createCollection(tx, ama.actor, ama.space, {
          kind: 'Culte',
          label: '',
          app: 'Vie spirituelle',
          fields: [{ name: '', label: 'Thème', type: 'choice' }],
        }),
      ),
    ).rejects.toThrow(/options/);
    // Her entry follows the model, and the date makes it « dated ».
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Action de grâce',
            title: 'Porte ouverte au bureau',
            data: { date: '2026-11-18', genre: 'porte ouverte' },
          },
        ],
      }),
    );
    expect(saved.entries).toHaveLength(1);
    const moved = await ama.as((tx) =>
      placeCollection(tx, ama.actor, ama.space, 'action de grâce', 'Foi'),
    );
    expect(moved).toEqual({ kind: 'Action de grâce', app: 'Foi' });
  });
});
