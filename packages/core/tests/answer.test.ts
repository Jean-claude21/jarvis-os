import { beforeAll, describe, expect, it } from 'vitest';
import { answerOf, asksAFigure, periodOf } from '../src';
import { person, type Person } from './people';

// Spec 049: a search that answers, with what justifies the answer.
const now = new Date('2026-11-10T09:00:00Z');

describe('her question', () => {
  it('reads the period and whether a figure is asked', () => {
    expect(periodOf('combien en transport en octobre ?', now)).toMatchObject({ label: 'octobre' });
    expect(periodOf('combien en transport en octobre ?', now).from.toISOString().slice(0, 10)).toBe(
      '2026-10-01',
    );
    expect(periodOf('combien de prières cette semaine', now).from.toISOString().slice(0, 10)).toBe(
      '2026-11-09',
    );
    expect(periodOf('how much last month', now).from.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(asksAFigure('Combien en transport ?')).toBe(true);
    expect(asksAFigure('Paul')).toBe(false);
  });
});

describe('the answer', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
    const rows: [string, string, string][] = [
      [
        'Transaction',
        'Taxi',
        '{"amount": 3000, "category": "Transport", "direction": "out", "date": "2026-10-03"}',
      ],
      [
        'Transaction',
        'Moto',
        '{"amount": 1500, "category": "Transport", "direction": "out", "date": "2026-10-20"}',
      ],
      [
        'Transaction',
        'Pain',
        '{"amount": 500, "category": "Repas", "direction": "out", "date": "2026-10-20"}',
      ],
      [
        'Transaction',
        'Taxi',
        '{"amount": 2000, "category": "Transport", "direction": "out", "date": "2026-09-12"}',
      ],
      ['Prière', 'Matin', '{"date": "2026-11-09"}'],
      ['Prière', 'Soir', '{"date": "2026-11-10"}'],
    ];
    for (const [i, [kind, title, data]] of rows.entries()) {
      await ama.as((tx) =>
        tx.query(
          'insert into entry (id, space_id, kind, title, data) values ($1, $2, $3, $4, $5)',
          [`ent_an_${i}`, ama.space, kind, title, data],
        ),
      );
    }
  });

  it('sums the money of a category over a month, against the month before', async () => {
    const a = await ama.as((tx) =>
      answerOf(tx, [ama.space], 'Combien en transport en octobre ?', now),
    );
    expect(a).toMatchObject({ figure: 4500, count: 2, previous: 2000, currency: 'XOF' });
    expect(a.top.map((one) => one.title)).toEqual(['Taxi', 'Moto']);
  });

  it('counts what she did over a week', async () => {
    const a = await ama.as((tx) =>
      answerOf(tx, [ama.space], 'combien de prières cette semaine', now),
    );
    expect(a).toMatchObject({ figure: 2, count: 2, currency: null });
  });
});
