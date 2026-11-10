import { beforeAll, describe, expect, it } from 'vitest';
import { capture, fileCapture, fileSure, find, inboxOf, personByChat, presort, save } from '../src';
import { db as pool, person, type Person } from './people';

// Spec 035: whatever arrives is kept at once, as it is; rules alone pre-sort it; she files it later,
// one by one or everything sure at once; a Telegram chat leads to her own space.
const words = { Finances: ['acheté', 'payé', 'dépense', 'fcfa'], Routines: ['séance', 'sport'] };

describe('the pre-sort, by rules only', () => {
  it('reads an amount, its currency, an account, her hashtags and the apps concerned', () => {
    expect(presort("J'ai payé le taxi 2 000 F en cash #transport", words)).toEqual({
      tags: ['transport'],
      apps: ['Finances'],
      amount: 2000,
      currency: 'XOF',
      account: 'cash',
      sure: true,
    });
    expect(presort('Riz 12,50 € au marché, payé par Flooz', words)).toMatchObject({
      amount: 12.5,
      currency: 'EUR',
      account: 'mobile_money',
      apps: ['Finances'],
      sure: true,
    });
    expect(presort('Séance de sport ce matin', words)).toMatchObject({
      apps: ['Routines'],
      sure: false,
    });
    expect(presort('Appeler maman', words)).toEqual({ tags: [], apps: [], sure: false });
  });
});

describe('her inbox', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('keeps a capture at once, as she said it, then files it one by one or all that is sure', async () => {
    const taxi = await ama.as((tx) =>
      capture(tx, ama.actor, ama.space, {
        text: "J'ai payé le taxi 2 000 F en cash",
        source: 'telegram',
        at: '2026-11-10T07:42:00.000Z',
        words,
      }),
    );
    expect(taxi.kind).toBe('Capture');
    expect(taxi.origin.text).toBe('said');
    expect(taxi.data).toMatchObject({
      source: 'telegram',
      at: '2026-11-10T07:42:00.000Z',
      status: 'to_file',
    });
    const idea = await ama.as((tx) =>
      capture(tx, ama.actor, ama.space, {
        text: 'Idée : un potager sur le toit',
        source: 'claude',
        words,
      }),
    );
    expect((await ama.as((tx) => inboxOf(tx, ama.space))).map((one) => one.id)).toEqual([
      taxi.id,
      idea.id,
    ]);

    const sure = await ama.as((tx) => fileSure(tx, ama.actor, ama.space));
    expect(sure).toEqual({ filed: ["J'ai payé le taxi 2 000 F en cash"], left: 1, waiting: [] });
    const [movement] = await ama.as((tx) => find(tx, ama.space, { kind: 'Transaction' }));
    expect(movement!.data).toMatchObject({
      amount: 2000,
      currency: 'XOF',
      direction: 'out',
      date: '2026-11-10',
    });

    await ama.as((tx) =>
      fileCapture(tx, ama.actor, ama.space, idea.id, [
        { kind: 'Note', title: 'Un potager sur le toit' },
      ]),
    );
    expect(await ama.as((tx) => inboxOf(tx, ama.space))).toEqual([]);
    const note = (await ama.as((tx) => find(tx, ama.space, { kind: 'Note' })))[0]!;
    const { rows } = await ama.as((tx) =>
      tx.query<{ role: string }>('select role from link where from_id = $1 and to_id = $2', [
        note.id,
        idea.id,
      ]),
    );
    expect(rows.map((one) => one.role)).toEqual(['from_capture']);
  });

  it('links the account her model asks for, or leaves it to file and says why', async () => {
    const kofi = await person('Kofi');
    await kofi.as((tx) =>
      save(tx, kofi.actor, kofi.space, {
        entries: [
          { kind: 'Model', title: 'Account', data: { fields: [{ name: 'type', type: 'text' }] } },
          {
            kind: 'Model',
            title: 'Transaction',
            data: {
              fields: [
                { name: 'amount', type: 'amount', required: true },
                { name: 'date', type: 'date' },
                { name: 'direction', type: 'choice', options: ['in', 'out'] },
                { name: 'account', type: 'link', target: 'Account', required: true },
                { name: 'note', type: 'text' },
              ],
            },
          },
          { kind: 'Account', title: 'Espèces', data: { type: 'cash' } },
          { kind: 'Account', title: 'Ecobank', data: { type: 'bank' } },
        ],
      }),
    );
    for (const text of ["J'ai payé le taxi 2 000 F en cash", 'Payé le pain 500 F']) {
      await kofi.as((tx) => capture(tx, kofi.actor, kofi.space, { text, source: 'app', words }));
    }
    const sure = await kofi.as((tx) => fileSure(tx, kofi.actor, kofi.space));
    expect(sure.filed).toEqual(["J'ai payé le taxi 2 000 F en cash"]);
    expect(sure.waiting).toEqual([{ title: 'Payé le pain 500 F', needs: 'account' }]);
    const [move] = await kofi.as((tx) => find(tx, kofi.space, { kind: 'Transaction' }));
    const { rows } = await kofi.as((tx) =>
      tx.query<{ title: string }>(
        `select e.title from link l join entry e on e.id = l.to_id where l.from_id = $1 and l.role = 'account'`,
        [move!.id],
      ),
    );
    expect(rows.map((one) => one.title)).toEqual(['Espèces']);
  });

  it('finds whose a Telegram chat is: her own space', async () => {
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Channel', title: 'Telegram', data: { telegram: '424242' } }],
      }),
    );
    expect(await personByChat(pool, '424242')).toEqual({ person: ama.id, spaceId: ama.space });
    expect(await personByChat(pool, '999')).toBeNull();
  });
});
