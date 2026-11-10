import { beforeAll, describe, expect, it } from 'vitest';
import { goalProgress, goalsOf, save } from '../src';
import { person, type Person } from './people';

// Spec 041: a goal's progress is computed from what is linked to it, never written by hand.
describe('her goals', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('adds up what moves a measurable goal, against its target and its deadline', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { ref: 'g', kind: 'Goal', title: 'Épargner 500 000 F', data: { deadline: '2026-12-31' } },
          { ref: 'f', kind: 'Fund', title: 'Épargne voyage', data: { balance: 150000 } },
          { ref: 'k', kind: 'Account', title: 'Tontine', data: { balance: 50000 } },
        ],
        links: [
          { from: 'f', to: 'g', role: 'advances' },
          { from: 'k', to: 'g', role: 'advances' },
        ],
      }),
    );
    const goal = await ama.as((tx) =>
      goalProgress(tx, ama.space, saved.entries[0]!.id, '2026-11-10'),
    );
    expect(goal).toMatchObject({
      measurable: true,
      target: 500000,
      current: 200000,
      ratio: 0.4,
      daysLeft: 51,
    });
  });

  it('averages how the things of another goal are kept', async () => {
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { ref: 'g', kind: 'Goal', title: 'Être plus présent' },
          { ref: 'a', kind: 'Task', title: 'Dîner sans téléphone', data: { status: 'done' } },
          {
            ref: 'b',
            kind: 'Task',
            title: 'Appeler maman chaque semaine',
            data: { status: 'open' },
          },
        ],
        links: [
          { from: 'a', to: 'g', role: 'advances' },
          { from: 'b', to: 'g', role: 'advances' },
        ],
      }),
    );
    const goals = await ama.as((tx) => goalsOf(tx, ama.space, '2026-11-10'));
    expect(goals.find((one) => one.title === 'Être plus présent')).toMatchObject({
      measurable: false,
      ratio: 0.5,
    });
  });
});
