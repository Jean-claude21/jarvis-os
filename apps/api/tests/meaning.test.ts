import { entriesToEmbed, type Embedder } from '@jarvis-os/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { embedOnce, searchByMeaning } from '../src/embeddings';
import { server, signUp, type Account } from './client';

// Spec 028 with a model made for the proof: texts that share a theme get close vectors. The entries
// are turned once, again when their words change, and a question finds what its words miss.
const THEMES: Record<string, string[]> = {
  papers: ['passeport', 'visa', 'ambassade', 'papiers', 'consulat', 'identite'],
  health: ['medecin', 'ordonnance', 'pharmacie', 'sante', 'paracetamol'],
  car: ['garage', 'vidange', 'voiture', 'pneus'],
};
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let calls = 0;
const themed: Embedder = {
  model: 'themes-for-the-proof',
  async embed(texts) {
    calls += 1;
    return texts.map((text) => {
      const vector = new Array(1024).fill(0.001) as number[];
      Object.values(THEMES).forEach((words, at) => {
        vector[at] = words.filter((word) => fold(text).includes(word)).length;
      });
      return vector;
    });
  },
};

let ama: Account;
let space: string;
let person: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  ama = await signUp('Ama');
  const me = await ama.json<{ person: { id: string }; space: { id: string } }>('/api/me');
  person = me.body.person.id;
  space = me.body.space.id;
  const saved = await ama.json<{ entries: { id: string; title: string }[] }>('/api/save', {
    entries: [
      { kind: 'Document', title: 'Scan du passeport', data: { text: 'valide jusqu’en 2031' } },
      { kind: 'Note', title: 'Rendez-vous ambassade', data: { text: 'consulat, mardi 9h' } },
      { kind: 'Note', title: 'Garage', data: { text: 'vidange et pneus' } },
    ],
  });
  for (const one of saved.body.entries) ids[one.title] = one.id;
});

describe('search by meaning', () => {
  it('turns her entries into vectors once, and again when their words change', async () => {
    // The base holds other runs' entries too: hers are the latest, turned first.
    const waiting = async () =>
      (await entriesToEmbed(server.db, themed.model, 1000)).map((one) => one.entryId);
    const hers = Object.values(ids);
    expect(await waiting()).toEqual(expect.arrayContaining(hers));
    expect((await embedOnce(server.db, themed)).embedded).toBeGreaterThanOrEqual(3);
    expect((await waiting()).filter((id) => hers.includes(id))).toEqual([]);
    await ama.json('/api/save', {
      entries: [{ id: ids.Garage, data: { text: 'vidange, pneus et voiture lavée' } }],
    });
    expect((await waiting()).filter((id) => hers.includes(id))).toEqual([ids.Garage]);
    await embedOnce(server.db, themed);
    expect((await waiting()).filter((id) => hers.includes(id))).toEqual([]);
  });

  it('finds what the words miss: « papiers pour le visa » reaches the passport scan', async () => {
    const near = await searchByMeaning(
      server.db,
      themed,
      person,
      space,
      'mes papiers pour le visa',
    );
    const titles = near.map((one) => one.title);
    expect(titles.slice(0, 2).sort()).toEqual(['Rendez-vous ambassade', 'Scan du passeport']);
    expect(titles).not.toContain('Garage');
  });

  it('answers nothing without a model', async () => {
    expect(await searchByMeaning(server.db, null, person, space, 'visa')).toEqual([]);
    const answer = await ama.json<unknown[]>('/api/search/meaning?text=visa');
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual([]);
  });

  it('keeps her vectors hers', async () => {
    const kofi = await signUp('Kofi');
    const me = await kofi.json<{ person: { id: string } }>('/api/me');
    await expect(
      searchByMeaning(server.db, themed, me.body.person.id, space, 'passeport'),
    ).resolves.toEqual([]);
    expect(calls).toBeGreaterThan(0);
  });
});
