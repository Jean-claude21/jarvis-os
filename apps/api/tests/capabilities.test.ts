import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PUBLIC_URL, server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 060: Jarvis's own Atelier (a small server of the test), reached by Jarvis itself — no
// connection of hers. Its capabilities listed with the apps that use them; a capability run from a
// conversation (a PDF kept as her file); a rule of her app calling « Atelier ».
const port = vi.hoisted(() => {
  const chosen = 41000 + Math.floor(Math.random() * 9000);
  process.env.ATELIER_URL = `http://127.0.0.1:${chosen}`;
  process.env.ATELIER_KEY = 'atelier-test-key';
  return chosen;
});

const catalog = {
  services: [
    {
      name: 'chercher',
      title: 'Chercher sur le web',
      does: 'Chercher sur le web',
      examples: ['trouve les sites où chercher un stage'],
      effect: 'reads',
      description: 'Searches the web.',
      input: { type: 'object', properties: { queries: { type: 'array' } } },
      long: false,
      minutes: 15,
      path: '/jobs/chercher',
      ready: true,
    },
    {
      name: 'parcourir',
      title: 'Parcourir des sites',
      does: 'Parcourir des sites selon une recette',
      examples: ['regarde ces sites chaque matin'],
      effect: 'reads',
      description: 'Reads sites by a recipe.',
      input: { type: 'object', properties: { sources: { type: 'array' } } },
      writes: { kind: 'Capture', match: 'url', raw: 'Capture' },
      long: true,
      minutes: 20,
      path: '/jobs/parcourir',
      ready: true,
    },
    {
      name: 'pdf',
      title: 'Faire un PDF',
      does: 'Mettre un CV ou une lettre en PDF',
      examples: ['ma lettre en PDF'],
      effect: 'makes',
      description: 'Makes a PDF.',
      input: { type: 'object', properties: { title: { type: 'string' } } },
      writes: { kind: 'Fichier' },
      long: true,
      minutes: 5,
      path: '/jobs/pdf',
      ready: true,
    },
  ],
};

let ama: Account;
let claude: Connected;
let atelier: Server;
const asked: {
  url: string | undefined;
  auth: string | undefined;
  body: Record<string, unknown>;
}[] = [];

beforeAll(async () => {
  ama = await signUp('Ama');
  claude = await connect(ama);
  atelier = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      response.setHeader('content-type', 'application/json');
      if (request.url === '/catalog') return response.end(JSON.stringify(catalog));
      const read = JSON.parse(body || '{}') as Record<string, unknown>;
      asked.push({ url: request.url, auth: request.headers.authorization, body: read });
      if (request.url === '/jobs/chercher')
        return response.end(JSON.stringify({ items: [{ title: 'Une offre', text: 'Stage IA' }] }));
      response.statusCode = 202;
      response.end(JSON.stringify({ accepted: true, job: 'job_1' }));
    });
  });
  await new Promise<void>((done) => atelier.listen(port, '127.0.0.1', done));
});
afterAll(() => atelier.close());

const withToken = (token: string, path: string, init: RequestInit) =>
  server.app.request(path, {
    ...init,
    headers: { authorization: `Bearer ${token}`, origin: PUBLIC_URL, ...(init.headers ?? {}) },
  });

describe('the Atelier, reached by Jarvis itself', () => {
  it('lists what it can do, with the apps that use each', async () => {
    const listed = (await (await ama.call('/api/capabilities')).json()) as {
      capabilities: { name: string; does: string; apps: string[] }[];
    };
    expect(listed.capabilities.map((one) => one.name)).toEqual(['chercher', 'parcourir', 'pdf']);
    expect(listed.capabilities[0]!.apps).toContain('Candidatures');
    const told = await claude.call<{ capabilities: { name: string; apps: string[] }[] }>(
      'capabilities',
      {},
    );
    expect(told.isError).toBe(false);
    expect(told.value.capabilities.find((one) => one.name === 'pdf')!.apps).toContain(
      'Candidatures',
    );
  });

  it('runs short work at once', async () => {
    const read = await claude.call<{ items: { title: string }[] }>('capabilities', {
      run: 'chercher',
      input: { queries: ['stage IA Rouen'] },
    });
    expect(read.value.items[0]!.title).toBe('Une offre');
    expect(asked.at(-1)).toMatchObject({ url: '/jobs/chercher', auth: 'Bearer atelier-test-key' });
  });

  it('runs long work from a conversation: the PDF it makes is kept as her file', async () => {
    const run = await claude.call<{ accepted: boolean; execution: string }>('capabilities', {
      run: 'pdf',
      input: { title: 'Lettre', html: '<p>Madame, Monsieur</p>' },
    });
    expect(run.isError).toBe(false);
    const sent = asked.at(-1)!;
    expect(sent.url).toBe('/jobs/pdf');
    const work = sent.body.jarvis as { execution: string; token: string; url: string };
    expect(work).toMatchObject({ execution: run.value.execution, url: `${PUBLIC_URL}/api` });
    // The Atelier's side: the file, then the close — with the work token only.
    const form = new FormData();
    form.append('file', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'Lettre.pdf');
    form.append('title', 'Lettre');
    form.append('links', JSON.stringify([{ to: work.execution, role: 'made_by' }]));
    const file = await withToken(work.token, '/api/files', { method: 'POST', body: form });
    expect(file.status).toBe(201);
    // Nothing else with that token: not her entries.
    expect((await withToken(work.token, '/api/entries', { method: 'GET' })).status).toBe(403);
    const closed = await withToken(work.token, `/api/executions/${work.execution}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done', counts: { found: 1, created: 1 } }),
    });
    expect(closed.status).toBe(200);
    const execution = (await (await ama.call(`/api/entries/${work.execution}`)).json()) as {
      data: { status: string };
    };
    expect(execution.data.status).toBe('done');
    // Once closed, its token answers nothing.
    expect((await withToken(work.token, '/api/entries', { method: 'GET' })).status).toBe(401);
  });

  it('is what a rule of her app calls as « Atelier », without a connection of hers', async () => {
    await ama.json('/api/save', {
      entries: [
        {
          kind: 'Rule',
          title: 'Offres quand elle cherche',
          data: {
            when: { saved: 'JobSearch' },
            then: [
              {
                call: {
                  connection: 'Atelier',
                  path: '/jobs/parcourir',
                  include: { searches: 'JobSearch', sources: 'Source' },
                  long: true,
                  save: { kind: 'JobOffer', match: 'url', title: '{title}', raw: 'Capture' },
                },
              },
            ],
          },
        },
      ],
    });
    await ama.json('/api/save', {
      entries: [{ kind: 'Source', title: 'Un site', data: { url: 'https://s.com/?q={poste}' } }],
    });
    await ama.json('/api/save', {
      entries: [
        { kind: 'JobSearch', title: 'Stage IA', data: { poste: 'stage IA', lieu: 'Rouen' } },
      ],
    });
    const sent = asked.at(-1)!;
    expect(sent).toMatchObject({ url: '/jobs/parcourir', auth: 'Bearer atelier-test-key' });
    expect(sent.body.searches).toEqual([
      expect.objectContaining({ title: 'Stage IA', poste: 'stage IA', lieu: 'Rouen' }),
    ]);
    expect(sent.body.sources).toEqual([
      expect.objectContaining({ title: 'Un site', url: 'https://s.com/?q={poste}' }),
    ]);
    const work = sent.body.jarvis as {
      execution: string;
      token: string;
      url: string;
      save: { kind: string };
    };
    expect(work).toMatchObject({ url: `${PUBLIC_URL}/api`, save: { kind: 'JobOffer' } });
    const received = await withToken(work.token, '/api/receive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'JobOffer',
        match: 'url',
        title: '{title} — {company}',
        execution: work.execution,
        items: [{ title: 'Stage IA', company: 'Exemple', url: 'https://ex.com/1', score: 80 }],
      }),
    });
    expect(((await received.json()) as { created: number }).created).toBe(1);
    // What could not be structured is kept raw, with the same token.
    const raw = await withToken(work.token, '/api/receive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'Capture',
        match: 'url',
        execution: work.execution,
        items: [{ title: 'Une page', url: 'https://s.com/2', source: 's.com', text: '# Offres' }],
      }),
    });
    expect(raw.status).toBe(200);
    expect(((await raw.json()) as { created: number }).created).toBe(1);
  });
});
