import { required } from '@jarvis-os/core';
import { getSchema } from 'better-auth/db';
import { getMigrations } from 'better-auth/db/migration';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { makeAuth } from './auth';

/**
 * The accounts' tables, as Better Auth needs them, made or completed by the owner; then granted to
 * `jarvis_app`. They are global by nature (an account is not in a space) and never granted to
 * `jarvis_reader`. Only Better Auth's own tables: every other table's grants are the core
 * migrations' business (spec 021 found the lease, the outbox and others granted here by mistake).
 */
export async function migrateAccounts(ownerUrl: string): Promise<string[]> {
  const owner = new pg.Pool({ connectionString: ownerUrl, max: 2 });
  try {
    const auth = makeAuth({
      db: owner,
      secret: 'migration-only-secret-not-used-to-sign-anything',
      publicUrl: 'http://localhost',
      quiet: true,
    });
    const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    for (const name of Object.keys(getSchema(auth.options))) {
      await owner.query(`grant select, insert, update, delete on table "${name}" to jarvis_app`);
    }
    return [...toBeCreated, ...toBeAdded].map((table) => table.table);
  } finally {
    await owner.end();
  }
}

// `pnpm db:migrate`: the branch named by JARVIS_MIGRATE_URL, else the dev branch.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.JARVIS_MIGRATE_URL || required('JARVIS_DEV_OWNER_URL');
  const changed = await migrateAccounts(url);
  console.info(changed.length ? `accounts: ${changed.join(', ')}` : 'accounts: nothing to apply');
}
