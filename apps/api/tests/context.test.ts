import { beforeAll, describe, expect, it } from 'vitest';
import { signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 029 through her account and Claude: until it reads her context, every answer reminds it;
// `context` gives her day, what changed since, and her charters in full; she sees when it read it.
let ama: Account;
let claude: Connected;

beforeAll(async () => {
  ama = await signUp('Ama');
  await ama.json('/api/save', {
    entries: [
      {
        kind: 'Charter',
        title: 'Ma charte',
        data: { text: 'Toujours me tutoyer. Ne jamais proposer de dépense le dimanche.' },
      },
      {
        kind: 'Reminder',
        title: 'Appeler maman',
        data: { at: '2026-11-01T08:00', status: 'failed' },
      },
    ],
  });
  claude = await connect(ama);
});

const texts = (result: { content: { type: string; text: string }[] }) =>
  result.content.map((one) => one.text);

describe('the charter received whole', () => {
  it('reminds an assistant that has not read her context', async () => {
    const result = (await claude.client.callTool({ name: 'kinds', arguments: {} })) as {
      content: { type: string; text: string }[];
    };
    expect(texts(result).at(-1)).toContain('Call `context` now');
  });

  it('gives her day, what changed, and her charters in full, then stops reminding', async () => {
    const read = await claude.call<{
      now: { date: string; weekday: string; zone: string };
      day: { toFix: { title: string }[] };
      changedSinceYouLastRead: { count: number; changes: { title: string }[] };
      charters: { title: string; text: string }[];
      routines: { name: string }[];
    }>('context');
    expect(read.isError).toBe(false);
    expect(read.value.now.weekday).toBeTruthy();
    expect(read.value.day.toFix.map((one) => one.title)).toContain('Appeler maman');
    expect(read.value.charters).toContainEqual(
      expect.objectContaining({
        title: 'Ma charte',
        text: 'Toujours me tutoyer. Ne jamais proposer de dépense le dimanche.',
      }),
    );
    expect(read.value.changedSinceYouLastRead.changes.map((one) => one.title)).toContain(
      'Ma charte',
    );
    expect(read.value.routines.length).toBeGreaterThan(0);

    const after = (await claude.client.callTool({ name: 'kinds', arguments: {} })) as {
      content: { type: string; text: string }[];
    };
    expect(texts(after).join('\n')).not.toContain('Call `context` now');
  });

  it('shows what changed since, not what this assistant did itself', async () => {
    await claude.call('save', { entries: [{ kind: 'Note', title: 'Par Claude' }] });
    await ama.json('/api/save', { entries: [{ kind: 'Note', title: 'Par elle' }] });
    const read = await claude.call<{ changedSinceYouLastRead: { changes: { title: string }[] } }>(
      'context',
    );
    const titles = read.value.changedSinceYouLastRead.changes.map((one) => one.title);
    expect(titles).toContain('Par elle');
    expect(titles).not.toContain('Par Claude');
  });
});
