import { describe, expect, it } from 'vitest';
import { signUp } from './client';

// The routes the v3 added (specs 099–105), through HTTP: their answers, their refusals in words.
describe('the v3 routes', () => {
  it('collections: a draft from a phrase, made, its fields changed, renamed, moved', async () => {
    const ama = await signUp('Ama');
    const draft = await ama.json<{ draft: { kind: string; fields: unknown[] } }>(
      '/api/collections/draft',
      { phrase: 'mes lectures' },
    );
    expect(draft.status).toBe(200);
    expect(draft.body.draft.kind).toBe('Lecture');
    const made = await ama.json('/api/collections', {
      kind: 'Lecture',
      label: 'Lecture',
      app: 'Livres',
      fields: [{ name: 'auteur', label: 'Auteur', type: 'text' }],
    });
    expect(made.status).toBe(201);
    expect(
      (
        await ama.json('/api/collections', {
          kind: 'Lecture',
          label: 'x',
          app: 'Livres',
          fields: [],
        })
      ).status,
    ).toBe(400);
    const fields = await ama.json(
      '/api/collections/Lecture/fields',
      { fields: [{ name: 'auteur', label: 'Écrit par', type: 'text' }] },
      'PUT',
    );
    expect(fields.status).toBe(200);
    expect(
      (await ama.json('/api/kinds/label', { kind: 'Lecture', label: 'Livre lu' })).status,
    ).toBe(200);
    expect((await ama.json('/api/collections/Lecture/app', { app: 'Culture' }, 'PUT')).status).toBe(
      200,
    );
  });

  it('the queue: a proposal changed before the yes, then decided', async () => {
    const ama = await signUp('Ama');
    const saved = await ama.json<{ entries: { id: string }[] }>('/api/save', {
      entries: [
        {
          kind: 'Proposal',
          title: 'Achat',
          data: {
            status: 'proposed',
            entries: [{ kind: 'Transaction', title: 'Pain', data: { amount: 500 } }],
            links: [],
          },
        },
      ],
    });
    const id = saved.body.entries[0]!.id;
    const amended = await ama.json(
      `/api/to-sort/${id}`,
      { entries: [{ at: 0, data: { amount: 450 } }] },
      'PUT',
    );
    expect(amended.status).toBe(200);
    expect(
      (await ama.json(`/api/to-sort/${id}`, { entries: [{ at: 5, data: { a: 1 } }] }, 'PUT'))
        .status,
    ).toBe(400);
    expect((await ama.json(`/api/to-sort/${id}`, { yes: true })).status).toBe(200);
    const [pain] = (await ama.json<{ data: { amount: number } }[]>('/api/entries?kind=Transaction'))
      .body;
    expect(pain?.data.amount).toBe(450);
  });

  it('agents: listed, paused, given a report channel and a memory', async () => {
    const ama = await signUp('Ama');
    const agents = await ama.json<{ title: string }[]>('/api/agents');
    expect(agents.body.map((one) => one.title)).toEqual(
      expect.arrayContaining([
        'Secrétaire des papiers',
        'Assistant du matin',
        'Gardien des rappels',
      ]),
    );
    expect(
      (
        await ama.json(
          '/api/agents/Assistant%20du%20matin',
          { paused: true, report: 'telegram' },
          'PATCH',
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await ama.json('/api/agents/Assistant%20du%20matin/memory', {
          text: 'Le lundi, la semaine.',
        })
      ).status,
    ).toBe(201);
    const after = (
      await ama.json<{ title: string; data: { paused?: boolean }; memory: { text: string }[] }[]>(
        '/api/agents',
      )
    ).body.find((one) => one.title === 'Assistant du matin');
    expect(after?.data.paused).toBe(true);
    expect(after?.memory.map((one) => one.text)).toEqual(['Le lundi, la semaine.']);
    expect((await ama.json('/api/agents/Personne', { paused: true }, 'PATCH')).status).toBe(404);
  });

  it('apps: removal tried first, an app given back', async () => {
    const ama = await signUp('Ama');
    expect((await ama.json('/api/apps/install', { name: 'garanties', dryRun: false })).status).toBe(
      200,
    );
    const tried = await ama.json<{ result: { removed: string[] } }>('/api/apps/remove', {
      name: 'Garanties',
      dryRun: true,
    });
    expect(tried.body.result.removed.length).toBeGreaterThan(0);
    expect((await ama.json('/api/apps/remove', { name: 'Garanties', dryRun: false })).status).toBe(
      200,
    );
    const gone = await ama.json<{ error: string }>('/api/apps/remove', {
      name: 'Garanties',
      dryRun: true,
    });
    expect(gone.status).toBe(400);
    expect(gone.body.error).toContain('No app « Garanties »');
  });

  it('a phrase taken twice is refused in words; the brief is sent nowhere without a channel', async () => {
    const ama = await signUp('Ama');
    const rule = (title: string) => ({
      kind: 'Rule',
      title,
      data: { when: { phrase: '/x1' }, then: [{ create: { kind: 'Task', title: 'X' } }] },
    });
    expect((await ama.json('/api/save', { entries: [rule('Un')] })).status).toBe(200);
    const twice = await ama.json<{ error: string }>('/api/save', { entries: [rule('Deux')] });
    expect(twice.status).toBe(400);
    expect(twice.body.error).toContain('one phrase starts one thing');
    expect((await ama.json<{ sent: boolean }>('/api/me/brief', {})).body.sent).toBe(false);
  });
});
