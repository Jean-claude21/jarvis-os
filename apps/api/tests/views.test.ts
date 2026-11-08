import { beforeAll, describe, expect, it } from 'vitest';
import { settingsFor } from '../src/settings';
import { uploadToken } from '../src/views/upload';
import { server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 005: Jarvis's views inside the clients (MCP Apps) and files sent by link, never through the
// model. Each tool still answers in words for hosts without views.
let account: Account;
let ama: Connected;
let person: string;

const SECRET = settingsFor('test').authSecret;

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
const callRaw = (name: string, args: Record<string, unknown>) =>
  ama.client.callTool({ name, arguments: args }) as Promise<ToolResult>;

beforeAll(async () => {
  account = await signUp('Ama');
  ama = await connect(account);
  person = (await account.json<{ person: { id: string } }>('/api/me')).body.person.id;
  await ama.call('save', {
    entries: [
      {
        kind: 'Dépense',
        title: 'Taxi',
        data: { montant: 2000, poste: 'Transport', mois: '2026-09' },
      },
      {
        kind: 'Dépense',
        title: 'Marché',
        data: { montant: 12000, poste: 'Repas', mois: '2026-10' },
      },
      {
        kind: 'Dépense',
        title: 'Zem',
        data: { montant: 500, poste: 'Transport', mois: '2026-10' },
      },
    ],
  });
});

describe('the views are MCP Apps (decision 0006)', () => {
  it('declares three ui:// views, each an HTML page that speaks to its host', async () => {
    const { resources } = await ama.client.listResources();
    expect(resources.map((one) => [one.uri, one.mimeType])).toEqual(
      expect.arrayContaining([
        ['ui://jarvis/dashboard', 'text/html;profile=mcp-app'],
        ['ui://jarvis/entry', 'text/html;profile=mcp-app'],
        ['ui://jarvis/upload', 'text/html;profile=mcp-app'],
      ]),
    );
    const read = await ama.client.readResource({ uri: 'ui://jarvis/upload' });
    const view = read.contents[0] as unknown as {
      text: string;
      _meta: { ui: { csp: { connectDomains: string[] } } };
    };
    expect(view.text).toContain("'ui/initialize'");
    expect(view.text).toContain('#b83a1b');
    expect(view._meta.ui.csp.connectDomains).toEqual(['http://localhost:3700']);
  });

  it('names its view on each tool that has one', async () => {
    const { tools } = await ama.client.listTools();
    const viewOf = (name: string) =>
      (tools.find((one) => one.name === name)?._meta as { ui?: { resourceUri?: string } })?.ui
        ?.resourceUri;
    expect(viewOf('dashboard')).toBe('ui://jarvis/dashboard');
    expect(viewOf('show_entry')).toBe('ui://jarvis/entry');
    expect(viewOf('upload_link')).toBe('ui://jarvis/upload');
    expect(viewOf('save')).toBeUndefined();
  });
});

describe('a dashboard recomputed on each open', () => {
  it('draws widgets given once, in words and in data, a failing query saying why', async () => {
    const result = await callRaw('dashboard', {
      title: 'Mes dépenses',
      widgets: [
        {
          title: 'Total',
          query: "select sum((data->>'montant')::int) as total from my_entries",
          chart: 'number',
        },
        {
          title: 'Par poste',
          query:
            "select data->>'poste' as poste, sum((data->>'montant')::int) as total from my_entries group by 1 order by 2 desc",
          chart: 'bar',
        },
        { title: 'Cassé', query: 'select nope from my_entries', chart: 'table' },
      ],
    });
    expect(result.isError).toBeFalsy();
    const widgets = result.structuredContent!.widgets as { rows: unknown[]; error?: string }[];
    expect(widgets[0]!.rows).toEqual([{ total: '14500' }]);
    expect(widgets[1]!.rows).toEqual([
      { poste: 'Repas', total: '12000' },
      { poste: 'Transport', total: '2500' },
    ]);
    expect(widgets[2]!.error).toContain('nope');
    expect(result.content[0]!.text).toContain('## Par poste (bar)');
  });

  it('opens a saved dashboard by name, with figures of now', async () => {
    await ama.call('save', {
      entries: [
        {
          kind: 'Dashboard',
          title: 'Budget du mois',
          data: {
            widgets: [
              {
                title: 'Par mois',
                query:
                  "select data->>'mois' as mois, sum((data->>'montant')::int) as total from my_entries where kind = 'Dépense' group by 1 order by 1",
                chart: 'line',
              },
            ],
          },
        },
      ],
    });
    const before = await callRaw('dashboard', { name: 'budget' });
    expect((before.structuredContent!.widgets as { rows: unknown[] }[])[0]!.rows).toEqual([
      { mois: '2026-09', total: '2000' },
      { mois: '2026-10', total: '12500' },
    ]);
    await ama.call('save', {
      entries: [{ kind: 'Dépense', title: 'Pain', data: { montant: 500, mois: '2026-10' } }],
    });
    const after = await callRaw('dashboard', { name: 'Budget du mois' });
    expect((after.structuredContent!.widgets as { rows: unknown[] }[])[0]!.rows).toEqual([
      { mois: '2026-09', total: '2000' },
      { mois: '2026-10', total: '13000' },
    ]);
    const missing = await callRaw('dashboard', { name: 'Inexistant' });
    expect(missing.isError).toBe(true);
  });
});

describe('an entry as a card', () => {
  it('gives the entry, its space and its history to the view', async () => {
    const saved = await ama.call<{ entries: { id: string }[] }>('save', {
      entries: [{ kind: 'Passeport', title: 'Passeport', data: { expire: '2029-03-14' } }],
    });
    const id = saved.value.entries[0]!.id;
    await ama.call('save', { entries: [{ id, data: { numero: 'TG1234567' }, origin: 'read' }] });
    const card = await callRaw('show_entry', { id });
    const data = card.structuredContent as {
      entry: { title: string; origin: Record<string, string> };
      history: { command: string }[];
      space: string;
    };
    expect(data.entry.title).toBe('Passeport');
    expect(data.entry.origin.numero).toBe('read');
    expect(data.history.map((line) => line.command)).toEqual(['entry.update', 'entry.create']);
    expect(data.space).toBe('Ama');
  });
});

describe('files by link, never through the model', () => {
  it('gives a link where a file goes straight into her space, linked', async () => {
    const saved = await ama.call<{ entries: { id: string }[] }>('save', {
      entries: [{ kind: 'Démarche', title: 'Titre de séjour' }],
    });
    const demarche = saved.value.entries[0]!.id;
    const link = await callRaw('upload_link', { links: [{ to: demarche, role: 'pièce de' }] });
    const url = (link.structuredContent as { url: string }).url;
    expect(url).toMatch(/^http:\/\/localhost:3700\/upload\/[\w-]+\.[\w-]+$/);
    const path = new URL(url).pathname;

    const page = await server.app.request(path);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('window.JARVIS_DATA');

    const form = new FormData();
    form.append(
      'file',
      new File(['Récépissé TGO-2026-48213'], 'recepisse.txt', { type: 'text/plain' }),
    );
    const sent = await server.app.request(path, { method: 'POST', body: form });
    expect(sent.status).toBe(201);
    const { entryId } = (await sent.json()) as { entryId: string };
    const entry = await ama.call<{
      kind: string;
      links: { out: { role: string; entry: { id: string } }[] };
    }>('get', { id: entryId });
    expect(entry.value.kind).toBe('Fichier');
    expect(entry.value.links.out[0]).toMatchObject({ role: 'pièce de', entry: { id: demarche } });
    const found = await ama.call<{ id: string }[]>('find', { text: 'TGO-2026-48213' });
    expect(found.value.map((one) => one.id)).toContain(entryId);
  });

  it('refuses a forged or expired link', async () => {
    const space = (await account.json<{ space: { id: string } }>('/api/me')).body.space.id;
    const form = () => {
      const body = new FormData();
      body.append('file', new File(['x'], 'x.txt', { type: 'text/plain' }));
      return body;
    };
    const forged = uploadToken(
      { person, spaceId: space, links: [], until: Date.now() + 60_000 },
      'another-secret',
    );
    expect(
      (await server.app.request(`/upload/${forged}`, { method: 'POST', body: form() })).status,
    ).toBe(410);
    const expired = uploadToken(
      { person, spaceId: space, links: [], until: Date.now() - 1 },
      SECRET,
    );
    const refused = await server.app.request(`/upload/${expired}`, {
      method: 'POST',
      body: form(),
    });
    expect(refused.status).toBe(410);
    expect(((await refused.json()) as { error: string }).error).toContain('expired');
  });
});
