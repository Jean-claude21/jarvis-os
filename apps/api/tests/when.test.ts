import { beforeAll, describe, expect, it } from 'vitest';
import { momentsOf, whenOf } from '../src/when';
import { signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 030: dates in her words, read by Jarvis on her clock — whatever the clock of the server.
// Tuesday 10 November 2026, 08:00 UTC: 08:00 in Lomé, 09:00 in Paris.
const now = new Date('2026-11-10T08:00:00Z');

describe('dates in her words', () => {
  it('reads a day and an hour on her clock', () => {
    expect(whenOf('demain 9h', 'Africa/Lome', now)).toEqual({
      value: '2026-11-11T09:00',
      allDay: false,
    });
    expect(whenOf('vendredi prochain à 14h30', 'Africa/Lome', now)?.value).toMatch(
      /^2026-11-(13|20)T14:30$/,
    );
    expect(whenOf('ce soir 20h', 'Europe/Paris', now)).toEqual({
      value: '2026-11-10T20:00',
      allDay: false,
    });
    expect(whenOf('le 3 janvier à 10h', 'Africa/Lome', now)?.value).toBe('2027-01-03T10:00');
  });

  it('gives a day when no hour was said', () => {
    expect(whenOf('15 décembre', 'Africa/Lome', now)).toEqual({
      value: '2026-12-15',
      allDay: true,
    });
    expect(whenOf('dans 2 semaines', 'Africa/Lome', now)?.value).toBe('2026-11-24');
  });

  it('keeps a written date, and words that say no date', () => {
    expect(whenOf('2026-11-12T09:00', 'Africa/Lome', now)).toBeNull();
    expect(whenOf('2026-11-12', 'Africa/Lome', now)).toBeNull();
    expect(whenOf('passeport', 'Africa/Lome', now)).toBeNull();
  });

  it('turns the moments of entries, and says what it understood', () => {
    const { entries, understood } = momentsOf(
      [{ title: 'Dentiste', data: { at: 'demain 9h', lieu: 'Lomé' } }, { title: 'Note' }],
      'Africa/Lome',
      now,
    );
    expect(entries[0]!.data).toEqual({ at: '2026-11-11T09:00', lieu: 'Lomé' });
    expect(understood).toEqual([
      { entry: 'Dentiste', field: 'at', said: 'demain 9h', date: '2026-11-11T09:00' },
    ]);
  });
});

describe('through Claude', () => {
  let ama: Account;
  let claude: Connected;

  beforeAll(async () => {
    ama = await signUp('Ama');
    claude = await connect(ama);
  });

  it('saves « demain 9h » as a date, and says so', async () => {
    const saved = await claude.call<{
      entries: { id: string }[];
      understood: { said: string; date: string }[];
    }>('save', {
      entries: [{ kind: 'Reminder', title: 'Appeler le notaire', data: { at: 'demain 9h' } }],
    });
    expect(saved.isError).toBe(false);
    expect(saved.value.understood[0]!.said).toBe('demain 9h');
    expect(saved.value.understood[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}T09:00$/);
    const entry = await ama.json<{ data: { at: string } }>(
      `/api/entries/${saved.value.entries[0]!.id}`,
    );
    expect(entry.body.data.at).toBe(saved.value.understood[0]!.date);
  });

  it('reads an agenda asked in her words', async () => {
    const agenda = await claude.call<unknown[]>('agenda', {
      from: 'aujourd’hui',
      to: 'dans 3 jours',
    });
    expect(agenda.isError).toBe(false);
  });
});
