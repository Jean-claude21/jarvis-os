import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PUBLIC_URL, server, signUp, type Account } from './client';

// Spec 050 through the API: a program's key within its limits, an agent's answer received, and a
// rule that calls an agent (here a small server of the test, on localhost) and writes its answer.
let ama: Account;
let agent: Server;
let agentUrl = '';
const asked: unknown[] = [];

beforeAll(async () => {
  ama = await signUp('Ama');
  agent = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      if (request.method === 'POST')
        asked.push({
          url: request.url,
          key: request.headers.authorization,
          body: JSON.parse(body || '{}'),
        });
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          offers: [
            { job_title: 'Stage IA', company: 'Exemple', job_url: 'https://ex.com/ia' },
            { job_title: 'Stage Web', company: 'Autre', job_url: 'https://ex.com/web' },
          ],
        }),
      );
    });
  });
  await new Promise<void>((done) => agent.listen(0, '127.0.0.1', done));
  agentUrl = `http://localhost:${(agent.address() as AddressInfo).port}`;
  const model = await ama.json('/api/save', {
    entries: [
      {
        kind: 'Model',
        title: 'Offre',
        data: {
          fields: [
            { name: 'poste', type: 'text', aliases: ['job_title'] },
            { name: 'entreprise', type: 'text', aliases: ['company'] },
            { name: 'url', type: 'url', unique: true, aliases: ['job_url'] },
          ],
        },
      },
    ],
  });
  expect(model.status).toBe(200);
});
afterAll(() => agent.close());

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

describe('agents outside Jarvis', () => {
  it('keeps a program’s key within its space and its kinds, and names it in the journal', async () => {
    const me = await ama.json<{ spaces: { id: string; personal: boolean }[] }>('/api/me');
    const own = me.body.spaces.find((one) => one.personal)!;
    const other = await ama.json<{ id: string }>('/api/spaces', { name: 'Famille' });
    const made = await ama.json<{ key: string }>('/api/me/keys', {
      name: 'Agent emplois',
      space: own.id,
      kinds: ['Offre'],
    });
    expect(made.status).toBe(201);
    const key = made.body.key;

    expect((await withKey(key, `/api/entries?space=${other.body.id}`)).status).toBe(403);
    expect((await withKey(key, '/api/me/keys', { name: 'Plus' })).status).toBe(403);
    const refused = await withKey(key, '/api/save', {
      entries: [{ kind: 'Transaction', title: 'Non' }],
    });
    expect(refused.status).toBe(403);

    const received = await withKey(key, '/api/receive', {
      kind: 'Offre',
      match: 'url',
      items: [
        { job_title: 'Alternance data', company: 'D', job_url: 'https://ex.com/d', salary: '?' },
      ],
      title: '{poste} — {entreprise}',
    });
    expect(received.status).toBe(200);
    expect(await received.json()).toMatchObject({ created: 1, setAside: ['salary'] });
    const history =
      await ama.json<{ client: string | null; command: string }[]>('/api/history?limit=5');
    expect(history.body.some((one) => one.client === 'key:Agent emplois')).toBe(true);

    const listed =
      await ama.json<{ name: string; spaceId: string; kinds: string[] }[]>('/api/me/keys');
    expect(listed.body.find((one) => one.name === 'Agent emplois')).toMatchObject({
      spaceId: own.id,
      kinds: ['Offre'],
    });
  });

  it('calls an agent from a rule, its key sealed in the connection, and writes its answer once', async () => {
    const connection = await ama.json<{ state: string; protocol: string }>('/api/connectors', {
      name: 'Agent emplois',
      url: agentUrl,
      auth: 'bearer',
      secret: 'agent-secret',
      protocol: 'http',
    });
    expect(connection.status).toBe(201);
    expect(connection.body).toMatchObject({ protocol: 'http', state: 'connected' });
    await ama.json('/api/save', {
      entries: [
        { kind: 'Profil', title: 'Mes critères', data: { contrat: 'Stage' } },
        {
          kind: 'Rule',
          title: 'Chercher des offres',
          data: {
            when: { saved: 'Recherche' },
            then: [
              {
                call: {
                  connection: 'Agent emplois',
                  path: '/search',
                  include: 'Profil',
                  save: {
                    kind: 'Offre',
                    at: 'offers',
                    match: 'url',
                    title: '{poste} — {entreprise}',
                  },
                },
              },
            ],
          },
        },
      ],
    });
    for (const title of ['Lundi', 'Mardi']) {
      const run = await ama.json('/api/save', { entries: [{ kind: 'Recherche', title }] });
      expect(run.status).toBe(200);
    }
    expect(asked[0]).toMatchObject({
      url: '/search',
      key: 'Bearer agent-secret',
      body: { entries: [{ title: 'Mes critères', contrat: 'Stage' }] },
    });
    const offers = await ama.json<{ title: string; data: Record<string, unknown> }[]>(
      '/api/entries?kind=Offre&limit=50',
    );
    const ia = offers.body.filter((one) => one.data.url === 'https://ex.com/ia');
    expect(ia).toHaveLength(1);
    expect(ia[0]).toMatchObject({ title: 'Stage IA — Exemple', data: { poste: 'Stage IA' } });
  });
});

describe('the addresses a call may reach', () => {
  it('calls https outside private networks, and localhost only off production', async () => {
    const { reachable } = await import('../src/connector-service');
    const at = (url: string, local = false) => reachable(new URL(url), local);
    expect(at('https://agent.example.com/search')).toBe(true);
    expect(at('http://agent.example.com/search')).toBe(false);
    for (const inside of [
      'https://10.0.0.4/x',
      'https://192.168.1.2/x',
      'https://172.20.0.1/x',
      'https://169.254.169.254/latest',
      'https://127.0.0.1/x',
      'https://box.internal/x',
    ])
      expect(at(inside)).toBe(false);
    expect(at('http://localhost:8000/search')).toBe(false);
    expect(at('http://localhost:8000/search', true)).toBe(true);
  });
});
