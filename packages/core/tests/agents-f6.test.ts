import { describe, expect, it } from 'vitest';
import {
  agentsOf,
  briefOnce,
  capture,
  find,
  get,
  history,
  recentMessages,
  remember,
  save,
  setAgent,
  setPreferences,
} from '../src';
import { db, person } from './people';

// v3 F6: the morning brief and the reminders are agents (paused in one gesture, signed with their
// name); a rule starts on a phrase or a message; an agent keeps a memory and reports on Telegram.
describe('agents, F6', () => {
  it('the morning brief is an agent: paused, no brief; resumed, it signs its work', async () => {
    const ama = await person('Ama');
    await ama.as(async (tx) => {
      await save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Channel', title: 'Jarvis', data: { telegram: '42', timezone: 'UTC' } }],
      });
      await setPreferences(tx, ama.actor, { brief: '07:00' });
    });
    const morning = new Date('2026-11-19T07:05:00Z');
    const tell = async () => true;
    const brief = (await ama.as((tx) => agentsOf(tx, ama.space))).find(
      (one) => one.title === 'Assistant du matin',
    );
    expect(brief?.when).toBe('chaque jour à 07:00');
    expect((await ama.as((tx) => agentsOf(tx, ama.space))).map((one) => one.title)).toContain(
      'Gardien des rappels',
    );

    await ama.as((tx) =>
      setAgent(tx, ama.actor, ama.space, 'Assistant du matin', { paused: true }),
    );
    expect(await briefOnce(db, ama.id, morning, tell)).toBeNull();
    const [channel] = await ama.as((tx) => find(tx, ama.space, { kind: 'Channel', limit: 1 }));
    expect(channel!.data.brief_sent).toBeUndefined();

    await ama.as((tx) =>
      setAgent(tx, ama.actor, ama.space, 'Assistant du matin', { paused: false }),
    );
    expect(await briefOnce(db, ama.id, morning, tell)).toBe(true);
    const signed = await ama.as((tx) =>
      history(tx, ama.space, { client: 'agent:Assistant du matin', limit: 5 }),
    );
    expect(signed.length).toBeGreaterThan(0);
  });

  it('a phrase starts its rule and files her words; a message rule reads what reaches her', async () => {
    const kofi = await person('Kofi');
    await kofi.as((tx) =>
      save(tx, kofi.actor, kofi.space, {
        entries: [
          {
            kind: 'Rule',
            title: 'Bilan sur demande',
            data: {
              when: { phrase: '/bilan' },
              then: [{ create: { kind: 'Task', title: 'Écrire le bilan', link: 'from' } }],
              agent: 'Le Bilan',
            },
          },
          {
            kind: 'Rule',
            title: 'Urgent',
            data: {
              when: { message: { contains: 'urgent' } },
              then: [{ create: { kind: 'Task', title: 'Rappeler vite', link: 'from' } }],
            },
          },
        ],
      }),
    );
    const said = (text: string) =>
      kofi.as((tx) => capture(tx, kofi.actor, kofi.space, { text, source: 'telegram' }));
    const tasks = async () =>
      (await kofi.as((tx) => find(tx, kofi.space, { kind: 'Task', limit: 20 }))).map(
        (one) => one.title,
      );

    const order = await said('/Bilan semaine');
    expect(await tasks()).toEqual(['Écrire le bilan']);
    expect((await kofi.as((tx) => get(tx, kofi.space, order.id)))?.data.status).toBe('filed');

    const plain = await said('/bilanx et rien');
    expect(await tasks()).toEqual(['Écrire le bilan']);
    expect((await kofi.as((tx) => get(tx, kofi.space, plain.id)))?.data.status).toBe('to_file');

    await said('Appel URGENT du plombier');
    expect((await tasks()).sort()).toEqual(['Rappeler vite', 'Écrire le bilan']);
  });

  it('keeps a memory, and reports on Telegram when she asks', async () => {
    const awa = await person('Awa');
    await awa.as((tx) =>
      save(tx, awa.actor, awa.space, {
        entries: [
          { kind: 'Channel', title: 'Jarvis', data: { telegram: '7' } },
          {
            kind: 'Rule',
            title: 'Arroser',
            data: {
              when: { saved: 'Plante' },
              then: [{ create: { kind: 'Task', title: 'Arroser {title}', link: 'for' } }],
              agent: 'Le Jardinier',
            },
          },
        ],
      }),
    );
    await awa.as((tx) =>
      remember(
        tx,
        awa.actor,
        awa.space,
        'Secrétaire des papiers',
        'Les factures EDF vont dans Maison.',
      ),
    );
    const secretary = (await awa.as((tx) => agentsOf(tx, awa.space))).find(
      (one) => one.title === 'Secrétaire des papiers',
    );
    expect(secretary?.id).toBeTruthy();
    expect(secretary?.memory.map((one) => one.text)).toEqual([
      'Les factures EDF vont dans Maison.',
    ]);

    const reports = async () =>
      (await awa.as((tx) => recentMessages(tx))).filter((one) => one.kind === 'report');
    await awa.as((tx) =>
      save(tx, awa.actor, awa.space, { entries: [{ kind: 'Plante', title: 'Ficus' }] }),
    );
    expect(await reports()).toHaveLength(0);
    await awa.as((tx) =>
      setAgent(tx, awa.actor, awa.space, 'Le Jardinier', { report: 'telegram' }),
    );
    await awa.as((tx) =>
      save(tx, awa.actor, awa.space, { entries: [{ kind: 'Plante', title: 'Basilic' }] }),
    );
    const told = await reports();
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({
      channel: 'telegram',
      subject: 'Le Jardinier',
      body: '« Arroser » : fait.',
    });
  });
});
