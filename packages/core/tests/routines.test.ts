import { beforeAll, describe, expect, it } from 'vitest';
import { decide, get, proposeStructure, routineToFollow, save, structureFromText } from '../src';
import { person, type Person } from './people';

// Spec 047: a routine in five parts; one kept as text proposed in that shape, for her yes.
const text = [
  'Chaque soir à 21h30, fais mon bilan de la journée.',
  'Regarde mon agenda de demain et mes objectifs.',
  '- Ce qui a marché',
  '- Ce qui a coincé',
  'Ton bref et chaleureux, tutoie-moi.',
  'Crée un Bilan avec mes réponses. Je dis /bilan.',
].join('\n');

describe('structured routines', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('reads a routine kept as text into its five parts', () => {
    expect(structureFromText('Bilan du soir', text)).toMatchObject({
      trigger: { repeat: '30 21 * * *', phrases: ['/bilandusoir', '/bilan'] },
      prepare: ['agenda_today', 'mirror_day', 'goals'],
      references: {
        style: 'Ton bref et chaleureux, tutoie-moi.',
        criteria: ['Ce qui a marché', 'Ce qui a coincé'],
      },
      result: { kind: 'Bilan' },
    });
  });

  it('proposes it in that shape; on her yes, Jarvis prepares it when she follows it', async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [{ kind: 'Routine', title: 'Bilan du soir', data: { instruction: text } }],
      }),
    );
    const id = saved.entries[0]!.id;
    expect(await ama.as((tx) => routineToFollow(tx, [ama.space], ama.space, id))).toMatchObject({
      structured: false,
    });
    const proposal = await ama.as((tx) => proposeStructure(tx, ama.actor, ama.space, id));
    await ama.as((tx) => decide(tx, ama.actor, ama.space, proposal.entries[0]!.id, true));
    const routine = await ama.as((tx) => get(tx, ama.space, id));
    expect(routine!.data).toMatchObject({ repeat: '30 21 * * *', remind: ['0 min'] });
    const follow = await ama.as((tx) => routineToFollow(tx, [ama.space], ama.space, id));
    expect(follow.structured).toBe(true);
    expect(Object.keys((follow as { prepared: object }).prepared).sort()).toEqual([
      'agenda_today',
      'goals',
      'mirror_day',
    ]);
  });
});
