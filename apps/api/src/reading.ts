import { asPerson, filesToRead, setFileWords, type Blobs } from '@jarvis-os/core';
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
    const worker = await createWorker(['fra', 'eng'], 1, { cachePath: tmpdir() });
    try {
      const { data } = await worker.recognize(Buffer.from(bytes));
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
    try {
      const bytes = await blobs.get(file.storageKey);
      const text = await within(readWords(bytes, file.mediaType), READ_TIMEOUT_MS);
      await asPerson(db, file.person, (tx) => setFileWords(tx, file.entryId, { text }));
      report.read += 1;
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
