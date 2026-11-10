import { beforeAll, describe, expect, it } from 'vitest';
import { canonicalKind, find, mergeKind, mergeProposals, save, undo } from '../src';
import { person, type Person } from './people';

// Spec 032: the common types are never created under another name; the duplicates a life already
// has are proposed to merge, with their fields brought to the engine's words, tried first, merged
// on her yes and undone at once.
describe('the common types', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('knows their other names, and not a recipe', () => {
    expect(canonicalKind('Contact')).toBe('Person');
    expect(canonicalKind('dépense')).toBe('Transaction');
    expect(canonicalKind('Moyen de paiement')).toBe('Account');
    expect(canonicalKind('Tâche')).toBe('Task');
    expect(canonicalKind('Fonds')).toBe('Fund');
    expect(canonicalKind('Recette')).toBeNull();
    expect(canonicalKind('Journal')).toBeNull();
  });

  it('keeps her own word while her space does not use the common type', async () => {
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Dépense', title: 'Taxi', data: { montant: 2000 } }],
      }),
    );
    const hers = await ama.as((tx) => find(tx, ama.space, { kind: 'Dépense' }));
    expect(hers.map((one) => one.data)).toEqual([{ montant: 2000 }]);
  });

  it('files another name as the common type her space uses, its fields in its words', async () => {
    const kofi = await person('Kofi');
    await kofi.as((tx) =>
      save(tx, kofi.actor, kofi.space, {
        entries: [
          { kind: 'Transaction', title: 'Essence', data: { amount: 20000, direction: 'out' } },
          { kind: 'Person', title: 'Ama' },
        ],
      }),
    );
    const saved = await kofi.as((tx) =>
      save(tx, kofi.actor, kofi.space, {
        entries: [
          { kind: 'dépense', title: 'Marché', data: { montant: 7500, devise: 'XOF' } },
          { kind: 'Contact', title: 'Kwame' },
        ],
      }),
    );
    expect(saved.notes.join(' ')).toContain('common type');
    const market = (await kofi.as((tx) => find(tx, kofi.space, { kind: 'Transaction' }))).find(
      (one) => one.title === 'Marché',
    )!;
    expect(market.data).toEqual({ amount: 7500, currency: 'XOF', direction: 'out' });
    const people = await kofi.as((tx) => find(tx, kofi.space, { kind: 'Person' }));
    expect(people.map((one) => one.title).sort()).toEqual(['Ama', 'Kwame']);
  });
});

describe('the duplicates of her life', () => {
  let kwame: Person;

  beforeAll(async () => {
    kwame = await person('Kwame');
    // Written before the common types: three names for her movements of money, two for a doc.
    await kwame.as(async (tx) => {
      await tx.query(
        `insert into entry (id, space_id, kind, title, data, origin)
         values ('ent_mv_1', $1, 'Mouvement', 'Salaire', '{"montant": 300000, "sens": "entrée"}', '{}'),
                ('ent_mv_2', $1, 'Mouvement', 'Loyer', '{"montant": 90000, "sens": "sortie"}', '{}'),
                ('ent_dp_1', $1, 'dépense', 'Marché', '{"montant": 5000, "devise": "XOF"}', '{}'),
                ('ent_tr_1', $1, 'Transaction', 'Essence', '{"amount": 20000, "direction": "out"}', '{}'),
                ('ent_dc_1', $1, 'Doc', 'Bail', '{}', '{}'),
                ('ent_dc_2', $1, 'document', 'Passeport', '{}', '{}'),
                ('ent_dc_3', $1, 'document', 'Diplôme', '{}', '{}')`,
        [kwame.space],
      );
    });
  });

  it('proposes each merge with the fields renamed on the way', async () => {
    const proposals = await kwame.as((tx) => mergeProposals(tx, kwame.space));
    const of = (from: string) => proposals.find((one) => one.from === from);
    expect(of('Mouvement')).toMatchObject({ to: 'Transaction', count: 2, toCount: 1 });
    const steps = of('Mouvement')!.steps;
    expect(steps).toHaveLength(3);
    expect(steps).toEqual(
      expect.arrayContaining([
        { rename: { from: 'montant', to: 'amount' } },
        { set: { field: 'direction', formula: expect.stringContaining('entrée') } },
        { remove: 'sens' },
      ]),
    );
    // « sens » is read before it is removed.
    expect(steps.findIndex((one) => 'set' in one)).toBeLessThan(
      steps.findIndex((one) => 'remove' in one),
    );
    expect(of('dépense')!.steps).toEqual(
      expect.arrayContaining([
        { rename: { from: 'montant', to: 'amount' } },
        { rename: { from: 'devise', to: 'currency' } },
        { set: { field: 'direction', formula: "'out'" } },
      ]),
    );
    expect(of('Doc')).toMatchObject({ to: 'document' });
    expect(of('Transaction')).toBeUndefined();
    const dismissed = await kwame.as((tx) => mergeProposals(tx, kwame.space, ['Doc→document']));
    expect(dismissed.find((one) => one.from === 'Doc')).toBeUndefined();
  });

  it('leaves a kind its app owns, and sets an older model aside when merging', async () => {
    await kwame.as(async (tx) => {
      await tx.query(
        `insert into entry (id, space_id, kind, title, data, origin) values
           ('ent_md_1', $1, 'Model', 'SubscriptionPayment', '{"app": "Subscriptions", "fields": [{"name": "amount", "type": "amount"}]}', '{}'),
           ('ent_md_2', $1, 'Model', 'Transaction', '{"app": "Finances", "fields": [{"name": "amount", "type": "amount"}, {"name": "direction", "type": "text"}]}', '{}'),
           ('ent_md_3', $1, 'Model', 'Compte', '{"app": "Finances", "fields": [{"name": "solde_initial", "type": "amount"}]}', '{}'),
           ('ent_md_4', $1, 'Model', 'Account', '{"app": "Finances", "fields": [{"name": "opening_balance", "type": "amount"}]}', '{}'),
           ('ent_sp_1', $1, 'SubscriptionPayment', 'Netflix novembre', '{"amount": 5000}', '{}'),
           ('ent_cp_1', $1, 'Compte', 'Ecobank', '{"solde_initial": 120000}', '{}')`,
        [kwame.space],
      );
    });
    const proposals = await kwame.as((tx) => mergeProposals(tx, kwame.space));
    expect(proposals.find((one) => one.from === 'SubscriptionPayment')).toBeUndefined();
    const compte = proposals.find((one) => one.from === 'Compte')!;
    expect(compte.to).toBe('Account');
    await kwame.as((tx) => mergeKind(tx, kwame.actor, kwame.space, { ...compte, dryRun: false }));
    const models = await kwame.as((tx) =>
      tx.query<{ title: string }>(
        `select title from entry where space_id = $1 and kind = 'Model' and archived_at is null order by title`,
        [kwame.space],
      ),
    );
    expect(models.rows.map((one) => one.title)).toEqual([
      'Account',
      'SubscriptionPayment',
      'Transaction',
    ]);
    const accounts = await kwame.as((tx) => find(tx, kwame.space, { kind: 'Account' }));
    expect(accounts[0]!.data).toEqual({ opening_balance: 120000 });
  });

  it('tries a merge without changing anything, then merges on her yes, undone at once', async () => {
    const proposal = (await kwame.as((tx) => mergeProposals(tx, kwame.space))).find(
      (one) => one.from === 'Mouvement',
    )!;
    const tried = await kwame.as((tx) =>
      mergeKind(tx, kwame.actor, kwame.space, { ...proposal, dryRun: true }),
    );
    expect(tried).toMatchObject({ applied: false, entries: 2 });
    expect(tried.fields!.sample[0]!.after).toMatchObject({ amount: 300000, direction: 'in' });
    const still = await kwame.as((tx) => find(tx, kwame.space, { kind: 'Mouvement' }));
    expect(still).toHaveLength(2);

    const done = await kwame.as((tx) =>
      mergeKind(tx, kwame.actor, kwame.space, { ...proposal, dryRun: false }),
    );
    expect(done).toMatchObject({ applied: true, to: 'Transaction', entries: 2 });
    const movements = await kwame.as((tx) => find(tx, kwame.space, { kind: 'Transaction' }));
    const salary = movements.find((one) => one.title === 'Salaire')!;
    expect(salary.data).toEqual({ amount: 300000, direction: 'in' });
    expect(movements.find((one) => one.title === 'Loyer')!.data.direction).toBe('out');

    // Undone: the rename, then the fields.
    const { rows } = await kwame.as((tx) =>
      tx.query<{ id: string; command: string }>(
        `select id, command from journal where space_id = $1 and command in ('kind.rename', 'migration.run')
          order by id desc`,
        [kwame.space],
      ),
    );
    for (const line of rows) {
      await kwame.as((tx) =>
        undo(tx, kwame.actor, { spaceId: kwame.space, journalId: Number(line.id) }),
      );
    }
    const back = await kwame.as((tx) => find(tx, kwame.space, { kind: 'Mouvement' }));
    expect(back.find((one) => one.title === 'Salaire')!.data).toEqual({
      montant: 300000,
      sens: 'entrée',
    });
  });
});
