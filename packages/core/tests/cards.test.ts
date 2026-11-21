import { beforeAll, describe, expect, it } from 'vitest';
import { cardsOf, pagesOf, renderPage, save } from '../src';
import { person, type Person } from './people';

// Spec 107: the cards — her pages' named blocks, each once; a fiche's cards from her models; the
// band of Aujourd'hui and a kind's fiche as pages of their own; a card's size.
let ama: Person;
const clock = { now: new Date('2026-10-30T10:00:00Z'), zone: 'Europe/Paris' };
const ids: Record<string, string> = {};

const spent = {
  block: 'stat',
  title: { fr: 'Payé ce mois', en: 'Paid this month' },
  query: { kind: 'Paiement', aggregate: { total: 'sum(montant)' } },
};

beforeAll(async () => {
  ama = await person('Ama');
  const saved = await ama.as((tx) =>
    save(tx, ama.actor, ama.space, {
      entries: [
        {
          kind: 'Model',
          title: 'Abonnement',
          data: { fields: [{ name: 'prix', type: 'amount' }], app: 'Argent' },
        },
        {
          kind: 'Model',
          title: 'Paiement',
          data: {
            fields: [
              { name: 'montant', type: 'amount' },
              { name: 'date', type: 'date' },
              { name: 'abonnement', type: 'link', target: 'Abonnement', inverse: 'paiements' },
            ],
            app: 'Argent',
          },
        },
        { ref: 'n', kind: 'Abonnement', title: 'Netflix', data: { prix: 899 } },
        { ref: 's', kind: 'Abonnement', title: 'Spotify', data: { prix: 1099 } },
        {
          kind: 'Paiement',
          title: 'Netflix octobre',
          data: { montant: 899, date: '2026-10-21', abonnement: 'n' },
        },
        {
          kind: 'Paiement',
          title: 'Netflix septembre',
          data: { montant: 899, date: '2026-09-21', abonnement: 'n' },
        },
        {
          kind: 'Paiement',
          title: 'Spotify octobre',
          data: { montant: 1099, date: '2026-10-02', abonnement: 's' },
        },
        {
          kind: 'Page',
          title: 'Vue',
          data: {
            app: 'Argent',
            blocks: [
              spent,
              {
                block: 'table',
                title: 'Paiements',
                size: 'l',
                query: { kind: 'Paiement', fields: ['date', 'montant'] },
              },
              { block: 'calendar' },
            ],
          },
        },
        // The same card on a second page, widened: still one card.
        {
          kind: 'Page',
          title: 'Autre',
          data: { app: 'Argent', blocks: [{ ...spent, size: 's' }] },
        },
      ],
    }),
  );
  const at = (title: string) => saved.entries.find((one) => one.title === title)!.id;
  ids.netflix = at('Netflix');
  ids.vue = at('Vue');
});

describe('the cards', () => {
  it('are her pages’ named blocks, each once, with their family', async () => {
    const cards = await ama.as((tx) => cardsOf(tx, ama.space, { app: 'Argent' }));
    expect(cards.map((one) => [one.title, one.family, one.from?.title])).toEqual([
      [{ fr: 'Payé ce mois', en: 'Paid this month' }, 'figure', 'Vue'],
      ['Paiements', 'list', 'Vue'],
    ]);
  });

  it('give a fiche « its » entries and their total, from a relation', async () => {
    const cards = await ama.as((tx) => cardsOf(tx, ama.space, { kind: 'Abonnement' }));
    expect(cards.map((one) => one.title)).toEqual([
      { fr: 'Paiements liés', en: 'Linked Paiements' },
      { fr: 'Total des paiements', en: 'Total paiements' },
    ]);
    // Drawn for Netflix: its two payments, not Spotify's.
    const ficheData = { for: 'Abonnement', blocks: cards.map((one) => one.block) };
    const fiche = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Page', title: 'Fiche abonnement', data: ficheData }],
      }),
    );
    const drawn = await ama.as((tx) =>
      renderPage(
        tx,
        ama.space,
        { id: fiche.entries[0]!.id, title: 'Fiche', data: ficheData },
        { record: ids.netflix! },
        clock,
      ),
    );
    expect(drawn.blocks.map((one) => one.error ?? null)).toEqual([null, null]);
    expect((drawn.blocks[0] as unknown as { rows: unknown[] }).rows).toHaveLength(2);
    expect(drawn.blocks[1]).toMatchObject({ value: 1798 });
    // The fiche's page is the kind's, never in the app's list.
    expect(
      (await ama.as((tx) => pagesOf(tx, ama.space, { for: 'abonnement' }))).map((p) => p.title),
    ).toEqual(['Fiche abonnement']);
    expect((await ama.as((tx) => pagesOf(tx, ama.space, 'Argent'))).map((p) => p.title)).toEqual([
      'Autre',
      'Vue',
    ]);
  });

  it('make Aujourd’hui’s band, and keep their size when drawn', async () => {
    const bandData = { today: true, blocks: [{ ...spent, size: 'l' }] };
    const band = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Page', title: 'Mes cartes', data: bandData }],
      }),
    );
    expect(
      (await ama.as((tx) => pagesOf(tx, ama.space, { today: true }))).map((p) => p.id),
    ).toEqual([band.entries[0]!.id]);
    expect(
      (await ama.as((tx) => pagesOf(tx, ama.space))).some((p) => p.title === 'Mes cartes'),
    ).toBe(false);
    const drawn = await ama.as((tx) =>
      renderPage(tx, ama.space, { id: 'b', title: 'B', data: bandData }, {}, clock),
    );
    expect(drawn.blocks[0]).toMatchObject({ size: 'l' });
    await expect(
      ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [{ kind: 'Page', title: 'X', data: { blocks: [{ ...spent, size: 'xl' }] } }],
        }),
      ),
    ).rejects.toThrow(/A « Page » is/);
  });
});
