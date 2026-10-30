import { beforeAll, describe, expect, it } from 'vitest';
import { addFile, attention, filesOf, save, type Blobs } from '../src';
import { person, type Person } from './people';

// Spec 013: « Maintenant » — what needs her, read from what she keeps; and her files, listed.
let ama: Person;
const now = new Date('2026-10-30T09:41:00Z'); // Friday 10:41 in Paris

beforeAll(async () => {
  ama = await person('Ama');
  await ama.as((tx) =>
    save(tx, ama.actor, ama.space, {
      entries: [
        {
          kind: 'Rappel',
          title: 'Taxe foncière',
          data: { at: '2026-10-30T08:00', status: 'failed' },
        },
        { kind: 'Obligation', title: 'Rembourser Paul', data: { due: '2026-10-29' } },
        {
          kind: 'Obligation',
          title: 'Déjà payé',
          data: { due: '2026-10-28', status: 'done' },
        },
        {
          kind: 'Événement',
          title: 'Réunion passée',
          data: { start: '2026-10-29T10:00', end: '2026-10-29T11:00' },
        },
        {
          kind: 'Événement',
          title: 'Dentiste',
          data: { start: '2026-10-30T14:00', end: '2026-10-30T15:00' },
        },
        { kind: 'Habitude', title: 'Prière', data: { repeat: '30 4 * * *', duration: 60 } },
        {
          kind: 'Créneau',
          title: 'Mémoire',
          data: { start: '2026-10-30T16:00', duration: 120, status: 'proposed' },
        },
        { kind: 'Idée', title: 'Ajuster le coucher', data: { status: 'proposed' } },
        { kind: 'Date', title: 'Anniversaire', data: { date: '2026-11-01' } },
      ],
    }),
  );
});

describe('what needs her now', () => {
  it('groups what went wrong, what is late, what is proposed, today and this week', async () => {
    const seen = await ama.as((tx) => attention(tx, [ama.space], now));
    expect(seen.items.map((one) => `${one.group}:${one.title}`)).toEqual([
      'fix:Taxe foncière',
      'late:Rembourser Paul',
      'proposed:Mémoire',
      'proposed:Ajuster le coucher',
      'today:Dentiste',
      'week:Anniversaire',
    ]);
  });

  it('gives her whole day, the repeated blocks included', async () => {
    const seen = await ama.as((tx) => attention(tx, [ama.space], now));
    expect(seen.day.map((one) => one.title)).toEqual([
      'Prière',
      'Taxe foncière',
      'Dentiste',
      'Mémoire',
    ]);
  });
});

describe('her files', () => {
  it('lists each file with what it is linked to', async () => {
    const blobs: Blobs = {
      put: async () => undefined,
      get: async () => new Uint8Array(),
      link: async () => '',
    };
    await ama.as(async (tx) => {
      const target = await save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Compte', title: 'Mobile money A' }],
      });
      await addFile(tx, ama.actor, blobs, {
        spaceId: ama.space,
        name: 'releve.csv',
        mediaType: 'text/csv',
        bytes: new TextEncoder().encode('date;montant\n2026-10-29;-2500\n'),
        links: [{ to: target.entries[0]!.id, role: 'relevé de' }],
      });
    });
    const files = await ama.as((tx) => filesOf(tx, ama.space));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ name: 'releve.csv', mediaType: 'text/csv', read: true });
    expect(files[0]?.links).toEqual([
      expect.objectContaining({ title: 'Mobile money A', role: 'relevé de' }),
    ]);
  });
});
