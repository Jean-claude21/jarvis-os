import { describe, expect, it } from 'vitest';
import { answersOf, reshapeBlock, type Block, type KindShape } from '../src';

// Spec 107: a card set on screen — read back as her answers, changed, set anew; what composing does
// not write is kept; what says more than answers can is left to its name and size.

const transaction = {
  kind: 'Transaction',
  fields: [
    { name: 'amount', type: 'amount' },
    { name: 'date', type: 'date' },
    { name: 'direction', type: 'choice', options: ['in', 'out'] },
    { name: 'account', type: 'link', target: 'Account' },
  ],
  facets: [
    { facet: 'dated', start: 'date' },
    { facet: 'stages', field: 'direction' },
  ],
} as unknown as KindShape;

const spending = {
  block: 'stat',
  title: { fr: 'Dépenses du mois', en: 'Spending this month' },
  size: 's',
  query: {
    kind: 'Transaction',
    where: "direction = 'out' and month(date) = {month}",
    aggregate: { total: 'sum(amount)' },
  },
} as Block;

describe('a card set on screen', () => {
  it('reads back as her answers, keeping what the assistant wrote', () => {
    expect(answersOf(spending, transaction)).toEqual({
      component: 'stat',
      title: 'Dépenses du mois',
      kind: 'Transaction',
      measure: 'amount',
      only: { field: 'direction', value: 'out' },
      where: 'month(date) = {month}',
    });
  });

  it('changes its shape and its time, keeping its size and its title in every language', () => {
    const asked = answersOf(spending, transaction)!;
    const line = reshapeBlock(
      spending,
      { ...asked, component: 'line', within: '3m', where: undefined },
      transaction,
    ) as Block & { query: { groupBy: string; where: string } };
    expect(line.block).toBe('line');
    expect(line.size).toBe('s');
    expect(line.title).toEqual({ fr: 'Dépenses du mois', en: 'Spending this month' });
    expect(line.query.groupBy).toBe('month(date)');
    expect(line.query.where).toBe("last_days(date, 92) and direction = 'out'");
    // Read back again: the same answers.
    expect(answersOf(line, transaction)).toMatchObject({ within: '3m', only: { value: 'out' } });
  });

  it('a new title replaces the old one; a filter is removed', () => {
    const asked = answersOf(spending, transaction)!;
    const set = reshapeBlock(
      spending,
      { ...asked, title: 'Tout ce qui sort', only: undefined, where: undefined },
      transaction,
    ) as Block & { query: { where?: string } };
    expect(set.title).toBe('Tout ce qui sort');
    expect(set.query.where).toBeUndefined();
  });

  it('a kind-based card keeps its gestures; a filter the screen cannot read stays', () => {
    const board = {
      block: 'kanban',
      kind: 'Transaction',
      by: 'direction',
      link: 'account',
      where: "amount > 100 and direction = 'out'",
    } as Block;
    const asked = answersOf(board, transaction)!;
    expect(asked).toMatchObject({ where: 'amount > 100', only: { field: 'direction' } });
    expect(asked.within).toBeUndefined();
  });

  it('reads a group by a linked entry’s title as the link', () => {
    const byAccount = {
      block: 'bar',
      query: { kind: 'Transaction', groupBy: 'account.title', aggregate: { n: 'count()' } },
    } as Block;
    expect(answersOf(byAccount, transaction)).toMatchObject({ group: 'account', measure: 'count' });
    const set = reshapeBlock(
      byAccount,
      { ...answersOf(byAccount, transaction)!, component: 'breakdown' },
      transaction,
    ) as Block & { query: { groupBy: string } };
    expect(set.query.groupBy).toBe('account.title');
  });

  it('says nothing of what it cannot read: a query of its own, a formula', () => {
    expect(answersOf({ block: 'sql', sql: 'select 1', chart: 'table' } as Block, null)).toBeNull();
    expect(
      answersOf(
        {
          block: 'bar',
          query: { kind: 'Transaction', groupBy: 'amount * 2', aggregate: { n: 'count()' } },
        } as Block,
        transaction,
      ),
    ).toBeNull();
  });

  it('refuses a time on what has no date, in words', () => {
    const undated = { ...transaction, facets: [] } as unknown as KindShape;
    expect(() =>
      reshapeBlock(spending, { component: 'stat', kind: 'Transaction', within: 'month' }, undated),
    ).toThrow(/no date/);
  });
});
