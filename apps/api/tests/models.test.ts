import { beforeAll, describe, expect, it } from 'vitest';
import { signUp } from './client';
import { connect, type Connected } from './connect';

// Spec 012 through Claude's door: a model is saved like any entry, `kinds` shows it, `save` keeps it.
let claude: Connected;

beforeAll(async () => {
  claude = await connect(await signUp('Ama'));
});

describe('a model through MCP', () => {
  it('is shown by kinds before any entry, and every save of its kind follows it', async () => {
    const made = await claude.call('save', {
      entries: [
        {
          kind: 'Modèle',
          title: 'Habitude',
          data: {
            champs: [
              { nom: 'cadence', nature: 'texte', obligatoire: true },
              { nom: 'non_negociable', nature: 'oui-non' },
              { nom: 'aspect', nature: 'choix', choix: ['esprit', 'âme', 'corps'] },
            ],
            app: 'Routines',
          },
        },
      ],
    });
    expect(made.isError).toBeFalsy();
    const kinds = await claude.call<{ kind: string; count: number; model?: { app: string } }[]>(
      'kinds',
      {},
    );
    expect(kinds.value.find((one) => one.kind === 'Habitude')).toMatchObject({
      count: 0,
      model: { app: 'Routines' },
    });

    const refused = await claude.call<{ error: string }>('save', {
      entries: [{ kind: 'Habitude', title: 'Gym', data: { frequence: '3 fois', aspect: 'sport' } }],
    });
    expect(refused.isError).toBe(true);
    expect(refused.value.error).toMatch(/« frequence » is not one of its fields/);
    expect(refused.value.error).toMatch(/one of: esprit, âme, corps/);
    expect(refused.value.error).toMatch(/« cadence » is required/);

    const kept = await claude.call('save', {
      entries: [
        {
          kind: 'habitude',
          title: 'Gym',
          data: {
            cadence: 'mar · mer · sam',
            aspect: 'Corps',
            repeat: '30 18 * * 2,3,6',
            duration: 90,
          },
        },
      ],
    });
    expect(kept.isError).toBeFalsy();
  });
});
