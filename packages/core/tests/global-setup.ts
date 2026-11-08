import pg from 'pg';
import { required } from '../src/env';
import { migrate } from '../src/migrate';

/** The Neon `test` branch, migrated, its rows of a previous run cleared. */
export default async function setup() {
  const owner = required('JARVIS_TEST_OWNER_URL');
  await migrate(owner);
  const client = new pg.Client({ connectionString: owner });
  await client.connect();
  try {
    await client.query(
      'truncate journal, file, link, entry, member, space restart identity cascade',
    );
  } finally {
    await client.end();
  }
}
