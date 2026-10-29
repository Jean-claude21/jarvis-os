import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { mcpServerFor } from '../src/mcp';
import { server, signUp, type Account } from './client';

// Spec 003, stories 2 and 3: every tool over the core, Jarvis's method on connection, and one
// person's tools never reaching another's life. In memory: the OAuth flow has its own test.

interface Connected {
  client: Client;
  call: <T = unknown>(
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ value: T; isError: boolean }>;
}

async function connect(account: Account): Promise<Connected> {
  const me = await account.json<{ person: { id: string; name: string }; space: { id: string } }>(
    '/api/me',
  );
  const mcp = await mcpServerFor(
    { db: server.db, blobs: server.blobs, today: () => '2026-10-29' },
    {
      person: me.body.person.id,
      name: me.body.person.name,
      spaceId: me.body.space.id,
      client: 'test',
    },
  );
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverSide);
  const client = new Client({ name: 'jarvis-test', version: '1.0.0' });
  await client.connect(clientSide);
  const call = async <T>(name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as {
      content: { text: string }[];
      isError?: boolean;
    };
    return { value: JSON.parse(result.content[0]!.text) as T, isError: result.isError === true };
  };
  return { client, call };
}

let ama: Connected;
let kossi: Connected;

beforeAll(async () => {
  const amaAccount = await signUp('Ama');
  await amaAccount.json('/api/save', {
    entries: [
      {
        kind: 'Routine',
        title: 'Dépenses',
        data: {
          quand: 'elle note une dépense',
          consigne: 'Toujours un poste parmi Transport, Repas, Logement.',
        },
      },
    ],
  });
  ama = await connect(amaAccount);
  kossi = await connect(await signUp('Kossi'));
});

describe('Jarvis’s method on connection (story 3)', () => {
  it('gives the instructions with Jarvis’s routines and hers', () => {
    const instructions = ama.client.getInstructions() ?? '';
    expect(instructions).toContain('Golden rules');
    expect(instructions).toContain('Today is 2026-10-29');
    expect(instructions).toContain('« Ranger ce qui arrive »');
    expect(instructions).toContain('« Le temps »');
    expect(instructions).toContain('« Dépenses » (hers)');
  });

  it('lists every tool, and reads a routine in full', async () => {
    const { tools } = await ama.client.listTools();
    expect(tools.map((one) => one.name).sort()).toEqual(
      [
        'add_file',
        'archive',
        'file_link',
        'find',
        'get',
        'history',
        'kinds',
        'query',
        'routine',
        'save',
        'undo',
      ].sort(),
    );
    const base = await ama.call<{ text: string }>('routine', { name: 'Le temps' });
    expect(base.value.text).toContain('Rappel');
    const hers = await ama.call<{ text: string }>('routine', { name: 'dépenses' });
    expect(hers.value.text).toContain('Transport, Repas, Logement');
    const none = await ama.call<{ error: string }>('routine', { name: 'Inconnue' });
    expect(none.isError).toBe(true);
    expect(none.value.error).toContain('Ranger ce qui arrive');
  });
});

describe('her life through the tools (story 2)', () => {
  it('saves, finds, gets, sums, corrects, undoes and sets aside', async () => {
    const saved = await ama.call<{ entries: { id: string }[] }>('save', {
      entries: [
        {
          ref: 'taxi',
          kind: 'Dépense',
          title: 'Taxi',
          data: { montant: 2000, poste: 'Transport' },
        },
        { ref: 'cash', kind: 'Compte', title: 'Espèces' },
      ],
      links: [{ from: 'taxi', to: 'cash', role: 'payé avec' }],
    });
    expect(saved.isError).toBe(false);
    const taxi = saved.value.entries[0]!.id;

    const kinds = await ama.call<{ kind: string }[]>('kinds');
    expect(kinds.value.map((one) => one.kind)).toEqual(
      expect.arrayContaining(['Dépense', 'Compte', 'Routine']),
    );
    const found = await ama.call<{ id: string }[]>('find', { text: 'taxi' });
    expect(found.value.map((one) => one.id)).toEqual([taxi]);
    const entry = await ama.call<{ links: { out: { role: string }[] } }>('get', { id: taxi });
    expect(entry.value.links.out[0]!.role).toBe('payé avec');
    const sum = await ama.call<{ rows: { total: string }[] }>('query', {
      sql: "select sum((data->>'montant')::int) as total from my_entries where kind = 'Dépense'",
    });
    expect(sum.value.rows).toEqual([{ total: '2000' }]);

    await ama.call('save', { entries: [{ id: taxi, data: { montant: 2500 } }] });
    const lines = await ama.call<{ id: number; command: string; door: string; client: string }[]>(
      'history',
      {
        target: taxi,
      },
    );
    expect(lines.value[0]).toMatchObject({ command: 'entry.update', door: 'mcp', client: 'test' });
    await ama.call('undo', { journalId: lines.value[0]!.id });
    const back = await ama.call<{ data: { montant: number } }>('get', { id: taxi });
    expect(back.value.data.montant).toBe(2000);

    await ama.call('archive', { id: taxi });
    expect((await ama.call<unknown[]>('find', { text: 'taxi' })).value).toEqual([]);
  });

  it('keeps a small file linked to its démarche, and opens it through a link', async () => {
    const saved = await ama.call<{ entries: { id: string }[] }>('save', {
      entries: [{ kind: 'Démarche', title: 'Titre de séjour' }],
    });
    const demarche = saved.value.entries[0]!.id;
    const text = 'Récépissé — référence TGO-2026-48213';
    const stored = await ama.call<{ entryId: string }>('add_file', {
      name: 'recepisse.txt',
      mediaType: 'text/plain',
      base64: Buffer.from(text).toString('base64'),
      data: { reference: 'TGO-2026-48213' },
      origin: 'read',
      links: [{ to: demarche, role: 'pièce de' }],
    });
    expect(stored.isError).toBe(false);
    const entry = await ama.call<{ kind: string; origin: Record<string, string> }>('get', {
      id: stored.value.entryId,
    });
    expect(entry.value.kind).toBe('Fichier');
    expect(entry.value.origin.reference).toBe('read');
    const link = await ama.call<{ url: string }>('file_link', {
      entryId: stored.value.entryId,
      seconds: 120,
    });
    expect(await (await fetch(link.value.url)).text()).toBe(text);
  });

  it('refuses a file over 5 MB with the way to send it', async () => {
    const big = await ama.call<{ error: string }>('add_file', {
      name: 'gros.bin',
      mediaType: 'application/octet-stream',
      base64: Buffer.alloc(6 * 1024 * 1024).toString('base64'),
    });
    expect(big.isError).toBe(true);
    expect(big.value.error).toContain('/api/files');
  });

  it('never reaches Ama’s life with Kossi’s tools', async () => {
    const amaEntries = await ama.call<{ id: string }[]>('find', { kind: 'Démarche' });
    const target = amaEntries.value[0]!.id;
    const read = await kossi.call<{ error: string }>('get', { id: target });
    expect(read.isError).toBe(true);
    expect((await kossi.call<unknown[]>('find', { kind: 'Démarche' })).value).toEqual([]);
    const query = await kossi.call<{ rows: unknown[] }>('query', {
      sql: 'select * from my_entries',
    });
    expect(query.value.rows).toEqual([]);
    const write = await kossi.call('save', { entries: [{ id: target, title: 'Volé' }] });
    expect(write.isError).toBe(true);
  });
});
