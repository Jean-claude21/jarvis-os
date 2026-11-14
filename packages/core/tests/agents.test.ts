import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { appPatternsOf, find, receive, runView, save, setCallOut, type CallRequest } from '../src';
import { person, type Person } from './people';

// Spec 050: agents outside Jarvis — her model translates, an answer comes in once, a key stays
// within its kinds, a rule calls an agent, an app watches for what moves.
describe('agents outside Jarvis', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Model',
            title: 'Offre',
            data: {
              fields: [
                { name: 'entreprise', type: 'text', aliases: ['company', 'company_name'] },
                { name: 'url', type: 'url', required: true, unique: true, aliases: ['job_url'] },
                { name: 'lieu', type: 'text', aliases: ['location'] },
              ],
            },
          },
        ],
      }),
    );
  });
  afterEach(() => setCallOut(null));

  it('writes what came under other names as her fields', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Offre',
            title: 'Stage IA',
            data: { company: 'Exemple', job_url: 'https://ex.com/1', location: 'Paris' },
          },
        ],
      }),
    );
    const [offre] = await ama.as((tx) => find(tx, ama.space, { kind: 'Offre', text: 'Stage IA' }));
    expect(offre!.data).toMatchObject({
      entreprise: 'Exemple',
      url: 'https://ex.com/1',
      lieu: 'Paris',
    });
    expect(saved.notes.join(' ')).toMatch(/company/);
  });

  it('receives a list once: the same url updates, never doubles', async () => {
    const items = [
      { position: 'Dev IA', company: 'A', job_url: 'https://ex.com/a' },
      { position: 'Dev Web', company: 'B', job_url: 'https://ex.com/b' },
      { position: 'Dev Web', company: 'B', job_url: 'https://ex.com/b' },
      { position: 'Sans lien', company: 'C' },
    ];
    const first = await ama.as((tx) =>
      receive(tx, ama.actor, ama.space, {
        kind: 'Offre',
        items,
        match: 'url',
        title: '{position} — {entreprise}',
      }),
    );
    expect(first).toMatchObject({ created: 2, updated: 0, skipped: 2 });
    const again = await ama.as((tx) =>
      receive(tx, ama.actor, ama.space, {
        kind: 'Offre',
        items: [{ position: 'Dev IA', company: 'A2', job_url: 'https://ex.com/a' }],
        match: 'url',
      }),
    );
    expect(again).toMatchObject({ created: 0, updated: 1 });
    const offers = await ama.as((tx) => find(tx, ama.space, { kind: 'Offre', limit: 50 }));
    expect(offers.filter((one) => one.data.url === 'https://ex.com/a')).toHaveLength(1);
    expect(offers.find((one) => one.data.url === 'https://ex.com/b')!.title).toBe('Dev Web — B');
  });

  it('knows an item again by the first of several keys: its fingerprint, else its address', async () => {
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Model',
            title: 'Annonce',
            data: {
              fields: [
                { name: 'url', type: 'url' },
                { name: 'empreinte', type: 'text' },
              ],
            },
          },
        ],
      }),
    );
    const send = (items: Record<string, unknown>[]) =>
      ama.as((tx) =>
        receive(tx, ama.actor, ama.space, { kind: 'Annonce', items, match: ['empreinte', 'url'] }),
      );
    expect(await send([{ title: 'Stage IA', url: 'https://a.com/1' }])).toMatchObject({
      created: 1,
    });
    // The same, seen again with its fingerprint: found by its address, it gains the fingerprint.
    expect(
      await send([{ title: 'Stage IA', url: 'https://a.com/1', empreinte: 'stage ia|x' }]),
    ).toMatchObject({ created: 0, updated: 1 });
    // The same offer on another site: found by its fingerprint.
    expect(
      await send([{ title: 'Stage IA', url: 'https://b.com/9', empreinte: 'stage ia|x' }]),
    ).toMatchObject({ created: 0, updated: 1 });
    const kept = await ama.as((tx) => find(tx, ama.space, { kind: 'Annonce', limit: 10 }));
    expect(kept).toHaveLength(1);
    // A view gives the values its text fields hold, for a filter to choose from.
    const view = await ama.as((tx) => runView(tx, ama.space, { kind: 'Annonce' }));
    expect(view.values.url).toEqual(['https://b.com/9']);
  });

  it('keeps a key within its kinds', async () => {
    const agent = { ...ama.actor, client: 'key:Agent', kinds: ['Offre'] };
    await expect(
      ama.as((tx) =>
        save(tx, agent, ama.space, { entries: [{ kind: 'Transaction', title: 'Non' }] }),
      ),
    ).rejects.toThrow(/This key may not write « Transaction »/);
    await ama.as((tx) =>
      save(tx, agent, ama.space, {
        entries: [{ kind: 'Offre', title: 'Par la clé', data: { url: 'https://ex.com/k' } }],
      }),
    );
  });

  it('calls an agent from a rule and writes its answer; a failure leaves a reminder', async () => {
    const asked: CallRequest[] = [];
    setCallOut(async (request) => {
      asked.push(request);
      return {
        offers: [{ position: 'Alternance data', company: 'D', job_url: 'https://ex.com/d' }],
      };
    });
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { kind: 'Profil', title: 'Mes critères', data: { contrat: 'Alternance' } },
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
                    body: { pays: 'France' },
                    include: 'Profil',
                    save: {
                      kind: 'Offre',
                      at: 'offers',
                      match: 'url',
                      title: '{position} — {company}',
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, { entries: [{ kind: 'Recherche', title: 'Lundi' }] }),
    );
    expect(asked[0]).toMatchObject({
      connection: 'Agent emplois',
      path: '/search',
      body: { pays: 'France', entries: [{ title: 'Mes critères', contrat: 'Alternance' }] },
    });
    const [found] = await ama.as((tx) =>
      find(tx, ama.space, { kind: 'Offre', text: 'Alternance data' }),
    );
    expect(found!.data).toMatchObject({ entreprise: 'D', url: 'https://ex.com/d' });

    setCallOut(async () => {
      throw new Error('it answered 500.');
    });
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, { entries: [{ kind: 'Recherche', title: 'Mardi' }] }),
    );
    const reminders = await ama.as((tx) => find(tx, ama.space, { kind: 'Reminder', limit: 50 }));
    expect(reminders.some((one) => /Agent emplois.*500/.test(one.title))).toBe(true);
  });

  it('brings back what an app watches for when it moved', async () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'App',
            title: 'Candidatures',
            data: {
              role: {
                covers: 'Mes candidatures',
                patterns: [
                  {
                    about: 'Candidatures envoyées',
                    kind: 'Candidature',
                    where: "statut = 'envoyée'",
                  },
                ],
              },
            },
          },
          ...[40, 45, 50].map((n) => ({
            kind: 'Candidature',
            title: `Avant ${n}`,
            data: { statut: 'envoyée', date: day(n) },
          })),
          ...[2, 3, 5, 8, 9, 12].map((n) => ({
            kind: 'Candidature',
            title: `Récente ${n}`,
            data: { statut: 'envoyée', date: day(n) },
          })),
          { kind: 'Candidature', title: 'Brouillon', data: { statut: 'brouillon', date: day(1) } },
        ],
      }),
    );
    const patterns = await ama.as((tx) => appPatternsOf(tx, [ama.space], now));
    expect(patterns).toEqual([
      expect.objectContaining({
        kind: 'app',
        about: 'Candidatures envoyées',
        figures: expect.objectContaining({
          app: 'Candidatures',
          recent: 6,
          before: 3,
          change: 100,
        }),
      }),
    ]);
  });
});
