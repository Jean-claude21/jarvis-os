import { beforeAll, describe, expect, it } from 'vitest';
import {
  find,
  nextRuns,
  planFromText,
  planOfSchedule,
  runRuleNow,
  save,
  scheduleOf,
  skillActions,
  skillOfTask,
  tasksFromText,
  tryRuleData,
  type Plan,
} from '../src';
import { person, type Person } from './people';

// Spec 109: an agent's tasks — a plan set freely, read from her words, its next times; her text
// made task lines; a task tried before it is kept, run now; a skill's task that prepares its bilan.

describe('a plan', () => {
  it('is written for the watcher and read back', () => {
    const plans: Plan[] = [
      { every: 'day', at: '07:00' },
      { every: 'weekdays', at: '08:30' },
      { every: 'days', at: '18:00', days: [1, 5] },
      { every: 'month', at: '10:00', monthDay: 1 },
      { every: 'month', at: '19:00', monthDay: 'last' },
      { every: 'hours', at: '00:15', hours: 2 },
    ];
    const written = plans.map((one) => scheduleOf(one));
    expect(written).toEqual([
      '0 7 * * *',
      '30 8 * * 1-5',
      '0 18 * * 1,5',
      '0 10 1 * *',
      '0 19 L * *',
      '15 */2 * * *',
    ]);
    expect(written.map((one) => planOfSchedule(one))).toEqual([
      { every: 'day', at: '07:00' },
      { every: 'weekdays', at: '08:30' },
      { every: 'days', at: '18:00', days: [1, 5] },
      { every: 'month', at: '10:00', monthDay: 1 },
      { every: 'month', at: '19:00', monthDay: 'last' },
      { every: 'hours', at: '00:15', hours: 2 },
    ]);
    expect(planOfSchedule('0 7 1-7 * 1')).toBeNull();
    expect(() => scheduleOf({ every: 'days', at: '09:00', days: [] })).toThrow(/at least one/);
  });

  it('says its next times, on her clock', () => {
    // Friday 21 Nov 2026, 10:00 in Paris: the next Fridays at 18:00.
    expect(nextRuns('0 18 * * 5', new Date('2026-11-21T09:00:00Z'), 'Europe/Paris')).toEqual([
      '2026-11-27T17:00:00.000Z',
      '2026-12-04T17:00:00.000Z',
      '2026-12-11T17:00:00.000Z',
    ]);
    expect(nextRuns('0 19 L * *', new Date('2026-11-21T09:00:00Z'), 'Europe/Paris', 2)).toEqual([
      '2026-11-30T18:00:00.000Z',
      '2026-12-31T18:00:00.000Z',
    ]);
  });
});

describe('a « when » in her words', () => {
  it.each([
    ['Chaque vendredi à 18h, fais mon bilan', { every: 'days', at: '18:00', days: [5] }],
    ['tous les jours à 7h30 le brief', { every: 'day', at: '07:30' }],
    ['En semaine à 9 h, relis mes offres', { every: 'weekdays', at: '09:00' }],
    ['chaque lundi et vendredi à 8h', { every: 'days', at: '08:00', days: [1, 5] }],
    ['le 1er de chaque mois à 10h', { every: 'month', at: '10:00', monthDay: 1 }],
    [
      'le dernier jour du mois à 19h, le bilan du mois',
      { every: 'month', at: '19:00', monthDay: 'last' },
    ],
    ['toutes les 2 heures, regarde mes mails', { every: 'hours', at: '00:00', hours: 2 }],
    ['chaque dimanche, prépare ma semaine', { every: 'days', at: '09:00', days: [0] }],
  ])('« %s »', (text, plan) => {
    expect(planFromText(text)?.plan).toEqual(plan);
  });

  it('says nothing when there is no time', () => {
    expect(planFromText('Mets toujours mes dépenses en premier.')).toBeNull();
  });
});

describe('her text made task lines', () => {
  it('each sentence with a time a task, the skill it names; the rest her instructions', () => {
    const read = tasksFromText(
      'Chaque vendredi à 18h, fais-moi le bilan de la semaine. Le dernier jour du mois à 19h, le bilan du mois. Mets toujours mes dépenses en premier.',
      ['Bilan hebdo', 'Bilan du mois', 'Ranger ce qui arrive'],
    );
    expect(read.tasks.map((one) => [one.schedule, one.skill])).toEqual([
      ['0 18 * * 5', null],
      ['0 19 L * *', 'Bilan du mois'],
    ]);
    expect(read.tasks[0]!.what).toMatch(/bilan de la semaine/);
    // The time taken out leaves no « à » behind.
    expect(tasksFromText('Chaque lundi et vendredi à 8h, relis mes offres.').tasks[0]!.what).toBe(
      'relis mes offres',
    );
    expect(read.instructions).toBe('Mets toujours mes dépenses en premier.');
  });
});

describe('a skill’s task', () => {
  it('prepares a bilan over its period and says it is ready; read back', () => {
    const then = skillActions({ name: 'Bilan hebdo', result: { kind: 'Bilan' } }, 'week');
    expect(then).toEqual([
      {
        create: {
          kind: 'Bilan',
          title: 'Bilan hebdo',
          data: {
            type: 'Bilan hebdo',
            skill: 'Bilan hebdo',
            status: 'to_write',
            from: '=date_add(today(), -6)',
            to: '=today()',
          },
        },
      },
      { remind: { text: expect.stringContaining('« Bilan hebdo »') } },
    ]);
    expect(skillOfTask(then)).toBe('Bilan hebdo');
    // A skill that makes no bilan: a reminder only, read back too.
    const other = skillActions({ name: 'Veille' });
    expect(other).toHaveLength(1);
    expect(skillOfTask(other)).toBe('Veille');
  });
});

describe('a task in her space', () => {
  let ama: Person;
  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('is tried before it is kept: what it would do, nothing written', async () => {
    const data = {
      when: { schedule: '0 18 * * 5' },
      then: skillActions({ name: 'Bilan hebdo', result: { kind: 'Bilan' } }, 'week'),
    };
    const tried = await ama.as((tx) => tryRuleData(tx, ama.actor, ama.space, data));
    expect(tried.result.matched).toBe(true);
    expect(tried.changes.length).toBeGreaterThan(0);
    expect(tried.changes.some((one) => (one.after as { kind?: string })?.kind === 'Bilan')).toBe(
      true,
    );
    const kept = await ama.as((tx) => find(tx, ama.space, { kind: 'Bilan' }));
    expect(kept).toHaveLength(0);
  });

  it('runs now, as on its time: the bilan to write over the week', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Rule',
            title: 'Bilan de la semaine',
            data: {
              when: { schedule: '0 18 * * 5' },
              then: skillActions({ name: 'Bilan hebdo', result: { kind: 'Bilan' } }, 'week'),
            },
          },
        ],
      }),
    );
    expect(await ama.as((tx) => runRuleNow(tx, ama.actor, ama.space, saved.entries[0]!.id))).toBe(
      true,
    );
    const [bilan] = await ama.as((tx) => find(tx, ama.space, { kind: 'Bilan' }));
    expect(bilan?.data).toMatchObject({ status: 'to_write', skill: 'Bilan hebdo' });
    const from = Date.parse(String(bilan?.data.from));
    const to = Date.parse(String(bilan?.data.to));
    expect((to - from) / 86_400_000).toBe(6);
  });
});
