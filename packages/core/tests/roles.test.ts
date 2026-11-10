import { beforeAll, describe, expect, it } from 'vitest';
import {
  appLines,
  appsOf,
  appsTouched,
  bridgesOf,
  createBridge,
  find,
  installApp,
  save,
  type Bundle,
} from '../src';
import { person, type Person } from './people';

// Spec 033: each app says its role; Jarvis shows one line per app, finds the apps a sentence touches
// without any AI, and keeps the bridges between apps as rules that run when she saves.
const money: Bundle = {
  app: 'Argent',
  models: [
    {
      title: 'Transaction',
      data: {
        fields: [
          { name: 'amount', type: 'amount', required: true },
          { name: 'direction', type: 'choice', options: ['in', 'out'] },
          { name: 'balance', type: 'formula', formula: 'amount' },
        ],
      },
    },
  ],
  role: {
    covers: { fr: 'Ton argent.', en: 'Your money.' },
    intents: ['acheté', 'payé', 'fcfa'],
    watches: ['Transaction'],
    writes: ['Transaction'],
    ask: [{ fr: 'Sur quel compte ?', en: 'From which account?' }],
    instructions: { fr: 'Une dépense est un Mouvement « out ».', en: 'Money spent goes out.' },
  },
};
const subscriptions: Bundle = {
  app: 'Abonnements',
  models: [
    { title: 'SubscriptionPayment', data: { fields: [{ name: 'amount', type: 'amount' }] } },
  ],
  role: {
    covers: 'Tes abonnements.',
    intents: ['abonnement', 'netflix'],
    watches: ['SubscriptionPayment'],
    writes: ['SubscriptionPayment'],
    bridges: [
      {
        from: 'SubscriptionPayment',
        create: 'Transaction',
        title: '{title}',
        data: { amount: '=amount', direction: 'out' },
        link: 'paid',
      },
    ],
  },
};

describe('apps and their roles', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
    for (const bundle of [money, subscriptions]) {
      await ama.as((tx) => installApp(tx, ama.actor, ama.space, bundle, false));
    }
    // An app installed before roles: deduced from its models.
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Model',
            title: 'Plant',
            data: { app: 'Jardin', fields: [{ name: 'water', type: 'text' }] },
          },
        ],
      }),
    );
  });

  it('keeps each app with its role, and deduces one for an older app', async () => {
    const apps = await ama.as((tx) => appsOf(tx, ama.space));
    expect(apps.map((one) => [one.app, one.declared])).toEqual([
      ['Abonnements', true],
      ['Argent', true],
      ['Jardin', false],
    ]);
    const lines = appLines(apps);
    expect(lines[1]).toBe(
      '« Argent »: Ton argent. — concerned by: acheté, payé, fcfa, Transaction',
    );
    expect(lines[2]).toContain('« Jardin »: Plant');
  });

  it('finds the apps a sentence touches, with what to ask and the fields to write', async () => {
    const touched = await ama.as((tx) =>
      appsTouched(tx, ama.space, "J'ai acheté du riz, 3500 FCFA au marché"),
    );
    expect(touched.map((one) => one.app)).toEqual(['Argent']);
    expect(touched[0]).toMatchObject({
      because: ['acheté', 'fcfa'],
      ask: ['Sur quel compte ?'],
      instructions: 'Une dépense est un Mouvement « out ».',
      fields: {
        Transaction: [
          { name: 'amount', type: 'amount', required: true },
          { name: 'direction', type: 'choice', required: false },
        ],
      },
    });
    const both = await ama.as((tx) => appsTouched(tx, ama.space, "J'ai payé l'abonnement Netflix"));
    expect(both.map((one) => one.app).sort()).toEqual(['Abonnements', 'Argent']);
    expect(await ama.as((tx) => appsTouched(tx, ama.space, 'Il fait beau'))).toEqual([]);
  });

  it('runs a bridge when she saves: a payment becomes a movement of money', async () => {
    expect((await ama.as((tx) => bridgesOf(tx, ama.space))).map((one) => one.title)).toEqual([
      'SubscriptionPayment → Transaction',
    ]);
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { kind: 'SubscriptionPayment', title: 'Netflix novembre', data: { amount: 5000 } },
        ],
      }),
    );
    const movements = await ama.as((tx) => find(tx, ama.space, { kind: 'Transaction' }));
    expect(movements).toEqual([
      expect.objectContaining({
        title: 'Netflix novembre',
        data: expect.objectContaining({ amount: 5000, direction: 'out' }),
      }),
    ]);
  });

  it('never blocks her save: what the other app needs is left as a reminder', async () => {
    await ama.as(async (tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            id: (await find(tx, ama.space, { kind: 'Model', text: 'Transaction' }))[0]!.id,
            data: {
              fields: [
                { name: 'amount', type: 'amount', required: true },
                { name: 'direction', type: 'choice', options: ['in', 'out'] },
                { name: 'account', type: 'text', required: true },
              ],
            },
          },
        ],
      }),
    );
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'SubscriptionPayment', title: 'Spotify', data: { amount: 2000 } }],
      }),
    );
    expect(
      await ama.as((tx) => find(tx, ama.space, { kind: 'SubscriptionPayment', text: 'Spotify' })),
    ).toHaveLength(1);
    expect(
      await ama.as((tx) => find(tx, ama.space, { kind: 'Transaction', text: 'Spotify' })),
    ).toEqual([]);
    const [reminder] = await ama.as((tx) =>
      find(tx, ama.space, { kind: 'Reminder', text: 'compléter' }),
    );
    expect(reminder!.title).toMatch(/SubscriptionPayment → Transaction.*account/);
  });

  it('makes a bridge on demand', async () => {
    await ama.as((tx) =>
      createBridge(tx, ama.actor, ama.space, {
        app: 'Jardin',
        bridge: {
          from: 'Plant',
          create: 'Transaction',
          title: 'Achat de {title}',
          data: { amount: 0, direction: 'out' },
        },
      }),
    );
    expect((await ama.as((tx) => bridgesOf(tx, ama.space))).map((one) => one.title)).toContain(
      'Plant → Transaction',
    );
  });
});
