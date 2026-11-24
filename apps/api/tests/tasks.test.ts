import { describe, expect, it } from 'vitest';
import { signUp } from './client';

// Spec 109 through HTTP: an agent made, a skill's task tried then kept, listed with its agent and
// its next times, run now; her text drawn as task lines.
describe('an agent’s tasks', () => {
  it('an agent « Bilans », its weekly bilan tried, kept, listed, run now', async () => {
    const ama = await signUp('Ama');
    expect((await ama.json('/api/agents', { title: 'Bilans', role: 'Mes bilans' })).status).toBe(
      201,
    );
    const twice = await ama.json<{ error: string }>('/api/agents', { title: 'bilans' });
    expect(twice.status).toBe(400);
    expect(twice.body.error).toContain('already here');
    await ama.json('/api/save', {
      entries: [
        {
          kind: 'Routine',
          title: 'Bilan hebdo',
          data: {
            instructions: 'Court : ce qui a avancé, ce qui a glissé, trois actions.',
            result: { kind: 'Bilan' },
          },
        },
      ],
    });
    const { then } = (
      await ama.json<{ then: unknown[] }>('/api/tasks/skill', {
        skill: 'Bilan hebdo',
        period: 'week',
      })
    ).body;
    const data = { when: { schedule: '0 18 * * 5' }, then, agent: 'Bilans' };
    const tried = await ama.json<{
      result: { matched: boolean };
      changes: unknown[];
      next: string[];
    }>('/api/tasks/try', { data });
    expect(tried.status).toBe(200);
    expect(tried.body.result.matched).toBe(true);
    expect(tried.body.changes.length).toBeGreaterThan(0);
    expect(tried.body.next).toHaveLength(3);
    expect(
      (await ama.json<unknown[]>('/api/entries?kind=Bilan')).body,
      'the dry run wrote nothing',
    ).toHaveLength(0);
    const saved = await ama.json<{ entries: { id: string }[] }>('/api/save', {
      entries: [{ kind: 'Rule', title: 'Bilan de la semaine', data }],
    });
    const id = saved.body.entries[0]!.id;
    const tasks =
      await ama.json<{ id: string; agent: string; skill: string; next: string[]; plan: unknown }[]>(
        '/api/tasks',
      );
    const task = tasks.body.find((one) => one.id === id);
    expect(task).toMatchObject({
      agent: 'Bilans',
      skill: 'Bilan hebdo',
      plan: { every: 'days', at: '18:00', days: [5] },
    });
    expect(task?.next).toHaveLength(3);
    expect((await ama.json<{ ran: boolean }>(`/api/tasks/${id}/run`, {})).body.ran).toBe(true);
    const bilans = await ama.json<{ data: { status: string } }[]>('/api/entries?kind=Bilan');
    expect(bilans.body.map((one) => one.data.status)).toEqual(['to_write']);
  });

  it('her text drawn as task lines and instructions', async () => {
    const ama = await signUp('Ama');
    const read = await ama.json<{ tasks: { schedule: string }[]; instructions: string }>(
      '/api/tasks/from-text',
      { text: 'Chaque lundi et vendredi à 8h, relis mes offres. Sois bref.' },
    );
    expect(read.body.tasks.map((one) => one.schedule)).toEqual(['0 8 * * 1,5']);
    expect(read.body.instructions).toBe('Sois bref.');
  });
});
