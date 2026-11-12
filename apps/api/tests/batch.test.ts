import { describe, expect, it } from 'vitest';
import { PUBLIC_URL, server, signUp } from './client';

// Reads asked together come back in order, each answered as if asked alone — her session, her
// spaces, a key's limits included.
describe('reads in one request', () => {
  it('answers each read in order, with its own status', async () => {
    const ama = await signUp('Ama');
    const answers = await ama.json<{ status: number; body: unknown }[]>('/api/batch', {
      paths: ['/me', '/kinds', '/entries/ent_nothing'],
    });
    expect(answers.status).toBe(200);
    expect(answers.body.map((one) => one.status)).toEqual([200, 200, 404]);
    expect(answers.body[0]!.body).toMatchObject({ person: expect.any(Object) });
    const refused = await ama.json('/api/batch', { paths: ['/batch'] });
    expect(refused.status).toBe(400);
  });

  it('keeps a key within its limits inside a batch', async () => {
    const ama = await signUp('Ama');
    const made = await ama.json<{ key: string }>('/api/me/keys', {
      name: 'Agent',
      kinds: ['Offre'],
    });
    const answers = await server.app.request('/api/batch', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${made.body.key}`,
        origin: PUBLIC_URL,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ paths: ['/me/keys', '/kinds'] }),
    });
    expect((await answers.json()).map((one: { status: number }) => one.status)).toEqual([403, 200]);
  });
});
