import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import pg from 'pg';
import { required } from './env';

const folder = fileURLToPath(new URL('../db/migrations/', import.meta.url));

/**
 * Applies the migrations not applied yet, in order, each in its own transaction, as the owner.
 * Migrations are additive: a file once applied is never edited.
 */
export async function migrate(ownerUrl: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query(
      'create table if not exists jarvis_migration (name text primary key, at timestamptz not null default now())',
    );
    const done = new Set(
      (await client.query<{ name: string }>('select name from jarvis_migration')).rows.map(
        (row) => row.name,
      ),
    );
    const applied: string[] = [];
    for (const name of readdirSync(folder)
      .filter((file) => file.endsWith('.sql'))
      .sort()) {
      if (done.has(name)) continue;
      await client.query('begin');
      try {
        await client.query(readFileSync(`${folder}${name}`, 'utf8'));
        await client.query('insert into jarvis_migration (name) values ($1)', [name]);
        await client.query('commit');
        applied.push(name);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${name} failed: ${(error as Error).message}`);
      }
    }
    return applied;
  } finally {
    await client.end();
  }
}

// `pnpm db:migrate`: the branch named by JARVIS_MIGRATE_URL, else the dev branch.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.JARVIS_MIGRATE_URL || required('JARVIS_DEV_OWNER_URL');
  const applied = await migrate(url);
  console.info(applied.length ? `applied: ${applied.join(', ')}` : 'nothing to apply');
}
