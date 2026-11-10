// A Neon branch of its own for each CI run (copied from « test » in seconds), so that pull requests
// are checked side by side instead of waiting for one shared database. `create <name>` makes it —
// after removing the run branches older than 90 minutes left by an interrupted run — and writes
// JARVIS_TEST_OWNER_URL, JARVIS_TEST_APP_URL and JARVIS_MIGRATE_URL to $GITHUB_ENV, masked;
// `delete <name>` removes it. It prints no secret.
//
// Environment: NEON_API_KEY, JARVIS_NEON_PROJECT_ID, and the URLs of « test » (JARVIS_TEST_OWNER_URL,
// JARVIS_TEST_APP_URL): a child branch keeps their roles and passwords, only its host differs.
import { appendFileSync } from 'node:fs';

const [, , command, name] = process.argv;
const key = process.env.NEON_API_KEY;
const project = process.env.JARVIS_NEON_PROJECT_ID;
const LIMIT = 10;
const STALE_MS = 90 * 60_000;
if (!key || !project || !name || !['create', 'delete'].includes(command)) {
  console.error(
    'ci-branch create|delete <name>, with NEON_API_KEY and JARVIS_NEON_PROJECT_ID set.',
  );
  process.exit(2);
}

/** What the Neon API answers, as far as this tool reads it. */
interface Neon {
  branches: { id: string; name: string; created_at: string }[];
  branch: { id: string };
  endpoints: { id: string }[];
  operations: { status: string }[];
}

const api = async (method: string, path: string, body?: unknown): Promise<Neon> => {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`https://console.neon.tech/api/v2/projects/${project}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 423 && attempt < 60) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (method === 'DELETE' && response.status === 404) return {} as Neon;
    if (!response.ok) throw new Error(`${method} ${path.split('?')[0]} → ${response.status}`);
    return (await response.json()) as Neon;
  }
};
const branches = async () => (await api('GET', '/branches')).branches;

if (command === 'delete') {
  const found = (await branches()).find((one) => one.name === name);
  if (found) await api('DELETE', `/branches/${found.id}`);
  console.log(`[ci-branch] ${name} ${found ? 'removed' : 'already gone'}`);
  process.exit(0);
}

// The run branches an interrupted run left behind.
for (const one of await branches()) {
  if (one.name.startsWith('ci-') && Date.now() - Date.parse(one.created_at) > STALE_MS) {
    await api('DELETE', `/branches/${one.id}`);
    console.log(`[ci-branch] ${one.name} removed (left by an interrupted run)`);
  }
}
const all = await branches();
if (all.length >= LIMIT) {
  console.error(
    `[ci-branch] the project holds ${all.length} branches, its limit: remove a backup or a run branch (${all.map((one) => one.name).join(', ')}).`,
  );
  process.exit(1);
}
const test = all.find((one) => one.name === 'test');
if (!test) throw new Error('No branch « test » to copy.');
const made = await api('POST', '/branches', {
  branch: { name, parent_id: test.id },
  endpoints: [{ type: 'read_write' }],
});
const endpoint = made.endpoints[0]!;
// Ready when Neon has finished making it.
for (let attempt = 0; attempt < 90; attempt += 1) {
  const { operations } = await api('GET', `/operations?branch_id=${made.branch.id}&limit=10`);
  if (operations.every((one) => ['finished', 'skipped', 'cancelled'].includes(one.status))) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/** The URL of « test » pointed at the new branch: its endpoint, pooled or not as before. */
const moved = (url: string | undefined) => {
  const parsed = new URL(url ?? '');
  parsed.hostname = parsed.hostname.replace(/^ep-[a-z0-9-]+?(-pooler)?\./, `${endpoint.id}$1.`);
  return parsed.toString();
};
const owner = moved(process.env.JARVIS_TEST_OWNER_URL);
const app = moved(process.env.JARVIS_TEST_APP_URL);
const lines = [
  `JARVIS_TEST_OWNER_URL=${owner}`,
  `JARVIS_TEST_APP_URL=${app}`,
  `JARVIS_MIGRATE_URL=${owner}`,
];
for (const url of [owner, app]) console.log(`::add-mask::${url}`);
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${lines.join('\n')}\n`);
console.log(`[ci-branch] ${name} made from test (${all.length + 1} of ${LIMIT} branches)`);
