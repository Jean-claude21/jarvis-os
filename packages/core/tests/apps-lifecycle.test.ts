import { beforeAll, describe, expect, it } from 'vitest';
import { COMMON_KINDS, find, installApp, removeApp, undo, type Bundle } from '../src';
import { person, type Person } from './people';

// Spec 034: an app installed on what she already keeps proposes to use it (never without her yes);
// an app removed leaves every entry of hers and the models of the common types, undone at once.
const finances: Bundle = {
  app: 'Finances',
  models: [
    { title: 'Account', data: { fields: [{ name: 'opening_balance', type: 'amount' }] } },
    { title: 'Fund', data: { fields: [{ name: 'monthly_budget', type: 'amount' }] } },
  ],
  rules: [
    {
      title: 'Fund overspent',
      data: { when: { saved: 'Fund' }, then: [{ remind: { text: 'Fonds dépassé' } }] },
    },
  ],
  role: { covers: 'Ton argent.', intents: ['payé'], watches: ['Account'] },
};
const common = (kind: string) => COMMON_KINDS.some((one) => one.kind === kind);

describe('installing on what she keeps, and removing', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) =>
      tx.query(
        `insert into entry (id, space_id, kind, title, data) values
           ('ent_ac_1', $1, 'Compte', 'Ecobank', '{"solde_initial": 120000}'),
           ('ent_ac_2', $1, 'Compte', 'Flooz', '{"solde_initial": 15000}')`,
        [ama.space],
      ),
    );
  });

  it('says what she already keeps that the app can use', async () => {
    const tried = await ama.as((tx) => installApp(tx, ama.actor, ama.space, finances, true));
    expect(tried.result.reuse).toEqual([
      expect.objectContaining({
        from: 'Compte',
        to: 'Account',
        count: 2,
        steps: [{ rename: { from: 'solde_initial', to: 'opening_balance' } }],
      }),
    ]);
    // Tried only: nothing installed, nothing merged.
    expect(await ama.as((tx) => find(tx, ama.space, { kind: 'App' }))).toEqual([]);
    expect(await ama.as((tx) => find(tx, ama.space, { kind: 'Compte' }))).toHaveLength(2);
  });

  it('removes an app at once, keeping her entries and the common types’ models, undone at once', async () => {
    await ama.as((tx) => installApp(tx, ama.actor, ama.space, finances, false));
    const removed = await ama.as((tx) =>
      removeApp(tx, ama.actor, ama.space, 'Finances', false, common),
    );
    expect(removed.result.removed.sort()).toEqual([
      'App « Finances »',
      'Model « Fund »',
      'Rule « Fund overspent »',
    ]);
    expect(removed.result.kept).toEqual(['Model « Account »']);
    expect(await ama.as((tx) => find(tx, ama.space, { kind: 'Compte' }))).toHaveLength(2);
    const titles = async (kind: string) =>
      (await ama.as((tx) => find(tx, ama.space, { kind }))).map((one) => one.title).sort();
    expect(await titles('Model')).toEqual(['Account']);

    const { rows } = await ama.as((tx) =>
      tx.query<{ id: string }>(
        `select id from journal where space_id = $1 and command = 'app.remove' order by id desc limit 1`,
        [ama.space],
      ),
    );
    await ama.as((tx) =>
      undo(tx, ama.actor, { spaceId: ama.space, journalId: Number(rows[0]!.id) }),
    );
    expect(await titles('Model')).toEqual(['Account', 'Fund']);
    expect(await titles('App')).toEqual(['Finances']);
  });

  it('says so for an app that is not there', async () => {
    await expect(
      ama.as((tx) => removeApp(tx, ama.actor, ama.space, 'Jardin', true, common)),
    ).rejects.toThrow(/No app « Jardin »/);
  });
});
