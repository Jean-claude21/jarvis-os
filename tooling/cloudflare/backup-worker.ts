/**
 * The nightly backup on Cloudflare (spec 022): a Worker whose cron keeps the production database as
 * a Neon branch `backup-main-<day>`, the last three kept — what `pnpm backup` does from a laptop.
 * Its secret NEON_API_KEY and its variable NEON_PROJECT_ID are set by `pnpm cron:deploy`. It prints
 * branch names only.
 */

interface Env {
  NEON_API_KEY: string;
  NEON_PROJECT_ID: string;
}
interface Branch {
  id: string;
  name: string;
  parent_id?: string;
}

const KEEP = 3;
const SOURCE = 'main';

async function neon<T>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(
      `https://console.neon.tech/api/v2/projects/${env.NEON_PROJECT_ID}${path}`,
      {
        method,
        headers: {
          authorization: `Bearer ${env.NEON_API_KEY}`,
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    // Neon answers 423 while another operation runs on the project.
    if (response.status === 423 && attempt < 20) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }
    if (!response.ok) throw new Error(`${method} ${path} → ${response.status}`);
    return (await response.json()) as T;
  }
}

export async function backup(env: Env, now = new Date()): Promise<string[]> {
  const said: string[] = [];
  const branches = async () =>
    (await neon<{ branches: Branch[] }>(env, 'GET', '/branches')).branches;
  const all = await branches();
  const source = all.find((one) => one.name === SOURCE);
  if (!source) throw new Error(`No Neon branch « ${SOURCE} ».`);
  const prefix = `backup-${SOURCE}-`;
  const name = `${prefix}${now.toISOString().slice(0, 10)}`;
  if (all.some((one) => one.name === name)) said.push(`${name} already made`);
  else {
    await neon(env, 'POST', '/branches', {
      branch: { name, parent_id: source.id },
      endpoints: [{ type: 'read_write' }],
    });
    said.push(`${name} made`);
  }
  const now2 = await branches();
  const parents = new Set(now2.map((one) => one.parent_id));
  const ours = now2
    .filter(
      (one) =>
        one.name.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}$/.test(one.name.slice(prefix.length)),
    )
    .sort((a, b) => b.name.localeCompare(a.name));
  for (const old of ours.slice(KEEP)) {
    // A backup a branch was restored from is that branch's parent: Neon keeps it, and so does this.
    if (parents.has(old.id)) {
      said.push(`${old.name} kept: a branch was restored from it`);
      continue;
    }
    await neon(env, 'DELETE', `/branches/${old.id}`);
    said.push(`${old.name} removed`);
  }
  return said;
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    console.log('[backup]', (await backup(env)).join('; '));
  },
};
