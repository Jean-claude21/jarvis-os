import { describe, expect, it } from 'vitest';
import {
  decide,
  get,
  installApp,
  readFacts,
  save,
  toSortOf,
  understandFile,
  type Bundle,
} from '../src';
import { person } from './people';

// v3 V7: a document read is understood — its genre, its facts with the words they come from — and
// an invoice proposes what it makes (the bill, the supplier recognised, the warranty), to her yes.
const INVOICE = `DARTY
contact@darty.com · www.darty.com
FACTURE N° F-2026-1182
Date : 12/11/2026
Lave-linge Bosch Serie 6
Garantie 2 ans pièces et main-d'œuvre
Total TTC : 649,90 €
À payer avant le 26/11/2026`;

describe('reading a document', () => {
  it('finds its genre and facts, each with its words', () => {
    const facts = readFacts(INVOICE);
    expect(facts.genre).toBe('invoice');
    expect(facts.amount?.value).toBe(649.9);
    expect(facts.amount?.quote).toContain('Total TTC');
    expect(facts.date?.value).toBe('2026-11-12');
    expect(facts.due?.value).toBe('2026-11-26');
    expect(facts.warranty?.value).toBe(24);
    expect(facts.supplier?.value).toBe('Darty');
    expect(readFacts('Ordonnance du Dr Martin\nposologie : 2 par jour').genre).toBe('prescription');
  });

  it('proposes the bill, the known supplier and the warranty, made on her yes', async () => {
    const ama = await person('Ama');
    const garanties: Bundle = {
      app: 'Garanties',
      models: [
        {
          title: 'Warranty',
          data: {
            fields: [
              { name: 'item', type: 'text' },
              { name: 'store', type: 'text' },
              { name: 'ends', type: 'date' },
            ],
          },
        },
        {
          title: 'Bill',
          data: {
            fields: [
              { name: 'amount', type: 'amount' },
              { name: 'due', type: 'date' },
              { name: 'state', type: 'choice', options: ['to_pay', 'paid'] },
            ],
          },
        },
      ],
    };
    await ama.as((tx) => installApp(tx, ama.actor, ama.space, garanties, false));
    const made = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            ref: 'o',
            kind: 'Organization',
            title: 'Darty',
            data: { website: 'https://www.darty.com' },
          },
          {
            ref: 'f',
            kind: 'Fichier',
            title: 'facture-lave-linge.pdf',
            data: { nom: 'facture-lave-linge.pdf' },
          },
        ],
      }),
    );
    const [org, file] = made.entries.map((one) => one.id) as [string, string];
    const read = await ama.as((tx) => understandFile(tx, ama.actor, ama.space, file, INVOICE));
    expect(read.genre).toBe('invoice');
    const kept = await ama.as((tx) => get(tx, ama.space, file));
    expect(kept?.data.genre).toBe('invoice');
    expect(kept?.origin.genre).toBe('read');
    // Read once: a second pass changes nothing.
    expect(
      (await ama.as((tx) => understandFile(tx, ama.actor, ama.space, file, INVOICE))).proposal,
    ).toBeNull();

    const waiting = await ama.as((tx) => toSortOf(tx, [ama.space]));
    const proposal = waiting.find((one) => one.id === read.proposal);
    expect(proposal?.type).toBe('proposal');
    expect((proposal?.detail.makes as { kind: string }[]).map((one) => one.kind).sort()).toEqual([
      'Bill',
      'Warranty',
    ]);

    await ama.as((tx) => decide(tx, ama.actor, ama.space, read.proposal!, true));
    const after = await ama.as((tx) => get(tx, ama.space, file));
    const bill = after!.links.out.find((one) => one.entry.kind === 'Bill');
    const warranty = after!.links.out.find((one) => one.entry.kind === 'Warranty');
    expect(bill?.role).toBe('pièce de');
    const billEntry = await ama.as((tx) => get(tx, ama.space, bill!.entry.id));
    expect(billEntry?.data).toMatchObject({ amount: 649.9, due: '2026-11-26', state: 'to_pay' });
    expect(billEntry?.origin.amount).toBe('read');
    expect(billEntry?.links.out.some((one) => one.entry.id === org && one.role === 'chez')).toBe(
      true,
    );
    const warrantyEntry = await ama.as((tx) => get(tx, ama.space, warranty!.entry.id));
    expect(warrantyEntry?.data.ends).toBe('2028-11-12');
  });
});
