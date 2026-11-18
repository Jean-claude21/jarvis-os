import { beforeAll, describe, expect, it } from 'vitest';
import {
  addFile,
  addStoredFile,
  eraseFile,
  fileOf,
  get,
  replaceFile,
  save,
  type Blobs,
} from '../src';
import { person, type Person } from './people';

// v3 médias: the same bytes kept once (a duplicate is the file she has, joined where it was going),
// a file replaced keeps its earlier version, a file erased leaves nothing in storage.
let ama: Person;
const stored = new Map<string, Uint8Array>();
const blobs: Blobs = {
  put: async (key: string, bytes: Uint8Array) => {
    stored.set(key, bytes);
  },
  get: async (key: string) => {
    const bytes = stored.get(key);
    if (!bytes) throw new Error(`No blob ${key}.`);
    return bytes;
  },
  link: async (key: string) => `https://stockage.test/${key}`,
  remove: async (key: string) => {
    stored.delete(key);
  },
} as unknown as Blobs;
const bytesOf = (text: string) => new TextEncoder().encode(text);

beforeAll(async () => {
  ama = await person('Ama');
});

describe('médias', () => {
  it('keeps the same bytes once and joins the file she has', async () => {
    const trip = await ama.as((tx) =>
      save(tx, ama.actor, ama.space, { entries: [{ kind: 'Note', title: 'Voyage à Assinie' }] }),
    );
    const tripId = trip.entries[0]!.id;
    const first = await ama.as((tx) =>
      addFile(tx, ama.actor, blobs, {
        spaceId: ama.space,
        name: 'plage.txt',
        mediaType: 'text/plain',
        bytes: bytesOf('la plage au matin'),
      }),
    );
    expect(first.duplicate).toBeFalsy();
    const again = await ama.as((tx) =>
      addFile(tx, ama.actor, blobs, {
        spaceId: ama.space,
        name: 'copie de plage.txt',
        mediaType: 'text/plain',
        bytes: bytesOf('la plage au matin'),
        links: [{ to: tripId, role: 'pièce de' }],
      }),
    );
    expect(again.duplicate).toBe(true);
    expect(again.entryId).toBe(first.entryId);
    const file = await ama.as((tx) => get(tx, ama.space, first.entryId));
    expect(file?.links.out.some((one) => one.entry.id === tripId)).toBe(true);
    // Different bytes are another file.
    const other = await ama.as((tx) =>
      addFile(tx, ama.actor, blobs, {
        spaceId: ama.space,
        name: 'plage.txt',
        mediaType: 'text/plain',
        bytes: bytesOf('la plage le soir'),
      }),
    );
    expect(other.entryId).not.toBe(first.entryId);
  });

  it('keeps the earlier bytes as a version when a file is replaced', async () => {
    const one = await ama.as((tx) =>
      addFile(tx, ama.actor, blobs, {
        spaceId: ama.space,
        name: 'devis.txt',
        mediaType: 'text/plain',
        bytes: bytesOf('devis v1 : 120 000'),
      }),
    );
    const replaced = await ama.as((tx) =>
      replaceFile(tx, ama.actor, blobs, ama.space, one.entryId, {
        name: 'devis.txt',
        mediaType: 'text/plain',
        bytes: bytesOf('devis v2 : 95 000'),
      }),
    );
    expect(replaced.entryId).toBe(one.entryId);
    expect(replaced.storageKey).not.toBe(one.storageKey);
    expect(new TextDecoder().decode(stored.get(replaced.storageKey))).toContain('v2');
    const entry = await ama.as((tx) => get(tx, ama.space, one.entryId));
    const versions = entry?.data.versions as { n: number; key: string; taille: number }[];
    expect(versions).toHaveLength(1);
    expect(versions[0]!.n).toBe(1);
    expect(versions[0]!.key).toBe(one.storageKey);
    expect(new TextDecoder().decode(stored.get(versions[0]!.key))).toContain('v1');
  });

  it('erases a file, its versions and its thumbnail for good', async () => {
    const one = await ama.as((tx) =>
      addFile(tx, ama.actor, blobs, {
        spaceId: ama.space,
        name: 'brouillon.txt',
        mediaType: 'text/plain',
        bytes: bytesOf('premier jet'),
      }),
    );
    await ama.as((tx) =>
      replaceFile(tx, ama.actor, blobs, ama.space, one.entryId, {
        name: 'brouillon.txt',
        mediaType: 'text/plain',
        bytes: bytesOf('second jet'),
      }),
    );
    const now = await ama.as((tx) => fileOf(tx, ama.space, one.entryId));
    stored.set(`${now!.storageKey}.thumb.webp`, bytesOf('vignette'));
    const done = await ama.as((tx) => eraseFile(tx, ama.actor, blobs, ama.space, one.entryId));
    expect(done.removed).toBe(3);
    expect(stored.has(now!.storageKey)).toBe(false);
    expect(stored.has(one.storageKey)).toBe(false);
    expect(stored.has(`${now!.storageKey}.thumb.webp`)).toBe(false);
    expect(await ama.as((tx) => fileOf(tx, ama.space, one.entryId))).toBeNull();
    const entry = await ama.as((tx) => get(tx, ama.space, one.entryId));
    expect(entry?.archivedAt ?? entry?.data.efface).toBeTruthy();
  });

  it('keeps a file sent in parts like any file', async () => {
    const key = `${ama.space}/up-test`;
    stored.set(key, bytesOf('une longue vidéo'));
    const one = await ama.as((tx) =>
      addStoredFile(tx, ama.actor, {
        spaceId: ama.space,
        storageKey: key,
        name: 'vacances.mp4',
        mediaType: 'video/mp4',
        size: 16,
        empreinte: 'a'.repeat(64),
        links: [],
      }),
    );
    const kept = await ama.as((tx) => fileOf(tx, ama.space, one.entryId));
    expect(kept?.storageKey).toBe(key);
    expect(kept?.mediaType).toBe('video/mp4');
  });
});
