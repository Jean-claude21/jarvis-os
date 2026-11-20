import { describe, expect, it } from 'vitest';
import {
  acceptInvitation,
  comment,
  commentsOf,
  examplesOf,
  createSharedSpace,
  find,
  get,
  history,
  invite,
  membersOf,
  save,
  setRole,
} from '../src';
import { person } from './people';

// v3 F7: an owner opens a member some kinds of a shared space only; the database keeps the rest
// from her — the entries, their links, and the journal lines that carry their values.
describe('what a member sees, by kind', () => {
  it('opens her some kinds only, and the database keeps the rest from her', async () => {
    const ama = await person('Ama');
    const kossi = await person('Kossi');
    const home = await ama.as((tx) => createSharedSpace(tx, ama.actor, { name: 'Maison' }));
    const { token } = await ama.as((tx) =>
      invite(tx, ama.actor, { spaceId: home.id, email: 'kossi@jarvis.test' }),
    );
    await kossi.as((tx) =>
      acceptInvitation(tx, kossi.actor, { token, email: 'kossi@jarvis.test' }),
    );
    const made = await ama.as((tx) =>
      save(tx, ama.actor, home.id, {
        entries: [
          { ref: 'c', kind: 'Courses', title: 'Riz', data: { qty: 2 } },
          { ref: 't', kind: 'Transaction', title: 'Loyer', data: { amount: 250000 } },
        ],
        links: [{ from: 'c', to: 't', role: 'payé par' }],
      }),
    );
    const [riz, loyer] = made.entries.map((one) => one.id) as [string, string];
    const kinds = async () =>
      (await kossi.as((tx) => find(tx, home.id, { limit: 50 }))).map((one) => one.kind).sort();
    expect(await kinds()).toEqual(['Courses', 'Transaction']);

    // Only the owner opens or closes.
    await expect(
      kossi.as((tx) =>
        setRole(tx, kossi.actor, {
          spaceId: home.id,
          person: kossi.id,
          role: 'member',
          kinds: ['Courses'],
        }),
      ),
    ).rejects.toThrow(/Only an owner/);
    await ama.as((tx) =>
      setRole(tx, ama.actor, {
        spaceId: home.id,
        person: kossi.id,
        role: 'member',
        kinds: ['courses'],
      }),
    );
    expect(
      (await ama.as((tx) => membersOf(tx, home.id))).find((one) => one.person === kossi.id)?.kinds,
    ).toEqual(['courses']);

    // She sees « Courses » only: not the rent, not the link to it, not its journal lines — and
    // how the space is built (a model), which she cannot change.
    expect(await kinds()).toEqual(['Courses']);
    expect(await kossi.as((tx) => get(tx, home.id, loyer))).toBeNull();
    expect((await kossi.as((tx) => get(tx, home.id, riz)))?.links.out).toEqual([]);
    const lines = await kossi.as((tx) => history(tx, home.id, { limit: 50 }));
    expect(lines.some((line) => JSON.stringify(line).includes('250000'))).toBe(false);
    expect(lines.some((line) => JSON.stringify(line).includes('Riz'))).toBe(true);

    // She writes what is opened to her, and nothing else.
    await kossi.as((tx) =>
      save(tx, kossi.actor, home.id, { entries: [{ kind: 'Courses', title: 'Huile' }] }),
    );
    await expect(
      kossi.as((tx) =>
        save(tx, kossi.actor, home.id, { entries: [{ kind: 'Transaction', title: 'Retrait' }] }),
      ),
    ).rejects.toThrow();
    await expect(
      kossi.as((tx) =>
        save(tx, kossi.actor, home.id, { entries: [{ id: loyer, data: { amount: 1 } }] }),
      ),
    ).rejects.toThrow();
    expect((await ama.as((tx) => get(tx, home.id, loyer)))?.data.amount).toBe(250000);

    await ama.as((tx) =>
      save(tx, ama.actor, home.id, {
        entries: [
          { kind: 'Model', title: 'Courses', data: { fields: [{ name: 'qty', type: 'number' }] } },
        ],
      }),
    );
    const [model] = await kossi.as((tx) => find(tx, home.id, { kind: 'Model', limit: 5 }));
    expect(model?.title).toBe('Courses');
    await expect(
      kossi.as((tx) =>
        save(tx, kossi.actor, home.id, { entries: [{ id: model!.id, title: 'X' }] }),
      ),
    ).rejects.toThrow();

    // The notes on what she sees are hers to read and to write; those on the rent stay hidden.
    await ama.as((tx) => comment(tx, ama.actor, home.id, riz, 'Le moins cher au marché.'));
    await ama.as((tx) => comment(tx, ama.actor, home.id, loyer, 'Payé le 5.'));
    const notes = async (id: string) =>
      (await kossi.as((tx) => commentsOf(tx, home.id, id))).map((one) => one.title);
    expect(await notes(riz)).toEqual(['Le moins cher au marché.']);
    await kossi.as((tx) => comment(tx, kossi.actor, home.id, riz, 'Pris 2 kg.'));
    expect(await notes(riz)).toEqual(['Le moins cher au marché.', 'Pris 2 kg.']);
    expect(
      (await kossi.as((tx) => find(tx, home.id, { kind: 'Comment', limit: 10 }))).map(
        (one) => one.title,
      ),
    ).not.toContain('Payé le 5.');

    // Everything open again.
    await ama.as((tx) =>
      setRole(tx, ama.actor, { spaceId: home.id, person: kossi.id, role: 'member', kinds: null }),
    );
    expect((await kinds()).filter((one) => one !== 'Comment')).toEqual([
      'Courses',
      'Courses',
      'Model',
      'Transaction',
    ]);
  });
});

// v3 F7: an app tried shows an example of each kind it brings, drawn from its models alone.
describe('an app tried', () => {
  it('shows one example of each kind, in her words, with a value of each type', () => {
    const [one] = examplesOf(
      {
        app: 'Garage',
        models: [
          {
            title: 'Repair',
            data: {
              label: { fr: 'Réparation' },
              fields: [
                { name: 'cost', type: 'amount', label: { fr: 'Coût' } },
                { name: 'done_on', type: 'date' },
                { name: 'state', type: 'choice', options: ['à faire', 'fait'] },
                { name: 'car', type: 'link', target: 'Car' },
              ],
            },
          },
        ],
      },
      new Date('2026-11-19T10:00:00Z'),
    );
    expect(one).toEqual({
      kind: 'Repair',
      label: 'Réparation',
      title: 'Exemple de réparation',
      fields: [
        { name: 'cost', label: 'Coût', type: 'amount', value: 125 },
        { name: 'done_on', label: 'done on', type: 'date', value: '2026-11-19' },
        { name: 'state', label: 'state', type: 'choice', value: 'à faire' },
      ],
    });
  });
});
