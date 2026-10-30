import { beforeAll, describe, expect, it } from 'vitest';
import { server, signUp, type Account } from './client';

// Spec 009: her web account — the app behind her session, and what it reads from `/api`.
let ama: Account;
let theory: string;
let budget: string;

beforeAll(async () => {
  ama = await signUp('Ama');
  const saved = await ama.json<{ entries: { id: string }[] }>('/api/save', {
    entries: [
      { kind: 'Dépense', title: 'Marché', data: { montant: 12000, poste: 'Repas' } },
      { kind: 'Dépense', title: 'Taxi', data: { montant: 2000, poste: 'Transport' } },
      {
        kind: 'Théorie',
        title: 'Théorie du royaume',
        data: { texte: `# Théorie du royaume\n\n## Fondement\n\n${'Le royaume. '.repeat(50)}` },
      },
      {
        kind: 'Rappel',
        title: 'Bientôt',
        data: { quand: new Date(Date.now() + 86_400_000).toISOString() },
      },
      {
        kind: 'Tableau de bord',
        title: 'Budget',
        data: {
          widgets: [
            {
              titre: 'Total',
              graphe: 'nombre',
              requete:
                "select sum((data->>'montant')::numeric) as total from my_entries where kind = 'Dépense'",
            },
          ],
        },
      },
    ],
  });
  theory = saved.body.entries[2]!.id;
  budget = saved.body.entries[4]!.id;
});

describe('the app', () => {
  it('opens at the root with her session, else sends her to sign in', async () => {
    expect((await server.app.request('/')).headers.get('location')).toBe('/app');
    const away = await server.app.request('/app');
    expect(away.status).toBe(302);
    expect(away.headers.get('location')).toBe('/connexion');
    const app = await ama.call('/app', { headers: { 'accept-language': 'fr' } });
    expect(app.status).toBe(200);
    const html = await app.text();
    expect(html).toContain('Tableaux de bord');
    expect(html).toContain('Connexions');
  });

  it('frames a saved dashboard and a document with the clients’ views', async () => {
    const dashboard = await (await ama.call(`/app/frame/dashboard/${budget}`)).text();
    expect(dashboard).toContain('"title":"Budget"');
    expect(dashboard).toContain('"total":"14000"');
    const document = await (await ama.call(`/app/frame/document/${theory}`)).text();
    expect(document).toContain('<title>Théorie du royaume</title>');
    expect((await server.app.request(`/app/frame/document/${theory}`)).status).toBe(302);
  });
});

describe('what the app reads', () => {
  it('gives an overview: counts per space, what comes, what changed', async () => {
    const { body } = await ama.json<{
      spaces: { entries: number; documents: number; reminders: number }[];
      upcoming: { title: string }[];
      changes: { n: number }[];
      recent: unknown[];
    }>('/api/overview');
    expect(body.spaces[0]).toMatchObject({ entries: 5, documents: 1, reminders: 1 });
    expect(body.upcoming.map((one) => one.title)).toEqual(['Bientôt']);
    expect(body.changes.reduce((sum, one) => sum + one.n, 0)).toBeGreaterThanOrEqual(5);
    expect(body.recent.length).toBeGreaterThan(0);
  });

  it('gives a document as HTML with its reading link, and computes a dashboard', async () => {
    const doc = await ama.json<{ html: string; link: string; outline: unknown[] }>(
      `/api/documents/${theory}`,
    );
    expect(doc.body.html).toContain('<h2 id="fondement">Fondement</h2>');
    expect(doc.body.link).toMatch(/\/document\//);
    const drawn = await ama.json<{ widgets: { rows: unknown[] }[] }>('/api/dashboard', {
      id: budget,
    });
    expect(drawn.body.widgets[0]!.rows).toEqual([{ total: '14000' }]);
  });

  it('lists no connection before she connects one, and revokes nothing she has not', async () => {
    expect((await ama.json('/api/connections')).body).toEqual([]);
    expect((await ama.json('/api/connections/nobody', undefined, 'DELETE')).status).toBe(404);
  });
});

describe('the new platform (spec 013)', () => {
  it('says what needs her now, across her spaces', async () => {
    const { body } = await ama.json<{
      items: { title: string; group: string }[];
      day: unknown[];
    }>('/api/now');
    expect(body.items.find((one) => one.title === 'Bientôt')?.group).toMatch(/today|week/);
  });

  it('lists her files, and gives one to download', async () => {
    const form = new FormData();
    const csv = 'date;montant\n2026-10-29;-2500\n';
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'releve.csv');
    const up = await ama.call('/api/files', { method: 'POST', body: form });
    expect(up.status).toBe(201);
    const { body: files } =
      await ama.json<{ entryId: string; name: string; read: boolean }[]>('/api/files');
    expect(files[0]).toMatchObject({ name: 'releve.csv', read: true });
    const down = await ama.call(`/api/files/${files[0]!.entryId}?download=1`);
    expect(down.headers.get('content-disposition')).toMatch(/^attachment/);
  });

  it('draws the new shell: now, the apps, the files', async () => {
    const html = await (await ama.call('/app', { headers: { 'accept-language': 'fr' } })).text();
    expect(html).toContain('Maintenant');
    expect(html).toContain('Fichiers');
    expect(html).toContain('id="apps"');
  });
});
