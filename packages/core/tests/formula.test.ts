import { describe, expect, it } from 'vitest';
import { formulaValue, parse, type Scope } from '../src';

// Spec 014: the formula language, evaluated without `eval`.
const scope = (values: Record<string, unknown>): Scope => ({ get: (name) => values[name] ?? null });
const clock = { now: new Date('2026-10-30T10:00:00Z'), zone: 'Europe/Paris' };
const run = (text: string, values: Record<string, unknown> = {}) =>
  formulaValue(text, scope(values), clock);

describe('a formula', () => {
  it('computes numbers, text, comparisons', async () => {
    expect(await run('1 + 2 * 3 - -1')).toBe(8);
    expect(await run('(a + b) / 2', { a: 3, b: 5 })).toBe(4);
    expect(await run("'Entrée' = 'entree'")).toBe(true);
    expect(await run("x >= 3 and not (y = 'non')", { x: 3, y: 'oui' })).toBe(true);
    expect(await run('if(reste < 0, "dépassé", "ok")', { reste: -2 })).toBe('dépassé');
    expect(await run('round(10 / 3, 2)')).toBe(3.33);
    expect(await run('1 / 0')).toBeNull();
    expect(await run('`date de paiement`', { 'date de paiement': '2026-10-01' })).toBe(
      '2026-10-01',
    );
  });

  it('goes over lists, with where', async () => {
    const lines = [
      scope({ montant: 100, nature: 'entrée', date: '2026-10-29' }),
      scope({ montant: 40, nature: 'sortie', date: '2026-10-01' }),
      scope({ montant: 10, nature: 'sortie', date: '2026-09-15' }),
    ];
    const values = { mouvements: lines, seuil: 20 };
    expect(await run('sum(mouvements.montant)', values)).toBe(150);
    expect(await run("sum(mouvements.montant where nature = 'sortie')", values)).toBe(50);
    expect(await run('count(mouvements where montant > seuil)', values)).toBe(2);
    expect(await run('max(mouvements.date)', values)).toBe('2026-10-29');
    expect(await run('avg(mouvements.montant)', values)).toBe(50);
    expect(await run('count(mouvements where this_month(date))', values)).toBe(2);
    expect(await run('count(mouvements where last_days(date, 7))', values)).toBe(1);
  });

  it('knows days', async () => {
    expect(await run('today()')).toBe('2026-10-30');
    expect(await run("month('2026-10-12')")).toBe('2026-10');
    expect(await run("days_between('2026-10-01', '2026-10-30')")).toBe(29);
    expect(await run("date_add('2026-10-30', 3)")).toBe('2026-11-02');
    const days = ['2026-10-30', '2026-10-29', '2026-10-28', '2026-10-26'].map((date) =>
      scope({ date }),
    );
    expect(await run('streak(pointages.date)', { pointages: days })).toBe(3);
  });

  it('says where it goes wrong', () => {
    expect(() => parse('sum(a')).toThrow(/« \) » expected at 6/);
    expect(() => parse('eval(1)')).toThrow(/« eval » is not a function/);
    expect(() => parse('a ; b')).toThrow(/« ; » is not understood/);
    expect(() => parse('if(a where b, 1, 2)')).toThrow(/« where » belongs to/);
  });
});
