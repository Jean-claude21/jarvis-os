/**
 * `pnpm backup` — the database of a Neon branch (`main` by default, `--branch <name>`) kept as it is
 * today: a branch `backup-<branch>-<day>`, copied by Neon without moving a byte. The last three are
 * kept; older `backup-<branch>-…` branches (made here, by name) are removed, but one a branch was
 * restored from (Neon makes it that branch's parent). Neon itself goes back
 * six hours on its free plan; these go back three days.
 *
 * `pnpm backup restore --from <backup> [--into <branch>]` — a dry run: what the backup and the
 * branch hold. `--apply` restores the branch from the backup; its state before is kept as
 * `<branch>_before_restore_<stamp>`. The files' bytes live in the branch's storage and are not
 * touched; the Markdown backups of each night are there too.
 *
 * The Neon key comes from `../.secrets/.admin.env` (NEON_API_TOKEN) or the environment; the project
 * from JARVIS_NEON_PROJECT_ID. Owner addresses are asked of Neon and kept in memory. Nothing secret
 * is printed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import pg from 'pg';

const envOf = (path: string): Record<string, string> =>
  existsSync(path)
    ? Object.fromEntries(
        readFileSync(path, 'utf8')
          .split(/\r?\n/)
          .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
          .filter((match): match is RegExpExecArray => match !== null)
          .map((match) => [match[1] ?? '', (match[2] ?? '').trim().replace(/^"|"$/g, '')]),
      )
    : {};
const secrets = envOf('../.secrets/.admin.env');
const local = envOf('.env');
const neonKey = process.env.NEON_API_KEY ?? secrets.NEON_API_KEY ?? secrets.NEON_API_TOKEN;
const projectId = process.env.JARVIS_NEON_PROJECT_ID ?? local.JARVIS_NEON_PROJECT_ID;
if (!neonKey || !projectId) {
  console.error('NEON_API_KEY (or the secrets file) and JARVIS_NEON_PROJECT_ID are required.');
  process.exit(2);
}

const KEEP = 3;
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    branch: { type: 'string', default: 'main' },
    from: { type: 'string' },
    into: { type: 'string', default: 'main' },
    apply: { type: 'boolean', default: false },
  },
});

const API = `https://console.neon.tech/api/v2/projects/${projectId}`;
async function neon<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${neonKey}`,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    // Neon answers 423 while another operation runs on the project.
    if (response.status === 423 && attempt < 60) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (!response.ok)
      throw new Error(
        `${method} ${path.split('?')[0]} → ${response.status} ${await response.text()}`,
      );
    return (await response.json()) as T;
  }
}
async function settled() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const { operations } = await neon<{ operations: { status: string }[] }>(
      'GET',
      '/operations?limit=20',
    );
    if (operations.every((one) => ['finished', 'skipped', 'cancelled'].includes(one.status)))
      return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Neon operations did not settle.');
}
type Branch = { id: string; name: string; created_at: string; parent_id?: string };
const branchesNow = async () => (await neon<{ branches: Branch[] }>('GET', '/branches')).branches;
const named = (branches: Branch[], name: string) => {
  const found = branches.find((one) => one.name === name);
  if (!found) throw new Error(`No Neon branch « ${name} ».`);
  return found;
};
const ownerUrl = async (branch: Branch) => {
  const { uri } = await neon<{ uri: string }>(
    'GET',
    `/connection_uri?branch_id=${branch.id}&database_name=neondb&role_name=neondb_owner`,
  );
  const url = new URL(uri);
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
};

/** What a branch holds: enough to see that a backup is whole. */
async function counts(branch: Branch): Promise<Record<string, number>> {
  const client = new pg.Client({ connectionString: await ownerUrl(branch) });
  await client.connect();
  try {
    const result: Record<string, number> = {};
    for (const table of ['user', 'space', 'entry', 'link', 'journal', 'file']) {
      result[table] = Number(
        (await client.query(`select count(*) as n from "${table}"`)).rows[0].n,
      );
    }
    return result;
  } finally {
    await client.end();
  }
}

if (positionals[0] === 'restore') {
  if (!values.from) {
    console.error('pnpm backup restore --from <backup> [--into <branch>] [--apply]');
    process.exit(2);
  }
  const branches = await branchesNow();
  const source = named(branches, values.from);
  const target = named(branches, values.into);
  console.info(`[backup] ${source.name}`, JSON.stringify(await counts(source)));
  console.info(`[backup] ${target.name}`, JSON.stringify(await counts(target)));
  if (!values.apply) {
    console.info(`[backup] dry run: --apply restores « ${target.name} » from « ${source.name} »`);
  } else {
    const kept = `${target.name}_before_restore_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
    await neon('POST', `/branches/${target.id}/restore`, {
      source_branch_id: source.id,
      preserve_under_name: kept,
    });
    await settled();
    console.info(`[backup] « ${target.name} » restored; its state before kept as « ${kept} »`);
    console.info(
      `[backup] ${target.name}`,
      JSON.stringify(await counts(named(await branchesNow(), target.name))),
    );
  }
} else {
  const branches = await branchesNow();
  const source = named(branches, values.branch);
  const day = new Date().toISOString().slice(0, 10);
  const prefix = `backup-${source.name}-`;
  const name = `${prefix}${day}`;
  if (branches.some((one) => one.name === name)) {
    console.info(`[backup] « ${name} » already made today`);
  } else {
    await neon('POST', '/branches', {
      branch: { name, parent_id: source.id },
      // A compute that sleeps when unused: a backup can be opened and read.
      endpoints: [{ type: 'read_write' }],
    });
    await settled();
    console.info(`[backup] « ${name} » made from « ${source.name} »`);
  }
  const ours = (await branchesNow())
    .filter(
      (one) =>
        /^\d{4}-\d{2}-\d{2}$/.test(one.name.slice(prefix.length)) && one.name.startsWith(prefix),
    )
    .sort((a, b) => b.name.localeCompare(a.name));
  // A backup a branch was restored from is that branch's parent: Neon keeps it, and so does this.
  const parents = new Set((await branchesNow()).map((one) => one.parent_id));
  for (const old of ours.slice(KEEP)) {
    if (parents.has(old.id)) {
      console.info(`[backup] « ${old.name} » kept: a branch was restored from it`);
      continue;
    }
    await neon('DELETE', `/branches/${old.id}`);
    await settled();
    console.info(`[backup] « ${old.name} » removed (${KEEP} kept)`);
  }
}
