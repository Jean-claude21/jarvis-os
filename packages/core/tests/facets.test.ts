import { beforeAll, describe, expect, it } from 'vitest';
import { kinds, save } from '../src';
import { person, type Person } from './people';

// v3 D4–D5: a kind says what it is (its facets, said or read from its fields), and may extend
// another kind, whose fields it then has.
describe('facets and extended kinds', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Model',
            title: 'Contact',
            data: {
              fields: [
                { name: 'email', type: 'email' },
                { name: 'phone', type: 'phone' },
              ],
            },
          },
          {
            kind: 'Model',
            title: 'Recruteur',
            data: {
              extends: 'Contact',
              fields: [{ name: 'cabinet', type: 'text' }],
            },
          },
          {
            kind: 'Model',
            title: 'Candidature',
            data: {
              fields: [
                { name: 'envoyee', type: 'date' },
                { name: 'status', type: 'choice', options: ['brouillon', 'envoyee', 'entretien'] },
              ],
              facets: [{ facet: 'dated', start: 'envoyee' }],
            },
          },
        ],
      }),
    );
  });

  it('reads facets from the fields, and keeps those a model says', async () => {
    const all = await ama.as((tx) => kinds(tx, ama.space));
    const of = (kind: string) => all.find((one) => one.kind === kind)?.facets?.map((f) => f.facet);
    expect(of('Contact')).toEqual(['who']);
    expect(of('Candidature')).toEqual(['dated']);
  });

  it("gives a child its parent's fields, on save and in its facets", async () => {
    const saved = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          {
            kind: 'Recruteur',
            title: 'Sarah',
            data: { email: 'sarah@exemple.fr', cabinet: 'Talents' },
          },
        ],
      }),
    );
    expect(saved.entries[0]!.id).toBeTruthy();
    const all = await ama.as((tx) => kinds(tx, ama.space));
    const recruteur = all.find((one) => one.kind === 'Recruteur');
    expect(recruteur?.parent).toBe('Contact');
    expect(recruteur?.facets?.map((f) => f.facet)).toContain('who');
  });
});
