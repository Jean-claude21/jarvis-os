import { describe, expect, it } from 'vitest';
import { COMPONENTS, checkPage, componentNamed } from '../src';

// v3 D21: one registry; a component answers to any of its names; a page may name its blocks so.
describe('the components registry', () => {
  it('finds a component by any of its names, accents and case aside', () => {
    expect(componentNamed('Entonnoir')?.id).toBe('funnel');
    expect(componentNamed('liste + détail')?.id).toBe('list_detail');
    expect(componentNamed('JAUGE')?.id).toBe('gauge');
    expect(componentNamed('tableau de bord')?.id).toBe('dashboard');
    expect(componentNamed('rien de tel')).toBeNull();
  });

  it('has one entry per name, and a category and a use for each', () => {
    const names = COMPONENTS.flatMap((one) => [one.id, ...one.aliases].map((n) => n.toLowerCase()));
    expect(new Set(COMPONENTS.map((one) => one.id)).size).toBe(COMPONENTS.length);
    expect(names.length).toBeGreaterThan(COMPONENTS.length);
    for (const one of COMPONENTS) {
      expect(one.when.length).toBeGreaterThan(10);
      expect(one.category).toBeTruthy();
    }
  });

  it('lets a page name its blocks in her words', () => {
    const page = checkPage({
      blocks: [
        { block: 'entonnoir', kind: 'JobOffer', by: 'status', steps: ['new', 'applied'] },
        { block: 'chiffre', query: { kind: 'JobOffer', aggregate: { n: 'count()' } } },
      ],
    });
    expect(page.blocks.map((one) => one.block)).toEqual(['funnel', 'stat']);
    expect(() => checkPage({ blocks: [{ block: 'inconnu' }] })).toThrow();
  });
});
