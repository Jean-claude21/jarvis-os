import { afterEach, describe, expect, it, vi } from 'vitest';
import { openaiTranscriber } from '../src/telegram';

// Her Telegram voice notes: written down with OpenAI when its key is set, never sent anywhere
// otherwise.
describe('her voice notes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('has no transcriber without a key', () => {
    expect(openaiTranscriber(undefined)).toBeNull();
    expect(openaiTranscriber('')).toBeNull();
  });

  it('sends the audio to the transcription and gives back her words', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ text: ' Acheté du pain, 500 francs. ' }), {
        status: 200,
      });
    });
    const transcribe = openaiTranscriber('sk-test')!;
    const text = await transcribe(new Blob([new Uint8Array([1, 2, 3])]), 'voice.oga');
    expect(text).toBe(' Acheté du pain, 500 francs. ');
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/audio/transcriptions');
    const form = calls[0]!.init.body as FormData;
    expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
    expect((form.get('file') as File).name).toBe('voice.oga');
  });

  it('says so when the transcription fails', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    await expect(openaiTranscriber('sk-test')!(new Blob([]), 'v.oga')).rejects.toThrow(/500/);
  });
});
