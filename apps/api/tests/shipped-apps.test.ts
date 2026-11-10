import { describe, expect, it } from 'vitest';
import { shippedApps } from '../src/apps';
import { signUp } from './client';

// The catalog of the mockup: every app Jarvis ships installs in one space next to the others, and
// every block of its pages computes (no formula or query it cannot read).
describe('the shipped apps', () => {
  it('ships the catalog of the mockup', () => {
    expect(shippedApps.map((one) => one.app)).toEqual(
      expect.arrayContaining([
        'Finances',
        'Routines',
        'Santé',
        'Projets',
        'Relations',
        'Lecture',
        'Maison',
        'Garanties',
        'Journal',
      ]),
    );
  });

  it('installs each one, and draws each of its pages without an error', async () => {
    const ama = await signUp('Ama');
    for (const app of shippedApps) {
      const installed = await ama.json<{ error?: string }>('/api/apps/install', {
        name: app.app,
        dryRun: false,
      });
      expect(installed.status, `${app.app}: ${installed.body.error ?? ''}`).toBe(200);
    }
    const pages = await ama.json<{ id: string; title: string; app: string | null }[]>('/api/pages');
    expect(pages.body.length).toBeGreaterThanOrEqual(
      shippedApps.reduce((n, one) => n + (one.pages?.length ?? 0), 0),
    );
    for (const page of pages.body) {
      const drawn = await ama.json<{ blocks: { title: unknown; error?: string }[] }>(
        `/api/pages/${page.id}`,
      );
      expect(drawn.status, page.title).toBe(200);
      const failed = drawn.body.blocks
        .filter((one) => one.error)
        .map((one) => `${page.app} · ${JSON.stringify(one.title)}: ${one.error}`);
      expect(failed).toEqual([]);
    }
  });
});
