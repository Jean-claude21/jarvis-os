import { beforeAll, describe, expect, it } from 'vitest';
import { comment, commentsOf, save } from '../src';
import { person, type Person } from './people';

// Spec 039: a note on an entry, as she wrote it, by her, the oldest first.
describe('notes on an entry', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('keeps her notes on an entry, linked to it, the oldest first', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, { entries: [{ kind: 'Project', title: 'Potager' }] }),
    );
    const id = saved.entries[0]!.id;
    await ama.as((tx) => comment(tx, ama.actor, ama.space, id, 'Tomates en mars'));
    await ama.as((tx) => comment(tx, ama.actor, ama.space, id, 'Arroser le soir'));
    const notes = await ama.as((tx) => commentsOf(tx, ama.space, id));
    expect(notes.map((one) => [one.data.text, one.data.by, one.origin.text])).toEqual([
      ['Tomates en mars', ama.id, 'said'],
      ['Arroser le soir', ama.id, 'said'],
    ]);
    await expect(ama.as((tx) => comment(tx, ama.actor, ama.space, id, '  '))).rejects.toThrow(
      /needs words/,
    );
  });
});
