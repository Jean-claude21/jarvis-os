import { describe, expect, it } from 'vitest';
import { agentsOf, find, history, save, setAgent, toSortOf } from '../src';
import { person } from './people';

// v3 D12: an agent is a named setting of the one node — its rules run where they always ran, and
// its Pause, its autonomy and its name apply there.
describe('an agent', () => {
  it('signs its work, stops when paused, and proposes when told to', async () => {
    const ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Rule',
            title: 'Arroser la plante',
            data: {
              when: { saved: 'Plante' },
              then: [{ create: { kind: 'Task', title: 'Arroser {title}', link: 'for' } }],
              agent: 'Le Jardinier',
            },
          },
        ],
      }),
    );
    const plant = (title: string) =>
      ama.as((tx) => save(tx, ama.actor, ama.space, { entries: [{ kind: 'Plante', title }] }));
    const tasks = async () =>
      (await ama.as((tx) => find(tx, ama.space, { kind: 'Task', limit: 50 }))).map((t) => t.title);

    // Its rule runs, signed with its name.
    await plant('Ficus');
    expect(await tasks()).toContain('Arroser Ficus');
    const signed = await ama.as((tx) =>
      history(tx, ama.space, { client: 'agent:Le Jardinier', limit: 10 }),
    );
    expect(signed.length).toBeGreaterThan(0);
    const listed = await ama.as((tx) => agentsOf(tx, ama.space));
    expect(listed.map((one) => one.title)).toEqual(
      expect.arrayContaining(['Le Jardinier', 'Secrétaire des papiers']),
    );

    // Paused, it does nothing.
    await ama.as((tx) => setAgent(tx, ama.actor, ama.space, 'Le Jardinier', { paused: true }));
    await plant('Monstera');
    expect(await tasks()).not.toContain('Arroser Monstera');
    expect(
      (await ama.as((tx) => agentsOf(tx, ama.space))).find((a) => a.title === 'Le Jardinier')
        ?.state,
    ).toBe('paused');

    // In « propose », what it would write waits for her yes.
    await ama.as((tx) =>
      setAgent(tx, ama.actor, ama.space, 'Le Jardinier', { paused: false, autonomy: 'propose' }),
    );
    await plant('Basilic');
    expect(await tasks()).not.toContain('Arroser Basilic');
    const waiting = await ama.as((tx) => toSortOf(tx, [ama.space]));
    expect(
      waiting.some((one) => one.type === 'proposal' && one.title.includes('Le Jardinier')),
    ).toBe(true);
  });

  it('a built-in agent gets its entry when she changes it', async () => {
    const lea = await person('Léa');
    const made = await lea.as((tx) =>
      setAgent(tx, lea.actor, lea.space, 'Secrétaire des papiers', { paused: true }),
    );
    expect(made.id).toBeTruthy();
    expect(made.data.builtin).toEqual(['lecture']);
    await expect(
      lea.as((tx) => setAgent(tx, lea.actor, lea.space, 'Personne', { paused: true })),
    ).rejects.toThrow(/No agent/);
  });
});
