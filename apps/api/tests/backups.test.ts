import type { Space } from '@jarvis-os/core';
import { describe, expect, it } from 'vitest';
import { backupSpace } from '../src/backups';
import { server, signUp } from './client';

// Spec 022 through her account: her space's backup of the night, listed, opened by its link, the
// Markdown of her entries inside.
describe('the nightly backup of her space', () => {
  it('is made, listed, and opens with her entries inside', async () => {
    const ama = await signUp('Ama');
    await ama.json('/api/save', {
      entries: [{ kind: 'Note', title: 'Cuisiner du riz', data: { text: 'Avec des oignons.' } }],
    });
    const me = await ama.json<{ person: { id: string } }>('/api/me');
    const spaces = await ama.json<Space[]>('/api/spaces');
    const own = spaces.body.find((one) => one.personal)!;
    const made = await backupSpace(
      server.db,
      server.blobs,
      { spaceId: own.id, person: me.body.person.id },
      '2026-11-09',
    );
    expect(made.files).toBeGreaterThan(0);
    const list = await ama.json<{ day: string; size: number }[]>('/api/backups');
    expect(list.body).toEqual([expect.objectContaining({ day: '2026-11-09', size: made.size })]);
    const link = await ama.json<{ url: string }>('/api/backups/2026-11-09/link');
    const bytes = new Uint8Array(await (await fetch(link.body.url)).arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('Cuisiner du riz');
    expect(text).toContain('Avec des oignons.');
    expect((await ama.json('/api/backups/2026-11-08/link')).status).toBe(404);
  });
});
