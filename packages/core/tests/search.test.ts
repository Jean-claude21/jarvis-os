import { beforeAll, describe, expect, it } from 'vitest';
import { find, save } from '../src';
import { person, type Person } from './people';

// Spec 027: search puts the best first (a word in the title before one in a field), and forgives a
// typing slip or a plural when nothing holds every word.
describe('search by words', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { kind: 'Note', title: 'Courses du samedi', data: { text: 'acheter du paracétamol' } },
          { kind: 'Note', title: 'Paracétamol pour Kofi', data: { text: 'deux boîtes' } },
          { kind: 'Note', title: 'Garage', data: { text: 'vidange de la voiture' } },
        ],
      }),
    );
  });

  const titles = async (text: string) =>
    (await ama.as((tx) => find(tx, ama.space, { text }))).map((one) => one.title);

  it('puts an entry whose title holds the word before one whose fields do', async () => {
    expect(await titles('paracetamol')).toEqual(['Paracétamol pour Kofi', 'Courses du samedi']);
  });

  it('forgives a typing slip and a plural', async () => {
    expect(await titles('paracetamool')).toContain('Paracétamol pour Kofi');
    expect(await titles('vidanges')).toEqual(['Garage']);
  });

  it('finds nothing for words far from hers', async () => {
    expect(await titles('ordinateur')).toEqual([]);
  });
});
