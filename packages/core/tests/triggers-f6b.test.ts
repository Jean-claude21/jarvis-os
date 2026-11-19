import { describe, expect, it } from 'vitest';
import { agentsOf, history, save, setAgent } from '../src';
import { person } from './people';

// v3 F6b: one vocabulary for « when » (rules and skills), one phrase for one thing, and an agent
// that answers for every rule.
describe('F6b', () => {
  it('refuses a phrase another rule or skill already answers to', async () => {
    const ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Routine',
            title: 'bilan-hebdo',
            data: { instructions: 'Écris mon bilan.', triggers: [{ phrase: '/bilan' }] },
          },
        ],
      }),
    );
    await expect(
      ama.as((tx) =>
        save(tx, ama.actor, ama.space, {
          entries: [
            {
              kind: 'Rule',
              title: 'Bilan sur demande',
              data: {
                when: { phrase: '/Bilan' },
                then: [{ create: { kind: 'Task', title: 'Bilan' } }],
              },
            },
          ],
        }),
      ),
    ).rejects.toThrow(/already starts « bilan-hebdo »/);
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Rule',
            title: 'Courses sur demande',
            data: {
              when: { phrase: '/courses' },
              then: [{ create: { kind: 'Task', title: 'Courses' } }],
            },
          },
        ],
      }),
    );
  });

  it('gives every rule an agent: the service it calls, its app, or hers', async () => {
    const kofi = await person('Kofi');
    await kofi.as((tx) =>
      save(tx, kofi.actor, kofi.space, {
        entries: [
          {
            kind: 'Agent',
            title: 'Chasseur d’offres',
            data: { service: 'Atelier', budget: { calls_per_day: 4 } },
          },
          {
            kind: 'Rule',
            title: 'Lire les offres',
            data: {
              when: { schedule: '30 7 * * *' },
              then: [{ call: { connection: 'Atelier', path: '/lire' } }],
              app: 'Candidatures',
            },
          },
          {
            kind: 'Rule',
            title: 'Fonds dépassé',
            data: {
              when: { saved: 'Mouvement' },
              then: [{ remind: { text: 'Fonds dépassé' } }],
              app: 'Finances',
            },
          },
          {
            kind: 'Rule',
            title: 'Rappel du matin',
            data: { when: { schedule: '0 7 * * *' }, then: [{ remind: { text: 'Bonjour' } }] },
          },
          {
            kind: 'Rule',
            title: 'Note du soir',
            data: {
              when: { schedule: '0 21 * * *' },
              then: [{ create: { kind: 'Note', title: 'Soir' } }],
            },
          },
        ],
      }),
    );
    const agents = await kofi.as((tx) => agentsOf(tx, kofi.space));
    const rulesOf = (title: string) =>
      agents.find((one) => one.title === title)?.rules.map((rule) => rule.title) ?? [];
    expect(rulesOf('Chasseur d’offres')).toEqual(['Lire les offres']);
    expect(rulesOf('Finances')).toEqual(['Fonds dépassé']);
    expect(rulesOf('Gardien des rappels')).toEqual(['Rappel du matin']);
    expect(rulesOf('Intendant')).toEqual(['Note du soir']);
    expect(agents.find((one) => one.title === 'Finances')?.data.role).toBe(
      'Fait tourner les automatismes de Finances.',
    );
    expect(agents.find((one) => one.title === 'Chasseur d’offres')?.rules[0]?.assigned).toBe(false);

    // Its work is signed with its agent; paused, the agent stops it.
    await kofi.as((tx) =>
      save(tx, kofi.actor, kofi.space, { entries: [{ kind: 'Mouvement', title: 'Loyer' }] }),
    );
    const lines = await kofi.as((tx) =>
      history(tx, kofi.space, { client: 'agent:Finances', limit: 5 }),
    );
    expect(lines.length).toBeGreaterThan(0);
    await kofi.as((tx) => setAgent(tx, kofi.actor, kofi.space, 'Finances', { paused: true }));
    const before = (
      await kofi.as((tx) => history(tx, kofi.space, { client: 'agent:Finances', limit: 50 }))
    ).length;
    await kofi.as((tx) =>
      save(tx, kofi.actor, kofi.space, { entries: [{ kind: 'Mouvement', title: 'Eau' }] }),
    );
    expect(
      (await kofi.as((tx) => history(tx, kofi.space, { client: 'agent:Finances', limit: 50 })))
        .length,
    ).toBe(before);
  });
});
