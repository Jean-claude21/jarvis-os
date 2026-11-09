import type pg from 'pg';
import type { Tx } from './db';

// Each night, each space as a Markdown folder in the storage (spec 022), kept thirty days: a row per
// backup, read by the space's members. The watcher finds what is missing and acts as a member.

export const BACKUP_KEEP_DAYS = 30;

export interface SpaceBackup {
  id: number;
  spaceId: string;
  day: string;
  storageKey: string;
  size: number;
  files: number;
  createdAt: string;
}

/** The spaces without a backup of `day`, each with the member who backs it up. */
export async function backupsDue(
  db: pg.Pool,
  day: string,
  max: number,
): Promise<{ spaceId: string; person: string }[]> {
  const { rows } = await db.query<{ space_id: string; person: string }>(
    'select space_id, person from jarvis_backup_due($1, $2)',
    [day, max],
  );
  return rows.map((row) => ({ spaceId: row.space_id, person: row.person }));
}

const backupOf = (row: Record<string, unknown>): SpaceBackup => ({
  id: Number(row.id),
  spaceId: String(row.space_id),
  day: String(row.day),
  storageKey: String(row.storage_key),
  size: Number(row.size),
  files: Number(row.files),
  createdAt: new Date(row.created_at as string).toISOString(),
});
const columns = `id, space_id, to_char(day, 'YYYY-MM-DD') as day, storage_key, size, files, created_at`;

/** A backup made: written once a day per space. */
export async function recordBackup(
  tx: Tx,
  backup: { spaceId: string; day: string; storageKey: string; size: number; files: number },
): Promise<void> {
  await tx.query(
    `insert into space_backup (space_id, day, storage_key, size, files) values ($1, $2, $3, $4, $5)
     on conflict (space_id, day) do nothing`,
    [backup.spaceId, backup.day, backup.storageKey, backup.size, backup.files],
  );
}

/** A space's backups, the latest first. */
export async function backupsOf(tx: Tx, spaceId: string): Promise<SpaceBackup[]> {
  const { rows } = await tx.query(
    `select ${columns} from space_backup where space_id = $1 order by day desc`,
    [spaceId],
  );
  return rows.map(backupOf);
}

/** A space's backups older than the days kept, removed from the list; their keys to remove. */
export async function forgetOldBackups(tx: Tx, spaceId: string, day: string): Promise<string[]> {
  const { rows } = await tx.query<{ storage_key: string }>(
    `delete from space_backup where space_id = $1 and day <= $2::date - $3::integer
     returning storage_key`,
    [spaceId, day, BACKUP_KEEP_DAYS],
  );
  return rows.map((row) => row.storage_key);
}
