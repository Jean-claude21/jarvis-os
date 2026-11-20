/**
 * `pnpm provision [secrets file]` — the Neon project of Jarvis OS, made once and idempotent: the
 * project in Frankfurt (object storage is available there, and it is in the EU), its `dev` and
 * `test` branches beside `main`, the application role that cannot bypass row-level security, and
 * each branch's object storage (a `files` bucket and a scoped credential). Everything a developer
 * needs is written to `.env`, which is never committed; no secret is printed.
 */
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

// The production project, or — `JARVIS_NEON_PROJECT_NAME=jarvis-os-dev pnpm provision` — a project of
// its own for `dev` and `test` (after the Neon quota of 19 Nov 2026): what a laptop and the test
// suites spend never reaches production's compute hours.
const NAME = process.env.JARVIS_NEON_PROJECT_NAME ?? 'jarvis-os';
const SEPARATE = NAME !== 'jarvis-os';
const REGION = 'aws-eu-central-1';
const BRANCHES = ['main', 'dev', 'test'] as const;
type BranchName = (typeof BRANCHES)[number];
const API = 'https://console.neon.tech/api/v2';

const envOf = (path: string): Record<string, string> =>
  existsSync(path)
    ? Object.fromEntries(
        readFileSync(path, 'utf8')
          .split(/\r?\n/)
          .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
          .filter((match): match is RegExpExecArray => match !== null)
          .map((match) => [match[1] ?? '', (match[2] ?? '').replace(/^"|"$/g, '')]),
      )
    : {};

const secrets = {
  ...envOf('../.secrets/.admin.env'),
  ...envOf(process.argv[2] ?? '../.secrets/atelier-admin.env'),
};
const apiKey = secrets.NEON_API_KEY ?? secrets.NEON_API_TOKEN ?? process.env.NEON_API_KEY;
if (!apiKey) throw new Error('NEON_API_KEY is missing (secrets file or environment).');
const current = envOf('.env');

async function neon<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    // A branch still being created answers 423: wait and try again.
    if (response.status === 423 && attempt < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (!response.ok) {
      throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }
}

async function settled(projectId: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const { operations } = await neon<{ operations: { status: string }[] }>(
      'GET',
      `/projects/${projectId}/operations?limit=20`,
    );
    if (operations.every((one) => ['finished', 'skipped', 'cancelled'].includes(one.status)))
      return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Neon operations did not settle.');
}

interface Branch {
  id: string;
  name: string;
}

async function project(): Promise<string> {
  const { projects } = await neon<{ projects: { id: string; name: string }[] }>(
    'GET',
    '/projects?limit=100',
  );
  const found = projects.find((one) => one.name === NAME);
  if (found) return found.id;
  const created = await neon<{ project: { id: string } }>('POST', '/projects', {
    project: { name: NAME, region_id: REGION, pg_version: 17 },
  });
  console.info(`project ${NAME} created in ${REGION}`);
  return created.project.id;
}

async function branches(projectId: string): Promise<Record<BranchName, Branch>> {
  await settled(projectId);
  const list = async () =>
    (
      await neon<{ branches: (Branch & { default: boolean })[] }>(
        'GET',
        `/projects/${projectId}/branches`,
      )
    ).branches;
  let all = await list();
  const main = all.find((one) => one.default)!;
  if (main.name !== 'main') {
    await neon('PATCH', `/projects/${projectId}/branches/${main.id}`, { branch: { name: 'main' } });
  }
  await appRole(projectId, main.id);
  for (const name of ['dev', 'test'] as const) {
    if (all.some((one) => one.name === name)) continue;
    await neon('POST', `/projects/${projectId}/branches`, {
      branch: { name, parent_id: main.id },
      endpoints: [{ type: 'read_write' }],
    });
    console.info(`branch ${name} created`);
  }
  await settled(projectId);
  all = await list();
  const by = (name: BranchName) => all.find((one) => one.name === name)!;
  return { main: { id: main.id, name: 'main' }, dev: by('dev'), test: by('test') };
}

async function uri(projectId: string, branchId: string, role: string, password?: string) {
  const { uri } = await neon<{ uri: string }>(
    'GET',
    `/projects/${projectId}/connection_uri?branch_id=${branchId}&database_name=neondb&role_name=neondb_owner`,
  );
  const url = new URL(uri);
  // The certificate and the host verified, as `pg` will require (« require » is ambiguous).
  url.searchParams.set('sslmode', 'verify-full');
  if (role !== 'neondb_owner') {
    url.username = role;
    url.password = password!;
  }
  return url.toString();
}

let appPassword = current.JARVIS_APP_PASSWORD ?? '';

/**
 * The role the application connects with: it logs in, never bypasses RLS, owns nothing. Made on
 * `main` before the branches, so they inherit it with the same password. When it exists already,
 * its password is never invented nor changed (spec 010: a new one written to `.env` once took
 * production down): it must come from `.env`, or the run stops and says so.
 */
async function appRole(projectId: string, mainId: string) {
  const client = new pg.Client({ connectionString: await uri(projectId, mainId, 'neondb_owner') });
  await client.connect();
  try {
    const { rowCount } = await client.query("select 1 from pg_roles where rolname = 'jarvis_app'");
    if (!rowCount) {
      appPassword ||= randomBytes(24).toString('base64url');
      await client.query(`create role jarvis_app login nobypassrls password '${appPassword}'`);
      console.info('role jarvis_app created');
    } else if (!appPassword) {
      throw new Error(
        'The role jarvis_app exists: set JARVIS_APP_PASSWORD in .env (it is not invented, never changed).',
      );
    }
  } finally {
    await client.end();
  }
}

interface Storage {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

async function storage(projectId: string, branch: Branch, prefix: string): Promise<Storage> {
  const state = await neon<{ enabled: boolean; s3_endpoint: string; region: string }>(
    'GET',
    `/projects/${projectId}/branches/${branch.id}/storage`,
  );
  const known = current[`${prefix}_STORAGE_ACCESS_KEY_ID`];
  const knownSecret = current[`${prefix}_STORAGE_SECRET_ACCESS_KEY`];
  const credential =
    known && knownSecret
      ? { accessKeyId: known, secretAccessKey: knownSecret }
      : await neon<{ token_id: string; s3_secret_access_key: string }>(
          'POST',
          `/projects/${projectId}/branches/${branch.id}/credentials`,
          {
            scopes: ['storage:read', 'storage:write'],
            principal_type: 'user',
            name: `jarvis-os-${branch.name}`,
          },
        ).then((one) => ({ accessKeyId: one.token_id, secretAccessKey: one.s3_secret_access_key }));
  const s3 = new S3Client({
    region: state.region,
    endpoint: state.s3_endpoint,
    credentials: credential,
    forcePathStyle: true,
  });
  try {
    await s3.send(new HeadBucketCommand({ Bucket: 'files' }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: 'files' }));
    console.info(`bucket files created on ${branch.name}`);
  }
  return { endpoint: state.s3_endpoint, region: state.region, ...credential };
}

const projectId = await project();
const all = await branches(projectId);
const lines = SEPARATE
  ? [
      `# Jarvis OS — production in Neon project ${current.JARVIS_NEON_PROJECT_ID ?? '?'}; dev and test in ${projectId} (written by pnpm provision; never commit).`,
      `JARVIS_NEON_PROJECT_ID=${current.JARVIS_NEON_PROJECT_ID ?? ''}`,
      `JARVIS_NEON_DEV_PROJECT_ID=${projectId}`,
      `JARVIS_APP_PASSWORD=${appPassword}`,
    ]
  : [
      `# Jarvis OS — Neon project ${projectId} (written by pnpm provision; never commit).`,
      `JARVIS_NEON_PROJECT_ID=${projectId}`,
      `JARVIS_APP_PASSWORD=${appPassword}`,
    ];
// Production (`main`) is reached by its host only (spec 010): no credential of it lands on a laptop.
if (!SEPARATE)
  lines.push(
    '',
    '# Branch main (production): credentials on its host only',
    `JARVIS_MAIN_BRANCH_ID=${all.main.id}`,
  );
else if (current.JARVIS_MAIN_BRANCH_ID)
  lines.push(
    '',
    '# Branch main (production)',
    `JARVIS_MAIN_BRANCH_ID=${current.JARVIS_MAIN_BRANCH_ID}`,
  );
for (const name of BRANCHES.filter((one) => one !== 'main')) {
  const branch = all[name];
  const prefix = `JARVIS_${name.toUpperCase()}`;
  // In a project of its own (dev and test), a branch whose storage cannot be made keeps the one it
  // had: files are not counted in compute hours.
  const files = await storage(projectId, branch, prefix).catch((error: Error) => {
    const was = {
      endpoint: current[`${prefix}_STORAGE_ENDPOINT`],
      region: current[`${prefix}_STORAGE_REGION`],
      accessKeyId: current[`${prefix}_STORAGE_ACCESS_KEY_ID`],
      secretAccessKey: current[`${prefix}_STORAGE_SECRET_ACCESS_KEY`],
    };
    if (!SEPARATE || !was.endpoint || !was.accessKeyId || !was.secretAccessKey) throw error;
    console.info(`storage of ${name} kept as it was (${error.message})`);
    return was as {
      endpoint: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  });
  lines.push(
    '',
    `# Branch ${name}`,
    `${prefix}_BRANCH_ID=${branch.id}`,
    `${prefix}_OWNER_URL=${await uri(projectId, branch.id, 'neondb_owner')}`,
    `${prefix}_APP_URL=${await uri(projectId, branch.id, 'jarvis_app', appPassword)}`,
    `${prefix}_STORAGE_ENDPOINT=${files.endpoint}`,
    `${prefix}_STORAGE_REGION=${files.region}`,
    `${prefix}_STORAGE_BUCKET=files`,
    `${prefix}_STORAGE_ACCESS_KEY_ID=${files.accessKeyId}`,
    `${prefix}_STORAGE_SECRET_ACCESS_KEY=${files.secretAccessKey}`,
  );
}
lines.push(
  '',
  '# Accounts: one secret per environment, at least 32 characters.',
  `JARVIS_DEV_AUTH_SECRET=${current.JARVIS_DEV_AUTH_SECRET || randomBytes(32).toString('base64url')}`,
  `JARVIS_TEST_AUTH_SECRET=${current.JARVIS_TEST_AUTH_SECRET || randomBytes(32).toString('base64url')}`,
);
// What provisioning does not manage (the tunnel, the Netlify site, Telegram…) is kept as it was.
const managed = /^JARVIS_(NEON_PROJECT_ID|NEON_DEV_PROJECT_ID|APP_PASSWORD|(MAIN|DEV|TEST)_.+)$/;
const kept = Object.entries(current).filter(([key]) => !managed.test(key));
if (kept.length)
  lines.push('', '# Kept as it was', ...kept.map(([key, value]) => `${key}=${value}`));
writeFileSync('.env', [...lines, ''].join('\n'));
console.info(
  `.env written: project ${projectId}, branches ${BRANCHES.join(', ')}, storage on each.`,
);
