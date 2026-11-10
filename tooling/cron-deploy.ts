/**
 * `pnpm cron:deploy` — the crons on Cloudflare (spec 022): the nightly backup Worker deployed with
 * wrangler, its secret NEON_API_KEY and its variable NEON_PROJECT_ID set. The tokens come from
 * `../.secrets/.admin.env` (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_API_TOKEN); the project
 * from JARVIS_NEON_PROJECT_ID (`.env`). Nothing secret is printed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WRANGLER = 'wrangler@4.151.2';
const root = fileURLToPath(new URL('..', import.meta.url));
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
const secrets = envOf(join(root, '..', '.secrets', '.admin.env'));
const local = envOf(join(root, '.env'));
const token = secrets.CLOUDFLARE_API_TOKEN;
const account = secrets.CLOUDFLARE_ACCOUNT_ID;
const neonKey = secrets.NEON_API_KEY ?? secrets.NEON_API_TOKEN;
const project = local.JARVIS_NEON_PROJECT_ID;
if (!token || !account || !neonKey || !project) {
  console.error(
    'CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_API_TOKEN (secrets file) and JARVIS_NEON_PROJECT_ID (.env) are required.',
  );
  process.exit(2);
}

const wrangler = (args: string[], input?: string) => {
  const result = spawnSync('npx', ['--yes', WRANGLER, ...args], {
    cwd: join(root, 'tooling', 'cloudflare'),
    stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
    input,
    shell: process.platform === 'win32',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

wrangler(['deploy', '--var', `NEON_PROJECT_ID:${project}`]);
wrangler(['secret', 'put', 'NEON_API_KEY'], neonKey);
console.info('[cron] the nightly backup runs on Cloudflare at 01:30 UTC');
