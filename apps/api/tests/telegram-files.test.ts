import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Blobs } from '@jarvis-os/core';
import { readTelegramLinks, sentFile } from '../src/telegram';
import { server, signUp } from './client';

// Spec 074: a photo or a document she sends from her linked Telegram is kept as her file, with a
// capture in « À ranger » that carries it; an unlinked chat keeps nothing.

const memory = (): Blobs & { kept: Map<string, Uint8Array> } => {
  const kept = new Map<string, Uint8Array>();
  return {
    kept,
    put: async (key, bytes) => void kept.set(key, bytes),
    get: async (key) => kept.get(key) ?? new Uint8Array(),
    link: async (key) => `https://files.test/${key}`,
  };
};

/** Telegram, as the bot sees it: one update, the file it holds, and the answers sent. */
function telegram(message: Record<string, unknown>) {
  const said: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.includes('/getUpdates'))
      return Response.json({ ok: true, result: [{ update_id: Date.now(), message }] });
    if (url.includes('/getFile'))
      return Response.json({ ok: true, result: { file_path: 'photos/file_1.jpg' } });
    if (url.includes('/file/bot')) return new Response(new Uint8Array([255, 216, 255, 1, 2, 3]));
    if (url.includes('/sendMessage')) {
      said.push(String(JSON.parse(String(init?.body)).text));
      return Response.json({ ok: true });
    }
    return new Response('not found', { status: 404 });
  });
  return said;
}

describe('her Telegram keeps photos and documents', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('picks the largest photo, or the document and its name', () => {
    expect(
      sentFile({
        date: 1_794_000_000,
        photo: [
          { file_id: 'small', file_size: 900 },
          { file_id: 'large', file_size: 90_000 },
        ],
      }),
    ).toMatchObject({ fileId: 'large', mediaType: 'image/jpeg', label: 'Photo' });
    expect(
      sentFile({
        document: { file_id: 'd', file_name: 'releve.pdf', mime_type: 'application/pdf' },
      }),
    ).toEqual({
      fileId: 'd',
      name: 'releve.pdf',
      mediaType: 'application/pdf',
      label: 'Document : releve.pdf',
    });
    expect(sentFile({})).toBeNull();
  });

  it('keeps a photo with its caption as a capture, the file linked to it', async () => {
    const ama = await signUp('Ama');
    const chat = String(Math.floor(Math.random() * 1e9) + 1e9);
    expect(
      (
        await ama.json('/api/save', {
          entries: [{ kind: 'Channel', title: 'Telegram', data: { telegram: chat } }],
        })
      ).status,
    ).toBe(200);
    const blobs = memory();
    const said = telegram({
      date: Math.floor(Date.now() / 1000),
      chat: { id: Number(chat) },
      caption: 'Reçu pharmacie 12,50 €',
      photo: [
        { file_id: 'p1', file_size: 10 },
        { file_id: 'p2', file_size: 20 },
      ],
    });
    const count = await readTelegramLinks(
      server.db,
      'tok',
      'linked',
      { kept: 'Gardé', filed: 'Rangé', unkept: 'Pas gardé' },
      null,
      blobs,
    );
    expect(count).toBe(1);
    expect(said).toEqual(['Gardé']);
    expect(blobs.kept.size).toBe(1);
    const inbox =
      await ama.json<{ id: string; title: string; data: Record<string, unknown> }[]>('/api/inbox');
    const kept = inbox.body.find((one) => one.title === 'Reçu pharmacie 12,50 €');
    expect(kept?.data.source).toBe('telegram');
    const files = await ama.json<
      { id: string; title: string }[] | { files: { id: string; title: string }[] }
    >('/api/files');
    const list = Array.isArray(files.body) ? files.body : files.body.files;
    expect(list.some((one) => one.title.startsWith('photo-'))).toBe(true);
  });

  it('keeps nothing from a chat that is not linked', async () => {
    const blobs = memory();
    const said = telegram({
      date: Math.floor(Date.now() / 1000),
      chat: { id: 7 },
      document: { file_id: 'd', file_name: 'x.pdf', mime_type: 'application/pdf' },
    });
    expect(
      await readTelegramLinks(
        server.db,
        'tok',
        'linked',
        { kept: 'Gardé', filed: 'Rangé' },
        null,
        blobs,
      ),
    ).toBe(0);
    expect(blobs.kept.size).toBe(0);
    expect(said).toEqual([]);
  });
});
