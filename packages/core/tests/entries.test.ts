import { beforeAll, describe, expect, it } from 'vitest';
import { find, get, kinds, save } from '../src';
import { person, type Person } from './people';

// Spec 001, stories 1 and 2: what she says saved with its links; found again; the kinds she has.
let ama: Person;

beforeAll(async () => {
  ama = await person('Ama');
});

describe('saving what she says (story 1)', () => {
  it('saves two entries and the link between them in one call, read both ways', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            ref: 'taxi',
            kind: 'Dépense',
            title: 'Taxi',
            data: { montant: 2000, date: '2026-10-29', poste: 'Transport' },
          },
          { ref: 'cash', kind: 'Compte', title: 'Espèces', data: { solde: 15000 } },
        ],
        links: [{ from: 'taxi', to: 'cash', role: 'payé avec' }],
      }),
    );
    expect(saved.entries.map((one) => [one.ref, one.created])).toEqual([
      ['taxi', true],
      ['cash', true],
    ]);
    const [taxi, cash] = saved.entries.map((one) => one.id);
    const read = await ama.as((tx) => get(tx, ama.space, taxi!));
    expect(read).toMatchObject({
      kind: 'Dépense',
      title: 'Taxi',
      data: { montant: 2000, date: '2026-10-29', poste: 'Transport' },
      origin: { montant: 'said', date: 'said', poste: 'said' },
      archivedAt: null,
    });
    expect(read!.links.out).toEqual([
      expect.objectContaining({
        role: 'payé avec',
        entry: { id: cash, kind: 'Compte', title: 'Espèces' },
      }),
    ]);
    const other = await ama.as((tx) => get(tx, ama.space, cash!));
    expect(other!.links.in).toEqual([
      expect.objectContaining({
        role: 'payé avec',
        entry: { id: taxi, kind: 'Dépense', title: 'Taxi' },
      }),
    ]);
  });

  it('changes the fields it is given, keeps the others, and removes a field given null', async () => {
    const [created] = (
      await ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [
            { kind: 'Dépense', title: 'Déjeuner', data: { montant: 3500, note: 'avec Kossi' } },
          ],
        }),
      )
    ).entries;
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ id: created!.id, data: { montant: 4000, note: null } }],
      }),
    );
    const read = await ama.as((tx) => get(tx, ama.space, created!.id));
    expect(read!.data).toEqual({ montant: 4000 });
    expect(read!.origin).toEqual({ montant: 'said' });
  });

  it('marks values read on a file « read » until she says them', async () => {
    const [passport] = (
      await ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [
            {
              kind: 'Passeport',
              title: 'Passeport togolais',
              data: { numero: 'TG1234567', expire: '2027-01-14' },
              origin: 'read',
            },
          ],
        }),
      )
    ).entries;
    let read = await ama.as((tx) => get(tx, ama.space, passport!.id));
    expect(read!.origin).toEqual({ numero: 'read', expire: 'read' });
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ id: passport!.id, data: { expire: '2027-01-14' }, origin: { expire: 'said' } }],
      }),
    );
    read = await ama.as((tx) => get(tx, ama.space, passport!.id));
    expect(read!.origin).toEqual({ numero: 'read', expire: 'said' });
  });

  it('refuses a new entry without a kind, an unknown entry and a link to nothing', async () => {
    await expect(
      ama.as((tx) => save(tx, ama.actor, ama.space, { entries: [{ title: 'Sans genre' }] })),
    ).rejects.toThrow(/kind and a title/);
    await expect(
      ama.as((tx) =>
        save(tx, ama.actor, ama.space, { entries: [{ id: 'ent_unknown', data: { a: 1 } }] }),
      ),
    ).rejects.toThrow(/No entry ent_unknown/);
    await expect(
      ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [{ ref: 'x', kind: 'Note', title: 'Une note' }],
          links: [{ from: 'x', to: 'ent_nowhere', role: 'concerne' }],
        }),
      ),
    ).rejects.toThrow(/No entry ent_nowhere/);
  });
});

describe('finding, and the kinds she has (story 2)', () => {
  it('lists the kinds with their counts and the fields they use', async () => {
    const all = await ama.as((tx) => kinds(tx, ama.space));
    expect(all.find((one) => one.kind === 'Dépense')).toEqual({
      kind: 'Dépense',
      count: 2,
      fields: ['date', 'montant', 'poste'],
    });
    expect(all.find((one) => one.kind === 'Passeport')).toMatchObject({ count: 1 });
  });

  it('finds by words accents and case aside, by kind, and by the day it was created', async () => {
    const byWord = await ama.as((tx) => find(tx, ama.space, { text: 'passeport TOGOLAIS' }));
    expect(byWord.map((one) => one.title)).toEqual(['Passeport togolais']);
    const byField = await ama.as((tx) => find(tx, ama.space, { text: 'transport' }));
    expect(byField.map((one) => one.title)).toEqual(['Taxi']);
    const byKind = await ama.as((tx) => find(tx, ama.space, { kind: 'dépense' }));
    expect(byKind.map((one) => one.title).sort()).toEqual(['Déjeuner', 'Taxi']);
    const today = new Date().toISOString().slice(0, 10);
    const byDay = await ama.as((tx) => find(tx, ama.space, { from: today, to: today }));
    expect(byDay.length).toBeGreaterThanOrEqual(4);
    const before = await ama.as((tx) => find(tx, ama.space, { to: '2020-01-01' }));
    expect(before).toEqual([]);
  });
});
