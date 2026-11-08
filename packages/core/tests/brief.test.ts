import { beforeAll, describe, expect, it } from 'vitest';
import {
  briefDue,
  briefOnce,
  briefPeople,
  find,
  localOf,
  save,
  setPreferences,
  type Brief,
} from '../src';
import { db, person, type Person } from './people';

// Spec 018: the morning brief — at her hour, once a day, never at night when it was missed.
describe('the hour of the brief', () => {
  it('is due past her hour, once a day, not three hours late', () => {
    const zone = 'Africa/Abidjan';
    const at = (iso: string) => new Date(iso);
    expect(localOf(at('2026-10-31T07:05:00Z'), zone)).toEqual({ day: '2026-10-31', time: '07:05' });
    expect(briefDue('07:00', null, at('2026-10-31T06:59:00Z'), zone)).toBe(false);
    expect(briefDue('07:00', null, at('2026-10-31T07:00:00Z'), zone)).toBe(true);
    expect(briefDue('07:00', '2026-10-30', at('2026-10-31T09:30:00Z'), zone)).toBe(true);
    expect(briefDue('07:00', '2026-10-31', at('2026-10-31T07:30:00Z'), zone)).toBe(false);
    expect(briefDue('07:00', null, at('2026-10-31T10:30:00Z'), zone)).toBe(false);
    // On her clock, not the server's: 07:00 in Paris is 06:00 UTC in winter.
    expect(briefDue('07:00', null, at('2026-11-02T06:01:00Z'), 'Europe/Paris')).toBe(true);
  });
});

describe('a brief told', () => {
  let ama: Person;
  const told: Brief[] = [];
  const tell = async (brief: Brief) => {
    told.push(brief);
    return true;
  };
  const morning = new Date('2026-10-31T07:10:00Z');

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Channel',
            title: 'Jarvis',
            data: { telegram: '42', timezone: 'Africa/Abidjan' },
          },
          { kind: 'Habitude', title: 'Prière', data: { days: '7/7', since: '2026-10-20' } },
          { kind: 'Prière', title: 'Prière du 30', data: { date: '2026-10-30' } },
          { kind: 'Event', title: 'Marché', data: { start: '2026-10-31T10:00' } },
        ],
      }),
    );
  });

  it('waits for her hour, then tells her day once', async () => {
    expect(await briefPeople(db)).not.toContain(ama.id);
    expect(await briefOnce(db, ama.id, morning, tell)).toBeNull();

    await ama.as((tx) => setPreferences(tx, ama.actor, { brief: '07:00' }));
    expect(await briefPeople(db)).toContain(ama.id);
    expect(await briefOnce(db, ama.id, morning, tell)).toBe(true);
    expect(told).toHaveLength(1);
    expect(told[0]).toEqual(
      expect.objectContaining({
        day: '2026-10-31',
        habits: [expect.objectContaining({ title: 'Prière', today: 'todo' })],
      }),
    );
    expect(told[0]!.agenda.map((one) => one.title)).toContain('Marché');

    // Once a day: the next pass says nothing; it is marked in her « Channel ».
    expect(await briefOnce(db, ama.id, new Date('2026-10-31T07:11:00Z'), tell)).toBeNull();
    const [channel] = await ama.as((tx) => find(tx, ama.space, { kind: 'Channel', limit: 1 }));
    expect(channel!.data.brief_sent).toBe('2026-10-31');
  });
});
