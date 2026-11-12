// `pnpm --filter @jarvis-os/api exec tsx tooling/catalog-icons.ts`: the logos of the catalog (spec 025) taken from simple-icons
// into a small file the server reads — not the whole set of icons (5 MB) at each start.
import { writeFileSync } from 'node:fs';
import * as icons from 'simple-icons';
import { CATALOG } from '../src/catalog';

const all = icons as unknown as Record<string, { path: string; hex: string } | undefined>;
const used = Object.fromEntries(
  CATALOG.flatMap((entry) => {
    const found = entry.icon ? all[entry.icon] : undefined;
    return found ? [[entry.icon!, { path: found.path, hex: found.hex }]] : [];
  }),
);
writeFileSync(
  new URL('../src/catalog-icons.json', import.meta.url),
  `${JSON.stringify(used, null, 2)}\n`,
);
console.info(`${Object.keys(used).length} logos written`);
