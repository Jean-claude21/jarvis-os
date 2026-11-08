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

const NAME = 'jarvis-os';
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

const secrets = envOf(process.argv[2] ?? '../.secrets/atelier-admin.env');
const apiKey = secrets.NEON_API_KEY ?? process.env.NEON_API_KEY;
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

const appPassword = current.JARVIS_APP_PASSWORD || randomBytes(24).toString('base64url');

/**
 * The role the application connects with: it logs in, never bypasses RLS, owns nothing. Made on
 * `main` before the branches, so they inherit it with the same password.
 */
async function appRole(projectId: string, mainId: string) {
  const client = new pg.Client({ connectionString: await uri(projectId, mainId, 'neondb_owner') });
  await client.connect();
  try {
    const { rowCount } = await client.query("select 1 from pg_roles where rolname = 'jarvis_app'");
    if (!rowCount) {
      await client.query(`create role jarvis_app login nobypassrls password '${appPassword}'`);
      console.info('role jarvis_app created');
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
const lines = [
  `# Jarvis OS — Neon project ${projectId} (written by pnpm provision; never commit).`,
  `JARVIS_NEON_PROJECT_ID=${projectId}`,
  `JARVIS_APP_PASSWORD=${appPassword}`,
];
for (const name of BRANCHES) {
  const branch = all[name];
  const prefix = `JARVIS_${name.toUpperCase()}`;
  const files = await storage(projectId, branch, prefix);
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
  '',
);
writeFileSync('.env', lines.join('\n'));
console.info(
  `.env written: project ${projectId}, branches ${BRANCHES.join(', ')}, storage on each.`,
);
