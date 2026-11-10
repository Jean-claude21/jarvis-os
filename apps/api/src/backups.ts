import {
  asPerson,
  backupsDue,
  exportMarkdown,
  forgetOldBackups,
  recordBackup,
  type Blobs,
} from '@jarvis-os/core';
import type pg from 'pg';
import { zip } from './zip';

// Each night, each space as a Markdown folder in the storage (spec 022): what `/api/export` gives,
// without the bytes of her files (they stay in the storage, once). Kept thirty days.

/** How many spaces a pass backs up: a pass stays short; the next ones do the rest. */
export const BACKUPS_PER_PASS = 3;

/** One space's backup of `day`, made as `person`; the backups past thirty days removed. */
export async function backupSpace(
  db: pg.Pool,
  blobs: Blobs,
  target: { spaceId: string; person: string },
  day: string,
): Promise<{ storageKey: string; size: number; files: number; removed: string[] }> {
  const { spaceId, person } = target;
  const files = await asPerson(db, person, (tx) => exportMarkdown(tx, spaceId));
  const bytes = zip(files);
  const storageKey = `backups/${spaceId}/${day}.zip`;
  await blobs.put(storageKey, bytes, 'application/zip');
  const removed = await asPerson(db, person, async (tx) => {
    await recordBackup(tx, { spaceId, day, storageKey, size: bytes.length, files: files.length });
    return forgetOldBackups(tx, spaceId, day);
  });
  for (const key of removed) await blobs.remove?.(key);
  return { storageKey, size: bytes.length, files: files.length, removed };
}

/** The backups of the day still missing, a few each pass; how many made, how many failed. */
export async function backupOnce(
  db: pg.Pool,
  blobs: Blobs,
  now: Date,
): Promise<{ made: number; failed: number }> {
  const day = now.toISOString().slice(0, 10);
  const report = { made: 0, failed: 0 };
  for (const target of await backupsDue(db, day, BACKUPS_PER_PASS)) {
    try {
      await backupSpace(db, blobs, target, day);
      report.made += 1;
    } catch (error) {
      console.warn('[watcher] backup', target.spaceId, (error as Error).message);
      report.failed += 1;
    }
  }
  return report;
}
