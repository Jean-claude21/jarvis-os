import { beforeAll, describe, expect, it } from 'vitest';
import { signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 033 through Claude: the shipped Finances app installed with its role; Claude then sees it
// in its context, and asks Jarvis which apps a sentence touches.
let ama: Account;
let claude: Connected;

beforeAll(async () => {
  ama = await signUp('Ama');
  claude = await connect(ama);
  const installed = await claude.call<{ result: { created: string[] } }>('app_install', {
    name: 'Finances',
    dryRun: false,
  });
  expect(installed.value.result.created).toContain('App « Finances »');
});

describe('her apps, linked', () => {
  it('shows each app in her context, one line', async () => {
    const read = await claude.call<{ apps: string[] }>('context');
    expect(read.value.apps).toEqual([expect.stringContaining('« Finances »: Ton argent')]);
  });

  it('says which apps a sentence touches, what to ask, and what to write', async () => {
    const touched = await claude.call<
      {
        app: string;
        because: string[];
        ask: string[];
        fields: Record<string, { name: string }[]>;
      }[]
    >('which_apps', { text: "J'ai acheté du riz pour 3500 FCFA au marché" });
    expect(touched.isError).toBe(false);
    expect(touched.value).toEqual([
      expect.objectContaining({
        app: 'Finances',
        because: expect.arrayContaining(['acheté', 'fcfa']),
      }),
    ]);
    expect(touched.value[0]!.ask[0]).toContain('compte');
    expect(touched.value[0]!.fields.Transaction!.map((one) => one.name)).toEqual(
      expect.arrayContaining(['amount', 'direction', 'account']),
    );
  });

  it('lists the bridges of the space through the apps family', async () => {
    const bridges = await claude.call<unknown[]>('bridge', {});
    expect(bridges.isError).toBe(false);
    expect(bridges.value).toEqual([]);
  });
});
