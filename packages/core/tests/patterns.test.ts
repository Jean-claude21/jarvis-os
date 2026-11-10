import { beforeAll, describe, expect, it } from 'vitest';
import { patternsOf } from '../src';
import { person, type Person } from './people';

// Spec 042: what comes back, counted with its figures, marked inferred.
describe('patterns', () => {
  let ama: Person;
  const now = new Date('2026-11-10T09:00:00Z');

  beforeAll(async () => {
    ama = await person('Ama');
    const rows: [string, string, string, string][] = [];
    const at = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
    for (const days of [1, 3, 5, 8]) rows.push(['Mood', 'Soir', `{"mood": "Fatigué"}`, at(days)]);
    for (const days of [2, 10, 20])
      rows.push([
        'Transaction',
        'Resto',
        '{"amount": 30000, "category": "Repas", "direction": "out"}',
        at(days),
      ]);
    for (const days of [40, 70, 100])
      rows.push([
        'Transaction',
        'Resto',
        '{"amount": 20000, "category": "Repas", "direction": "out"}',
        at(days),
      ]);
    rows.push(['Person', 'Kofi', '{}', at(60)]);
    for (const days of [2, 4, 6, 9]) rows.push(['Note', `Vu Kofi ${days}`, '{}', at(days)]);
    for (const [i, [kind, title, data, created]] of rows.entries()) {
      await ama.as((tx) =>
        tx.query(
          'insert into entry (id, space_id, kind, title, data, created_at) values ($1, $2, $3, $4, $5, $6)',
          [`ent_pt_${i}`, ama.space, kind, title, data, created],
        ),
      );
    }
  });

  it('counts a state said again, spending that rises and a person often named', async () => {
    const found = await ama.as((tx) => patternsOf(tx, [ama.space], now));
    const by = (kind: string) => found.find((one) => one.kind === kind);
    expect(by('state')).toMatchObject({
      about: 'fatigué',
      figures: { times: 4, days: 14 },
      origin: 'inferred',
    });
    expect(by('spending')).toMatchObject({
      about: 'Repas',
      figures: { recent: 90000, usual: 20000, rise: 350 },
    });
    expect(by('person')).toMatchObject({ about: 'Kofi', figures: { times: 4, days: 30 } });
  });
});
