import { beforeAll, describe, expect, it } from 'vitest';
import { capture, personCard, save } from '../src';
import { person, type Person } from './people';

// Spec 045: a person's card across her apps.
describe('a person’s card', () => {
  let ama: Person;
  let paul: string;

  beforeAll(async () => {
    ama = await person('Ama');
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { ref: 'p', kind: 'Person', title: 'Paul' },
          { ref: 'c', kind: 'Call', title: 'Appel', data: { date: '2026-11-02' } },
          {
            ref: 'l',
            kind: 'Transaction',
            title: 'Prêt',
            data: { amount: 10000, date: '2026-10-20' },
          },
          {
            ref: 'e',
            kind: 'Event',
            title: 'Déjeuner avec Paul',
            data: { start: '2026-11-20T12:30' },
          },
          {
            kind: 'Task',
            title: 'Rendre le livre à Paul',
            data: { status: 'open', due: '2026-11-15' },
          },
        ],
        links: [
          { from: 'c', to: 'p', role: 'with' },
          { from: 'l', to: 'p', role: 'to' },
        ],
      }),
    );
    paul = saved.entries[0]!.id;
    await ama.as((tx) =>
      capture(tx, ama.actor, ama.space, { text: 'Je vais présenter Paul à Kofi', source: 'app' }),
    );
  });

  it('says the last time, the promises, the next time and what touches them', async () => {
    const card = await ama.as((tx) =>
      personCard(tx, ama.space, paul, new Date('2026-11-10T09:00:00Z')),
    );
    expect(card.last).toMatchObject({ title: 'Appel', on: '2026-11-02' });
    expect(card.promises.map((one) => one.title).sort()).toEqual([
      'Présenter Paul à Kofi',
      'Rendre le livre à Paul',
    ]);
    expect(card.next).toMatchObject({ title: 'Rendre le livre à Paul', on: '2026-11-15' });
    expect(card.around.map((one) => one.kind)).toEqual(
      expect.arrayContaining(['Call', 'Transaction', 'Event', 'Task', 'Intention']),
    );
  });
});
