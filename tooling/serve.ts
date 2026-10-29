/**
 * `pnpm serve` — Jarvis OS served from this machine at one address that never changes: the API on
 * the `dev` branch, its watcher (reminders on Telegram), and an ngrok tunnel on the author's fixed
 * domain (`JARVIS_TUNNEL_DOMAIN`). Each restarts on its own when it stops, so a client keeps its
 * connector; closing this stops them all. The server reads its files once (no watch): switching
 * git branches does not stop it; run this again to take a change.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
if (existsSync(`${root}.env`)) {
  const given = { ...process.env };
  process.loadEnvFile(`${root}.env`);
  Object.assign(process.env, given);
}
const domain = process.env.JARVIS_TUNNEL_DOMAIN;
if (!domain) {
  console.error('JARVIS_TUNNEL_DOMAIN is not set (see .env.example).');
  process.exit(2);
}
const port = process.env.PORT ?? '3700';
const publicUrl = `https://${domain}`;

const children = new Set<ChildProcess>();
let stopping = false;

/** Stops what this started, the whole tree of each (on Windows a shell stands in between). */
function stop() {
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) process.on(signal, stop);

/** Runs a command and runs it again when it stops, a little later each time it fails quickly. */
function keep(name: string, command: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  let delay = 1000;
  const run = () => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
    });
    children.add(child);
    child.on('exit', (code) => {
      children.delete(child);
      if (stopping) return;
      delay = Date.now() - started > 60_000 ? 1000 : Math.min(delay * 2, 30_000);
      console.warn(`[serve] ${name} stopped (${code}); again in ${delay / 1000} s`);
      setTimeout(run, delay);
    });
  };
  run();
}

keep('api', 'pnpm', ['--filter', '@jarvis-os/api', 'start'], {
  JARVIS_PUBLIC_URL: publicUrl,
  PORT: port,
});
keep('watcher', 'pnpm', ['--filter', '@jarvis-os/api', 'watcher']);
keep('tunnel', 'ngrok', [
  'http',
  port,
  `--url=${publicUrl}`,
  '--log',
  'stdout',
  '--log-level',
  'warn',
]);
console.info(`[serve] Jarvis OS at ${publicUrl} (MCP: ${publicUrl}/mcp)`);
