import { beforeAll, describe, expect, it } from 'vitest';
import { server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 014 through Claude's door and her web account: the Finances app installed, a month of
// mouvements, its page computed, a rule tried, a statement imported by a script in QuickJS.
let ama: Account;
let claude: Connected;
const ids: Record<string, string> = {};
const month = new Date().toISOString().slice(0, 7);

beforeAll(async () => {
  ama = await signUp('Ama');
  claude = await connect(ama);
});

describe('the Finances app', () => {
  it('installs in one call, tried first', async () => {
    const tried = await claude.call<{ result: { created: string[] }; changes: unknown[] }>(
      'app_install',
      { name: 'finances' },
    );
    expect(tried.isError).toBe(false);
    expect(tried.value.result.created).toContain('Model « Mouvement »');
    expect((await claude.call<unknown[]>('kinds', {})).value).toHaveLength(0);
    const done = await claude.call<{ result: { created: string[] } }>('app_install', {
      name: 'Finances',
      dryRun: false,
    });
    expect(done.value.result.created).toHaveLength(9);
    const unknown = await claude.call<{ error: string }>('app_install', { name: 'Jardin' });
    expect(unknown.value.error).toMatch(/No app « Jardin » ships with Jarvis: Finances, Routines/);
  });

  it('keeps the shape of her money: relations, formulas, a workflow', async () => {
    const saved = await claude.call<{ entries: { title: string; id: string }[] }>('save', {
      entries: [
        {
          ref: 'b',
          kind: 'Compte',
          title: 'Banque',
          data: { type: 'banque', solde_initial: 100000 },
        },
        { ref: 'c', kind: 'Fonds', title: 'Courses', data: { budget_mensuel: 20000 } },
        {
          ref: 'l',
          kind: 'Obligation',
          title: 'Loyer',
          data: { montant: 120000, due: `${month}-28` },
        },
        {
          kind: 'Mouvement',
          title: 'Salaire',
          data: { montant: 300000, date: `${month}-01`, sens: 'entrée', compte: 'b' },
        },
        {
          kind: 'Mouvement',
          title: 'Marché',
          data: { montant: 15000, date: `${month}-02`, sens: 'sortie', compte: 'b', fonds: 'c' },
        },
      ],
    });
    for (const one of saved.value.entries) ids[one.title] = one.id;
    const banque = await claude.call<{ computed: { solde: number } }>('get', { id: ids.Banque });
    expect(banque.value.computed.solde).toBe(385000);
    const wrong = await claude.call<{ error: string }>('save', {
      entries: [
        { id: ids.Loyer, data: { etat: 'annulée' } },
        { id: ids.Loyer, data: { etat: 'payée' } },
      ],
    });
    expect(wrong.isError).toBe(true);
    expect(wrong.value.error).toMatch(/cannot go from « annulée » to « payée »/);
  });

  it('warns when a fund overspends, and the rule can be tried', async () => {
    await claude.call('save', {
      entries: [
        {
          kind: 'Mouvement',
          title: 'Supermarché',
          data: {
            montant: 8000,
            date: `${month}-03`,
            sens: 'sortie',
            compte: ids.Banque,
            fonds: ids.Courses,
          },
        },
      ],
    });
    const reminders = await claude.call<{ title: string }[]>('find', { kind: 'Rappel' });
    expect(reminders.value[0]?.title).toMatch(/Le fonds Courses est dépassé de 3\s000/);
    const tried = await claude.call<{ result: { matched: boolean } }>('rule_test', {
      rule: 'Fonds dépassé',
      entry: ids['Marché'],
    });
    expect(tried.value.result.matched).toBe(true);
  });

  it('draws its page in Claude, and through her account', async () => {
    const pages = await claude.call<{ pages: { id: string; title: string }[] }>('page', {
      app: 'Finances',
    });
    expect(pages.isError).toBe(false);
    const raw = await claude.client.callTool({ name: 'page', arguments: { name: 'Vue du mois' } });
    const drawn = raw.structuredContent as {
      id: string;
      blocks: { block: string; value?: unknown; error?: string }[];
    };
    expect(drawn.blocks.filter((one) => one.error)).toEqual([]);
    expect(drawn.blocks[0]).toMatchObject({ block: 'stat', value: 377000 });
    expect(drawn.blocks[1]).toMatchObject({ block: 'stat_delta', value: 23000 });
    ids.page = drawn.id;

    const rest = await ama.json<{ blocks: unknown[] }>(`/api/pages/${drawn.id}?month=1999-01`);
    expect(rest.status).toBe(200);
    expect(rest.body.blocks[1]).toMatchObject({ value: 0 });
    const list = await ama.json<{ title: string }[]>('/api/pages?app=Finances');
    expect(list.body.map((one) => one.title)).toEqual(['Vue du mois', 'Comptes']);
  });

  it('imports a statement with its script, in QuickJS, tried first', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob(
        ['date;libellé;montant\n2026-10-05;Boulangerie;-1200\n2026-10-06;Remboursement;5000\n'],
        { type: 'text/csv' },
      ),
      'releve.csv',
    );
    const uploaded = await ama.call('/api/files', { method: 'POST', body: form });
    const file = (await uploaded.json()) as { entryId: string };
    expect(uploaded.status).toBe(201);
    const tried = await claude.call<{ result: { saved: { created: number } } }>('run_script', {
      script: 'Import de relevé',
      file: file.entryId,
      params: { compte: 'Banque' },
    });
    expect(tried.isError).toBe(false);
    expect(tried.value.result.saved.created).toBe(2);
    expect(
      (await claude.call<unknown[]>('find', { kind: 'Mouvement', text: 'Boulangerie' })).value,
    ).toHaveLength(0);
    await claude.call('run_script', {
      script: 'Import de relevé',
      file: file.entryId,
      params: { compte: 'Banque' },
      dryRun: false,
    });
    const banque = await claude.call<{ computed: { solde: number } }>('get', { id: ids.Banque });
    expect(banque.value.computed.solde).toBe(377000 - 1200 + 5000);
  });

  it('stops a script that never ends', async () => {
    await claude.call('save', {
      entries: [
        {
          kind: 'Script',
          title: 'Boucle',
          data: { writes: ['Note'], code: 'function run() { while (true) {} }', timeout: 300 },
        },
      ],
    });
    const stopped = await claude.call<{ error: string }>('run_script', { script: 'Boucle' });
    expect(stopped.isError).toBe(true);
    expect(stopped.value.error).toMatch(/longer than its limit/);
  });

  it('migrates a kind, tried first', async () => {
    const tried = await claude.call<{ result: { changed: number } }>('migrate', {
      kind: 'Mouvement',
      steps: [{ set: { field: 'note', formula: "'vérifié'" } }],
    });
    expect(tried.value.result.changed).toBe(5);
    expect(
      (await claude.call<{ data: Record<string, unknown> }>('get', { id: ids.Salaire })).value.data,
    ).not.toHaveProperty('note');
  });

  it('frames its page and an entry’s record in her web account', async () => {
    const page = await (await ama.call(`/app/frame/page/${ids.page}`)).text();
    expect(page).toContain('Vue du mois');
    const record = await (await ama.call(`/app/frame/record/${ids.Banque}`)).text();
    expect(record).toContain('mouvements');
    expect((await server.app.request(`/app/frame/page/${ids.page}`)).status).toBe(302);
  });
});
