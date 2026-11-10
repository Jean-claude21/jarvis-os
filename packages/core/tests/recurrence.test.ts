import { beforeAll, describe, expect, it } from 'vitest';
import { find, occurrencesOf, repetitionFromWords, save, setOccurrence } from '../src';
import { person, type Person } from './people';

// Spec 036: a repetition says « the 2nd Monday », ends on a date or after so many times, skips
// days, and each occurrence has its own state — done, missed, postponed to another time, cancelled.
const row = (data: Record<string, unknown>) => ({
  id: 'ent_x',
  kind: 'Event',
  title: 'X',
  data,
  space: 'Ama',
  space_id: 'spc_x',
});
const zone = 'Africa/Lome'; // UTC, all year: the hours read as they are written.
const days = (data: Record<string, unknown>, from: string, to: string) =>
  occurrencesOf(row(data), new Date(from), new Date(to), new Date(from), zone).map((one) =>
    one.start.slice(0, 16),
  );

describe('repetitions', () => {
  it('names the 2nd Monday and the last Friday of each month', () => {
    expect(days({ repeat: '0 18 * * 1#2' }, '2026-11-01', '2027-01-01')).toEqual([
      '2026-11-09T18:00',
      '2026-12-14T18:00',
    ]);
    expect(days({ repeat: '0 17 * * 5#L' }, '2026-11-01', '2027-01-01')).toEqual([
      '2026-11-27T17:00',
      '2026-12-25T17:00',
    ]);
  });

  it('ends after so many times, and never shows before its start', () => {
    expect(
      days({ repeat: '0 7 * * 1', start: '2026-11-09', count: 3 }, '2026-11-01', '2027-01-01'),
    ).toEqual(['2026-11-09T07:00', '2026-11-16T07:00', '2026-11-23T07:00']);
  });

  it('keeps the state of each occurrence, and moves one alone', () => {
    const found = occurrencesOf(
      row({
        repeat: '0 7 * * *',
        occurrences: {
          '2026-11-10': { status: 'done' },
          '2026-11-11': { status: 'missed' },
          '2026-11-12': { status: 'postponed', at: '2026-11-12T19:30' },
          '2026-11-13': { status: 'cancelled' },
        },
      }),
      new Date('2026-11-10'),
      new Date('2026-11-15'),
      new Date('2026-11-10'),
      zone,
    ).map((one) => [one.day, one.start.slice(0, 16), one.status, one.moved ?? false]);
    expect(found).toEqual([
      ['2026-11-10', '2026-11-10T07:00', 'done', false],
      ['2026-11-11', '2026-11-11T07:00', 'missed', false],
      ['2026-11-12', '2026-11-12T19:30', 'postponed', true],
      ['2026-11-14', '2026-11-14T07:00', null, false],
    ]);
  });

  it('understands a repetition in her words', () => {
    expect(repetitionFromWords('tous les jours à 20h45')).toBe('45 20 * * *');
    expect(repetitionFromWords('chaque lundi et jeudi à 7h')).toBe('0 7 * * 1,4');
    expect(repetitionFromWords('le 2e lundi du mois à 18h')).toBe('0 18 * * 1#2');
    expect(repetitionFromWords('le dernier vendredi du mois')).toBe('0 9 * * 5#L');
    expect(repetitionFromWords('tous les mois le 5')).toBe('0 9 5 * *');
    expect(repetitionFromWords('en semaine à 6h30')).toBe('30 6 * * 1-5');
    expect(repetitionFromWords('every Sunday at 10am')).toBe('0 10 * * 0');
    expect(repetitionFromWords('45 20 * * 0-5')).toBeNull();
    expect(repetitionFromWords('Appeler maman')).toBeNull();
  });
});

describe('one occurrence changed', () => {
  let ama: Person;
  let id: string;

  beforeAll(async () => {
    ama = await person('Ama');
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Event', title: 'Sport', data: { repeat: '0 7 * * *' } }],
      }),
    );
    id = saved.entries[0]!.id;
  });

  it('is kept by its day, the others unchanged, and put back', async () => {
    await ama.as((tx) =>
      setOccurrence(tx, ama.actor, ama.space, id, '2026-11-12', { status: 'done' }),
    );
    await ama.as((tx) =>
      setOccurrence(tx, ama.actor, ama.space, id, '2026-11-13', { at: '2026-11-13T18:00' }),
    );
    const sport = async () =>
      (await ama.as((tx) => find(tx, ama.space, { kind: 'Event' })))[0]!.data.occurrences;
    expect(await sport()).toEqual({
      '2026-11-12': { status: 'done' },
      '2026-11-13': { status: 'postponed', at: '2026-11-13T18:00' },
    });
    await ama.as((tx) => setOccurrence(tx, ama.actor, ama.space, id, '2026-11-12', null));
    expect(await sport()).toEqual({
      '2026-11-13': { status: 'postponed', at: '2026-11-13T18:00' },
    });
  });

  it('says so for a day it does not fall on, or an entry that does not repeat', async () => {
    const once = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Event', title: 'Dentiste', data: { start: '2026-11-20T10:00' } }],
      }),
    );
    await expect(
      ama.as((tx) =>
        setOccurrence(tx, ama.actor, ama.space, once.entries[0]!.id, '2026-11-20', {
          status: 'done',
        }),
      ),
    ).rejects.toThrow(/does not repeat/);
    const weekly = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Event', title: 'Cours', data: { repeat: '0 18 * * 1' } }],
      }),
    );
    await expect(
      ama.as((tx) =>
        setOccurrence(tx, ama.actor, ama.space, weekly.entries[0]!.id, '2026-11-12', {
          status: 'done',
        }),
      ),
    ).rejects.toThrow(/no occurrence on 2026-11-12/);
  });
});
