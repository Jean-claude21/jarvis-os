import { beforeAll, describe, expect, it } from 'vitest';
import { find, impactOf, replan, save, setZone, windowOf } from '../src';
import { person, type Person } from './people';

// Spec 044: what a change collides with and threatens, and an absence replanned at once.
describe('what it changes', () => {
  let ama: Person;
  const zone = 'Africa/Lome'; // UTC all year: hours read as written.

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) => setZone(tx, ama.actor, zone));
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { ref: 'k', kind: 'Person', title: 'Kofi' },
          {
            ref: 'm',
            kind: 'Event',
            title: 'Réunion projet',
            data: { start: '2027-02-15T10:00', end: '2027-02-15T11:00', remind: '15 min' },
          },
          { kind: 'Event', title: 'Sport', data: { repeat: '0 7 * * *', duration: 60 } },
          { kind: 'Task', title: 'Rapport', data: { due: '2027-02-16T17:00', status: 'open' } },
          {
            kind: 'Reminder',
            title: 'Payer le loyer',
            data: { at: '2027-02-17T09:00', status: 'planned' },
          },
        ],
        links: [{ from: 'm', to: 'k', role: 'with' }],
      }),
    );
  });

  it('finds what a new time collides with, who is concerned and the free slots', async () => {
    const at = windowOf({ start: '2027-02-15T10:30', duration: 60 }, zone)!;
    const impact = await ama.as((tx) => impactOf(tx, [ama.space], at));
    expect(impact.conflicts.map((one) => one.title)).toEqual(['Réunion projet']);
    expect(impact.people.map((one) => one.title)).toEqual(['Kofi']);
    expect(impact.deadlines.map((one) => one.title)).toEqual(['Rapport']);
    expect(impact.free[0]).toEqual({
      start: '2027-02-15T08:00:00.000Z',
      end: '2027-02-15T10:00:00.000Z',
    });
  });

  it('replans an absence: proposed first, applied in one step', async () => {
    const window = { from: new Date('2027-02-15T00:00:00Z'), to: new Date('2027-02-18T00:00:00Z') };
    const proposed = await ama.as((tx) => replan(tx, ama.actor, ama.space, window));
    expect(proposed.applied).toBe(false);
    expect(proposed.steps.map((one) => [one.title, one.does]).sort()).toEqual(
      [
        ['Payer le loyer', 'remind_after'],
        ['Rapport', 'due_before'],
        ['Réunion projet', 'to_reschedule'],
        ['Sport', 'skip'],
        ['Sport', 'skip'],
        ['Sport', 'skip'],
      ].sort(),
    );
    await ama.as((tx) => replan(tx, ama.actor, ama.space, window, false));
    const title = async (kind: string, title: string) =>
      (await ama.as((tx) => find(tx, ama.space, { kind, text: title })))[0]!.data;
    expect(await title('Task', 'Rapport')).toMatchObject({ due: '2027-02-14' });
    expect(await title('Reminder', 'loyer')).toMatchObject({ at: '2027-02-18T09:00' });
    expect(Object.keys((await title('Event', 'Sport')).occurrences as object).sort()).toEqual([
      '2027-02-15',
      '2027-02-16',
      '2027-02-17',
    ]);
  });
});
