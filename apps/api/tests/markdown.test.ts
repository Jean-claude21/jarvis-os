import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { markdownOf } from '../src/markdown';
import { signUp, type Account } from './client';

// Spec 007: her data, hers — a space out as a zip of Markdown, a Markdown folder in.
let ama: Account;

/** The files of a zip whose files are stored as they are (what `zip` writes). */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength;
    files.set(name, new TextDecoder().decode(bytes.subarray(start, start + size)));
    at = start + size;
  }
  return files;
}

beforeAll(async () => {
  ama = await signUp('Ama');
});

describe('a Markdown folder in, a zip out', () => {
  it('imports a folder through the API, then exports it with her files beside', async () => {
    const imported = await ama.json<{ created: number; links: number }>('/api/import', {
      docs: [
        { path: 'personnes/kossi.md', text: '---\ncercle: 1\n---\n# Kossi\n\nVoir [[Mariage]].' },
        { path: 'cultures/mariage/_carte.md', text: '---\nkind: parcours\n---\n# Mariage\n' },
      ],
      kinds: { personnes: 'Personne' },
    });
    expect(imported).toMatchObject({ status: 201, body: { created: 2, links: 1 } });

    const form = new FormData();
    form.set('file', new File(['Bon pour accord'], 'accord signé.txt', { type: 'text/plain' }));
    expect((await ama.call('/api/files', { method: 'POST', body: form })).status).toBe(201);

    const response = await ama.call('/api/export');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    const files = unzip(new Uint8Array(await response.arrayBuffer()));
    expect([...files.keys()]).toEqual([
      'cultures/mariage/_carte.md',
      'fichier/accord-signe-txt.md',
      'fichier/accord-signe.txt',
      'personnes/kossi.md',
    ]);
    expect(files.get('personnes/kossi.md')).toContain(
      '- mentionne : [Mariage](../cultures/mariage/_carte.md)',
    );
    expect(files.get('fichier/accord-signe.txt')).toBe('Bon pour accord');
  });

  it('refuses a path that leaves the folder', async () => {
    const refused = await ama.json('/api/import', {
      docs: [{ path: '../dehors.md', text: '# Dehors' }],
    });
    expect(refused.status).toBe(400);
  });
});

describe('the Markdown files of a folder', () => {
  const root = mkdtempSync(join(tmpdir(), 'jarvis-md-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('leaves out code projects, hidden folders, node_modules and what she skips', () => {
    const put = (path: string, text = '# x') => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    put('inbox.md');
    put('vie/journal/2026-09-01.md');
    put('cultures/app/package.json', '{}');
    put('cultures/app/README.md');
    put('cultures/app/docs/guide.md');
    put('.claude/skills/x.md');
    put('node_modules/y/readme.md');
    put('_archive/old.md');
    put('vie/photo.jpg', 'jpg');
    expect(markdownOf(root, ['_archive']).map((doc) => doc.path)).toEqual([
      'inbox.md',
      'vie/journal/2026-09-01.md',
    ]);
  });
});
