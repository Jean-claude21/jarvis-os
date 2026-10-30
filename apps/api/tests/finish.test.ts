import { beforeAll, describe, expect, it } from 'vitest';
import { server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 015 through her account and Claude: views, areas, her time zone, Telegram, personal keys,
// the sql block, refusals she can read.
let ama: Account;
let claude: Connected;
const ids: Record<string, string> = {};

beforeAll(async () => {
  ama = await signUp('Ama');
  claude = await connect(ama);
  await ama.json('/api/apps/install', { name: 'Finances', dryRun: false });
  const saved = await ama.json<{ entries: { title: string; id: string }[] }>('/api/save', {
    entries: [
      { ref: 'b', kind: 'Account', title: 'Banque', data: { type: 'bank', opening_balance: 1000 } },
      { ref: 'c', kind: 'Fund', title: 'Courses', data: { monthly_budget: 500 } },
      {
        kind: 'Transaction',
        title: 'Marché',
        data: { amount: 300, date: '2026-10-12', direction: 'out', account: 'b', fund: 'c' },
      },
      {
        kind: 'Transaction',
        title: 'Salaire',
        data: { amount: 2000, date: '2026-10-01', direction: 'in', account: 'b' },
      },
      { kind: 'Bill', title: 'Loyer', data: { amount: 700, due: '2026-11-05' } },
    ],
  });
  for (const one of saved.body.entries) ids[one.title] = one.id;
});

describe('views', () => {
  it('run, filtered through a link, as a table and a kanban', async () => {
    const table = await ama.json<{
      rows: { title: string }[];
      types: string[];
      totals: Record<string, number>;
    }>('/api/views/run', {
      view: {
        kind: 'Transaction',
        filters: [{ field: 'fund.title', op: 'eq', value: 'Courses' }],
        columns: ['amount'],
      },
    });
    expect(table.status).toBe(200);
    expect(table.body.rows.map((row) => row.title)).toEqual(['Marché']);
    expect(table.body.totals).toEqual({ amount: 300 });
    expect(table.body.types).toEqual(['table', 'kanban', 'calendar', 'timeline']);
    const kanban = await claude.call<{ kanban: { by: string; columns: { name: string }[] } }>(
      'view',
      { view: { kind: 'Bill', type: 'kanban' } },
    );
    expect(kanban.value.kanban.columns.map((column) => column.name)).toEqual([
      'to_pay',
      'paid',
      'cancelled',
    ]);
  });

  it('are kept and listed by app', async () => {
    await ama.json('/api/save', {
      entries: [
        {
          kind: 'View',
          title: 'Out',
          data: {
            kind: 'Transaction',
            app: 'Finances',
            filters: [{ field: 'direction', op: 'eq', value: 'out' }],
          },
        },
      ],
    });
    const views = await ama.json<{ id: string; title: string }[]>('/api/views?app=Finances');
    expect(views.body.map((one) => one.title)).toEqual(['Out']);
    const run = await ama.json<{ rows: unknown[] }>('/api/views/run', { id: views.body[0]!.id });
    expect(run.body.rows).toHaveLength(1);
  });
});

describe('areas', () => {
  it('file an app in her words', async () => {
    const filed = await ama.json<{ models: number }>('/api/apps/area', {
      app: 'Finances',
      area: 'Personnel',
    });
    expect(filed.body.models).toBe(5);
    const kinds = await ama.json<{ kind: string; model?: { area?: string } }[]>('/api/kinds');
    expect(kinds.body.find((one) => one.kind === 'Account')?.model?.area).toBe('Personnel');
  });
});

describe('her settings', () => {
  it('keep her time zone, Paris until she says', async () => {
    expect((await ama.json<{ zone: string }>('/api/me/zone')).body.zone).toBe('Europe/Paris');
    expect((await ama.json('/api/me/zone', { zone: 'Mars/Olympus' })).status).toBe(400);
    expect(
      (await ama.json<{ zone: string }>('/api/me/zone', { zone: 'Africa/Abidjan' })).body.zone,
    ).toBe('Africa/Abidjan');
    expect((await ama.json<{ zone: string }>('/api/me/zone')).body.zone).toBe('Africa/Abidjan');
  });

  it('say when Telegram is not set up', async () => {
    const saved = process.env.JARVIS_TELEGRAM_BOT_TOKEN;
    delete process.env.JARVIS_TELEGRAM_BOT_TOKEN;
    const refused = await ama.json<{ error: string; code: string }>('/api/me/telegram', {});
    if (saved) process.env.JARVIS_TELEGRAM_BOT_TOKEN = saved;
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('telegram');
  });

  it('make a personal key that acts as her, until revoked', async () => {
    const made = await ama.json<{ key: string; id: string }>('/api/me/keys', {
      name: 'Jarvis desktop',
    });
    expect(made.status).toBe(201);
    expect(made.body.key).toMatch(/^jos_/);
    const asKey = (path: string) =>
      server.app.request(path, { headers: { authorization: `Bearer ${made.body.key}` } });
    const me = await asKey('/api/me');
    expect(me.status).toBe(200);
    expect(((await me.json()) as { person: { email: string } }).person.email).toBe(ama.email);
    const keys = await ama.json<{ name: string; lastUsedAt: string | null }[]>('/api/me/keys');
    expect(keys.body[0]).toMatchObject({ name: 'Jarvis desktop' });
    expect(keys.body[0]?.lastUsedAt).not.toBeNull();
    await ama.call(`/api/me/keys/${made.body.id}`, { method: 'DELETE' });
    expect((await asKey('/api/me')).status).toBe(401);
    expect(
      (await server.app.request('/api/me', { headers: { authorization: 'Bearer jos_nothing' } }))
        .status,
    ).toBe(401);
  });
});

describe('a page', () => {
  it('draws an sql block with its filter', async () => {
    const saved = await ama.json<{ entries: { id: string }[] }>('/api/save', {
      entries: [
        {
          kind: 'Page',
          title: 'Raw',
          data: {
            filters: [{ name: 'month', type: 'month', default: '2026-10' }],
            blocks: [
              {
                block: 'sql',
                chart: 'number',
                sql: "select count(*) as n from my_entries where kind = 'Transaction' and left(data->>'date', 7) = {month}",
              },
            ],
          },
        },
      ],
    });
    const drawn = await ama.json<{ blocks: { columns: string[]; rows: { n: string }[] }[] }>(
      `/api/pages/${saved.body.entries[0]!.id}`,
    );
    expect(drawn.body.blocks[0]?.rows).toEqual([{ n: '2' }]);
  });
});

describe('a refusal', () => {
  it('says its kind, for the app to say it in her language', async () => {
    const refused = await ama.json<{ error: string; code: string }>('/api/save', {
      entries: [{ kind: 'Transaction', title: 'X', data: { prix: 3 } }],
    });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('model');
    const workflow = await ama.json<{ code: string }>('/api/save', {
      entries: [
        { id: ids.Loyer, data: { state: 'cancelled' } },
        { id: ids.Loyer, data: { state: 'paid' } },
      ],
    });
    expect(workflow.body.code).toBe('workflow');
  });
});
