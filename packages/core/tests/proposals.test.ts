import { beforeAll, describe, expect, it } from 'vitest';
import { capture, decide, find, get, propose, save, toSortOf } from '../src';
import { person, type Person } from './people';

// Spec 046: what waits for her yes, in one place; a proposal across her apps made in one step.
describe('to sort', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('lists captures, proposed entries and proposals; yes makes them, no sets them aside', async () => {
    await ama.as((tx) =>
      capture(tx, ama.actor, ama.space, { text: 'Idée : peindre le salon', source: 'app' }),
    );
    const slot = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Event',
            title: 'Séance proposée',
            data: { status: 'proposed', start: '2027-01-05T07:00' },
          },
        ],
      }),
    );
    const fridge = await ama.as((tx) =>
      propose(tx, ama.actor, ama.space, {
        title: 'Frigo acheté 250 000 F',
        why: 'Une dépense, un objet de la maison, sa garantie.',
        apps: ['Finances', 'Maison'],
        entries: [
          {
            ref: 't',
            kind: 'Transaction',
            title: 'Frigo',
            data: { amount: 250000, direction: 'out' },
          },
          {
            ref: 'o',
            kind: 'Item',
            title: 'Frigo Samsung',
            data: { warranty_until: '2028-11-10' },
          },
        ],
        links: [{ from: 't', to: 'o', role: 'bought' }],
      }),
    );
    const list = await ama.as((tx) => toSortOf(tx, [ama.space]));
    expect(list.map((one) => one.type).sort()).toEqual(['capture', 'proposal', 'proposed']);
    expect(list.find((one) => one.type === 'proposal')!.detail.makes).toEqual([
      { kind: 'Transaction', title: 'Frigo' },
      { kind: 'Item', title: 'Frigo Samsung' },
    ]);

    await ama.as((tx) => decide(tx, ama.actor, ama.space, fridge.entries[0]!.id, true));
    const [item] = await ama.as((tx) => find(tx, ama.space, { kind: 'Item' }));
    const full = await ama.as((tx) => get(tx, ama.space, item!.id));
    expect(full!.links.out.map((one) => one.role)).toContain('from_proposal');
    expect(full!.links.in.map((one) => one.role)).toContain('bought');

    await ama.as((tx) => decide(tx, ama.actor, ama.space, slot.entries[0]!.id, false));
    expect(await ama.as((tx) => find(tx, ama.space, { kind: 'Event' }))).toEqual([]);
    expect((await ama.as((tx) => toSortOf(tx, [ama.space]))).map((one) => one.type)).toEqual([
      'capture',
    ]);
    await expect(
      ama.as((tx) => decide(tx, ama.actor, ama.space, fridge.entries[0]!.id, true)),
    ).rejects.toThrow(/No proposal/);
  });
});
