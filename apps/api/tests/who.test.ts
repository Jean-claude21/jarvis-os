import type { AttentionItem, Space } from '@jarvis-os/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 038: in a shared space, a thing says for whom — a member by her name, « moi », or nobody in
// particular; each sees in « Maintenant » what is hers, and what is for nobody.
let ama: Account;
let kossi: Account;
let claude: Connected;
let nous: Space;

beforeAll(async () => {
  ama = await signUp('Ama');
  kossi = await signUp('Kossi');
  claude = await connect(ama, 'claude-who');
  nous = (await claude.call<Space>('create_space', { name: 'Nous' })).value;
  const invited = await claude.call<{ link: string }>('invite', {
    space: 'Nous',
    email: kossi.email,
  });
  const token = invited.value.link.slice(invited.value.link.indexOf('#') + 1);
  await kossi.json('/api/invitations/accept', { token });
});

describe('for whom', () => {
  it('keeps the member named, and shows each what is hers', async () => {
    const soon = new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 16);
    const saved = await claude.call<{ entries: { id: string }[] }>('save', {
      space: 'Nous',
      entries: [
        {
          kind: 'Task',
          title: 'Sortir les poubelles',
          data: { at: soon, status: 'planned', who: 'Kossi' },
        },
        {
          kind: 'Task',
          title: 'Payer le loyer',
          data: { at: soon, status: 'planned', who: 'moi' },
        },
        {
          kind: 'Task',
          title: 'Acheter du pain',
          data: { at: soon, status: 'planned', who: 'personne' },
        },
      ],
    });
    expect(saved.isError).toBe(false);
    const titles = async (account: Account) =>
      (await account.json<{ items: AttentionItem[] }>('/api/now')).body.items
        .filter((one) => one.spaceId === nous.id)
        .map((one) => one.title)
        .sort();
    expect(await titles(ama)).toEqual(['Acheter du pain', 'Payer le loyer']);
    expect(await titles(kossi)).toEqual(['Acheter du pain', 'Sortir les poubelles']);
    const entry = await ama.json<{ data: { who: string } }>(
      `/api/entries/${saved.value.entries[0]!.id}?space=${nous.id}`,
    );
    expect(entry.body.data.who).not.toBe('Kossi');
    expect(entry.body.data.who).toMatch(/\w{8,}/);
  });

  it('says so for a name that is no member', async () => {
    const wrong = await claude.call<{ error: string }>('save', {
      space: 'Nous',
      entries: [{ kind: 'Task', title: 'Réparer le vélo', data: { who: 'Afi' } }],
    });
    expect(wrong.isError).toBe(true);
    expect(wrong.value.error).toContain('no member of this space');
  });
});
