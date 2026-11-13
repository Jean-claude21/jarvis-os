import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  activities,
  closeExecution,
  failOverdueWork,
  find,
  get,
  groupOf,
  keyScope,
  receive,
  save,
  setCallOut,
  countOnExecution,
  type CallRequest,
} from '../src';
import { db, person, type Person } from './people';

// Spec 057: what she has to do, in one place; what programs do for her, traced — long work
// answering later with a token bound to its execution, closed by the watcher when it is silent.
describe('activities and executions', () => {
  let ama: Person;
  const now = new Date('2026-11-13T10:00:00Z');

  beforeAll(async () => {
    ama = await person('Ama');
  });
  afterEach(() => setCallOut(null));

  it('places an activity by its status and due', () => {
    const zone = 'Europe/Paris';
    expect(groupOf('planned', '2026-11-12', '2026-11-13', zone)).toBe('late');
    expect(groupOf('planned', '2026-11-13T16:00:00Z', '2026-11-13', zone)).toBe('today');
    expect(groupOf('planned', '2026-11-18', '2026-11-13', zone)).toBe('week');
    expect(groupOf('planned', '2026-12-30', '2026-11-13', zone)).toBe('later');
    expect(groupOf('planned', null, '2026-11-13', zone)).toBe('undated');
    expect(groupOf('proposed', '2026-11-12', '2026-11-13', zone)).toBe('review');
    expect(groupOf('failed', null, '2026-11-13', zone)).toBe('failed');
    expect(groupOf('done', '2026-11-12', '2026-11-13', zone)).toBe('done');
  });

  it('lists tasks and kinds her model makes activities, with what they concern', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Model',
            title: 'Relance',
            data: {
              activity: true,
              fields: [
                { name: 'due', type: 'date' },
                { name: 'status', type: 'text' },
              ],
            },
          },
          { kind: 'Offre', title: 'Stage IA — Exemple' },
          { kind: 'Task', title: 'Appeler l’école', data: { due: '2026-11-12' } },
          { kind: 'Relance', title: 'Relancer Exemple', data: { due: '2026-11-18' } },
          { kind: 'Task', title: 'Déjà fait', data: { due: '2026-11-10', status: 'done' } },
          { kind: 'Task', title: 'À valider', data: { status: 'proposed' } },
          { kind: 'Note', title: 'Pas une activité', data: { due: '2026-11-12' } },
        ],
      }),
    );
    const id = (title: string) => saved.entries.find((one) => one.title === title)!.id;
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        links: [{ from: id('Relancer Exemple'), to: id('Stage IA — Exemple'), role: 'about' }],
      }),
    );
    const open = await ama.as((tx) => activities(tx, [ama.space], {}, now));
    const titles = open.map((one) => one.title);
    expect(titles).toEqual(
      expect.arrayContaining(['Appeler l’école', 'Relancer Exemple', 'À valider']),
    );
    expect(titles).not.toContain('Déjà fait');
    expect(titles).not.toContain('Pas une activité');
    expect(titles.indexOf('À valider')).toBeLessThan(titles.indexOf('Appeler l’école'));
    const relance = open.find((one) => one.title === 'Relancer Exemple')!;
    expect(relance).toMatchObject({ group: 'week', status: 'planned' });
    expect(relance.about).toEqual([
      expect.objectContaining({ id: id('Stage IA — Exemple'), kind: 'Offre' }),
    ]);
    const about = await ama.as((tx) =>
      activities(tx, [ama.space], { about: id('Stage IA — Exemple') }, now),
    );
    expect(about.map((one) => one.title)).toEqual(['Relancer Exemple']);
    const done = await ama.as((tx) => activities(tx, [ama.space], { state: 'done' }, now));
    expect(done.map((one) => one.title)).toContain('Déjà fait');
  });

  it('traces a call that answers at once, and one that fails', async () => {
    setCallOut(async () => ({ offers: [{ title: 'Stage data', url: 'https://ex.com/x' }] }));
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Rule',
            title: 'Collecte',
            data: {
              when: { saved: 'Collecte' },
              then: [
                {
                  call: {
                    connection: 'Collecteur',
                    path: '/search',
                    save: { kind: 'Offre', at: 'offers', match: 'url' },
                  },
                },
              ],
            },
          },
          { kind: 'Collecte', title: 'Lundi' },
        ],
      }),
    );
    const [execution] = await ama.as((tx) =>
      find(tx, ama.space, { kind: 'Execution', text: 'Collecteur', limit: 5 }),
    );
    expect(execution!.data).toMatchObject({
      service: 'Collecteur',
      status: 'done',
      counts: { created: 1 },
    });
    const [offer] = await ama.as((tx) =>
      find(tx, ama.space, { kind: 'Offre', text: 'Stage data' }),
    );
    const full = await ama.as((tx) => get(tx, ama.space, offer!.id));
    expect(full!.links.out).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'made_by' })]),
    );

    setCallOut(async () => {
      throw new Error('it answered 500.');
    });
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, { entries: [{ kind: 'Collecte', title: 'Mardi' }] }),
    );
    const failed = await ama.as((tx) => activities(tx, [ama.space], { state: 'failed' }, now));
    expect(failed.find((one) => one.kind === 'Execution')!.execution!.error).toMatch(/500/);
  });

  it('keeps long work running; its token writes, closes once, then answers nothing', async () => {
    const asked: CallRequest[] = [];
    setCallOut(async (request) => {
      asked.push(request);
      return { accepted: true };
    });
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Rule',
            title: 'Longue collecte',
            data: {
              when: { saved: 'Longue' },
              then: [
                {
                  call: {
                    connection: 'Atelier',
                    path: '/jobs/offres',
                    long: true,
                    minutes: 10,
                    lend: ['treg'],
                    save: { kind: 'Offre', match: 'url' },
                  },
                },
              ],
            },
          },
          { kind: 'Longue', title: 'Matin' },
        ],
      }),
    );
    const work = asked[0]!.body.jarvis as { execution: string; token: string; until: string };
    expect(work.token).toMatch(/^jos_/);
    const scope = await keyScope(db, work.token);
    expect(scope).toMatchObject({
      person: ama.id,
      spaceId: ama.space,
      executionId: work.execution,
    });
    expect(scope!.kinds).toEqual(expect.arrayContaining(['Execution', 'Offre']));
    const running = await ama.as((tx) => get(tx, ama.space, work.execution));
    expect(running!.data).toMatchObject({ status: 'running', long: true, lend: ['treg'] });

    // The service answers with its token: what it writes is counted on its execution.
    const agent = { person: ama.id, door: 'api', client: 'key:work', kinds: scope!.kinds! };
    await ama.as(async (tx) => {
      const got = await receive(tx, agent, ama.space, {
        kind: 'Offre',
        items: [{ title: 'Stage NLP', url: 'https://ex.com/nlp' }],
        match: 'url',
      });
      await countOnExecution(tx, agent, ama.space, work.execution, got);
      await closeExecution(tx, agent, ama.space, work.execution, { status: 'done', log: 'ok' });
    });
    const closed = await ama.as((tx) => get(tx, ama.space, work.execution));
    expect(closed!.data).toMatchObject({ status: 'done', counts: { created: 1 }, log: 'ok' });
    expect(await keyScope(db, work.token)).toBeNull();
    await expect(
      ama.as((tx) => closeExecution(tx, agent, ama.space, work.execution, { status: 'failed' })),
    ).rejects.toThrow(/already done/);
  });

  it('fails long work that stayed silent past its time', async () => {
    setCallOut(async () => ({ accepted: true }));
    let token = '';
    let execution = '';
    setCallOut(async (request) => {
      ({ token, execution } = request.body.jarvis as { token: string; execution: string });
      return { accepted: true };
    });
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Rule',
            title: 'Muette',
            data: {
              when: { saved: 'Muette' },
              then: [{ call: { connection: 'Silencieux', path: '/jobs', long: true, minutes: 1 } }],
            },
          },
          { kind: 'Muette', title: 'Une fois' },
        ],
      }),
    );
    expect(token).toMatch(/^jos_/);
    const failed = await failOverdueWork(db, new Date(Date.now() + 5 * 60_000));
    expect(failed).toBeGreaterThanOrEqual(1);
    const after = await ama.as((tx) => get(tx, ama.space, execution));
    expect(after!.data).toMatchObject({ status: 'failed', error: 'No answer in time.' });
    const reminders = await ama.as((tx) => find(tx, ama.space, { kind: 'Reminder', limit: 50 }));
    expect(reminders.some((one) => /Silencieux.*No answer/.test(one.title))).toBe(true);
  });

  it('shows, in the whole stream, what happens to her beside what she does (spec 058)', async () => {
    const bea = await person('Bea');
    await bea.as((tx) =>
      save(tx, bea.actor, bea.space, {
        entries: [
          { kind: 'Task', title: 'Préparer le point', data: { due: '2026-11-13' } },
          {
            kind: 'Réunion',
            title: 'Point projet',
            data: { start: '2026-11-13T14:00:00Z', end: '2026-11-13T15:00:00Z' },
          },
          { kind: 'Event', title: 'Dîner passé', data: { start: '2026-11-01T19:00:00Z' } },
          { kind: 'Reminder', title: 'Passeport J-90', data: { at: '2026-12-14T08:00:00Z' } },
        ],
      }),
    );
    const todo = await bea.as((tx) => activities(tx, [bea.space], {}, now));
    expect(todo.map((one) => one.title)).toEqual(['Préparer le point']);
    const stream = await bea.as((tx) =>
      activities(tx, [bea.space], { scope: 'all', state: 'all' }, now),
    );
    expect(stream.map((one) => one.title)).toEqual([
      'Dîner passé',
      'Préparer le point',
      'Point projet',
      'Passeport J-90',
    ]);
    expect(stream.find((one) => one.title === 'Dîner passé')).toMatchObject({
      status: 'done',
      todo: false,
    });
    expect(stream.find((one) => one.title === 'Préparer le point')!.todo).toBe(true);
    const today = await bea.as((tx) =>
      activities(tx, [bea.space], { scope: 'all', state: 'all', period: 'today' }, now),
    );
    expect(today.map((one) => one.title)).toEqual(['Préparer le point', 'Point projet']);
  });
});
