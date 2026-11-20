import { migrate } from '../../packages/core/src/migrate';
import { required } from '../../packages/core/src/env';

/**
 * The test database migrated before the server starts. Nothing is cleared: each test signs up an
 * account of its own, so the runs never step on each other.
 */
export default async function setup() {
  await migrate(required('JARVIS_TEST_OWNER_URL'));
}
