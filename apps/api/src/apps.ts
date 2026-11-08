import { bundleSchema, type Bundle } from '@jarvis-os/core';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

// The apps Jarvis ships (spec 014): bundles read once from `apps/*.json`, installed in one sentence
// and then hers to change.

export const shippedApps: Bundle[] = (() => {
  const folder = fileURLToPath(new URL('./apps/', import.meta.url));
  return readdirSync(folder)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => bundleSchema.parse(JSON.parse(readFileSync(`${folder}${file}`, 'utf8'))));
})();

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** A shipped app by its name, or a sentence naming those there are. */
export function shippedApp(name: string): Bundle {
  const found = shippedApps.find((one) => fold(one.app) === fold(name));
  if (!found) {
    throw new Error(
      `No app « ${name} » ships with Jarvis: ${shippedApps.map((one) => one.app).join(', ')}.`,
    );
  }
  return found;
}
