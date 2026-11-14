import { z } from 'zod';
import type { Actor, Tx } from './db';
import { save, withAliases } from './entries';
import { modelOf } from './models';

// Agents outside Jarvis (spec 050). What an agent answers comes in through `receive`: each item
// passed through her model's other names for its fields, checked by her model, and — with `match` —
// the entry already there with the same value updated rather than made twice. Jarvis reaches an
// agent through `callOut`, which the server provides (the connection's secret is opened there,
// never here).

export const receiveSchema = z.object({
  kind: z.string().trim().min(1).max(80),
  items: z.array(z.record(z.string(), z.unknown())).max(200),
  /** A field whose value finds the entry already there (« url »). */
  match: z.string().trim().min(1).max(60).optional(),
  /** The title of each entry: « {position} — {company} »; else its title, name or first text. */
  title: z.string().trim().min(1).max(300).optional(),
});
export type ReceiveInput = z.input<typeof receiveSchema>;

const fill = (template: string, data: Record<string, unknown>) =>
  template
    .replace(/\{([^{}]+)\}/g, (_, name: string) => {
      const value = data[name.trim()];
      return value === undefined || value === null ? '' : String(value);
    })
    .replace(/\s+/g, ' ')
    .trim();

const titleOf = (item: Record<string, unknown>, template?: string) => {
  if (template) {
    const made = fill(template, item);
    if (made.replace(/[—–\-·|,\s]/g, '')) return made.slice(0, 300);
  }
  for (const name of ['title', 'titre', 'name', 'nom']) {
    if (typeof item[name] === 'string' && item[name]) return String(item[name]).slice(0, 300);
  }
  const first = Object.values(item).find((value) => typeof value === 'string' && value.trim());
  return first ? String(first).slice(0, 300) : null;
};

/**
 * A value sent in a near shape made the one her model keeps (spec 061): a date with its time for a
 * day, a number or a yes written as text. What cannot be read so is left for her model to refuse.
 */
function fit(fields: { name: string; type: string }[], data: Record<string, unknown>) {
  for (const field of fields) {
    const value = data[field.name];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const time = Date.parse(text);
      if (!Number.isNaN(time)) data[field.name] = new Date(time).toISOString().slice(0, 10);
    } else if (['number', 'amount', 'rating', 'progress'].includes(field.type)) {
      const number = Number(text.replace(/\s/g, '').replace(',', '.'));
      if (text && Number.isFinite(number)) data[field.name] = number;
    } else if (field.type === 'boolean' && /^(true|false|oui|non|yes|no)$/i.test(text)) {
      data[field.name] = /^(true|oui|yes)$/i.test(text);
    }
  }
}

/** What an agent sent, written as her entries: made, or updated when `match` finds one. */
export async function receive(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  raw: ReceiveInput,
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  ids: string[];
  /** Fields it sent that her model has no place for. */
  setAside: string[];
}> {
  const input = receiveSchema.parse(raw);
  const model = await modelOf(tx, spaceId, input.kind);
  const entries: { id?: string; kind?: string; title?: string; data: Record<string, unknown> }[] =
    [];
  let skipped = 0;
  const seen = new Set<string>();
  const aside = new Set<string>();
  for (const item of input.items) {
    const data = model ? withAliases(model, item) : { ...item };
    const title = titleOf(data, input.title);
    if (!title) {
      skipped += 1;
      continue;
    }
    for (const name of ['title', 'titre']) delete data[name];
    // What her model has no field for is set aside (it served the title): her model decides.
    if (model) {
      const own = new Set(model.fields.map((field) => field.name));
      for (const name of Object.keys(data)) {
        if (!own.has(name)) {
          delete data[name];
          aside.add(name);
        }
      }
    }
    if (model) fit(model.fields, data);
    const key = input.match ? data[input.match] : undefined;
    if (input.match && (key === undefined || key === null || key === '')) {
      skipped += 1;
      continue;
    }
    if (key !== undefined) {
      // Twice in the same answer: once.
      if (seen.has(String(key))) {
        skipped += 1;
        continue;
      }
      seen.add(String(key));
      const { rows } = await tx.query<{ id: string }>(
        `select id from entry
          where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
            and data->>$3 = $4
          limit 1`,
        [spaceId, input.kind, input.match, String(key)],
      );
      if (rows[0]) {
        entries.push({ id: rows[0].id, data });
        continue;
      }
    }
    entries.push({ kind: input.kind, title, data });
  }
  if (!entries.length) return { created: 0, updated: 0, skipped, ids: [], setAside: [...aside] };
  const saved = await save(tx, actor, spaceId, {
    entries: entries.map((one) => ({ ...one, origin: 'read' as const })),
  });
  return {
    created: saved.entries.filter((one) => one.created).length,
    updated: saved.entries.filter((one) => !one.created).length,
    skipped,
    ids: saved.entries.map((one) => one.id),
    setAside: [...aside],
  };
}

/** A call to one of her connections, by name: what the server does (spec 050, US2). */
export interface CallRequest {
  person: string;
  spaceId: string;
  connection: string;
  /** An HTTP connection: the path POSTed to (« /search »). */
  path?: string;
  /** An MCP connection: the tool called. */
  tool?: string;
  body: Record<string, unknown>;
}
export type CallOut = (request: CallRequest) => Promise<unknown>;

let callOut: CallOut | null = null;

/** Set by the server (it alone opens a connection's secret); null where none is set. */
export function setCallOut(fn: CallOut | null): void {
  callOut = fn;
}

export async function callConnection(request: CallRequest): Promise<unknown> {
  if (!callOut) throw new Error('A call reaches outside only from the server; none is set here.');
  return callOut(request);
}

/** The part of an answer at `path` (« offers », « data.results »), or the answer itself. */
export function partOf(answer: unknown, path?: string): unknown {
  if (!path) return answer;
  let at: unknown = answer;
  for (const step of path.split('.')) {
    if (at && typeof at === 'object' && step in (at as Record<string, unknown>))
      at = (at as Record<string, unknown>)[step];
    else return undefined;
  }
  return at;
}
