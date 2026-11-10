import { beforeAll, describe, expect, it } from 'vitest';
import {
  defaultsFor,
  find,
  get,
  offsetOf,
  save,
  setPreferences,
  watchOnce,
  type Entry,
} from '../src';
import { db, person, type Person } from './people';

// Spec 037: a reminder attached to a thing, « 1 jour avant », moves with it; a thing that repeats
// gets the reminder of its next occurrence once one is sent; her defaults apply to a new dated thing.
describe('offsets in her words', () => {
  it('reads minutes before', () => {
    expect(offsetOf('1 jour avant')).toBe(1440);
    expect(offsetOf('15 min')).toBe(15);
    expect(offsetOf('2h')).toBe(120);
    expect(offsetOf('la veille')).toBe(1440);
    expect(offsetOf('1 semaine')).toBe(10080);
    expect(offsetOf('bientôt')).toBeNull();
  });

  it('picks her defaults by space and kind, then kind, then all', () => {
    const defaults = { 'Famille/Event': ['1 jour'], Event: ['15 min'], '*': ['1h'] };
    expect(defaultsFor(defaults, 'Famille', 'Event')).toEqual(['1 jour']);
    expect(defaultsFor(defaults, 'Ama', 'event')).toEqual(['15 min']);
    expect(defaultsFor(defaults, 'Ama', 'Task')).toEqual(['1h']);
  });
});

describe('attached to a thing', () => {
  let ama: Person;
  const reminders = async (id: string) => {
    const thing = await ama.as((tx) => get(tx, ama.space, id));
    const out: Entry[] = [];
    for (const link of thing!.links.in.filter((one) => one.role === 'for')) {
      out.push((await ama.as((tx) => get(tx, ama.space, link.entry.id)))!);
    }
    return out
      .filter((one) => one.data.status !== 'cancelled')
      .map((one) => [one.data.before, one.data.at, one.data.status]);
  };

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('keeps one reminder per offset, moved with the thing, gone when she removes it', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Event',
            title: 'Dentiste',
            data: { start: '2027-03-10T10:00', remind: ['1 jour avant', '15 min'] },
          },
        ],
      }),
    );
    const id = saved.entries[0]!.id;
    expect((await reminders(id)).sort()).toEqual([
      ['1 jour avant', '2027-03-09T10:00', 'planned'],
      ['15 min', '2027-03-10T09:45', 'planned'],
    ]);
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ id, data: { start: '2027-03-12T14:00' } }],
      }),
    );
    expect((await reminders(id)).sort()).toEqual([
      ['1 jour avant', '2027-03-11T14:00', 'planned'],
      ['15 min', '2027-03-12T13:45', 'planned'],
    ]);
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, { entries: [{ id, data: { remind: ['15 min'] } }] }),
    );
    expect(await reminders(id)).toEqual([['15 min', '2027-03-12T13:45', 'planned']]);
  });

  it('gives a new dated thing her defaults when it says none', async () => {
    await ama.as((tx) => setPreferences(tx, ama.actor, { reminders: { Task: ['1 jour'] } }));
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Task', title: 'Rendre le dossier', data: { due: '2027-04-02T17:00' } }],
      }),
    );
    expect(await reminders(saved.entries[0]!.id)).toEqual([
      ['1 jour', '2027-04-01T17:00', 'planned'],
    ]);
  });

  it('moves to the next occurrence of a thing that repeats, once sent', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Event',
            title: 'Cours de piano',
            data: { repeat: '0 18 * * 1', start: '2027-01-04', remind: '1h' },
          },
        ],
      }),
    );
    const id = saved.entries[0]!.id;
    expect(await reminders(id)).toEqual([['1h', '2027-01-04T17:00', 'planned']]);
    const [{ id: reminder }] = (await ama.as((tx) =>
      find(tx, ama.space, { kind: 'Reminder', text: 'Cours de piano' }),
    )) as [Entry];
    const told: string[] = [];
    // The watcher's pass at 17:00 on her clock (Paris, UTC+1 in January).
    await watchOnce(db, new Date('2027-01-04T16:00:30Z'), async (due) => {
      if (due.entryId === reminder) told.push(due.title);
      return true;
    });
    expect(told).toEqual(['Cours de piano']);
    expect(await reminders(id)).toEqual([['1h', '2027-01-11T17:00', 'planned']]);
  });
});
