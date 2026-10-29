import {
  asPerson,
  exportMarkdown,
  importMarkdown,
  pool,
  spacesOf,
  type MarkdownDoc,
} from '@jarvis-os/core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { settingsFor, type Branch } from './settings';
import { spaceFor } from './spaces';
import { objectStorage } from './storage';

/** Folders that hold code: their Markdown documents the code, not her life. */
const CODE_MARKS = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];

/**
 * The Markdown files of a folder: those git tracks when it is a repository (what she chose to keep),
 * else every one outside hidden folders and `node_modules`; never inside a code project, nor under
 * a path given to `skip`. A hidden folder given to `include` is read too (`.claude/skills`).
 */
export function markdownOf(
  root: string,
  skip: string[] = [],
  include: string[] = [],
): MarkdownDoc[] {
  const under = (path: string, prefixes: string[]) =>
    prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix.replace(/\/$/, '')}/`));
  const listed = existsSync(join(root, '.git'))
    ? execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
        .split('\0')
        .filter(Boolean)
    : [
        ...walk(root, root),
        ...include
          .filter((folder) => existsSync(join(root, folder)))
          .flatMap((folder) => walk(root, join(root, folder))),
      ];
  const code = new Set(
    listed
      .filter((path) => CODE_MARKS.includes(path.split('/').at(-1)!))
      .map((path) => path.split('/').slice(0, -1).join('/')),
  );
  const inCode = (path: string) =>
    [...code].some((folder) => folder === '' || path.startsWith(`${folder}/`));
  const skipped = (path: string) =>
    (!under(path, include) &&
      path.split('/').some((part) => part.startsWith('.') || part === 'node_modules')) ||
    under(path, skip);
  return listed
    .filter((path) => /\.md$/i.test(path) && !skipped(path) && !inCode(path))
    .sort()
    .map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));
}

function walk(root: string, folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((item) => {
    if (item.name.startsWith('.') || item.name === 'node_modules') return [];
    const path = join(folder, item.name);
    return item.isDirectory() ? walk(root, path) : [relative(root, path).split(sep).join('/')];
  });
}

// `pnpm --filter @jarvis-os/api markdown import <folder> --email <her address> [--space Moi]
//   [--kinds kinds.json] [--skip _archive] [--branch dev] [--dry]`
// `pnpm --filter @jarvis-os/api markdown export <folder> --email <her address> [--space Moi]`
// The author's own tool, on a branch whose database he holds: it acts as the person named, under
// row-level security, like any door.
if (process.argv[1]?.endsWith('markdown.ts')) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      email: { type: 'string' },
      space: { type: 'string' },
      kinds: { type: 'string' },
      skip: { type: 'string', multiple: true, default: [] },
      include: { type: 'string', multiple: true, default: [] },
      branch: { type: 'string', default: 'dev' },
      dry: { type: 'boolean', default: false },
    },
  });
  const [command, folder] = positionals;
  if (!['import', 'export'].includes(command ?? '') || !folder || !values.email) {
    console.error('markdown import|export <folder> --email <address> [--space <name>]');
    process.exit(2);
  }
  const settings = settingsFor(values.branch as Branch);
  const db = pool(settings.appUrl);
  try {
    const { rows } = await db.query<{ id: string }>('select id from "user" where email = $1', [
      values.email,
    ]);
    const person = rows[0]?.id;
    if (!person) throw new Error(`No account for ${values.email} on ${values.branch}.`);
    const spaces = await asPerson(db, person, (tx) => spacesOf(tx));
    const space = spaceFor(spaces, values.space);
    const actor = { person, door: 'cli' };

    if (command === 'import') {
      const docs = markdownOf(folder, values.skip, values.include);
      const kinds = values.kinds
        ? (JSON.parse(readFileSync(values.kinds, 'utf8')) as Record<string, string>)
        : {};
      console.info(`${docs.length} Markdown files → « ${space.name} »`);
      if (values.dry) {
        const { readMarkdown } = await import('@jarvis-os/core');
        const count = new Map<string, number>();
        for (const doc of docs) {
          const kind = readMarkdown(doc, kinds).kind;
          count.set(kind, (count.get(kind) ?? 0) + 1);
        }
        console.table([...count].sort((a, b) => b[1] - a[1]).map(([kind, n]) => ({ kind, n })));
      } else {
        const report = await asPerson(db, person, (tx) =>
          importMarkdown(tx, actor, space.id, { docs, kinds, name: folder }),
        );
        console.info(report);
      }
    } else {
      const files = await asPerson(db, person, (tx) =>
        exportMarkdown(tx, space.id, objectStorage(settings.storage)),
      );
      for (const file of files) {
        const path = join(folder, ...file.path.split('/'));
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.content);
      }
      console.info(`${files.length} files from « ${space.name} » → ${folder}`);
    }
  } finally {
    await db.end();
  }
}
