/**
 * `pnpm production` (spec 010) — her life moves from the Neon branch `dev` to `main`, production.
 *
 *   pnpm production             what would happen: the branches, the counts on each. Changes nothing.
 *   pnpm production --apply     restores `main` from `dev` (its previous state kept as a backup
 *                               branch), checks that the application role logs in on `main`, copies
 *                               her files to `main`'s storage, and compares the counts.
 *   pnpm production --switch    sets Netlify's variables for `main` (JARVIS_BRANCH and
 *                               JARVIS_MAIN_*); then `pnpm deploy:prod` from `main` makes it live.
 *
 * Neon and Netlify tokens come from `../.secrets/.admin.env`; `dev`'s credentials from `.env`.
 * No secret is printed, and `main`'s credentials are never written to a file.
 */
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { existsSync, readFileSync } from 'node:fs';
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
const neonKey = secrets.NEON_API_KEY ?? secrets.NEON_API_TOKEN ?? process.env.NEON_API_KEY;
const netlifyToken = secrets.NETLIFY_AUTH_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN;
const projectId = local.JARVIS_NEON_PROJECT_ID;
const site = local.JARVIS_NETLIFY_SITE;
const apply = process.argv.includes('--apply');
const switching = process.argv.includes('--switch');
if (!neonKey || !projectId) throw new Error('NEON_API_KEY (secrets) and .env are required.');

const API = 'https://console.neon.tech/api/v2';
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
    if (response.status === 423 && attempt < 60) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (!response.ok)
      throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
    return (await response.json()) as T;
  }
}
async function settled() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
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
const ownerUrl = async (branchId: string) => {
  const { uri } = await neon<{ uri: string }>(
    'GET',
    `/projects/${projectId}/connection_uri?branch_id=${branchId}&database_name=neondb&role_name=neondb_owner`,
  );
  const url = new URL(uri);
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
};

/** What her life holds on a branch: enough to see that a copy is whole. */
async function counts(connectionString: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const tables = ['user', 'space', 'entry', 'link', 'journal', 'file'];
    const present = (
      await client.query<{ table_name: string }>(
        `select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)`,
        [tables],
      )
    ).rows.map((row) => row.table_name);
    const result: Record<string, number> = {};
    for (const table of tables) {
      result[table] = present.includes(table)
        ? Number((await client.query(`select count(*) n from "${table}"`)).rows[0].n)
        : -1;
    }
    return result;
  } finally {
    await client.end();
  }
}

const { branches } = await neon<{ branches: { id: string; name: string; parent_id?: string }[] }>(
  'GET',
  `/projects/${projectId}/branches`,
);
const main = branches.find((one) => one.name === 'main');
const dev = branches.find((one) => one.name === 'dev');
if (!main || !dev) throw new Error('The branches main and dev are required.');

const before = {
  dev: await counts(await ownerUrl(dev.id)),
  main: await counts(await ownerUrl(main.id)),
};
console.info('[production] counts before', JSON.stringify(before));

if (apply) {
  const backup = `main_before_production_${new Date().toISOString().slice(0, 10)}`;
  console.info(
    `[production] restoring main from dev (main's previous state kept as « ${backup} »)…`,
  );
  await neon('POST', `/projects/${projectId}/branches/${main.id}/restore`, {
    source_branch_id: dev.id,
    preserve_under_name: backup,
  });
  await settled();

  // The application role logs in on `main` with the password Netlify already uses on `dev`.
  const devApp = new URL(local.JARVIS_DEV_APP_URL ?? '');
  const mainApp = new URL(await ownerUrl(main.id));
  mainApp.username = devApp.username;
  mainApp.password = devApp.password;
  const probe = new pg.Client({ connectionString: mainApp.toString() });
  await probe.connect();
  await probe.query('select 1');
  await probe.end();
  console.info('[production] jarvis_app logs in on main');

  // Her files, from dev's storage to main's.
  const storageOf = async (branchId: string) =>
    neon<{ s3_endpoint: string; region: string }>(
      'GET',
      `/projects/${projectId}/branches/${branchId}/storage`,
    );
  const from = new S3Client({
    region: local.JARVIS_DEV_STORAGE_REGION,
    endpoint: local.JARVIS_DEV_STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: local.JARVIS_DEV_STORAGE_ACCESS_KEY_ID ?? '',
      secretAccessKey: local.JARVIS_DEV_STORAGE_SECRET_ACCESS_KEY ?? '',
    },
    forcePathStyle: true,
  });
  const mainStorage = await storageOf(main.id);
  const credential = await neon<{ token_id: string; s3_secret_access_key: string }>(
    'POST',
    `/projects/${projectId}/branches/${main.id}/credentials`,
    {
      scopes: ['storage:read', 'storage:write'],
      principal_type: 'user',
      name: 'jarvis-os-production',
    },
  );
  const to = new S3Client({
    region: mainStorage.region,
    endpoint: mainStorage.s3_endpoint,
    credentials: {
      accessKeyId: credential.token_id,
      secretAccessKey: credential.s3_secret_access_key,
    },
    forcePathStyle: true,
  });
  let copied = 0;
  let token: string | undefined;
  do {
    const page = await from.send(
      new ListObjectsV2Command({ Bucket: 'files', ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) {
      const body = await from.send(new GetObjectCommand({ Bucket: 'files', Key: object.Key }));
      await to.send(
        new PutObjectCommand({
          Bucket: 'files',
          Key: object.Key,
          Body: Buffer.from(await body.Body!.transformToByteArray()),
          ContentType: body.ContentType,
        }),
      );
      copied += 1;
    }
    token = page.NextContinuationToken;
  } while (token);
  console.info(`[production] ${copied} files copied to main's storage`);

  const after = await counts(await ownerUrl(main.id));
  const whole = Object.entries(before.dev).every(([table, n]) => after[table] === n);
  console.info(
    '[production] counts on main after',
    JSON.stringify(after),
    whole ? '— whole' : '— DIFFERENT',
  );
  if (!whole) process.exit(1);

  if (switching) {
    if (!netlifyToken || !site)
      throw new Error('NETLIFY_AUTH_TOKEN and JARVIS_NETLIFY_SITE are required.');
    const netlify = async (method: string, path: string, body?: unknown) => {
      const response = await fetch(`https://api.netlify.com/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${netlifyToken}`, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok && response.status !== 404)
        throw new Error(`Netlify ${method} ${path.split('?')[0]} → ${response.status}`);
      return response;
    };
    const siteInfo = (await (await netlify('GET', `/sites/${site}`)).json()) as {
      account_slug: string;
    };
    const account = siteInfo.account_slug;
    const variables: Record<string, string> = {
      JARVIS_BRANCH: 'main',
      JARVIS_MAIN_APP_URL: mainApp.toString(),
      JARVIS_MAIN_AUTH_SECRET: local.JARVIS_DEV_AUTH_SECRET ?? '',
      JARVIS_MAIN_STORAGE_ENDPOINT: mainStorage.s3_endpoint,
      JARVIS_MAIN_STORAGE_REGION: mainStorage.region,
      JARVIS_MAIN_STORAGE_BUCKET: 'files',
      JARVIS_MAIN_STORAGE_ACCESS_KEY_ID: credential.token_id,
      JARVIS_MAIN_STORAGE_SECRET_ACCESS_KEY: credential.s3_secret_access_key,
    };
    for (const [key, value] of Object.entries(variables)) {
      if (!value) throw new Error(`${key} has no value.`);
      const values = [{ context: 'all', value }];
      const updated = await netlify('PUT', `/accounts/${account}/env/${key}?site_id=${site}`, {
        key,
        values,
      });
      if (updated.status === 404)
        await netlify('POST', `/accounts/${account}/env?site_id=${site}`, [{ key, values }]);
    }
    console.info(
      `[production] Netlify: ${Object.keys(variables).join(', ')} set. Deploy from main to make it live.`,
    );
  }
} else {
  console.info(
    '[production] nothing changed. --apply to restore main from dev; --switch to set Netlify too.',
  );
}
