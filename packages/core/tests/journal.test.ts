import { beforeAll, describe, expect, it } from 'vitest';
import { archive, find, get, history, save, undo } from '../src';
import { person, type Person } from './people';

// Spec 001, story 3: every change journaled with its before and after, and undoable once.
let ama: Person;

beforeAll(async () => {
  ama = await person('Ama');
});

const lastChange = (target: string) =>
  ama.as(async (tx) => (await history(tx, ama.space, { target, limit: 1 }))[0]!);

describe('undoing a change (story 3)', () => {
  it('puts a corrected amount back, with its origin, and journals the undo', async () => {
    const [taxi] = (
      await ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [{ kind: 'Dépense', title: 'Taxi', data: { montant: 2000 }, origin: 'read' }],
        }),
      )
    ).entries;
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ id: taxi!.id, data: { montant: 2500 }, origin: 'said' }],
      }),
    );
    const correction = await lastChange(taxi!.id);
    expect(correction).toMatchObject({
      command: 'entry.update',
      before: { data: { montant: 2000 }, origin: { montant: 'read' } },
      after: { data: { montant: 2500 }, origin: { montant: 'said' } },
      actor: ama.id,
      door: 'test',
    });
    const done = await ama.as((tx) =>
      undo(tx, ama.actor, { spaceId: ama.space, journalId: correction.id }),
    );
    const read = await ama.as((tx) => get(tx, ama.space, taxi!.id));
    expect(read).toMatchObject({ data: { montant: 2000 }, origin: { montant: 'read' } });
    const lines = await ama.as((tx) => history(tx, ama.space, { target: taxi!.id }));
    expect(lines.map((line) => line.command)).toEqual([
      'journal.undo',
      'entry.update',
      'entry.create',
    ]);
    expect(lines[1]!.undoneBy).toBe(done.by);
  });

  it('brings back an entry set aside, and sets aside an entry whose creation is undone', async () => {
    const [note] = (
      await ama.as((tx) =>
        save(tx, ama.actor, ama.space, { entries: [{ kind: 'Note', title: 'Appeler maman' }] }),
      )
    ).entries;
    await ama.as((tx) => archive(tx, ama.actor, { spaceId: ama.space, id: note!.id }));
    expect(await ama.as((tx) => find(tx, ama.space, { text: 'appeler maman' }))).toEqual([]);
    const archived = await lastChange(note!.id);
    await ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: archived.id }));
    expect(
      (await ama.as((tx) => find(tx, ama.space, { text: 'appeler maman' }))).map((one) => one.id),
    ).toEqual([note!.id]);

    const created = (await ama.as((tx) => history(tx, ama.space, { target: note!.id }))).find(
      (line) => line.command === 'entry.create',
    )!;
    await ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: created.id }));
    expect((await ama.as((tx) => get(tx, ama.space, note!.id)))!.archivedAt).not.toBeNull();
  });

  it('takes a link away, and refuses to undo twice or to undo an undo', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { ref: 'a', kind: 'Démarche', title: 'Titre de séjour' },
          { ref: 'b', kind: 'Fichier', title: 'passeport.jpg' },
        ],
        links: [{ from: 'b', to: 'a', role: 'pièce de' }],
      }),
    );
    const added = await lastChange(saved.links[0]!.id);
    expect(added.command).toBe('link.add');
    const done = await ama.as((tx) =>
      undo(tx, ama.actor, { spaceId: ama.space, journalId: added.id }),
    );
    expect((await ama.as((tx) => get(tx, ama.space, saved.entries[0]!.id)))!.links.in).toEqual([]);
    await expect(
      ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: added.id })),
    ).rejects.toThrow(/already undone/);
    await expect(
      ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: done.by })),
    ).rejects.toThrow(/cannot be undone/);
  });
});
