import { beforeAll, describe, expect, it } from 'vitest';
import { signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 017 through her account and Claude: a list with its own days and folders, its statistics,
// entries filed at once, a kind renamed and grouped.
let ama: Account;
let claude: Connected;

beforeAll(async () => {
  ama = await signUp('Ama');
  claude = await connect(ama);
  await ama.json('/api/save', {
    entries: [
      { kind: 'Prière', title: 'Prière 2026-10-28', data: { date: '2026-10-28' } },
      { kind: 'Prière', title: 'Prière 2026-10-27', data: { date: '2026-10-27' } },
      {
        kind: 'Bilan',
        title: 'Bilan W33',
        data: { source: 'vie/2026/2026-08/bilans/W33.md' },
      },
      { kind: 'document', title: 'Notions', data: { source: 'cultures/permis/notions.md' } },
    ],
  });
});

describe('a list', () => {
  it('gives each entry its own day and folder, and its statistics', async () => {
    const list = await ama.json<{ rows: { title: string; day: string; folder: string }[] }>(
      '/api/list?kind=Bilan',
    );
    expect(list.body.rows).toEqual([
      expect.objectContaining({ day: '2026-08-10', folder: 'vie/2026/2026-08/bilans' }),
    ]);
    const stats = await ama.json<{ total: number; streak: { best: number } }>(
      '/api/list/stats?kind=Pri%C3%A8re',
    );
    expect(stats.body).toEqual(
      expect.objectContaining({ total: 2, streak: expect.objectContaining({ best: 2 }) }),
    );
    const viaClaude = await claude.call<{ total: number }>('stats', { kind: 'Prière' });
    expect(viaClaude.value.total).toBe(2);
  });

  it('files entries at once', async () => {
    const list = await ama.json<{ rows: { id: string }[] }>('/api/list?kind=Pri%C3%A8re');
    const filed = await ama.json('/api/entries/bulk', {
      ids: list.body.rows.map((one) => one.id),
      folder: 'Spirituel/Prière',
    });
    expect(filed.status).toBe(200);
    const inFolder = await ama.json<{ total: number }>('/api/list?folder=Spirituel');
    expect(inFolder.body.total).toBe(2);
    const nothing = await ama.json<{ code: string }>('/api/entries/bulk', { ids: ['x'] });
    expect(nothing.status).toBe(400);
  });
});

describe('her kinds', () => {
  it('are renamed and grouped, by her or by Claude', async () => {
    const renamed = await ama.json<{ kind: string }>('/api/kinds/rename', {
      from: 'document',
      to: 'Document',
    });
    expect(renamed.body.kind).toBe('Document');
    await claude.call('group_kind', { kind: 'Prière', group: 'Spirituel' });
    const kinds = await ama.json<{ kind: string; group: string | null }[]>('/api/kinds');
    expect(kinds.body.find((one) => one.kind === 'Prière')?.group).toBe('Spirituel');
    expect(kinds.body.map((one) => one.kind)).toContain('Document');
  });
});
