import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { fingerprintOf } from './agenda';
import type { Tx } from './db';
import { prefixedId } from './ids';

// Personal keys (spec 015): what an app of her own (the Jarvis desktop or phone app) uses to reach
// her life through the REST API. Made in her settings, shown once, revoked at will; only the key's
// fingerprint is kept.

export const KEY_PREFIX = 'jos_';

export interface PersonalKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** A new key for her: the key itself, to show once, and what is kept of it. */
export async function createKey(
  tx: Tx,
  person: string,
  name: string,
): Promise<{ key: string; id: string }> {
  const label = name.trim().slice(0, 80);
  if (!label) throw new Error('A key needs a name (« Jarvis desktop »).');
  const key = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  const id = prefixedId('key');
  await tx.query(
    'insert into personal_key (id, person_id, name, fingerprint) values ($1, $2, $3, $4)',
    [id, person, label, fingerprintOf(key)],
  );
  return { key, id };
}

/** Her keys still valid, the latest first. */
export async function keysOf(tx: Tx): Promise<PersonalKey[]> {
  const { rows } = await tx.query<PersonalKey>(
    `select id, name,
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
            to_char(last_used_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "lastUsedAt"
       from personal_key where revoked_at is null order by created_at desc`,
  );
  return rows;
}

/** A key that answers nothing any more. */
export async function revokeKey(tx: Tx, id: string): Promise<void> {
  const { rowCount } = await tx.query(
    'update personal_key set revoked_at = now() where id = $1 and revoked_at is null',
    [id],
  );
  if (!rowCount) throw new Error(`No key ${id} to revoke.`);
}

/** Whose a key is (and its use noted), or null. */
export async function keyOwner(db: pg.Pool, key: string): Promise<string | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const fingerprint = fingerprintOf(key);
  const { rows } = await db.query<{ person: string | null }>(
    'select jarvis_key_owner($1) as person',
    [fingerprint],
  );
  return rows[0]?.person ?? null;
}
