import { beforeAll, describe, expect, it } from 'vitest';
import { find, get, history, kinds, save, spacesOf, undo } from '../src';
import { person, type Person } from './people';

// Spec 001, story 5: one life is never another's — row-level security, not the code's goodwill.
let ama: Person;
let kossi: Person;
let passport: string;

beforeAll(async () => {
  ama = await person('Ama');
  kossi = await person('Kossi');
  passport = (
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { kind: 'Passeport', title: 'Passeport togolais', data: { numero: 'TG1234567' } },
        ],
      }),
    )
  ).entries[0]!.id;
});

describe('one life is never another’s (story 5)', () => {
  it('lets Kossi see only his own space', async () => {
    expect((await kossi.as((tx) => spacesOf(tx))).map((one) => one.id)).toEqual([kossi.space]);
  });

  it('shows Kossi nothing of Ama’s space', async () => {
    expect(await kossi.as((tx) => find(tx, ama.space, {}))).toEqual([]);
    expect(await kossi.as((tx) => kinds(tx, ama.space))).toEqual([]);
    expect(await kossi.as((tx) => get(tx, ama.space, passport))).toBeNull();
    expect(await kossi.as((tx) => history(tx, ama.space))).toEqual([]);
  });

  it('lets Kossi change nothing of Ama’s space', async () => {
    await expect(
      kossi.as((tx) =>
        save(tx, kossi.actor, ama.space, { entries: [{ kind: 'Note', title: 'Intrus' }] }),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      kossi.as((tx) =>
        save(tx, kossi.actor, ama.space, { entries: [{ id: passport, data: { numero: 'X' } }] }),
      ),
    ).rejects.toThrow(/No entry/);
    const [mine] = (
      await kossi.as((tx) =>
        save(tx, kossi.actor, kossi.space, {
          entries: [{ ref: 'k', kind: 'Note', title: 'À moi' }],
        }),
      )
    ).entries;
    await expect(
      kossi.as((tx) =>
        save(tx, kossi.actor, kossi.space, {
          links: [{ from: mine!.id, to: passport, role: 'vole' }],
        }),
      ),
    ).rejects.toThrow(/No entry/);
    const amaLine = (await ama.as((tx) => history(tx, ama.space, { limit: 1 })))[0]!;
    await expect(
      kossi.as((tx) => undo(tx, kossi.actor, { spaceId: ama.space, journalId: amaLine.id })),
    ).rejects.toThrow(/No change/);
    expect((await ama.as((tx) => get(tx, ama.space, passport)))!.data).toEqual({
      numero: 'TG1234567',
    });
  });
});
