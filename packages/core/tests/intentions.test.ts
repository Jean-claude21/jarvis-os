import { beforeAll, describe, expect, it } from 'vitest';
import { attention, capture, find, get, intentionIn, save } from '../src';
import { person, type Person } from './people';

// Spec 040: what she says she will do becomes an intention; said again, the same one once more;
// done by itself when an entry does it; else it comes back to her.
describe('her words', () => {
  it('finds what she means to do', () => {
    expect(intentionIn('Je vais appeler Paul demain')).toBe('appeler Paul demain');
    expect(intentionIn('Il faut que je renouvelle mon passeport.')).toBe(
      'renouvelle mon passeport',
    );
    expect(intentionIn('Demain je passe à la banque')).toBe('passe à la banque');
    expect(intentionIn('I need to book the flight')).toBe('book the flight');
    expect(intentionIn("J'ai payé le taxi 2 000 F")).toBeNull();
    expect(intentionIn('Idée : un potager sur le toit')).toBeNull();
  });
});

describe('her intentions', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('keeps one intention for the same words said again, and brings it back to her', async () => {
    for (const [text, at] of [
      ['Je vais appeler Paul', '2026-10-20T08:00:00.000Z'],
      ['il faut que j’appelle Paul…', '2026-10-27T08:00:00.000Z'],
      ['Ah oui, je dois appeler Paul', '2026-11-03T08:00:00.000Z'],
    ] as const) {
      await ama.as((tx) => capture(tx, ama.actor, ama.space, { text, source: 'telegram', at }));
    }
    const all = await ama.as((tx) => find(tx, ama.space, { kind: 'Intention' }));
    expect(all).toHaveLength(1);
    expect(all[0]!.data).toMatchObject({ status: 'open', text: 'appeler Paul' });
    expect(all[0]!.data.said).toHaveLength(3);
    const now = await ama.as((tx) => attention(tx, [ama.space], new Date('2026-11-10T09:00:00Z')));
    expect(now.items.find((one) => one.group === 'intent')).toMatchObject({
      title: 'Appeler Paul',
      said: { times: 3, since: '2026-10-20T08:00:00.000Z' },
    });
  });

  it('closes when an entry does it, linked to it', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Call', title: 'Appel avec Paul', data: { date: '2026-11-10' } }],
      }),
    );
    const [intention] = await ama.as((tx) => find(tx, ama.space, { kind: 'Intention' }));
    expect(intention!.data.status).toBe('done');
    const full = await ama.as((tx) => get(tx, ama.space, intention!.id));
    expect(full!.links.out).toContainEqual(
      expect.objectContaining({
        role: 'done_by',
        entry: expect.objectContaining({ id: saved.entries[0]!.id }),
      }),
    );
  });
});
