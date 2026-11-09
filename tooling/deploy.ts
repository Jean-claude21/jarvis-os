/**
 * `pnpm deploy:draft` — Jarvis OS built from this checkout and deployed to a private Netlify
 * address, to check before anything changes for her. `pnpm deploy:prod` — the production site,
 * only from a clean `main` (constitution: production is the human gesture).
 *
 * The functions are bundled here, one file each with every dependency inside; beside them go what
 * the code reads next to itself (QuickJS's WebAssembly file, the shipped apps, Jarvis's routines).
 * Netlify ships them as they are. The Netlify token comes from `../.secrets/.admin.env` (NETLIFY_AUTH_TOKEN) or
 * the environment; the site from JARVIS_NETLIFY_SITE (`.env`). Nothing secret is printed.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = 'netlify-cli@27.13.0';
const root = fileURLToPath(new URL('..', import.meta.url));
const api = join(root, 'apps', 'api');
const out = join(api, 'netlify', '.build', 'functions');
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

const prod = process.argv.includes('--prod');
const secrets = envOf(join(root, '..', '.secrets', '.admin.env'));
const local = envOf(join(root, '.env'));
const token = process.env.NETLIFY_AUTH_TOKEN ?? secrets.NETLIFY_AUTH_TOKEN;
const site = process.env.JARVIS_NETLIFY_SITE ?? local.JARVIS_NETLIFY_SITE;
if (!token || !site) {
  console.error('NETLIFY_AUTH_TOKEN (secrets file) and JARVIS_NETLIFY_SITE (.env) are required.');
  process.exit(2);
}

if (prod) {
  const git = (...args: string[]) =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main' || git('status', '--porcelain') !== '') {
    console.error('Production is deployed only from a clean `main`.');
    process.exit(2);
  }
}

// The two functions, each one file; their `config` (path, schedule) stays an export Netlify reads.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
await build({
  entryPoints: ['api', 'watcher'].map((name) => join(api, 'netlify', 'functions', `${name}.mts`)),
  outdir: out,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  logLevel: 'warning',
  // Some dependencies still `require` Node's own modules.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
const fromApi = createRequire(join(api, 'package.json'));
const variant = dirname(
  createRequire(fromApi.resolve('quickjs-emscripten')).resolve(
    '@jitl/quickjs-wasmfile-release-sync/package.json',
  ),
);
copyFileSync(join(variant, 'dist', 'emscripten-module.wasm'), join(out, 'emscripten-module.wasm'));
// The shipped apps and Jarvis's routines are read from folders beside the module that reads them.
for (const folder of ['apps', 'routines']) {
  cpSync(join(api, 'src', folder), join(out, folder), { recursive: true });
}
console.info('[deploy] functions bundled in apps/api/netlify/.build/functions');

// npx, not `pnpm dlx`: the CLI's postinstall needs a flat node_modules.
const result = spawnSync(
  'npx',
  [
    '--yes',
    CLI,
    'deploy',
    '--no-build',
    '--filter',
    '@jarvis-os/api',
    '--site',
    site,
    '--message',
    prod ? 'production from main' : 'draft',
    ...(prod ? ['--prod'] : []),
  ],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, NETLIFY_AUTH_TOKEN: token },
  },
);
process.exit(result.status ?? 1);
