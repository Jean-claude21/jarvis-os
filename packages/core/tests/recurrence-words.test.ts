import { describe, expect, it } from 'vitest';
import { anchorOf, occurrencesOf, repetitionFromWords } from '../src';

// Spec 075: « chaque semaine » takes the event's own day and hour; a day said without an hour keeps
// the event's hour; a repeated span keeps its end; a repetition not understood still shows once.
const zone = 'Africa/Lome'; // UTC all year.
const row = (data: Record<string, unknown>) => ({
  id: 'ent_x',
  kind: 'Event',
  title: 'X',
  data,
  space: 'Ama',
  space_id: 'spc_x',
});
const week = (data: Record<string, unknown>) =>
  occurrencesOf(
    row(data),
    new Date('2026-11-16T00:00Z'),
    new Date('2026-11-30T00:00Z'),
    new Date('2026-11-16T00:00Z'),
    zone,
  );

describe('repetitions in her words', () => {
  const wednesday18 = anchorOf(new Date('2026-11-18T18:00Z'), zone);

  it('reads the weekday and hour of a start', () => {
    expect(wednesday18).toEqual({ hour: 18, minute: 0, weekday: 3 });
  });

  it('understands « chaque semaine » on the start’s day and hour', () => {
    for (const said of ['chaque semaine', 'toutes les semaines', 'hebdomadaire', 'every week'])
      expect(repetitionFromWords(said, wednesday18)).toBe('0 18 * * 3');
    expect(repetitionFromWords('chaque semaine')).toBeNull();
  });

  it('keeps the event’s hour when none is said', () => {
    expect(repetitionFromWords('tous les mercredis', wednesday18)).toBe('0 18 * * 3');
    expect(repetitionFromWords('tous les mercredis à 7h', wednesday18)).toBe('0 7 * * 3');
    expect(repetitionFromWords('tous les mercredis')).toBe('0 9 * * 3');
  });

  it('shows words kept as they were said, with the end of the span', () => {
    const sport = week({
      start: '2026-11-18T18:00',
      end: '2026-11-18T19:30',
      repeat: 'toutes les semaines',
    });
    expect(sport.map((one) => [one.start.slice(0, 16), one.end?.slice(0, 16)])).toEqual([
      ['2026-11-18T18:00', '2026-11-18T19:30'],
      ['2026-11-25T18:00', '2026-11-25T19:30'],
    ]);
  });

  it('still shows once a repetition it cannot read', () => {
    const odd = week({ start: '2026-11-17T14:00', repeat: 'quand il pleut' });
    expect(odd.map((one) => one.start.slice(0, 16))).toEqual(['2026-11-17T14:00']);
  });
});
