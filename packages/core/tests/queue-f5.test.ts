import { describe, expect, it } from 'vitest';
import {
  addFile,
  amendProposal,
  decide,
  find,
  get,
  propose,
  save,
  toSortOf,
  type Blobs,
} from '../src';
import { person } from './people';

// v3 F5: what waits for her yes is changed before the yes; values read from her files wait to be
// confirmed; each item says the kinds it touches, so an app shows its own.
const blobs: Blobs = {
  put: async () => undefined,
  get: async () => new Uint8Array(),
  link: async () => '',
};

describe('the queue, F5', () => {
  it('changes a proposal before her yes: what she sets is hers, the rest keeps how it was known', async () => {
    const ama = await person('Ama');
    const made = await ama.as((tx) =>
      propose(tx, ama.actor, ama.space, {
        title: 'Facture Darty',
        entries: [
          {
            kind: 'Transaction',
            title: 'Achat Darty',
            data: { amount: 64990, date: '2026-11-12', direction: 'out' },
            origin: 'read',
          },
        ],
      }),
    );
    const id = made.entries[0]!.id;
    const waiting = await ama.as((tx) => toSortOf(tx, [ama.space]));
    expect(waiting.find((one) => one.id === id)?.kinds).toEqual(['Transaction']);

    await ama.as((tx) =>
      amendProposal(tx, ama.actor, ama.space, id, [
        { at: 0, title: 'Lave-linge', data: { amount: 649.9, direction: null } },
      ]),
    );
    await expect(
      ama.as((tx) => amendProposal(tx, ama.actor, ama.space, id, [{ at: 3, data: { a: 1 } }])),
    ).rejects.toThrow(/n° 4/);

    await ama.as((tx) => decide(tx, ama.actor, ama.space, id, true));
    const [made2] = await ama.as((tx) => find(tx, ama.space, { kind: 'Transaction' }));
    expect(made2?.title).toBe('Lave-linge');
    expect(made2?.data).toMatchObject({ amount: 649.9, date: '2026-11-12' });
    expect(made2?.data.direction).toBeUndefined();
    expect(made2?.origin).toMatchObject({ amount: 'said', date: 'read' });
    await expect(
      ama.as((tx) => amendProposal(tx, ama.actor, ama.space, id, [{ at: 0, data: { a: 1 } }])),
    ).rejects.toThrow(/No proposal/);
  });

  it('lists values read from her file, not those copied from a source; yes makes them hers', async () => {
    const kofi = await person('Kofi');
    const ids = await kofi.as(async (tx) => {
      const bill = await save(tx, kofi.actor, kofi.space, {
        entries: [
          {
            kind: 'Bill',
            title: 'Facture eau',
            data: { amount: 12500, note: 'à payer' },
            origin: { amount: 'read' },
          },
          { kind: 'Event', title: 'Réunion', data: { start: '2026-11-20T09:00' }, origin: 'read' },
        ],
      });
      const [billId, eventId] = bill.entries.map((one) => one.id) as [string, string];
      const file = await addFile(tx, kofi.actor, blobs, {
        spaceId: kofi.space,
        name: 'facture-eau.pdf',
        mediaType: 'application/pdf',
        bytes: new TextEncoder().encode('%PDF facture'),
        links: [{ to: billId, role: 'pièce de' }],
        origin: 'read',
      });
      return { billId, eventId, fileId: file.entryId };
    });
    const waiting = (await kofi.as((tx) => toSortOf(tx, [kofi.space]))).filter(
      (one) => one.type === 'verify',
    );
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({
      id: ids.billId,
      kinds: ['Bill'],
      detail: {
        kind: 'Bill',
        fields: [{ field: 'amount', value: 12500 }],
        from: { id: ids.fileId, title: 'facture-eau.pdf' },
      },
    });

    await kofi.as((tx) => decide(tx, kofi.actor, kofi.space, ids.billId, true));
    expect((await kofi.as((tx) => get(tx, kofi.space, ids.billId)))?.origin.amount).toBe('said');
    expect(
      (await kofi.as((tx) => toSortOf(tx, [kofi.space]))).some((one) => one.type === 'verify'),
    ).toBe(false);
    // Nothing to confirm on an entry read from a source: it is no proposal either.
    await expect(
      kofi.as((tx) => decide(tx, kofi.actor, kofi.space, ids.billId, true)),
    ).rejects.toThrow(/No proposal/);
  });
});
