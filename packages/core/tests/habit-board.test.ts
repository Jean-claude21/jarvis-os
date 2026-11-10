import { beforeAll, describe, expect, it } from 'vitest';
import { habitBoard, save } from '../src';
import { cronWeekdays, planOf } from '../src/habits';
import { person, type Person } from './people';

// The Routines page: her habits today, their streaks, the last days.
describe('her habits board', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('reads the days of a five-field cadence, only for a habit', () => {
    expect(cronWeekdays('0 6 * * 1-5')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
    expect(cronWeekdays('30 18 * * 0,6')).toEqual(['sat', 'sun']);
    expect(cronWeekdays('0 9 1 * *')).toBeNull();
    expect(planOf({ repeat: '0 6 * * *' }, 'Habit')!.days).toHaveLength(7);
    expect(planOf({ repeat: '0 6 * * *' }, 'Event')).toBeNull();
  });

  it('shows today, the streak and the day-by-day line of each habit', async () => {
    const today = '2026-11-10';
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            ref: 'h',
            kind: 'Habit',
            title: 'Prière du matin',
            data: { repeat: '30 4 * * *', non_negotiable: true },
          },
          { ref: 'a', kind: 'CheckIn', title: 'Prière', data: { date: '2026-11-08' } },
          { ref: 'b', kind: 'CheckIn', title: 'Prière', data: { date: '2026-11-09' } },
          { ref: 'c', kind: 'CheckIn', title: 'Prière', data: { date: '2026-11-10' } },
        ],
        links: [
          { from: 'a', to: 'h', role: 'habit' },
          { from: 'b', to: 'h', role: 'habit' },
          { from: 'c', to: 'h', role: 'habit' },
        ],
      }),
    );
    const board = await ama.as((tx) => habitBoard(tx, [ama.space], today, 7));
    const prayer = board.habits.find((one) => one.title === 'Prière du matin')!;
    expect(prayer).toMatchObject({ time: '04:30', nonNegotiable: true, today: 'done', streak: 3 });
    expect(prayer.line).toEqual(['miss', 'miss', 'miss', 'miss', 'done', 'done', 'done']);
    expect(board.daily.at(-1)!.rate).toBeGreaterThan(0);
  });
});
