import { beforeAll, describe, expect, it } from 'vitest';
import { find, nextTime, save, timeOf, watchOnce, type Due } from '../src';
import { db, person, type Person } from './people';

// Spec 006: the watcher tells her on time — once, or again and again — on her clock.
describe('time on her clock', () => {
  const at = (iso: string) => new Date(iso);

  it('reads a time she wrote, in her zone, with or without an hour', () => {
    expect(timeOf('2026-11-03T09:00')?.toISOString()).toBe('2026-11-03T08:00:00.000Z');
    expect(timeOf('2026-07-03T09:00')?.toISOString()).toBe('2026-07-03T07:00:00.000Z');
    expect(timeOf('2026-11-03')?.toISOString()).toBe('2026-11-03T08:00:00.000Z');
    expect(timeOf('2026-11-03T09:00Z')?.toISOString()).toBe('2026-11-03T09:00:00.000Z');
    expect(timeOf('2026-11-03T09:00', 'Africa/Abidjan')?.toISOString()).toBe(
      '2026-11-03T09:00:00.000Z',
    );
    expect(timeOf('demain')).toBeNull();
  });

  it('finds the next time of a repetition: every day but Saturday, Mondays, the last day', () => {
    // Friday 30 October 2026, 21:00 in Paris: the next 20:45 but Saturday is Sunday's.
    expect(nextTime('45 20 * * 0-5', at('2026-10-30T20:00:00Z')).toISOString()).toBe(
      '2026-11-01T19:45:00.000Z',
    );
    expect(nextTime('15 7 * * 1', at('2026-10-29T12:00:00Z')).toISOString()).toBe(
      '2026-11-02T06:15:00.000Z',
    );
    expect(nextTime('30 19 L * *', at('2026-10-01T00:00:00Z')).toISOString()).toBe(
      '2026-10-31T18:30:00.000Z',
    );
    // Around the change of hour (25 October 2026), the clock still says 07:30.
    expect(nextTime('30 7 * * *', at('2026-10-24T12:00:00Z')).toISOString()).toBe(
      '2026-10-25T06:30:00.000Z',
    );
    expect(() => nextTime('chaque soir', new Date())).toThrow(/five fields/);
  });
});

describe('a pass of the watcher', () => {
  let ama: Person;
  const told: Due[] = [];
  const tell = async (due: Due) => {
    told.push(due);
    return true;
  };

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Reminder',
            title: 'Renouveler le passeport',
            data: { at: '2026-11-03T09:00', status: 'planned' },
          },
          {
            kind: 'Reminder',
            title: 'Dépôt du jour',
            data: { repeat: '45 20 * * 0-5', message: 'Va devant Dieu, puis #soir.' },
          },
          { kind: 'Reminder', title: 'Plus tard', data: { at: '2026-12-25T09:00' } },
          { kind: 'Reminder', title: 'Mal écrit', data: { repeat: 'chaque soir' } },
        ],
      }),
    );
  });

  const reminders = async () =>
    Object.fromEntries(
      (await ama.as((tx) => find(tx, ama.space, { kind: 'Reminder' }))).map((one) => [
        one.title,
        one.data,
      ]),
    );
  const mine = () => told.filter((due) => due.person === ama.id).map((due) => due.title);

  it('schedules a repetition first, tells nothing before its time', async () => {
    await watchOnce(db, new Date('2026-11-01T12:00:00Z'), tell);
    expect(mine()).toEqual([]);
    const now = await reminders();
    expect(now['Dépôt du jour']).toMatchObject({ next: '2026-11-01T19:45:00.000Z' });
    expect(now['Mal écrit']).toMatchObject({ status: 'to_fix' });
  });

  it('tells what is due, once; a repetition moves to its next time', async () => {
    await watchOnce(db, new Date('2026-11-03T08:01:00Z'), tell);
    expect(mine()).toEqual(['Renouveler le passeport']);
    // The Sunday 20:45 was missed while nothing ran: skipped to its next time, not sent late.
    const now = await reminders();
    expect(now['Renouveler le passeport']).toMatchObject({ status: 'sent' });
    expect(now['Dépôt du jour']).toMatchObject({ next: '2026-11-03T19:45:00.000Z' });

    await watchOnce(db, new Date('2026-11-03T19:46:00Z'), tell);
    expect(mine()).toEqual(['Renouveler le passeport', 'Dépôt du jour']);
    expect(told.at(-1)).toMatchObject({ message: 'Va devant Dieu, puis #soir.', repeated: true });
    expect((await reminders())['Dépôt du jour']).toMatchObject({
      next: '2026-11-04T19:45:00.000Z',
      last_sent: '2026-11-03T19:46:00.000Z',
    });
    await watchOnce(db, new Date('2026-11-03T19:47:00Z'), tell);
    expect(mine()).toHaveLength(2);
  });
});
