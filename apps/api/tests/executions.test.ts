import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PUBLIC_URL, server, signUp, type Account } from './client';

// Spec 057 through the API: a rule starts long work on a service (a small server of the test);
// the service answers later with its work token — within its execution, its kinds, the
// connections lent — then closes it; « Tâches » reads it.
let ama: Account;
let service: Server;
let serviceUrl = '';
const asked: { url: string | undefined; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
  ama = await signUp('Ama');
  service = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      asked.push({ url: request.url, body: JSON.parse(body || '{}') });
      response.setHeader('content-type', 'application/json');
      response.statusCode = request.url === '/jobs/offres' ? 202 : 200;
      response.end(
        JSON.stringify(request.url === '/jobs/offres' ? { accepted: true } : { lent: true }),
      );
    });
  });
  await new Promise<void>((done) => service.listen(0, '127.0.0.1', done));
  serviceUrl = `http://localhost:${(service.address() as AddressInfo).port}`;
  for (const name of ['Atelier', 'Autre'])
    expect(
      (
        await ama.json('/api/connectors', {
          name,
          url: serviceUrl,
          auth: 'bearer',
          secret: 'service-secret',
          protocol: 'http',
        })
      ).status,
    ).toBe(201);
});
afterAll(() => service.close());

const withKey = (key: string, path: string, body?: unknown) =>
  server.app.request(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      origin: PUBLIC_URL,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('long work and its token', () => {
  it('runs, answers within its execution, calls what was lent, closes once', async () => {
    await ama.json('/api/save', {
      entries: [
        {
          kind: 'Rule',
          title: 'Collecte du matin',
          data: {
            when: { saved: 'Collecte' },
            then: [
              {
                call: {
                  connection: 'Atelier',
                  path: '/jobs/offres',
                  long: true,
                  lend: ['Atelier'],
                  save: { kind: 'Offre', match: 'url' },
                },
              },
            ],
          },
        },
      ],
    });
    expect(
      (await ama.json('/api/save', { entries: [{ kind: 'Collecte', title: 'Jeudi' }] })).status,
    ).toBe(200);
    const work = asked.find((one) => one.url === '/jobs/offres')!.body.jarvis as {
      execution: string;
      token: string;
      url: string;
    };
    expect(work.url).toMatch(/\/api$/);
    const { token, execution } = work;

    // Within its execution only.
    expect((await withKey(token, '/api/entries')).status).toBe(403);
    expect((await withKey(token, '/api/executions/ent_other', { status: 'done' })).status).toBe(
      403,
    );
    expect(
      (await withKey(token, '/api/receive', { kind: 'Offre', items: [], execution: 'ent_other' }))
        .status,
    ).toBe(403);
    expect(
      (await withKey(token, '/api/receive', { kind: 'Transaction', items: [{ title: 'Non' }] }))
        .status,
    ).toBe(403);

    // What it sends is counted on its execution.
    const sent = await withKey(token, '/api/receive', {
      kind: 'Offre',
      match: 'url',
      items: [
        { title: 'Stage IA', url: 'https://ex.com/ia' },
        { title: 'Stage NLP', url: 'https://ex.com/nlp' },
      ],
    });
    expect(sent.status).toBe(200);

    // A connection lent is called by Jarvis; one not lent is refused.
    const lent = await withKey(token, `/api/executions/${execution}/call`, {
      connection: 'Atelier',
      path: '/lent',
      args: { q: 'stage' },
    });
    expect(lent.status).toBe(200);
    expect(await lent.json()).toEqual({ answer: { lent: true } });
    expect(asked.find((one) => one.url === '/lent')!.body).toEqual({ q: 'stage' });
    expect(
      (
        await withKey(token, `/api/executions/${execution}/call`, {
          connection: 'Autre',
          path: '/x',
        })
      ).status,
    ).toBe(403);

    // Closed once; then the token answers nothing.
    const closed = await withKey(token, `/api/executions/${execution}`, {
      status: 'done',
      log: '2 offres',
    });
    expect(closed.status).toBe(200);
    expect((await withKey(token, `/api/executions/${execution}`, { status: 'done' })).status).toBe(
      401,
    );
    const again = await ama.json(`/api/executions/${execution}`, { status: 'failed' });
    expect(again.status).toBe(400);

    const done = await ama.json<{ kind: string; execution?: { counts: Record<string, number> } }[]>(
      '/api/activities?state=done&kind=Execution',
    );
    expect(done.body[0]).toMatchObject({
      kind: 'Execution',
      execution: { counts: { created: 2 } },
    });
  });

  it('lists what she has to do, what needs her first', async () => {
    await ama.json('/api/save', {
      entries: [
        { kind: 'Task', title: 'Relancer l’école', data: { due: '2020-01-01' } },
        { kind: 'Task', title: 'Valider la lettre', data: { status: 'proposed' } },
      ],
    });
    const open = await ama.json<{ title: string; group: string }[]>('/api/activities');
    expect(open.status).toBe(200);
    const titles = open.body.map((one) => one.title);
    expect(titles.indexOf('Valider la lettre')).toBeLessThan(titles.indexOf('Relancer l’école'));
    expect(open.body.find((one) => one.title === 'Relancer l’école')!.group).toBe('late');
  });
});
