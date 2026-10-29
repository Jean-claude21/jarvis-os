import { beforeAll, describe, expect, it } from 'vitest';
import { query, save } from '../src';
import { person, type Person } from './people';

// Spec 001, story 4: figures from the database, read-only, over her own rows only (decision 0004).
let ama: Person;
let kossi: Person;

beforeAll(async () => {
  ama = await person('Ama');
  kossi = await person('Kossi');
  await ama.as((tx) =>
    save(tx, ama.actor, ama.space, {
      entries: [
        { kind: 'Dépense', title: 'Taxi', data: { montant: 2000, poste: 'Transport' } },
        { kind: 'Dépense', title: 'Déjeuner', data: { montant: 3500, poste: 'Repas' } },
        { kind: 'Dépense', title: 'Zem', data: { montant: 500, poste: 'Transport' } },
      ],
    }),
  );
  await kossi.as((tx) =>
    save(tx, kossi.actor, kossi.space, {
      entries: [{ kind: 'Dépense', title: 'Loyer', data: { montant: 80000, poste: 'Logement' } }],
    }),
  );
});

const run = (who: Person, sql: string) => who.as((tx) => query(tx, { spaceIds: [who.space], sql }));

describe('a read-only query (story 4)', () => {
  it('sums her expenses by post, exactly', async () => {
    const result = await run(
      ama,
      `select data->>'poste' as poste, sum((data->>'montant')::int) as total
         from my_entries where kind = 'Dépense' group by 1 order by 1`,
    );
    expect(result.columns).toEqual(['poste', 'total']);
    expect(result.rows).toEqual([
      { poste: 'Repas', total: '3500' },
      { poste: 'Transport', total: '2500' },
    ]);
    expect(result.truncated).toBe(false);
  });

  it('refuses to write, to read the real tables, to run two statements or to run too long', async () => {
    await expect(run(ama, "update my_entries set title = 'x'")).rejects.toThrow();
    await expect(run(ama, 'select * from entry')).rejects.toThrow(/permission denied/);
    await expect(run(ama, 'select * from member')).rejects.toThrow(/permission denied/);
    await expect(run(ama, 'select * from journal')).rejects.toThrow(/permission denied/);
    await expect(run(ama, 'select 1; select 2')).rejects.toThrow();
    await expect(run(ama, 'select pg_sleep(5)')).rejects.toThrow(/statement timeout/);
  });

  it('never shows another life, even by changing who the session acts for', async () => {
    const result = await run(
      ama,
      `select title from my_entries, lateral (select set_config('jarvis.person', '${kossi.id}', true)) s`,
    );
    expect(result.rows.map((row) => row.title).sort()).toEqual(['Déjeuner', 'Taxi', 'Zem']);
    const kossiSees = await run(kossi, 'select title from my_entries');
    expect(kossiSees.rows).toEqual([{ title: 'Loyer' }]);
  });
});
