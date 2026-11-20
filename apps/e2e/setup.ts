import { migrate } from '../../packages/core/src/migrate';
import { required } from '../../packages/core/src/env';
import { migrateAccounts } from '../api/src/migrate';

/**
 * The test database migrated before the server starts — the core's tables, and the accounts'
 * (better-auth). Nothing is cleared: each test signs up an account of its own, so the runs never
 * step on each other.
 */
export default async function setup() {
  const owner = required('JARVIS_TEST_OWNER_URL');
  await migrate(owner);
  await migrateAccounts(owner);
}
