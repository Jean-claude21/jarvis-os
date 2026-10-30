import { beforeAll, describe, expect, it } from 'vitest';
import {
  agenda,
  calendarOwner,
  find,
  minutesOf,
  occurrencesOf,
  renewCalendarKey,
  save,
  upcoming,
} from '../src';
import { db, person, type Person } from './people';

// Spec 011: time is a property of any entry; the calendar is the view of everything dated.
const row = (data: Record<string, unknown>, kind = 'Chose') => ({
  id: 'ent_x',
  kind,
  title: 'X',
  data,
  space: 'Ama',
  space_id: 'spc_x',
});
// The week of Monday 26 October 2026 in Paris (winter time from the 25th: UTC+1).
const from = new Date('2026-10-25T23:00:00Z');
const to = new Date('2026-11-01T23:00:00Z');
const today = new Date('2026-10-30T09:41:00Z');

describe('the occurrences of one entry', () => {
  it('places a span, a moment, a deadline and a day, on her clock', () => {
    expect(
      occurrencesOf(
        row({ start: '2026-10-29T14:00', end: '2026-10-29T15:00' }),
        from,
        to,
        today,
      )[0],
    ).toMatchObject({
      start: '2026-10-29T13:00:00.000Z',
      end: '2026-10-29T14:00:00.000Z',
      type: 'span',
      allDay: false,
    });
    expect(
      occurrencesOf(row({ start: '2026-10-29T14:00', duration: '1h30' }), from, to, today)[0]?.end,
    ).toBe('2026-10-29T14:30:00.000Z');
    expect(occurrencesOf(row({ at: '2026-10-30T09:00' }), from, to, today)[0]).toMatchObject({
      type: 'moment',
      end: null,
    });
    // A day alone is the whole day, from midnight on her clock.
    expect(occurrencesOf(row({ due: '2026-10-31' }), from, to, today)[0]).toMatchObject({
      type: 'deadline',
      allDay: true,
      start: '2026-10-30T23:00:00.000Z',
    });
    expect(occurrencesOf(row({ date: '2026-11-01' }), from, to, today)[0]?.type).toBe('day');
  });

  it('keeps a past day out: her journal is not her calendar', () => {
    expect(occurrencesOf(row({ date: '2026-10-27' }, 'Journal'), from, to, today)).toEqual([]);
  });

  it('repeats in the window, with a duration, without the days off', () => {
    const gym = occurrencesOf(
      row({ repeat: '30 18 * * 2,3', duration: 90, except: ['2026-10-28'] }, 'Habitude'),
      from,
      to,
      today,
    );
    expect(gym.map((one) => one.start)).toEqual(['2026-10-27T17:30:00.000Z']);
    expect(gym[0]).toMatchObject({ end: '2026-10-27T19:00:00.000Z', repeated: true, type: 'span' });
    // Every evening at 20:45 but Saturday: six times this week.
    expect(
      occurrencesOf(row({ repeat: '45 20 * * 0-5' }, 'Reminder'), from, to, today),
    ).toHaveLength(6);
    // A repetition that starts on Thursday.
    expect(
      occurrencesOf(row({ repeat: '0 7 * * *', start: '2026-10-29' }), from, to, today).map((one) =>
        one.start.slice(0, 10),
      ),
    ).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('bounds a repetition, and leaves out what is cancelled or wrong', () => {
    expect(occurrencesOf(row({ repeat: '*/5 * * * *' }), from, to, today)).toHaveLength(200);
    expect(
      occurrencesOf(row({ at: '2026-10-30T09:00', status: 'cancelled' }), from, to, today),
    ).toEqual([]);
    expect(occurrencesOf(row({ repeat: 'chaque soir' }), from, to, today)).toEqual([]);
    expect(occurrencesOf(row({ start: '2026-11-05T10:00' }), from, to, today)).toEqual([]);
  });

  it('marks what Jarvis proposed', () => {
    expect(
      occurrencesOf(row({ start: '2026-10-30T16:00', status: 'proposed' }), from, to, today)[0]
        ?.proposed,
    ).toBe(true);
  });

  it('reads the durations she says', () => {
    expect([
      minutesOf(90),
      minutesOf('45 min'),
      minutesOf('1h30'),
      minutesOf('2h'),
      minutesOf('long'),
    ]).toEqual([90, 45, 90, 120, null]);
  });
});

describe('her calendar', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Événement',
            title: 'Dentiste',
            data: { start: '2026-10-29T14:00', end: '2026-10-29T15:00' },
          },
          {
            kind: 'Obligation',
            title: 'Frais de dossier',
            data: { due: '2026-10-31', montant: 120000 },
          },
          { kind: 'Habitude', title: 'Gym', data: { repeat: '30 18 * * 2,3', duration: 90 } },
          {
            kind: 'Reminder',
            title: 'Déjà envoyé',
            data: { at: '2026-10-30T08:00', status: 'sent' },
          },
          { kind: 'Journal', title: '27 octobre', data: { date: '2026-10-27' } },
          { kind: 'Personne', title: 'Paul', data: { telephone: '…' } },
        ],
      }),
    );
  });

  it('gathers every kind that has a time, sorted', async () => {
    const week = await ama.as((tx) => agenda(tx, [ama.space], { from, to, today }));
    expect(week.map((one) => `${one.kind}:${one.title}`)).toEqual([
      'Habitude:Gym',
      'Habitude:Gym',
      'Événement:Dentiste',
      'Reminder:Déjà envoyé',
      'Obligation:Frais de dossier',
    ]);
    expect(week[0]?.space).toBe('Ama');
  });

  it('refuses a window backwards or longer than a year', async () => {
    await expect(ama.as((tx) => agenda(tx, [ama.space], { from: to, to: from }))).rejects.toThrow(
      /after/,
    );
    await expect(
      ama.as((tx) => agenda(tx, [ama.space], { from, to: new Date('2028-01-01T00:00:00Z') })),
    ).rejects.toThrow(/366/);
  });

  it('gives what comes from today, without what was sent', async () => {
    const soon = await ama.as((tx) => upcoming(tx, [ama.space], 3, today));
    expect(soon.map((one) => [one.title, one.when])).toEqual([['Frais de dossier', '2026-10-31']]);
  });
});

describe('the private address of her calendar', () => {
  it('opens her calendar only, until she renews it; the key itself is never kept', async () => {
    const kofi = await person('Kofi');
    const first = await kofi.as((tx) => renewCalendarKey(tx, kofi.actor, kofi.space));
    expect(await calendarOwner(db, first)).toBe(kofi.id);
    const second = await kofi.as((tx) => renewCalendarKey(tx, kofi.actor, kofi.space));
    expect(await calendarOwner(db, first)).toBeNull();
    expect(await calendarOwner(db, second)).toBe(kofi.id);
    const [canal] = await kofi.as((tx) => find(tx, kofi.space, { kind: 'Channel' }));
    expect(JSON.stringify(canal?.data)).not.toContain(second);
    expect(await calendarOwner(db, 'not-a-key')).toBeNull();
  });
});
