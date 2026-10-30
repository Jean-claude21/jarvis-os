import { runInNewContext } from 'node:vm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  exportApp,
  find,
  get,
  history,
  installApp,
  migrateKind,
  runDueRules,
  runScript,
  save,
  testRule,
  undo,
  useScriptRunner,
} from '../src';
import { db, person, type Person } from './people';

// Spec 014: rules, scripts, migrations and app bundles — each writes through `save`, each can be
// tried first. Scripts run here in Node's `vm`, a stand-in for the API's isolated engine.
let ama: Person;
const ids: Record<string, string> = {};

beforeAll(async () => {
  useScriptRunner({
    run: async (code, input) => {
      const logs: string[] = [];
      const output = runInNewContext(
        `${code}\n;run(input)`,
        { input: JSON.parse(JSON.stringify(input)), log: (m: string) => logs.push(m) },
        { timeout: 1000 },
      );
      return { output, logs };
    },
  });
  ama = await person('Ama');
  const saved = await ama.as((tx) =>
    save(tx, ama.actor, ama.space, {
      entries: [
        {
          kind: 'Model',
          title: 'Fonds',
          data: {
            fields: [
              { name: 'budget', type: 'amount' },
              { name: 'reste', type: 'formula', formula: 'budget - sum(affectations.montant)' },
            ],
            app: 'Finances',
          },
        },
        {
          kind: 'Model',
          title: 'Mouvement',
          data: {
            fields: [
              { name: 'montant', type: 'amount', required: true },
              { name: 'date', type: 'date' },
              { name: 'fonds', type: 'link', target: 'Fonds', inverse: 'affectations' },
              { name: 'confirme', type: 'boolean' },
            ],
            app: 'Finances',
          },
        },
        { ref: 'f', kind: 'Fonds', title: 'Courses', data: { budget: 10000 } },
        {
          kind: 'Rule',
          title: 'Fonds dépassé',
          data: {
            when: { saved: 'Mouvement' },
            if: 'fonds.reste < 0',
            then: [
              { remind: { text: 'Le fonds {fonds.title} est dépassé de {-fonds.reste}' } },
              { update: { set: { confirme: false } } },
            ],
            app: 'Finances',
          },
        },
        {
          kind: 'Script',
          title: 'Import relevé',
          data: {
            reads: ['Fonds'],
            writes: ['Mouvement'],
            app: 'Finances',
            code: `function run(input) {
              const fonds = input.entries.Fonds.find((f) => f.title === input.params.fonds);
              return input.file.text.trim().split('\\n').slice(1).map((line, i) => {
                const [date, label, amount] = line.split(';');
                return { create: { ref: 'm' + i, kind: 'Mouvement', title: label, data: { montant: Number(amount), date, fonds: fonds.id } } };
              });
            }`,
          },
        },
      ],
    }),
  );
  for (const one of saved.entries) ids[one.title] = one.id;
});

afterAll(() => useScriptRunner(null));

describe('a rule', () => {
  it('is checked when saved', async () => {
    await expect(
      ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [{ kind: 'Rule', title: 'Vide', data: { when: { saved: 'X' }, then: [] } }],
        }),
      ),
    ).rejects.toThrow(/A « Rule » is/);
    await expect(
      ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [
            {
              kind: 'Rule',
              title: 'Mal',
              data: { when: { schedule: 'tous les jours' }, then: [{ remind: { text: 'x' } }] },
            },
          ],
        }),
      ),
    ).rejects.toThrow();
  });

  it('runs inside the save that triggers it, as the rule, when its condition holds', async () => {
    const first = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Mouvement',
            title: 'Marché',
            data: { montant: 6000, fonds: ids.Courses!, confirme: true },
          },
        ],
      }),
    );
    ids.Marché = first.entries[0]!.id;
    expect(await ama.as((tx) => find(tx, ama.space, { kind: 'Reminder' }))).toHaveLength(0);
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Mouvement',
            title: 'Supermarché',
            data: { montant: 5000, fonds: ids.Courses!, confirme: true },
          },
        ],
      }),
    );
    const [reminder] = await ama.as((tx) => find(tx, ama.space, { kind: 'Reminder' }));
    expect(reminder?.title).toMatch(/^Le fonds Courses est dépassé de 1\s000$/);
    const entry = await ama.as((tx) => get(tx, ama.space, saved.entries[0]!.id));
    expect(entry?.data.confirme).toBe(false);
    const lines = await ama.as((tx) => history(tx, ama.space, { limit: 5 }));
    expect(lines.some((line) => line.door === 'rule' && line.client === 'rule:Fonds dépassé')).toBe(
      true,
    );
  });

  it('can be tried on an entry, changing nothing', async () => {
    const tried = await ama.as((tx) =>
      testRule(tx, ama.actor, ama.space, { rule: 'Fonds dépassé', entryId: ids.Marché }),
    );
    expect(tried.result.matched).toBe(true);
    expect(tried.changes.map((one) => one.command)).toEqual([
      'entry.create',
      'link.add',
      'entry.update',
    ]);
    expect(await ama.as((tx) => find(tx, ama.space, { kind: 'Reminder' }))).toHaveLength(1);
  });

  it('runs on a schedule, from the watcher', async () => {
    const [rule] = (
      await ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [
            {
              kind: 'Rule',
              title: 'Loyer du mois',
              data: {
                when: { schedule: '0 8 1 * *' },
                then: [
                  {
                    create: {
                      kind: 'Obligation',
                      title: 'Loyer {month(today())}',
                      data: { montant: 120000 },
                    },
                  },
                ],
              },
            },
          ],
        }),
      )
    ).entries;
    {
      await runDueRules(db, new Date('2026-10-30T10:00:00Z'));
      let entry = await ama.as((tx) => get(tx, ama.space, rule!.id));
      expect(entry?.data.next).toBe('2026-11-01T07:00:00.000Z');
      await runDueRules(db, new Date('2026-11-01T07:01:00Z'));
      const [loyer] = await ama.as((tx) => find(tx, ama.space, { kind: 'Obligation' }));
      expect(loyer?.title).toMatch(/^Loyer \d{4}-\d{2}$/);
      entry = await ama.as((tx) => get(tx, ama.space, rule!.id));
      expect(entry?.data.next).toBe('2026-12-01T07:00:00.000Z');
    }
  });
});

describe('a script', () => {
  it('computes, and Jarvis checks and writes; tried first', async () => {
    const [releve] = (
      await ama.as((tx) =>
        save(tx, ama.actor, ama.space, { entries: [{ kind: 'Relevé', title: 'Octobre' }] }),
      )
    ).entries;
    await ama.as((tx) =>
      tx.query(
        `insert into file (entry_id, space_id, name, media_type, size, storage_key, text)
         values ($1, $2, 'releve.csv', 'text/csv', 60, 'test/releve.csv', $3)`,
        [
          releve!.id,
          ama.space,
          'date;libellé;montant\n2026-10-03;Boulangerie;800\n2026-10-04;Pharmacie;2500\n',
        ],
      ),
    );
    const tried = await ama.as((tx) =>
      runScript(tx, ama.actor, ama.space, {
        script: 'Import relevé',
        fileId: releve!.id,
        params: { fonds: 'Courses' },
        dryRun: true,
      }),
    );
    expect(tried.result.saved).toEqual({ created: 2, updated: 0, links: 0 });
    expect(
      await ama.as((tx) => find(tx, ama.space, { kind: 'Mouvement', text: 'Boulangerie' })),
    ).toHaveLength(0);
    const done = await ama.as((tx) =>
      runScript(tx, ama.actor, ama.space, {
        script: 'Import relevé',
        fileId: releve!.id,
        params: { fonds: 'Courses' },
      }),
    );
    expect(
      done.changes.filter(
        (one) => one.command === 'entry.create' && one.after?.kind === 'Mouvement',
      ),
    ).toHaveLength(2);
    expect(
      await ama.as((tx) => find(tx, ama.space, { kind: 'Mouvement', text: 'Boulangerie' })),
    ).toHaveLength(1);
  });

  it('may only write what it declared', async () => {
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Script',
            title: 'Intrus',
            data: {
              writes: ['Note'],
              code: 'function run() { return [{ create: { kind: "Fonds", title: "Pirate" } }] }',
            },
          },
        ],
      }),
    );
    await expect(
      ama.as((tx) => runScript(tx, ama.actor, ama.space, { script: 'Intrus' })),
    ).rejects.toThrow(/may not write a « Fonds »/);
  });
});

describe('a migration', () => {
  it('renames and sets a field on every entry of a kind, tried, then undone at once', async () => {
    const tried = await ama.as((tx) =>
      migrateKind(tx, ama.actor, ama.space, {
        kind: 'Mouvement',
        steps: [
          { rename: { from: 'confirme', to: 'verifie' } },
          { set: { field: 'sens', formula: "'sortie'" } },
        ],
      }),
    );
    expect(tried.result.changed).toBe(4);
    expect(tried.result.problems[0]?.problems.join(' ')).toMatch(
      /« verifie » is not one of its fields/,
    );
    expect(
      (await ama.as((tx) => find(tx, ama.space, { kind: 'Mouvement', text: 'Marché' })))[0]?.data,
    ).not.toHaveProperty('sens');
    const done = await ama.as((tx) =>
      migrateKind(tx, ama.actor, ama.space, {
        kind: 'Mouvement',
        steps: [{ set: { field: 'date', formula: "coalesce(date, '2026-10-01')" } }],
        dryRun: false,
      }),
    );
    expect(done.result.changed).toBe(2);
    const [line] = await ama.as((tx) => history(tx, ama.space, { limit: 1 }));
    expect(line?.command).toBe('migration.run');
    await ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: line!.id }));
    const [marche] = await ama.as((tx) =>
      find(tx, ama.space, { kind: 'Mouvement', text: 'Marché' }),
    );
    expect(marche?.data).not.toHaveProperty('date');
  });
});

describe('an app bundle', () => {
  it('exports an app, and installs it elsewhere, tried first', async () => {
    const bundle = await ama.as((tx) => exportApp(tx, ama.space, 'Finances'));
    expect(bundle.models.map((one) => one.title)).toEqual(['Fonds', 'Mouvement']);
    expect(bundle.rules.map((one) => one.title)).toEqual(['Fonds dépassé']);
    expect(bundle.scripts.map((one) => one.title)).toEqual(['Import relevé']);
    const kofi = await person('Kofi');
    const tried = await kofi.as((tx) => installApp(tx, kofi.actor, kofi.space, bundle));
    expect(tried.result.created).toHaveLength(4);
    expect(await kofi.as((tx) => find(tx, kofi.space, { kind: 'Model' }))).toHaveLength(0);
    await kofi.as((tx) => installApp(tx, kofi.actor, kofi.space, bundle, false));
    expect(await kofi.as((tx) => find(tx, kofi.space, { kind: 'Model' }))).toHaveLength(2);
    const again = await kofi.as((tx) => installApp(tx, kofi.actor, kofi.space, bundle, false));
    expect(again.result.kept).toHaveLength(4);
  });
});
