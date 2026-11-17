import { beforeAll, describe, expect, it } from 'vitest';
import {
  decide,
  history,
  installApp,
  modelsOf,
  proposeApp,
  save,
  toSortOf,
  undo,
  updateApp,
  type Bundle,
} from '../src';
import { person, type Person } from './people';

// v3 D14: an app in layers — an update takes the new release where she changed nothing, keeps what
// she changed (and says when the app changed it too), keeps her own fields, undone at once.
const v1: Bundle = {
  app: 'Jardin',
  release: 1,
  models: [
    {
      title: 'Plante',
      data: {
        fields: [
          { name: 'arrosage', type: 'text' },
          { name: 'lumiere', type: 'choice', options: ['ombre', 'soleil'] },
        ],
      },
    },
  ],
};
const v2: Bundle = {
  app: 'Jardin',
  release: 2,
  models: [
    {
      title: 'Plante',
      data: {
        fields: [
          { name: 'arrosage', type: 'text', help: 'Tous les combien' },
          { name: 'lumiere', type: 'choice', options: ['ombre', 'mi-ombre', 'soleil'] },
          { name: 'rempotage', type: 'date' },
        ],
      },
    },
    { title: 'Arrosage', data: { fields: [{ name: 'quand', type: 'datetime' }] } },
  ],
};

describe('an app in layers', () => {
  let ama: Person;
  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) => installApp(tx, ama.actor, ama.space, v1, false));
    // She changes « lumiere » her way and adds a field of her own.
    const plante = (await ama.as((tx) => modelsOf(tx, ama.space))).find(
      (m) => m.kind === 'Plante',
    )!;
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            id: plante.id,
            data: {
              fields: [
                { name: 'arrosage', type: 'text' },
                { name: 'lumiere', type: 'choice', options: ['ombre', 'soleil', 'serre'] },
                { name: 'surnom', type: 'text' },
              ],
            },
          },
        ],
      }),
    );
  });

  it('takes the new release where she changed nothing, and keeps what she made', async () => {
    const tried = await ama.as((tx) => updateApp(tx, ama.actor, ama.space, v2, true));
    expect(tried.result.updated).toContain('Model « Plante »');
    expect(tried.result.created).toContain('Model « Arrosage »');
    expect(tried.result.conflicts).toEqual(['Model « Plante » : fields.lumiere']);

    await ama.as((tx) => updateApp(tx, ama.actor, ama.space, v2, false));
    const plante = (await ama.as((tx) => modelsOf(tx, ama.space))).find(
      (m) => m.kind === 'Plante',
    )!;
    const byName = Object.fromEntries(plante.fields.map((field) => [field.name, field]));
    expect(byName.arrosage?.help).toBe('Tous les combien');
    expect(byName.lumiere?.options).toEqual(['ombre', 'soleil', 'serre']);
    expect(byName.surnom).toBeTruthy();
    expect(byName.rempotage?.type).toBe('date');

    // Done already: nothing more.
    const again = await ama.as((tx) => updateApp(tx, ama.actor, ama.space, v2, true));
    expect(again.result.updated).toEqual([]);
  });

  it('is undone at once', async () => {
    const [line] = await ama.as((tx) =>
      history(tx, ama.space, { commands: ['app.update'], limit: 1 }),
    );
    expect(line?.command).toBe('app.update');
    await ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: line!.id }));
    const kinds = (await ama.as((tx) => modelsOf(tx, ama.space))).map((m) => m.kind);
    expect(kinds).not.toContain('Arrosage');
    const plante = (await ama.as((tx) => modelsOf(tx, ama.space))).find(
      (m) => m.kind === 'Plante',
    )!;
    expect(plante.fields.some((field) => field.name === 'rempotage')).toBe(false);
  });
});

// v3 D14: an app an assistant designed waits in « À valider »; her yes installs it.
describe('an app proposed to her', () => {
  it('waits with what it makes, and her yes installs it', async () => {
    const lea = await person('Léa');
    const made = await lea.as((tx) =>
      proposeApp(tx, lea.actor, lea.space, { ...v1, app: 'Potager' }, 'Pour suivre tes plantes'),
    );
    const waiting = await lea.as((tx) => toSortOf(tx, [lea.space]));
    const one = waiting.find((item) => item.id === made.id);
    expect(one?.type).toBe('app');
    expect(one?.detail.makes).toEqual(['Plante']);
    await lea.as((tx) => decide(tx, lea.actor, lea.space, made.id, true));
    const kinds = (await lea.as((tx) => modelsOf(tx, lea.space))).map((m) => m.kind);
    expect(kinds).toContain('Plante');
    const after = await lea.as((tx) => toSortOf(tx, [lea.space]));
    expect(after.some((item) => item.id === made.id)).toBe(false);
  });
});
