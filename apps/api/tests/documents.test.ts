import { beforeAll, describe, expect, it } from 'vitest';
import { server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 008: documents written from Claude section by section, read in a view, printed, downloaded.
let account: Account;
let ama: Connected;

interface Written {
  id: string;
  size: number;
  outline: { title: string; level: number }[];
  link: string;
}

beforeAll(async () => {
  account = await signUp('Ama');
  ama = await connect(account);
});

describe('documents from a client', () => {
  let doc: Written;

  it('writes a theory, then adds to it section by section', async () => {
    doc = (
      await ama.call<Written>('write_document', {
        kind: 'Théorie',
        title: 'Théorie du royaume',
        text: '# Théorie du royaume\n\nL’ouverture.\n\n## Fondement\n\nLa parole.',
      })
    ).value;
    expect(doc.outline.map((one) => one.title)).toEqual(['Théorie du royaume', 'Fondement']);
    expect(doc.link).toMatch(/^http:\/\/localhost:3700\/document\/[\w-]+\.[\w-]+$/);

    const added = await ama.call<Written>('edit_document', {
      id: doc.id,
      action: 'append',
      text: '## Application\n\nAu quotidien, **chaque jour**.',
    });
    expect(added.value.outline.map((one) => one.title)).toContain('Application');
    const refused = await ama.call<{ error: string }>('edit_document', {
      id: doc.id,
      action: 'replace_section',
      text: 'x',
    });
    expect(refused).toMatchObject({
      isError: true,
      value: { error: '« replace_section » needs « section ».' },
    });
  });

  it('reads it in its view, with its versions', async () => {
    const tools = await ama.client.listTools();
    expect(tools.tools.find((one) => one.name === 'read_document')?._meta).toEqual({
      ui: { resourceUri: 'ui://jarvis/document' },
    });
    const read = (await ama.client.callTool({
      name: 'read_document',
      arguments: { id: doc.id, sections: ['Application'] },
    })) as { content: { text: string }[]; structuredContent: Record<string, unknown> };
    expect(JSON.parse(read.content[0]!.text)).toMatchObject({
      kind: 'Théorie',
      partial: true,
      text: '## Application\n\nAu quotidien, **chaque jour**.',
      versions: 2,
    });
    expect(read.structuredContent.html).toBe(
      '<h2 id="application">Application</h2>\n<p>Au quotidien, <strong>chaque jour</strong>.</p>',
    );
  });

  it('opens by its link as a page to print, or as its Markdown file; a forged link opens nothing', async () => {
    const path = new URL(doc.link).pathname;
    const page = await server.app.request(path);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<title>Théorie du royaume</title>');
    // The page draws its data, every « < » of it escaped.
    expect(html).toContain('strong>chaque jour');
    expect(html).not.toContain('<strong>chaque jour');

    const file = await server.app.request(`${path}?format=md`);
    expect(file.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(file.headers.get('content-disposition')).toContain('theorie-du-royaume.md');
    expect(await file.text()).toMatch(/^# Théorie du royaume\n\nL’ouverture\./);

    expect((await server.app.request(`${path.slice(0, -3)}abc`)).status).toBe(410);
  });

  it('never lets a script of her text run in the view', async () => {
    const written = await ama.call<Written>('write_document', {
      title: 'Piège',
      text: '<script>alert(1)</script> [lien](javascript:alert(1))',
    });
    const read = (await ama.client.callTool({
      name: 'read_document',
      arguments: { id: written.value.id },
    })) as unknown as { structuredContent: { html: string } };
    expect(read.structuredContent.html).not.toContain('<script>');
    expect(read.structuredContent.html).not.toContain('javascript:');
  });
});
