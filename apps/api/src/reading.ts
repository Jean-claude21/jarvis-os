import {
  asPerson,
  filesToRead,
  setFileWords,
  understandFile,
  type Actor,
  type Blobs,
} from '@jarvis-os/core';
import { tmpdir } from 'node:os';
import type pg from 'pg';

// Her files read (spec 026), so that `find` and her assistants reach their words: the text of a PDF
// (unpdf) or a Word document (mammoth), what a photo shows in writing (tesseract.js, French and
// English). The watcher reads a few files each pass, after the upload, never during it.

export const READS_PER_PASS = 3;
const READ_TIMEOUT_MS = 45_000;

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** The words of a file, or null when it holds none (a photo without writing). */
export async function readWords(bytes: Uint8Array, mediaType: string): Promise<string | null> {
  if (mediaType === PDF) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim() || null;
  }
  if (mediaType === DOCX) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value.trim() || null;
  }
  if (mediaType.startsWith('image/')) {
    const { createWorker } = await import('tesseract.js');
    // A broken image makes the OCR worker throw outside any promise: caught here, it fails this file
    // only, never the watcher's process (found on her real files, spec 026).
    let broken: unknown = null;
    const worker = await createWorker(['fra', 'eng'], 1, {
      cachePath: tmpdir(),
      errorHandler: (error: unknown) => {
        broken = error;
      },
    });
    try {
      const { data } = await worker.recognize(Buffer.from(bytes)).catch((error: unknown) => {
        throw new Error(`the image cannot be read (${String((broken ?? error) as Error)})`);
      });
      // A photo without writing still gives a few stray signs: only words count.
      const words = data.text.match(/\p{L}{3,}/gu) ?? [];
      return words.length >= 3 ? data.text.trim() : null;
    } finally {
      await worker.terminate();
    }
  }
  return null;
}

const within = <T>(work: Promise<T>, ms: number) =>
  Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`not read within ${ms / 1000} s`)), ms),
    ),
  ]);

/** The files waiting to be read, a few of them; how many read, how many failed. */
export async function readOnce(
  db: pg.Pool,
  blobs: Blobs,
): Promise<{ read: number; failed: number }> {
  const report = { read: 0, failed: 0 };
  for (const file of await filesToRead(db, READS_PER_PASS)) {
    // Marked first: a file whose reading stops the process is not tried again and again.
    await asPerson(db, file.person, (tx) =>
      setFileWords(tx, file.entryId, { error: 'its reading was interrupted' }),
    );
    try {
      const bytes = await blobs.get(file.storageKey);
      const text = await within(readWords(bytes, file.mediaType), READ_TIMEOUT_MS);
      await asPerson(db, file.person, (tx) => setFileWords(tx, file.entryId, { text }));
      report.read += 1;
      if (text)
        await asPerson(db, file.person, (tx) =>
          understandFile(tx, readerOf(file.person), file.spaceId, file.entryId, text),
        ).catch((error) => console.warn('[reading] understand', (error as Error).message));
    } catch (error) {
      const reason = (error as Error).message;
      await asPerson(db, file.person, (tx) =>
        setFileWords(tx, file.entryId, { error: reason }),
      ).catch(() => undefined);
      console.warn('[watcher] reading', file.entryId, reason);
      report.failed += 1;
    }
  }
  return report;
}

/** Who reads: her, through Jarvis's reading — so the journal says where the facts come from. */
const readerOf = (person: string): Actor => ({ person, door: 'app', client: 'lecture' });

/**
 * A file she just gave, read now and understood (v3 V7): its words (at once for a text, within
 * the minute for a PDF or a photo), its genre and facts, and what it makes waiting in « À valider ».
 * The watcher's pass stays the way back for what this one could not finish.
 */
export async function readAndUnderstand(
  db: pg.Pool,
  blobs: Blobs,
  person: string,
  spaceId: string,
  entryId: string,
): Promise<void> {
  const row = await asPerson(db, person, async (tx) => {
    const { rows } = await tx.query<{
      text: string | null;
      read_state: string;
      media_type: string;
      storage_key: string;
    }>(
      'select text, read_state, media_type, storage_key from file where entry_id = $1 and space_id = $2',
      [entryId, spaceId],
    );
    return rows[0];
  });
  if (!row) return;
  let text = row.text;
  if (!text && row.read_state === 'pending') {
    try {
      const bytes = await blobs.get(row.storage_key);
      text = await within(readWords(bytes, row.media_type), READ_TIMEOUT_MS);
      await asPerson(db, person, (tx) => setFileWords(tx, entryId, { text }));
    } catch (error) {
      console.warn('[reading] now', entryId, (error as Error).message);
      return;
    }
  }
  if (text)
    await asPerson(db, person, (tx) =>
      understandFile(tx, readerOf(person), spaceId, entryId, text),
    );
}
