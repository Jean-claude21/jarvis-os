import { beforeAll, describe, expect, it } from 'vitest';
import {
  exportMarkdown,
  find,
  get,
  history,
  importMarkdown,
  query,
  readMarkdown,
  save,
  undo,
  type MarkdownDoc,
} from '../src';
import { person, type Person } from './people';

// Spec 007: her life leaves and enters as Markdown (decision 0007).
const folder: MarkdownDoc[] = [
  {
    path: 'vie/2026/2026-09/journal/2026-09-01.md',
    text: '# Journal — 2026-09-01\n\n## Résumé\n\nUn jour avec [Christian](../../../../personnes/famille/christian.md).\n',
  },
  {
    path: 'personnes/famille/christian.md',
    text: "---\ncercle: 2\nderniere-interaction: 2026-08-06\n---\n# Christian\n\nMon frère. Voir [[Toujours s'associer]].\n",
  },
  {
    path: 'arbre/resolutions/toujours-s-associer.md',
    text: "---\nmandat: [communion]\ntrigger: always-on\n---\n# Toujours s'associer\n\nÀ plusieurs.\n",
  },
  {
    path: 'cultures/permis/_carte.md',
    text: "---\nkind: apprentissage\nstade: croissance\n---\n# Permis\n\nLe code d'abord. [Hors du dossier](../../ailleurs.md)\n",
  },
  {
    path: 'cultures/permis/timeline.md',
    text: '# Timeline du permis\n\n- 2026-10-01 — inscrit.\n',
  },
];
const kinds = { personnes: 'Personne', journal: 'Journal' };

describe('reading a Markdown file', () => {
  it('takes the kind from the front matter, the named folders, else the parent folder', () => {
    expect(readMarkdown(folder[3]!, kinds).kind).toBe('apprentissage');
    expect(readMarkdown(folder[3]!, { apprentissage: 'Apprentissage' }).kind).toBe('Apprentissage');
    expect(readMarkdown(folder[1]!, kinds).kind).toBe('Personne');
    expect(readMarkdown(folder[2]!, kinds).kind).toBe('Resolution');
    expect(readMarkdown({ path: 'inbox.md', text: 'brut' }).kind).toBe('Note');
    expect(readMarkdown({ path: 'vie/2026-10/x.md', text: 'x' }).kind).toBe('Note');
  });

  it('takes the title from the heading, the date from the name, the fields as read', () => {
    const journal = readMarkdown(folder[0]!, kinds);
    expect(journal.title).toBe('Journal — 2026-09-01');
    expect(journal.data).toMatchObject({ date: '2026-09-01', source: folder[0]!.path });
    expect(journal.data.text).toContain('## Résumé');
    expect(journal.data.text).not.toContain('# Journal');
    const christian = readMarkdown(folder[1]!, kinds);
    expect(christian.data).toMatchObject({ cercle: 2, 'derniere-interaction': '2026-08-06' });
    expect(Object.values(christian.origin).every((one) => one === 'read')).toBe(true);
    expect(readMarkdown({ path: 'notes/sans-titre.md', text: 'rien' }).title).toBe('sans titre');
  });

  it('keeps a front matter that is not YAML in the text', () => {
    const odd = readMarkdown({ path: 'a.md', text: '---\n: : [\n---\n# A\n' });
    expect(odd.data.text).toContain(': : [');
  });
});

describe('importing a Markdown folder', () => {
  let ama: Person;
  let journalId: number;

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, { entries: [{ kind: 'personne', title: 'Afi' }] }),
    );
  });

  it('makes an entry per file and links them, the kinds as she first wrote them', async () => {
    const report = await ama.as((tx) =>
      importMarkdown(tx, ama.actor, ama.space, { docs: folder, kinds, name: 'Life OS' }),
    );
    expect(report).toMatchObject({ created: 5, updated: 0, unchanged: 0, links: 3, unresolved: 1 });
    journalId = report.journalId!;
    const [christian] = await ama.as((tx) => find(tx, ama.space, { text: 'Christian frère' }));
    expect(christian!.kind).toBe('personne');
    const card = await ama.as((tx) => get(tx, ama.space, christian!.id));
    expect(card!.links.out.map((one) => one.entry.title)).toEqual(["Toujours s'associer"]);
    expect(card!.links.in.map((one) => [one.role, one.entry.kind])).toEqual([
      ['mentions', 'Journal'],
    ]);
    const [timeline] = await ama.as((tx) => find(tx, ama.space, { text: 'Timeline du permis' }));
    const part = await ama.as((tx) => get(tx, ama.space, timeline!.id));
    expect(part!.links.out.map((one) => [one.role, one.entry.title])).toEqual([
      ['part_of', 'Permis'],
    ]);
    const counted = await ama.as((tx) =>
      query(tx, {
        spaceIds: [ama.space],
        sql: "select count(*)::int as n from my_entries where data->>'source' like 'vie/%'",
      }),
    );
    expect(counted.rows[0]).toEqual({ n: 1 });
  });

  it('reads the same folder again without adding anything twice', async () => {
    const changed = folder.map((doc) =>
      doc.path.endsWith('christian.md')
        ? { ...doc, text: doc.text.replace('cercle: 2', 'cercle: 3') }
        : doc,
    );
    const again = await ama.as((tx) =>
      importMarkdown(tx, ama.actor, ama.space, { docs: changed, kinds }),
    );
    expect(again).toMatchObject({ created: 0, updated: 1, unchanged: 4, links: 0 });
    const [christian] = await ama.as((tx) => find(tx, ama.space, { text: 'Christian' }));
    expect(christian!.data.cercle).toBe(3);
    // The second import is undone on its own: Christian is back in the second circle.
    await ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: again.journalId! }));
    const [back] = await ama.as((tx) => find(tx, ama.space, { text: 'Christian' }));
    expect(back!.data.cercle).toBe(2);
  });

  it('writes the space back as a folder that reads the same', async () => {
    const files = await ama.as((tx) => exportMarkdown(tx, ama.space));
    const paths = files.map((one) => one.path);
    expect(paths).toContain('personnes/famille/christian.md');
    expect(paths).toContain('personne/afi.md');
    const christian = files.find((one) => one.path === 'personnes/famille/christian.md')!;
    expect(christian.content).toMatch(/^---\nkind: personne\nid: ent_/);
    expect(christian.content).toContain(
      "- mentions : [Toujours s'associer](../../arbre/resolutions/toujours-s-associer.md)",
    );

    // Into another person's space, the export makes the same entries and the same links.
    const kossi = await person('Kossi');
    const docs = files.map((one) => ({ path: one.path, text: String(one.content) }));
    const report = await kossi.as((tx) => importMarkdown(tx, kossi.actor, kossi.space, { docs }));
    expect(report).toMatchObject({ created: 6, links: 3 });
    const read = await kossi.as((tx) => exportMarkdown(tx, kossi.space));
    const strip = (text: string) => text.replace(/^id: .*$/m, '');
    expect(read.map((one) => [one.path, strip(String(one.content))])).toEqual(
      files.map((one) => [one.path, strip(String(one.content))]),
    );
  });

  it('is undone at once: its entries set aside, its links gone, journaled', async () => {
    await ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId }));
    const left = await ama.as((tx) => find(tx, ama.space, {}));
    expect(left.map((one) => one.title)).toEqual(['Afi']);
    const lines = await ama.as((tx) => history(tx, ama.space, { limit: 1 }));
    expect(lines[0]).toMatchObject({ command: 'journal.undo', after: { undoes: journalId } });
    await expect(
      ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId })),
    ).rejects.toThrow(/already undone/);
  });
});
