import { beforeAll, describe, expect, it } from 'vitest';
import { server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 016 through her account, Claude and a public link: collections and their statistics,
// buttons, public forms and views, viewers.
let ama: Account;
let claude: Connected;
const ids: Record<string, string> = {};

beforeAll(async () => {
  ama = await signUp('Ama');
  claude = await connect(ama);
  const saved = await ama.json<{ entries: { title: string; id: string }[] }>('/api/save', {
    entries: [
      {
        kind: 'Model',
        title: 'Application',
        data: {
          area: 'Professionnel',
          label: { fr: 'Candidature', en: 'Application' },
          fields: [
            { name: 'offer', type: 'url', unique: true },
            { name: 'contact', type: 'email' },
            { name: 'state', type: 'choice', options: ['applied', 'interview', 'rejected'] },
            { name: 'interest', type: 'rating' },
            { name: 'applied_on', type: 'date', default: '=today()' },
            { name: 'place', type: 'location' },
            { name: 'notes', type: 'long_text' },
            { name: 'relaunch', type: 'button', action: { set: { state: 'applied' } } },
          ],
        },
      },
      {
        kind: 'Application',
        title: 'Data intern',
        data: {
          offer: 'https://kora.example/42',
          state: 'interview',
          interest: 5,
          place: { address: 'Cocody', lat: 5.36, lng: -3.99 },
        },
      },
      { kind: 'Application', title: 'Analyst', data: { state: 'rejected', interest: 3 } },
    ],
  });
  for (const one of saved.body.entries) ids[one.title] = one.id;
});

describe('a collection', () => {
  it('is listed and gives its statistics', async () => {
    const list =
      await ama.json<{ kind: string; count: number; area: string }[]>('/api/collections');
    expect(list.body).toEqual([
      expect.objectContaining({ kind: 'Application', count: 2, area: 'Professionnel' }),
    ]);
    const stats = await ama.json<{
      total: number;
      splits: { field: string; counts: { option: string; n: number }[] }[];
      figures: { field: string; value: number }[];
    }>('/api/collections/Application/stats');
    expect(stats.body.total).toBe(2);
    expect(stats.body.splits[0]?.counts.map((one) => one.n)).toEqual([0, 1, 1]);
    expect(stats.body.figures).toEqual([expect.objectContaining({ field: 'interest', value: 4 })]);
    const viaClaude = await claude.call<{ total: number }>('collection_stats', {
      kind: 'Application',
    });
    expect(viaClaude.value.total).toBe(2);
  });

  it('shows on a map', async () => {
    const map = await ama.json<{ map: { items: { title: string }[] } }>('/api/views/run', {
      view: { kind: 'Application', type: 'map' },
    });
    expect(map.body.map.items.map((one) => one.title)).toEqual(['Data intern']);
  });

  it('keeps a value unique and says so in her language’s terms', async () => {
    const refused = await ama.json<{ code: string; error: string }>('/api/save', {
      entries: [
        { kind: 'Application', title: 'Again', data: { offer: 'https://kora.example/42' } },
      ],
    });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('model');
  });

  it('has a button that does what it says', async () => {
    const pressed = await ama.json(`/api/entries/${ids['Analyst']}/press`, { field: 'relaunch' });
    expect(pressed.status).toBe(200);
    expect(
      (await ama.json<{ data: { state: string } }>(`/api/entries/${ids['Analyst']}`)).body.data
        .state,
    ).toBe('applied');
  });
});

describe('a public link', () => {
  it('opens a form anyone can send, which reaches her as proposed', async () => {
    const made = await ama.json<{ link: string }>('/api/shares', {
      name: 'Candidature spontanée',
      data: { mode: 'form', kind: 'Application', fields: ['contact', 'notes'] },
    });
    expect(made.status).toBe(201);
    const path = new URL(made.body.link).pathname;
    const page = await server.app.request(path);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Candidature spontanée');
    const sent = await server.app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Kofi',
        data: { contact: 'kofi@example.org', notes: 'Bonjour' },
      }),
    });
    expect(sent.status).toBe(201);
    const refused = await server.app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Kofi', data: { state: 'interview' } }),
    });
    expect(refused.status).toBe(400);
    const [kofi] = (
      await ama.json<{ title: string; data: { status: string } }[]>(
        '/api/entries?kind=Application&text=Kofi',
      )
    ).body;
    expect(kofi?.data.status).toBe('proposed');
    expect((await server.app.request('/p/nothing-here-at-all-1234')).status).toBe(404);
  });

  it('opens a view to read, through Claude after her yes', async () => {
    const made = await claude.call<{ link: string }>('share', {
      name: 'Mes candidatures',
      mode: 'view',
      view: { kind: 'Application', columns: ['state'] },
    });
    expect(made.isError).toBe(false);
    const page = await server.app.request(new URL(made.value.link).pathname);
    expect(await page.text()).toContain('Data intern');
  });
});

describe('a viewer', () => {
  it('reads a shared space and writes nothing', async () => {
    const kofi = await signUp('Kofi');
    const nous = await ama.json<{ id: string }>('/api/spaces', { name: 'Nous' });
    const invited = await ama.json<{ link: string }>(`/api/spaces/${nous.body.id}/invitations`, {
      email: kofi.email,
    });
    await kofi.json('/api/invitations/accept', { token: invited.body.link.split('#')[1] });
    const me = await kofi.json<{ person: { id: string } }>('/api/me');
    const set = await ama.json(`/api/spaces/${nous.body.id}/members/${me.body.person.id}/role`, {
      role: 'viewer',
    });
    expect(set.status).toBe(200);
    const written = await kofi.json<{ code: string }>(`/api/save?space=${nous.body.id}`, {
      entries: [{ kind: 'Note', title: 'Pirate' }],
    });
    expect(written.status).toBe(400);
    expect(written.body.code).toBe('readonly');
    expect((await kofi.json<unknown[]>(`/api/entries?space=${nous.body.id}`)).status).toBe(200);
  });
});
