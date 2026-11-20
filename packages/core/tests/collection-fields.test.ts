import { describe, expect, it } from 'vitest';
import { changeCollection, createCollection, find, modelsOf, save } from '../src';
import { person } from './people';

// v3 D4: a collection's fields changed on screen. A field renamed keeps its stored name and its
// values; one taken off the model leaves its values on the entries; a formula stays as it was.
describe('a collection’s fields, changed', () => {
  it('renames, retypes, adds and takes off fields; her values stay', async () => {
    const ama = await person('Ama');
    await ama.as((tx) =>
      createCollection(tx, ama.actor, ama.space, {
        kind: 'Lecture',
        label: 'Lecture',
        app: 'Livres',
        fields: [
          { name: 'auteur', label: 'Auteur', type: 'text' },
          { name: 'note', label: 'Note', type: 'number' },
          { name: 'resume', label: 'Résumé', type: 'long_text' },
        ],
      }),
    );
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { kind: 'Lecture', title: 'Le Petit Prince', data: { auteur: 'Saint-Exupéry', note: 5 } },
        ],
      }),
    );
    await ama.as((tx) =>
      changeCollection(tx, ama.actor, ama.space, 'Lecture', {
        fields: [
          { name: 'auteur', label: 'Écrit par', type: 'text' },
          { name: 'note', label: 'Étoiles', type: 'rating' },
          { name: '', label: 'Genre', type: 'choice', options: ['roman', 'essai'] },
        ],
      }),
    );
    const model = (await ama.as((tx) => modelsOf(tx, ama.space))).find(
      (m) => m.kind === 'Lecture',
    )!;
    expect(model.fields.map((f) => [f.name, f.type, f.label?.fr])).toEqual([
      ['auteur', 'text', 'Écrit par'],
      ['note', 'rating', 'Étoiles'],
      ['genre', 'choice', 'Genre'],
    ]);
    const [book] = await ama.as((tx) => find(tx, ama.space, { kind: 'Lecture' }));
    expect(book?.data).toMatchObject({ auteur: 'Saint-Exupéry', note: 5 });

    await expect(
      ama.as((tx) =>
        changeCollection(tx, ama.actor, ama.space, 'Lecture', {
          fields: [{ name: '', label: 'Genre', type: 'choice' }],
        }),
      ),
    ).rejects.toThrow(/give its options/);
  });
});
