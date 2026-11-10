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

  it('saves a repetition said in her words, and marks one occurrence done (spec 036)', async () => {
    const saved = await claude.call<{
      entries: { id: string }[];
      understood: { field: string; date: string }[];
    }>('save', {
      entries: [{ kind: 'Event', title: 'Sport', data: { repeat: 'tous les jours à 7h' } }],
    });
    expect(saved.value.understood).toContainEqual(
      expect.objectContaining({ field: 'repeat', date: '0 7 * * *' }),
    );
    const id = saved.value.entries[0]!.id;
    const done = await claude.call('occurrence', { id, day: 'demain', status: 'done' });
    expect(done.isError).toBe(false);
    const agenda = await claude.call<{ id: string; status: string | null; day: string }[]>(
      'agenda',
      { from: 'demain', to: 'demain' },
    );
    expect(agenda.value.find((one) => one.id === id)?.status).toBe('done');
  });
});

describe('her review through Claude (spec 043)', () => {
  it('prepares the mirror, then keeps her decisions as tasks', async () => {
    const ama = await signUp('Ama');
    const claude = await connect(ama);
    const mirror = await claude.call<{ questions: string[] }>('review', {});
    expect(mirror.isError).toBe(false);
    expect(mirror.value.questions.length).toBeGreaterThan(0);
    const kept = await claude.call<{ entries: { id: string }[] }>('review', {
      action: 'keep',
      answers: [{ question: 'Qu’est-ce qui a coincé ?', answer: 'Le sommeil.' }],
      decisions: [{ text: 'Me coucher à 23h', due: 'demain' }],
    });
    expect(kept.isError).toBe(false);
    expect(kept.value.entries).toHaveLength(2);
  });
});

describe('what it changes, through Claude (spec 044)', () => {
  it('says what a new time collides with, and proposes to replan an absence', async () => {
    const ama = await signUp('Ama');
    const claude = await connect(ama);
    await claude.call('save', {
      entries: [
        { kind: 'Event', title: 'Dentiste', data: { start: '2027-03-10T10:00', duration: 60 } },
      ],
    });
    const saved = await claude.call<{ changes: { conflicts: { title: string }[] }[] }>('save', {
      entries: [
        { kind: 'Event', title: 'Coiffeur', data: { start: '2027-03-10T10:30', duration: 60 } },
      ],
    });
    expect(saved.value.changes[0]!.conflicts.map((one) => one.title)).toEqual(['Dentiste']);
    const proposed = await claude.call<{
      applied: boolean;
      steps: { title: string; does: string }[];
    }>('replan', { from: '2027-03-09', to: '2027-03-12' });
    expect(proposed.value.applied).toBe(false);
    expect(proposed.value.steps.map((one) => one.does)).toEqual(['to_reschedule', 'to_reschedule']);
  });
});

describe('a person’s card through Claude (spec 045)', () => {
  it('finds them by name', async () => {
    const ama = await signUp('Ama');
    const claude = await connect(ama);
    await claude.call('save', { entries: [{ kind: 'Person', title: 'Paul Agbo' }] });
    const card = await claude.call<{ title: string; promises: unknown[] }>('person', {
      person: 'Paul',
    });
    expect(card.isError).toBe(false);
    expect(card.value.title).toBe('Paul Agbo');
    const none = await claude.call<{ error: string }>('person', { person: 'Zoé' });
    expect(none.value.error).toContain('No person');
  });
});

describe('a proposal across her apps, through Claude (spec 046)', () => {
  it('proposes, lists what waits, and makes it on her yes', async () => {
    const ama = await signUp('Ama');
    const claude = await connect(ama);
    const made = await claude.call<{ entries: { id: string }[] }>('propose', {
      title: 'Frigo acheté',
      apps: ['Finances'],
      entries: [{ kind: 'Transaction', title: 'Frigo', data: { amount: 250000 } }],
    });
    expect(made.isError).toBe(false);
    const waits = await claude.call<{ type: string }[]>('to_sort', {});
    expect(waits.value.map((one) => one.type)).toContain('proposal');
    const yes = await claude.call('decide', { id: made.value.entries[0]!.id, yes: true });
    expect(yes.isError).toBe(false);
  });
});

describe('a structured routine through Claude (spec 047)', () => {
  it('proposes the five parts of a routine kept as text, then prepares it by its phrase', async () => {
    const ama = await signUp('Ama');
    const claude = await connect(ama);
    const saved = await claude.call<{ entries: { id: string }[] }>('save', {
      entries: [
        {
          kind: 'Routine',
          title: 'Bilan',
          data: { instruction: 'Chaque soir à 21h, fais mon bilan. Regarde mon agenda. /bilan' },
        },
      ],
    });
    const asText = await claude.call<{ structured: boolean; structure: { prepare: string[] } }>(
      'routine',
      { name: 'Bilan' },
    );
    expect(asText.value.structured).toBe(false);
    expect(asText.value.structure.prepare).toEqual(['agenda_today', 'mirror_day']);
    const proposal = await claude.call<{ entries: { id: string }[] }>('structure_routine', {
      id: saved.value.entries[0]!.id,
    });
    await claude.call('decide', { id: proposal.value.entries[0]!.id, yes: true });
    const follow = await claude.call<{ structured: boolean; prepared: Record<string, unknown> }>(
      'routine',
      { name: '/bilan' },
    );
    expect(follow.value.structured).toBe(true);
    expect(Object.keys(follow.value.prepared)).toEqual(['agenda_today', 'mirror_day']);
  });
});

describe('one occurrence from her agenda (spec 036, I2)', () => {
  it('marks a day done, then puts it back', async () => {
    const ama = await signUp('Ama');
    const saved = await ama.json<{ entries: { id: string }[] }>('/api/save', {
      entries: [{ kind: 'Event', title: 'Sport', data: { repeat: '0 7 * * *' } }],
    });
    const id = saved.body.entries[0]!.id;
    const done = await ama.json(`/api/entries/${id}/occurrences/2027-01-04`, { status: 'done' });
    expect(done.status).toBe(200);
    const entry = await ama.json<{ data: { occurrences: unknown } }>(`/api/entries/${id}`);
    expect(entry.body.data.occurrences).toEqual({ '2027-01-04': { status: 'done' } });
    await ama.json(`/api/entries/${id}/occurrences/2027-01-04`, { status: null });
    const back = await ama.json<{ data: { occurrences: unknown } }>(`/api/entries/${id}`);
    expect(back.body.data.occurrences).toEqual({});
    const wrong = await ama.json<{ error: string }>(`/api/entries/${id}/occurrences/demain`, {
      status: 'done',
    });
    expect(wrong.status).toBe(400);
  });
});
