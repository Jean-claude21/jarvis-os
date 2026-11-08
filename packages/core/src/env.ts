import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

// Local runs read the repository's `.env` (written by `pnpm provision`); CI and servers get real
// environment variables, which win.
const local = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(local)) {
  const given = { ...process.env };
  process.loadEnvFile(local);
  Object.assign(process.env, given);
}

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example).`);
  return value;
}
