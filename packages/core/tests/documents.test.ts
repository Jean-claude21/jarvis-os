import { beforeAll, describe, expect, it } from 'vitest';
import { applyEdit, outline, readDocument, undo, writeDocument } from '../src';
import { person, type Person } from './people';

// Spec 008: a document is written and changed section by section, read the same way, each change a
// version she can go back from.
const theory = `# La théorie

L'ouverture.

## Pourquoi

Parce que.

### Détail

Un détail.

## Comment

\`\`\`
## pas un titre
\`\`\`

Ainsi.
`;

describe('the outline and the edits', () => {
  it('finds the sections, their levels and extents, never a heading in code', () => {
    expect(outline(theory).map((one) => [one.level, one.title])).toEqual([
      [1, 'La théorie'],
      [2, 'Pourquoi'],
      [3, 'Détail'],
      [2, 'Comment'],
    ]);
    const why = outline(theory)[1]!;
    expect(theory.slice(why.start, why.end)).toContain('Un détail.');
    expect(theory.slice(why.start, why.end)).not.toContain('Comment');
  });

  it('appends, replaces, inserts by section; replaces a passage found once', () => {
    expect(applyEdit(theory, { action: 'append', text: '## Fin\n\nVoilà.' })).toMatch(
      /Ainsi\.\n\n## Fin\n\nVoilà\.\n$/,
    );
    const replaced = applyEdit(theory, {
      action: 'replace_section',
      section: 'pourquoi',
      text: '## Pourquoi\n\nParce que c’est vrai.',
    });
    expect(replaced).toContain('Parce que c’est vrai.\n\n## Comment');
    expect(replaced).not.toContain('Un détail.');
    expect(
      applyEdit(theory, { action: 'insert_after', section: 'Détail', text: '### Exemple\n\nUn.' }),
    ).toContain('Un détail.\n\n### Exemple\n\nUn.\n\n## Comment');
    expect(
      applyEdit(theory, { action: 'append', section: 'Pourquoi', text: 'Et encore.' }),
    ).toContain('Un détail.\n\nEt encore.\n\n## Comment');
    expect(applyEdit(theory, { action: 'replace_text', find: 'Ainsi.', text: 'Donc.' })).toContain(
      'Donc.',
    );
    expect(() =>
      applyEdit(theory, { action: 'replace_section', section: 'Nulle part', text: 'x' }),
    ).toThrow(/No section « Nulle part »\. Sections: # La théorie/);
    expect(() => applyEdit(theory, { action: 'replace_text', find: '## ', text: 'x' })).toThrow(
      /more than once/,
    );
  });
});

describe('a document in her life', () => {
  let ama: Person;
  let id: string;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('is written, changed by a section, read by its sections, each change a version', async () => {
    id = (
      await ama.as((tx) =>
        writeDocument(tx, ama.actor, ama.space, {
          kind: 'Théorie',
          title: 'La théorie',
          text: theory,
        }),
      )
    ).id;
    const changed = await ama.as((tx) =>
      writeDocument(tx, ama.actor, ama.space, {
        id,
        edit: { action: 'append', section: 'Comment', text: 'Puis.' },
      }),
    );
    expect(changed.outline.map((one) => one.title)).toEqual([
      'La théorie',
      'Pourquoi',
      'Détail',
      'Comment',
    ]);
    const part = await ama.as((tx) => readDocument(tx, ama.space, { id, sections: ['Détail'] }));
    expect(part).toMatchObject({
      kind: 'Théorie',
      partial: true,
      text: '### Détail\n\nUn détail.',
    });
    const whole = await ama.as((tx) => readDocument(tx, ama.space, { id }));
    expect(whole.text).toContain('Ainsi.\n\nPuis.');
    expect(whole.versions.map((one) => one.undone)).toEqual([false, false]);

    // Going back before the change brings the earlier text again.
    await ama.as((tx) =>
      undo(tx, ama.actor, { spaceId: ama.space, journalId: whole.versions[0]!.journalId }),
    );
    const back = await ama.as((tx) => readDocument(tx, ama.space, { id }));
    expect(back.text).not.toContain('Puis.');
  });

  it('gives a long one by its opening and outline, until she asks for more', async () => {
    const long = `# Long\n\nDébut.\n\n## Une\n\n${'a'.repeat(30_000)}\n\n## Deux\n\n${'b'.repeat(30_000)}\n`;
    const made = await ama.as((tx) =>
      writeDocument(tx, ama.actor, ama.space, { title: 'Long', text: long }),
    );
    const read = await ama.as((tx) => readDocument(tx, ama.space, { id: made.id }));
    expect(read).toMatchObject({ kind: 'Document', partial: true, text: '# Long\n\nDébut.\n\n' });
    expect(read.outline.map((one) => one.title)).toEqual(['Long', 'Une', 'Deux']);
  });
});
