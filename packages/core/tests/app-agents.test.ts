import { describe, expect, it } from 'vitest';
import { find, installApp, removeApp, type Bundle } from '../src';
import { person } from './people';

// v3 F7: an app removed takes its idle agents with it; an agent another app still uses stays.
const rule = (title: string, agent: string, app: string) => ({
  title,
  data: { when: { saved: 'Plante' }, then: [{ remind: { text: title } }], agent, app },
});
const jardin: Bundle = {
  app: 'Jardin',
  models: [{ title: 'Plante', data: { fields: [{ name: 'nom', type: 'text' }] } }],
  rules: [rule('Arroser', 'Le Jardinier', 'Jardin'), rule('Rappeler', 'Le Veilleur', 'Jardin')],
  agents: [
    { title: 'Le Jardinier', data: { role: 'Arrose.' } },
    { title: 'Le Veilleur', data: { role: 'Veille.' } },
  ],
};
const maison: Bundle = {
  app: 'Maison',
  models: [{ title: 'Objet', data: { fields: [{ name: 'nom', type: 'text' }] } }],
  rules: [rule('Garantie', 'Le Veilleur', 'Maison')],
};

describe('an app removed, its agents', () => {
  it('sets aside the agents no automation names any more, and keeps the shared one', async () => {
    const ama = await person('Ama');
    await ama.as((tx) => installApp(tx, ama.actor, ama.space, jardin, false));
    await ama.as((tx) => installApp(tx, ama.actor, ama.space, maison, false));
    const done = await ama.as((tx) => removeApp(tx, ama.actor, ama.space, 'Jardin', false));
    expect(done.result.removed).toContain('Agent « Le Jardinier »');
    expect(done.result.removed).not.toContain('Agent « Le Veilleur »');
    const agents = (await ama.as((tx) => find(tx, ama.space, { kind: 'Agent', limit: 10 }))).map(
      (one) => one.title,
    );
    expect(agents).toEqual(['Le Veilleur']);
  });
});
