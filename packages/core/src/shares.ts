import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { fingerprintOf } from './agenda';
import type { Actor, Tx } from './db';
import { save } from './entries';
import { labelSchema, modelOf, type ModelField } from './models';
import { runView, viewDataSchema, type ViewResult } from './views';

// Shares (spec 016): a public link to a form (her guests confirm their presence, a client places an
// order) or to a view of one of her collections (a list she shows a relative). A share is an entry
// « Share »; only the fingerprint of the link's key is kept; archiving it closes the link. What comes
// through a form is content from outside: its origin is « read », and it waits as « proposed ».

export const SHARE_KIND = 'Share';

export const shareDataSchema = z.object({
  mode: z.enum(['form', 'view']),
  /** The kind a form adds to. */
  kind: z.string().trim().min(1).max(80).optional(),
  /** The fields a form asks (and nothing else is accepted). */
  fields: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  /** The view a link shows, read-only. */
  view: viewDataSchema.optional(),
  title: labelSchema.optional(),
  intro: z.string().max(2000).optional(),
  active: z.boolean().optional(),
  /** Kept by Jarvis: the fingerprint of the link's key. */
  token: z.string().length(64).optional(),
});
export type ShareData = z.infer<typeof shareDataSchema>;

/** A share's shape, checked; throws a sentence that says what to fix. */
export function checkShare(data: unknown): ShareData {
  const parsed = shareDataSchema.safeParse(data);
  if (
    !parsed.success ||
    (parsed.data.mode === 'form' && !parsed.data.kind) ||
    (parsed.data.mode === 'view' && !parsed.data.view)
  ) {
    const issues = parsed.success
      ? parsed.data.mode === 'form'
        ? 'a form needs its kind'
        : 'a view share needs its view'
      : parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'share'}: ${issue.message}`)
          .join('; ');
    throw new Error(
      `A « ${SHARE_KIND} » is { mode: form|view, kind? (form), fields? (form), view? (view), title?, intro? } — ${issues}.`,
    );
  }
  return parsed.data;
}

/** A new public link: the key to give (in the link), and the share kept. */
export async function createShare(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { name: string; data: Omit<z.input<typeof shareDataSchema>, 'token'> },
): Promise<{ id: string; key: string }> {
  const data = checkShare(input.data);
  if (data.mode === 'form') {
    const model = await modelOf(tx, spaceId, data.kind!);
    if (!model)
      throw new Error(`A form adds to a collection with a model: « ${data.kind} » has none.`);
    for (const name of data.fields ?? []) {
      if (!model.fields.some((field) => field.name === name))
        throw new Error(`« ${name} » is not a field of « ${model.kind} ».`);
    }
  }
  const key = randomBytes(18).toString('base64url');
  const saved = await save(tx, actor, spaceId, {
    entries: [
      {
        kind: SHARE_KIND,
        title: input.name.trim().slice(0, 120) || 'Share',
        data: { ...data, token: fingerprintOf(key) },
      },
    ],
  });
  return { id: saved.entries[0]!.id, key };
}

/** Whose share a key opens: the person, the space, the share. */
export async function shareOf(
  db: pg.Pool,
  key: string,
): Promise<{ person: string; spaceId: string; entryId: string } | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return null;
  const { rows } = await db.query<{ person: string; space_id: string; entry_id: string }>(
    'select person, space_id, entry_id from jarvis_share($1)',
    [fingerprintOf(key)],
  );
  const row = rows[0];
  return row ? { person: row.person, spaceId: row.space_id, entryId: row.entry_id } : null;
}

export interface SharedPage {
  mode: 'form' | 'view';
  title: z.infer<typeof labelSchema> | string;
  intro: string | null;
  /** A form: the fields it asks, with their types, labels and options. */
  fields?: Pick<
    ModelField,
    | 'name'
    | 'type'
    | 'label'
    | 'options'
    | 'optionLabels'
    | 'required'
    | 'unit'
    | 'help'
    | 'min'
    | 'max'
  >[];
  /** A view: its rows, read-only. */
  view?: Omit<ViewResult, 'fields'>;
}

const ASKABLE = new Set([
  'text',
  'long_text',
  'number',
  'amount',
  'date',
  'datetime',
  'time',
  'choice',
  'multi_choice',
  'boolean',
  'url',
  'email',
  'phone',
  'rating',
  'progress',
]);

/** What a share shows: the form's fields, or the view's rows. */
export async function sharedPage(tx: Tx, spaceId: string, entryId: string): Promise<SharedPage> {
  const { rows } = await tx.query<{ title: string; data: unknown }>(
    'select title, data from entry where id = $1 and space_id = $2',
    [entryId, spaceId],
  );
  if (!rows[0]) throw new Error('No share here.');
  const share = checkShare(rows[0].data);
  const title = share.title ?? rows[0].title;
  if (share.mode === 'view') {
    const run = await runView(tx, spaceId, share.view!);
    const view = Object.fromEntries(
      Object.entries(run).filter(([key]) => key !== 'fields'),
    ) as Omit<ViewResult, 'fields'>;
    return { mode: 'view', title, intro: share.intro ?? null, view };
  }
  const model = (await modelOf(tx, spaceId, share.kind!))!;
  const asked = model.fields.filter(
    (field) => ASKABLE.has(field.type) && (!share.fields || share.fields.includes(field.name)),
  );
  return {
    mode: 'form',
    title,
    intro: share.intro ?? null,
    fields: asked.map(
      ({ name, type, label, options, optionLabels, required, unit, help, min, max }) => ({
        name,
        type,
        label,
        options,
        optionLabels,
        required,
        unit,
        help,
        min,
        max,
      }),
    ),
  };
}

/** What someone sent through a form: a new entry of its kind, from outside, waiting for her. */
export async function submitShare(
  tx: Tx,
  spaceId: string,
  person: string,
  entryId: string,
  input: { title: string; data: Record<string, unknown> },
): Promise<{ id: string }> {
  const page = await sharedPage(tx, spaceId, entryId);
  if (page.mode !== 'form') throw new Error('This link shows; it takes nothing.');
  const allowed = new Set(page.fields!.map((field) => field.name));
  const data: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input.data ?? {})) {
    if (!allowed.has(name)) throw new Error(`« ${name} » is not asked by this form.`);
    if (value !== '' && value !== null && value !== undefined) data[name] = value;
  }
  const { rows } = await tx.query<{ data: { kind: string } }>(
    'select data from entry where id = $1',
    [entryId],
  );
  const title = String(input.title ?? '')
    .trim()
    .slice(0, 300);
  if (!title) throw new Error('A name is needed.');
  const saved = await save(tx, { person, door: 'form', client: `share:${entryId}` }, spaceId, {
    entries: [
      {
        ref: 'sent',
        kind: rows[0]!.data.kind,
        title,
        data: { ...data, status: 'proposed' },
        origin: 'read',
      },
    ],
    links: [{ from: 'sent', to: entryId, role: 'via' }],
  });
  return { id: saved.entries[0]!.id };
}
