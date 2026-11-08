import { beforeAll, describe, expect, it } from 'vitest';
import { server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 014 through Claude's door and her web account: the Finances app installed, a month of
// transactions, its page computed, a rule tried, a statement imported by a script in QuickJS.
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
    const tried = await claude.call<{ result: { created: string[] } }>('app_install', {
      name: 'finances',
    });
    expect(tried.isError).toBe(false);
    expect(tried.value.result.created).toContain('Model « Transaction »');
    expect((await claude.call<unknown[]>('kinds', {})).value).toHaveLength(0);
    const done = await claude.call<{ result: { created: string[] } }>('app_install', {
      name: 'Finances',
      dryRun: false,
    });
    expect(done.value.result.created).toHaveLength(9);
    const unknown = await claude.call<{ error: string }>('app_install', { name: 'Garden' });
    expect(unknown.value.error).toMatch(/No app « Garden » ships with Jarvis: Finances, Routines/);
  });

  it('keeps the shape of her money: relations, formulas, a workflow', async () => {
    const saved = await claude.call<{ entries: { title: string; id: string }[] }>('save', {
      entries: [
        {
          ref: 'b',
          kind: 'Account',
          title: 'Banque',
          data: { type: 'bank', opening_balance: 100000 },
        },
        { ref: 'c', kind: 'Fund', title: 'Courses', data: { monthly_budget: 20000 } },
        { ref: 'l', kind: 'Bill', title: 'Loyer', data: { amount: 120000, due: `${month}-28` } },
        {
          kind: 'Transaction',
          title: 'Salaire',
          data: { amount: 300000, date: `${month}-01`, direction: 'in', account: 'b' },
        },
        {
          kind: 'Transaction',
          title: 'Marché',
          data: { amount: 15000, date: `${month}-02`, direction: 'out', account: 'b', fund: 'c' },
        },
      ],
    });
    for (const one of saved.value.entries) ids[one.title] = one.id;
    const bank = await claude.call<{ computed: { balance: number } }>('get', { id: ids.Banque });
    expect(bank.value.computed.balance).toBe(385000);
    const wrong = await claude.call<{ error: string }>('save', {
      entries: [
        { id: ids.Loyer, data: { state: 'cancelled' } },
        { id: ids.Loyer, data: { state: 'paid' } },
      ],
    });
    expect(wrong.isError).toBe(true);
    expect(wrong.value.error).toMatch(/cannot go from « cancelled » to « paid »/);
  });

  it('warns when a fund overspends, and the rule can be tried', async () => {
    await claude.call('save', {
      entries: [
        {
          kind: 'Transaction',
          title: 'Supermarché',
          data: {
            amount: 8000,
            date: `${month}-03`,
            direction: 'out',
            account: ids.Banque,
            fund: ids.Courses,
          },
        },
      ],
    });
    const reminders = await claude.call<{ title: string }[]>('find', { kind: 'Reminder' });
    expect(reminders.value[0]?.title).toMatch(/^Courses : 3\s000$/);
    const tried = await claude.call<{ result: { matched: boolean } }>('rule_test', {
      rule: 'Fund overspent',
      entry: ids['Marché'],
    });
    expect(tried.value.result.matched).toBe(true);
  });

  it('draws its page in Claude, and through her account', async () => {
    const pages = await claude.call<{ pages: { id: string; title: string }[] }>('page', {
      app: 'Finances',
    });
    expect(pages.isError).toBe(false);
    const raw = await claude.client.callTool({
      name: 'page',
      arguments: { name: 'Month overview' },
    });
    const drawn = raw.structuredContent as {
      id: string;
      label: { fr: string };
      vocabulary: Record<string, { fields: Record<string, { label: { fr: string } }> }>;
      blocks: { block: string; value?: unknown; error?: string }[];
    };
    expect(drawn.blocks.filter((one) => one.error)).toEqual([]);
    expect(drawn.label.fr).toBe('Vue du mois');
    expect(drawn.vocabulary.Transaction?.fields.amount?.label.fr).toBe('Montant');
    expect(drawn.blocks[0]).toMatchObject({ block: 'stat', value: 377000 });
    expect(drawn.blocks[1]).toMatchObject({ block: 'stat_delta', value: 23000 });
    ids.page = drawn.id;

    const rest = await ama.json<{ blocks: unknown[] }>(`/api/pages/${drawn.id}?month=1999-01`);
    expect(rest.status).toBe(200);
    expect(rest.body.blocks[1]).toMatchObject({ value: 0 });
    const list = await ama.json<{ title: string }[]>('/api/pages?app=Finances');
    expect(list.body.map((one) => one.title)).toEqual(['Month overview', 'Accounts']);
  });

  it('imports a statement with its script, in QuickJS, tried first', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob(
        ['date;label;amount\n2026-10-05;Boulangerie;-1200\n2026-10-06;Remboursement;5000\n'],
        { type: 'text/csv' },
      ),
      'releve.csv',
    );
    const uploaded = await ama.call('/api/files', { method: 'POST', body: form });
    const file = (await uploaded.json()) as { entryId: string };
    expect(uploaded.status).toBe(201);
    const tried = await claude.call<{ result: { saved: { created: number } } }>('run_script', {
      script: 'Statement import',
      file: file.entryId,
      params: { account: 'Banque' },
    });
    expect(tried.isError).toBe(false);
    expect(tried.value.result.saved.created).toBe(2);
    expect(
      (await claude.call<unknown[]>('find', { kind: 'Transaction', text: 'Boulangerie' })).value,
    ).toHaveLength(0);
    await claude.call('run_script', {
      script: 'Statement import',
      file: file.entryId,
      params: { account: 'Banque' },
      dryRun: false,
    });
    const bank = await claude.call<{ computed: { balance: number } }>('get', { id: ids.Banque });
    expect(bank.value.computed.balance).toBe(377000 - 1200 + 5000);
  });

  it('stops a script that never ends', async () => {
    await claude.call('save', {
      entries: [
        {
          kind: 'Script',
          title: 'Loop',
          data: { writes: ['Note'], code: 'function run() { while (true) {} }', timeout: 300 },
        },
      ],
    });
    const stopped = await claude.call<{ error: string }>('run_script', { script: 'Loop' });
    expect(stopped.isError).toBe(true);
    expect(stopped.value.error).toMatch(/longer than its limit/);
  });

  it('migrates a kind, tried first', async () => {
    const tried = await claude.call<{ result: { changed: number } }>('migrate', {
      kind: 'Transaction',
      steps: [{ set: { field: 'note', formula: "'checked'" } }],
    });
    expect(tried.value.result.changed).toBe(5);
    expect(
      (await claude.call<{ data: Record<string, unknown> }>('get', { id: ids.Salaire })).value.data,
    ).not.toHaveProperty('note');
  });

  it('frames its page and an entry’s record in her web account', async () => {
    const page = await (await ama.call(`/app/frame/page/${ids.page}`)).text();
    expect(page).toContain('Month overview');
    const record = await (await ama.call(`/app/frame/record/${ids.Banque}`)).text();
    expect(record).toContain('transactions');
    expect((await server.app.request(`/app/frame/page/${ids.page}`)).status).toBe(302);
  });
});
