/**
 * `pnpm serve` — Jarvis OS served from this machine at one address that never changes: the API on
 * the `dev` branch, its watcher (reminders on Telegram), and an ngrok tunnel on the author's fixed
 * domain (`JARVIS_TUNNEL_DOMAIN`). Each restarts on its own when it stops, so a client keeps its
 * connector; closing this stops them all. The server reads its files once (no watch): switching
 * git branches does not stop it; run this again to take a change.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

// One instance only: a second watcher would tell her everything twice. The previous one (and its
// tree) is stopped first, even when it was closed without a signal.
const pidFile = `${root}.local/serve.pid`;
const killTree = (pid: number) =>
  process.platform === 'win32'
    ? spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
    : spawnSync('pkill', ['-TERM', '-P', String(pid)], { stdio: 'ignore' });
if (existsSync(pidFile)) {
  const previous = Number(readFileSync(pidFile, 'utf8'));
  // A number the system gave to another program since is left alone.
  const isNode =
    process.platform !== 'win32' ||
    spawnSync('tasklist', ['/FI', `PID eq ${previous}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
    }).stdout.includes('"node.exe"');
  if (previous && previous !== process.pid && isNode) {
    killTree(previous);
    try {
      process.kill(previous);
    } catch {
      // Already gone.
    }
  }
}
mkdirSync(`${root}.local`, { recursive: true });
writeFileSync(pidFile, String(process.pid));

const children = new Set<ChildProcess>();
let stopping = false;

/** Stops what this started, the whole tree of each (on Windows a shell stands in between). */
function stop() {
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32') {
      killTree(child.pid);
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
