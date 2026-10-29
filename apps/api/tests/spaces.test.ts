import type { Space } from '@jarvis-os/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 004: Ama and Kossi share « Nous » through Claude; each keeps « Moi ». A client reaches only
// the spaces she allowed it; the charter of each space reaches the client.
let amaAccount: Account;
let kossiAccount: Account;
let ama: Connected;
let nous: Space;

const tokenOf = (link: string) => link.slice(link.indexOf('#') + 1);

beforeAll(async () => {
  amaAccount = await signUp('Ama');
  kossiAccount = await signUp('Kossi');
  ama = await connect(amaAccount, 'claude-ama');
});

describe('a shared space through Claude (stories 1 and 2)', () => {
  it('creates « Nous », which this client then reaches', async () => {
    const made = await ama.call<Space>('create_space', { name: 'Nous' });
    expect(made.isError).toBe(false);
    nous = made.value;
    const reached = await amaAccount.json<Space[]>('/api/clients/claude-ama/spaces');
    expect(reached.body.map((one) => one.name)).toEqual(['Ama', 'Nous']);
  });

  it('invites Kossi by a link he accepts with his own address, never into « Moi »', async () => {
    const own = await ama.call<{ error: string }>('invite', {
      space: 'Ama',
      email: kossiAccount.email,
    });
    expect(own.isError).toBe(true);
    expect(own.value.error).toContain('private');

    const invited = await ama.call<{ link: string }>('invite', {
      space: 'nous',
      email: kossiAccount.email,
    });
    expect(invited.value.link).toMatch(/^http:\/\/localhost:3700\/invitation#.{20,}$/);
    const token = tokenOf(invited.value.link);

    const preview = await server.app.request('/invitation/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    expect(await preview.json()).toEqual({
      spaceName: 'Nous',
      email: kossiAccount.email,
      state: 'open',
    });
    const page = await server.app.request('/invitation');
    expect(await page.text()).toContain('/api/invitations/accept');

    const someoneElse = await signUp('Afi');
    const refused = await someoneElse.json<{ error: string }>('/api/invitations/accept', { token });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toContain('another address');

    const joined = await kossiAccount.json<Space>('/api/invitations/accept', { token });
    expect(joined.body).toMatchObject({ id: nous.id, name: 'Nous', role: 'member' });
  });

  it('files in the space named, and sums over every space this client reaches', async () => {
    await ama.call('save', {
      space: 'Nous',
      entries: [{ kind: 'Dépense', title: 'Loyer', data: { montant: 80000 } }],
    });
    await ama.call('save', {
      entries: [{ kind: 'Dépense', title: 'Cadeau secret', data: { montant: 15000 } }],
    });
    const both = await ama.call<{ rows: { space: string; total: string }[] }>('query', {
      sql: "select space, sum((data->>'montant')::int) as total from my_entries group by space order by space",
    });
    expect(both.value.rows).toEqual([
      { space: 'Ama', total: '15000' },
      { space: 'Nous', total: '80000' },
    ]);

    const kossiSees = await kossiAccount.json<{ title: string }[]>('/api/entries?space=Nous');
    expect(kossiSees.body.map((one) => one.title)).toEqual(['Loyer']);
    const kossiQuery = await kossiAccount.json<{ rows: { title: string }[] }>('/api/query', {
      sql: 'select title from my_entries order by title',
    });
    expect(kossiQuery.body.rows).toEqual([{ title: 'Loyer' }]);
  });

  it('lists the spaces with who belongs, by name', async () => {
    const listed = await ama.call<{ name: string; members: string[] }[]>('spaces');
    expect(listed.value.find((one) => one.name === 'Nous')!.members).toEqual(['Ama', 'Kossi']);
  });
});

describe('a client reaches only what she allowed (story 3)', () => {
  it('keeps a new client to her own space, refusing « Nous » by name', async () => {
    const kossi = await connect(kossiAccount, 'chatgpt-kossi');
    const refused = await kossi.call<{ error: string }>('find', { space: 'Nous' });
    expect(refused.isError).toBe(true);
    expect(refused.value.error).toContain('No space « Nous » reachable');
    const sees = await kossi.call<{ rows: unknown[] }>('query', {
      sql: 'select * from my_entries',
    });
    expect(sees.value.rows).toEqual([]);
  });

  it('lets her allow it « Nous », and nothing that is not hers', async () => {
    const all = await kossiAccount.json<Space[]>('/api/spaces');
    const allowed = await kossiAccount.json<Space[]>(
      '/api/clients/chatgpt-kossi/spaces',
      { spaces: all.body.map((one) => one.id) },
      'PUT',
    );
    expect(allowed.body.map((one) => one.name)).toEqual(['Kossi', 'Nous']);
    const kossi = await connect(kossiAccount, 'chatgpt-kossi');
    const found = await kossi.call<{ title: string }[]>('find', { space: 'Nous' });
    expect(found.value.map((one) => one.title)).toEqual(['Loyer']);

    const amaOwn = (await amaAccount.json<Space[]>('/api/spaces')).body.find(
      (one) => one.personal,
    )!;
    const stolen = await kossiAccount.json<{ error: string }>(
      '/api/clients/chatgpt-kossi/spaces',
      { spaces: [amaOwn.id] },
      'PUT',
    );
    expect(stolen.status).toBe(400);
  });
});

describe('the charter of a space (story 4)', () => {
  it('reaches the client in its instructions, named by its space', async () => {
    await ama.call('save', {
      space: 'Nous',
      entries: [
        {
          kind: 'Charte',
          title: 'Charte du foyer',
          data: {
            texte: 'La dîme sort en premier. Une dépense au-delà de 50 000 se décide à deux.',
          },
        },
      ],
    });
    await ama.call('save', {
      space: 'Nous',
      entries: [
        {
          kind: 'Routine',
          title: 'Bilan du dimanche',
          data: { quand: 'le dimanche soir', consigne: 'Revoir la semaine à deux.' },
        },
      ],
    });
    const again = await connect(amaAccount, 'claude-ama');
    const instructions = again.client.getInstructions() ?? '';
    expect(instructions).toContain('### « Nous » — Charte du foyer');
    expect(instructions).toContain('La dîme sort en premier.');
    expect(instructions).toContain('« Bilan du dimanche » (in « Nous »)');
    expect(instructions).toContain('« Ama »: her own space, private for good');
  });
});

describe('leaving « Nous » (story 1)', () => {
  it('lets Kossi leave; Ama keeps everything', async () => {
    const left = await kossiAccount.json(`/api/spaces/${nous.id}/members/me`, undefined, 'DELETE');
    expect(left.status).toBe(200);
    const kossiSees = await kossiAccount.json<{ error: string }>('/api/entries?space=Nous');
    expect(kossiSees.status).toBe(400);
    const amaSees = await amaAccount.json<{ title: string }[]>(
      '/api/entries?space=Nous&kind=Dépense',
    );
    expect(amaSees.body.map((one) => one.title)).toEqual(['Loyer']);
  });
});
