import { migrate, required } from '@jarvis-os/core';
import pg from 'pg';
import { migrateAccounts } from '../src/migrate';

/** The Neon `test` branch: the core and the accounts migrated, the rows of a previous run cleared. */
export default async function setup() {
  const owner = required('JARVIS_TEST_OWNER_URL');
  await migrate(owner);
  await migrateAccounts(owner);
  const client = new pg.Client({ connectionString: owner });
  await client.connect();
  try {
    await client.query(
      'truncate journal, file, link, entry, member, space, "user" restart identity cascade',
    );
  } finally {
    await client.end();
  }
}
