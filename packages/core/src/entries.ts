import type { Actor, Tx } from './db';
import { prefixedId } from './ids';
import { record } from './journal';
import { readerOf } from './compute';
import { formulaValue } from './formula';
import { checkPage } from './pages';
import { zoneOf } from './zone';
import { checkRule, runRulesAfterSave, type Changed } from './rules';
import { checkScript } from './scripts';
import { checkView } from './views';
import { checkShare } from './shares';
import { dataInNewWords, KIND_RENAMES, modelInNewWords, ROLE_RENAMES } from './keywords';
import {
  checkAgainst,
  MODEL_KIND,
  modelDataSchema,
  modelError,
  modelOf,
  modelsOf,
  type Model,
} from './models';
import {
  findInputSchema,
  saveInputSchema,
  type EntryInput,
  type FindInput,
  type LinkInput,
  type Origin,
  type SaveInput,
} from './schemas';

export interface Entry {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  origin: Record<string, Origin>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface LinkView {
  id: string;
  role: string;
  /** The entry at the other end. */
  entry: { id: string; kind: string; title: string };
}

const columns = `id, kind, title, data, origin,
  to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
  to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt",
  to_char(archived_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "archivedAt"`;

/** What the journal keeps of an entry: enough to put it back. */
const snapshotOf = async (tx: Tx, id: string) =>
  (
    await tx.query<Record<string, unknown>>(
      'select kind, title, data, origin, archived_at from entry where id = $1',
      [id],
    )
  ).rows[0] ?? null;

function originsFor(input: EntryInput, fields: string[]): Record<string, Origin> {
  const given = input.origin ?? 'said';
  return Object.fromEntries(
    fields.map((field) => [field, typeof given === 'string' ? given : (given[field] ?? 'said')]),
  );
}

export interface Saved {
  entries: { ref: string | null; id: string; kind: string; title: string; created: boolean }[];
  links: { id: string; from: string; to: string; role: string }[];
  unlinked: number;
  /** Old keywords renamed on the way (spec 014): tell the model to write the new ones. */
  notes: string[];
}

/**
 * A kind as it was first written in this space: « dépense » and « Dépense » are one kind, case and
 * accents aside (decision 0005). A new kind is kept as given.
 */
async function kindAsWritten(tx: Tx, spaceId: string, kind: string): Promise<string> {
  const { rows } = await tx.query<{ kind: string }>(
    `select kind from entry where space_id = $1 and jarvis_fold(kind) = jarvis_fold($2)
      order by created_at limit 1`,
    [spaceId, kind],
  );
  return rows[0]?.kind ?? kind;
}

const foldKind = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const isModelKind = (kind: string) => foldKind(kind) === foldKind(MODEL_KIND);

/** The engine's other kinds (spec 014) are checked by their own shape. */
const SYSTEM_CHECKS: Record<string, (data: Record<string, unknown>) => unknown> = {
  page: checkPage,
  rule: checkRule,
  script: checkScript,
  view: checkView,
  share: checkShare,
};
const checkSystem = (kind: string, data: Record<string, unknown>) =>
  SYSTEM_CHECKS[foldKind(kind)]?.(data);

/** A model's shape, checked; throws the sentence that says what to fix. */
function checkModel(data: Record<string, unknown>): void {
  const parsed = modelDataSchema.safeParse(data);
  if (parsed.success) return;
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'model'}: ${issue.message}`)
    .join('; ');
  throw new Error(
    `A « ${MODEL_KIND} » is { fields: [{ name, type, required?, options?, target?, cardinality?, inverse?, formula?, fields?, unit?, help? }], path?, columns?, total?, groupBy?, app?, open?, workflow? } — ${issues}.`,
  );
}

const sameState = (a: unknown, b: unknown) =>
  typeof a === 'string' && typeof b === 'string' && foldKind(a) === foldKind(b);

/** A change of state follows the model's workflow: one of its transitions, its condition true. */
async function followWorkflow(
  tx: Tx,
  spaceId: string,
  model: Model,
  id: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): Promise<void> {
  const workflow = model.workflow;
  if (!workflow) return;
  const from = before ? before[workflow.field] : undefined;
  const to = after[workflow.field];
  if (before === null) {
    if (workflow.initial && to !== undefined && !sameState(to, workflow.initial)) {
      throw new Error(
        `« ${model.kind} » starts as « ${workflow.initial} » (its workflow), not « ${String(to)} ».`,
      );
    }
    return;
  }
  if (to === undefined || sameState(from, to)) return;
  const allowed = workflow.transitions.filter(
    (one) =>
      sameState(one.to, to) &&
      [one.from].flat().some((state) => state === '*' || sameState(state, from)),
  );
  const paths = workflow.transitions
    .map((one) => `${[one.from].flat().join('|')} → ${one.to}`)
    .join(', ');
  if (!allowed.length) {
    throw new Error(
      `« ${model.kind} » cannot go from « ${String(from ?? '—')} » to « ${String(to)} »: its workflow allows ${paths}.`,
    );
  }
  const reader = await readerOf(tx, spaceId);
  const view = reader.view({
    id,
    kind: model.kind,
    title: '',
    data: after,
    createdAt: '',
    updatedAt: '',
  });
  for (const one of allowed) {
    if (!one.if || (await formulaValue(one.if, view, reader.clock))) return;
  }
  throw new Error(
    `« ${model.kind} » cannot go to « ${String(to)} » yet: ${allowed.map((one) => one.if).join(' or ')} must hold.`,
  );
}

/** The defaults of a model's fields, put in a new entry's data where nothing was given (spec 016). */
async function defaultsInto(tx: Tx, model: Model, data: Record<string, unknown>): Promise<void> {
  const clock = { now: new Date(), zone: await zoneOf(tx) };
  for (const field of model.fields) {
    if (field.default === undefined || data[field.name] !== undefined) continue;
    data[field.name] =
      typeof field.default === 'string' && field.default.startsWith('=')
        ? await formulaValue(field.default.slice(1), { get: (name) => data[name] ?? null }, clock)
        : field.default;
  }
}

/** A model's other promises (spec 016): unique values, files that exist. */
async function followOptions(
  tx: Tx,
  spaceId: string,
  model: Model,
  id: string,
  given: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<void> {
  for (const field of model.fields) {
    const value = data[field.name];
    if (value === undefined || value === null || !(field.name in given)) continue;
    if (field.unique) {
      const { rows } = await tx.query<{ title: string }>(
        typeof value === 'string'
          ? `select title from entry where space_id = $1 and archived_at is null and id <> $2
               and jarvis_fold(kind) = jarvis_fold($3) and jarvis_fold(data->>$4) = jarvis_fold($5) limit 1`
          : `select title from entry where space_id = $1 and archived_at is null and id <> $2
               and jarvis_fold(kind) = jarvis_fold($3) and data->$4 = $5::jsonb limit 1`,
        [
          spaceId,
          id,
          model.kind,
          field.name,
          typeof value === 'string' ? value : JSON.stringify(value),
        ],
      );
      if (rows[0])
        throw modelError(model, [
          `« ${field.name} » is unique, and « ${rows[0].title} » already has it`,
        ]);
    }
    if (field.type === 'file') {
      const ids = [value].flat().map(String);
      const { rows } = await tx.query<{ entry_id: string }>(
        'select entry_id from file where space_id = $1 and entry_id = any($2)',
        [spaceId, ids],
      );
      const missing = ids.find((one) => !rows.some((row) => row.entry_id === one));
      if (missing) throw modelError(model, [`« ${field.name} »: no file ${missing} in this space`]);
    }
  }
}

/** A link field given in `data`: made a link once every entry of the save has its id. */
interface Pending {
  entry: string;
  field: string;
  target: string | null;
  values: string[];
}

/**
 * Takes the link fields of a model out of the data (spec 014): `compte: "ent_…"` becomes a link
 * « compte » — a list for `many`, `null` to take the links away.
 */
function linksOutOf(
  model: Model | null,
  given: Record<string, unknown>,
  pending: Omit<Pending, 'entry'>[],
): Record<string, unknown> {
  if (!model) return given;
  const rest: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(given)) {
    const field = model.fields.find((one) => foldKind(one.name) === foldKind(name));
    if (field?.type !== 'link') {
      rest[name] = value;
      continue;
    }
    const values = value === null ? [] : [value].flat();
    if (!values.every((one) => typeof one === 'string' && one.trim())) {
      throw modelError(model, [
        `« ${name} » must be an entry id (or a ref of this save), or a list of them`,
      ]);
    }
    if (field.cardinality !== 'many' && values.length > 1) {
      throw modelError(model, [`« ${name} » links one « ${field.target} », not ${values.length}`]);
    }
    pending.push({ field: field.name, target: field.target ?? null, values: values as string[] });
  }
  return rest;
}

/**
 * One save of what she said: new entries and changes to existing ones, the links among them, the
 * links taken away — every change journaled. A field given `null` is removed. Each entry follows
 * its kind's model (fields, relations, lines, workflow); old keywords are renamed and noted.
 */
export async function save(tx: Tx, actor: Actor, spaceId: string, raw: SaveInput): Promise<Saved> {
  const input = saveInputSchema.parse(raw);
  const refs = new Map<string, string>();
  const saved: Saved = { entries: [], links: [], unlinked: 0, notes: [] };
  const pending: Pending[] = [];
  const created: { id: string; model: Model }[] = [];
  const changed: Changed[] = [];

  for (const one of input.entries) {
    const notes: string[] = [];
    let wanted = one.kind;
    if (wanted && KIND_RENAMES[foldKind(wanted)]) {
      notes.push(`kind « ${wanted} » → « ${KIND_RENAMES[foldKind(wanted)]} »`);
      wanted = KIND_RENAMES[foldKind(wanted)];
    }
    const current = one.id
      ? (
          await tx.query<{
            kind: string;
            title: string;
            data: Record<string, unknown>;
            origin: Record<string, Origin>;
          }>(
            'select kind, title, data, origin from entry where id = $1 and space_id = $2 for update',
            [one.id, spaceId],
          )
        ).rows[0]
      : undefined;
    if (one.id && !current) throw new Error(`No entry ${one.id} in this space.`);
    if (!one.id && (!wanted || !one.title))
      throw new Error('A new entry needs a kind and a title.');
    const kind = wanted ? await kindAsWritten(tx, spaceId, wanted) : current!.kind;
    const model = isModelKind(kind) ? null : await modelOf(tx, spaceId, kind);
    const links: Omit<Pending, 'entry'>[] = [];
    const given = linksOutOf(
      model,
      isModelKind(kind)
        ? modelInNewWords(one.data ?? {}, notes)
        : dataInNewWords(one.data ?? {}, notes),
      links,
    );
    if (notes.length)
      saved.notes.push(`${one.title ?? current?.title ?? kind}: ${notes.join(', ')}`);
    const kept = Object.keys(given).filter((field) => given[field] !== null);

    let id: string;
    if (!current) {
      id = prefixedId('ent');
      const data = Object.fromEntries(kept.map((field) => [field, given[field]]));
      if (model) await defaultsInto(tx, model, data);
      if (model?.workflow?.initial && data[model.workflow.field] === undefined) {
        data[model.workflow.field] = model.workflow.initial;
      }
      if (isModelKind(kind)) checkModel(data);
      else checkSystem(kind, data);
      if (model) {
        const problems = checkAgainst(model, given, data, true);
        if (problems.length) throw modelError(model, problems);
        await followWorkflow(tx, spaceId, model, id, null, data);
        await followOptions(tx, spaceId, model, id, data, data);
        created.push({ id, model });
      }
      await tx.query(
        'insert into entry (id, space_id, kind, title, data, origin) values ($1, $2, $3, $4, $5, $6)',
        [id, spaceId, kind, one.title, JSON.stringify(data), JSON.stringify(originsFor(one, kept))],
      );
      await record(tx, actor, {
        spaceId,
        command: 'entry.create',
        target: id,
        before: null,
        after: await snapshotOf(tx, id),
      });
      saved.entries.push({ ref: one.ref ?? null, id, kind, title: one.title!, created: true });
      changed.push({ id, kind, created: true, fields: Object.keys(data) });
    } else {
      id = one.id!;
      const before = await snapshotOf(tx, id);
      const data = { ...current.data };
      const origin = { ...current.origin, ...originsFor(one, kept) };
      for (const [field, value] of Object.entries(given)) {
        if (value === null) {
          delete data[field];
          delete origin[field];
        } else {
          data[field] = value;
        }
      }
      const title = one.title ?? current.title;
      if (isModelKind(kind)) checkModel(data);
      else checkSystem(kind, data);
      if (model) {
        // A change of kind meets the new kind's model as a whole; a change of fields, the fields given.
        const problems =
          kind !== current.kind
            ? checkAgainst(model, data, data, true)
            : checkAgainst(model, given, data, false);
        if (problems.length) throw modelError(model, problems);
        await followWorkflow(tx, spaceId, model, id, current.data, data);
        await followOptions(tx, spaceId, model, id, given, data);
      }
      await tx.query(
        `update entry set kind = $2, title = $3, data = $4, origin = $5, updated_at = now()
          where id = $1`,
        [id, kind, title, JSON.stringify(data), JSON.stringify(origin)],
      );
      const after = await snapshotOf(tx, id);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        await record(tx, actor, { spaceId, command: 'entry.update', target: id, before, after });
        const fields = [...new Set([...Object.keys(current.data), ...Object.keys(data)])].filter(
          (field) => JSON.stringify(current.data[field]) !== JSON.stringify(data[field]),
        );
        changed.push({ id, kind, created: false, fields });
      }
      saved.entries.push({ ref: one.ref ?? null, id, kind, title, created: false });
    }
    if (one.ref) refs.set(one.ref, id);
    for (const link of links) pending.push({ ...link, entry: id });
  }

  const addLink = async (from: string, to: string, role: string) => {
    const id = prefixedId('lnk');
    const { rows } = await tx.query<{ id: string }>(
      `insert into link (id, space_id, from_id, to_id, role) values ($1, $2, $3, $4, $5)
       on conflict (from_id, to_id, role) do nothing returning id`,
      [id, spaceId, from, to, role],
    );
    if (rows[0]) {
      await record(tx, actor, {
        spaceId,
        command: 'link.add',
        target: id,
        before: null,
        after: { id, from_id: from, to_id: to, role },
      });
    }
    saved.links.push({ id: rows[0]?.id ?? id, from, to, role });
  };

  const removeLinks = async (
    rows: { id: string; from_id: string; to_id: string; role: string }[],
  ) => {
    for (const row of rows) {
      await record(tx, actor, {
        spaceId,
        command: 'link.remove',
        target: row.id,
        before: row,
        after: null,
      });
      saved.unlinked += 1;
    }
  };

  // Link fields: the target exists here and is of the right kind; the links of that role become
  // exactly those given.
  for (const one of pending) {
    const ends = one.values.map((value) => refs.get(value) ?? value);
    if (ends.length) {
      const { rows } = await tx.query<{ id: string; kind: string }>(
        'select id, kind from entry where space_id = $1 and id = any($2) and archived_at is null',
        [spaceId, ends],
      );
      for (const end of ends) {
        const found = rows.find((row) => row.id === end);
        if (!found) throw new Error(`« ${one.field} »: no entry ${end} in this space.`);
        if (one.target && foldKind(found.kind) !== foldKind(one.target)) {
          throw new Error(
            `« ${one.field} » links a « ${one.target} », and ${end} is a « ${found.kind} ».`,
          );
        }
      }
    }
    const { rows: gone } = await tx.query<{
      id: string;
      from_id: string;
      to_id: string;
      role: string;
    }>(
      `delete from link where space_id = $1 and from_id = $2 and role = $3 and not (to_id = any($4))
       returning id, from_id, to_id, role`,
      [spaceId, one.entry, one.field, ends],
    );
    await removeLinks(gone);
    for (const end of ends) await addLink(one.entry, end, one.field);
  }

  const resolve = async (link: LinkInput) => {
    const from = refs.get(link.from) ?? link.from;
    const to = refs.get(link.to) ?? link.to;
    const { rows } = await tx.query<{ id: string }>(
      'select id from entry where space_id = $1 and id = any($2)',
      [spaceId, [from, to]],
    );
    const found = new Set(rows.map((row) => row.id));
    for (const end of [from, to]) {
      if (!found.has(end)) throw new Error(`No entry ${end} in this space to link.`);
    }
    const role = ROLE_RENAMES[link.role.trim().toLowerCase()];
    if (role) saved.notes.push(`role « ${link.role} » → « ${role} »`);
    return { from, to, role: role ?? link.role };
  };

  for (const link of input.links) {
    const { from, to, role } = await resolve(link);
    await addLink(from, to, role);
  }

  for (const link of input.unlink) {
    const { from, to, role } = await resolve(link);
    const { rows } = await tx.query<{ id: string; from_id: string; to_id: string; role: string }>(
      `delete from link where space_id = $1 and from_id = $2 and to_id = $3 and role = $4
       returning id, from_id, to_id, role`,
      [spaceId, from, to, role],
    );
    await removeLinks(rows);
  }

  // A required relation is there once the save is done.
  for (const { id, model } of created) {
    for (const field of model.fields) {
      if (field.type !== 'link' || !field.required) continue;
      const { rows } = await tx.query(
        'select 1 from link where space_id = $1 and from_id = $2 and jarvis_fold(role) = jarvis_fold($3) limit 1',
        [spaceId, id, field.name],
      );
      if (!rows.length) throw modelError(model, [`« ${field.name} » is required`]);
    }
  }
  // Her rules (spec 014) run on what this save made or changed, in the same transaction.
  await runRulesAfterSave(tx, actor, spaceId, changed);
  return saved;
}

/** One entry, with its links both ways. */
export async function get(
  tx: Tx,
  spaceId: string,
  id: string,
): Promise<(Entry & { links: { out: LinkView[]; in: LinkView[] } }) | null> {
  const { rows } = await tx.query<Entry>(
    `select ${columns} from entry where id = $1 and space_id = $2`,
    [id, spaceId],
  );
  const entry = rows[0];
  if (!entry) return null;
  const ends = async (direction: 'out' | 'in') =>
    (
      await tx.query<{ id: string; role: string; entry_id: string; kind: string; title: string }>(
        direction === 'out'
          ? `select l.id, l.role, e.id as entry_id, e.kind, e.title from link l
               join entry e on e.id = l.to_id where l.from_id = $1 order by l.created_at`
          : `select l.id, l.role, e.id as entry_id, e.kind, e.title from link l
               join entry e on e.id = l.from_id where l.to_id = $1 order by l.created_at`,
        [id],
      )
    ).rows.map((row) => ({
      id: row.id,
      role: row.role,
      entry: { id: row.entry_id, kind: row.kind, title: row.title },
    }));
  return { ...entry, links: { out: await ends('out'), in: await ends('in') } };
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Entries by words (in the title, the fields and a text file's words, accents and case aside,
 * every word present), by
 * kind, by the day they were created; the latest first. Archived ones only when asked.
 */
export async function find(tx: Tx, spaceId: string, raw: FindInput = {}): Promise<Entry[]> {
  const input = findInputSchema.parse(raw);
  const words = fold(input.text ?? '')
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const { rows } = await tx.query<Entry>(
    `select ${columns} from entry
      where space_id = $1
        and ($2::boolean or archived_at is null)
        and ($3::text is null or jarvis_fold(kind) = jarvis_fold($3))
        and ($4::date is null or created_at >= $4::date)
        and ($5::date is null or created_at < $5::date + 1)
        and (select bool_and(jarvis_fold(title || ' ' || data::text || ' ' || jarvis_file_words(id))
                             like '%' || word || '%')
               from unnest($6::text[]) as word) is not false
      order by updated_at desc limit $7`,
    [
      spaceId,
      input.archived,
      input.kind ? (KIND_RENAMES[foldKind(input.kind)] ?? input.kind) : null,
      input.from ?? null,
      input.to ?? null,
      words,
      input.limit,
    ],
  );
  return rows;
}

export interface Kind {
  kind: string;
  count: number;
  fields: string[];
  /** Its model, when it has one (spec 012): the fields every save of it follows. */
  model?: Model;
}

/** The kinds of things in a space, the most used first, with the fields each uses. */
export async function kinds(tx: Tx, spaceId: string): Promise<Kind[]> {
  const { rows } = await tx.query<Kind>(
    `select e.kind, count(distinct e.id)::int as count,
            coalesce(array_agg(distinct f.key) filter (where f.key is not null), '{}') as fields
       from entry e left join lateral jsonb_object_keys(e.data) as f(key) on true
      where e.space_id = $1 and e.archived_at is null
      group by e.kind order by count desc, e.kind`,
    [spaceId],
  );
  // A kind with a model says its shape (spec 012), even before its first entry.
  const fold = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const models = new Map((await modelsOf(tx, spaceId)).map((model) => [fold(model.kind), model]));
  const out = rows.map((row) => {
    const model = models.get(fold(row.kind));
    models.delete(fold(row.kind));
    return model ? { ...row, model } : row;
  });
  for (const model of models.values()) out.push({ kind: model.kind, count: 0, fields: [], model });
  return out;
}

/** Sets an entry aside (never erased); journaled, so undone like any change. */
export async function archive(
  tx: Tx,
  actor: Actor,
  input: { spaceId: string; id: string },
): Promise<void> {
  const before = await snapshotOf(tx, input.id);
  const { rowCount } = await tx.query(
    `update entry set archived_at = now(), updated_at = now()
      where id = $1 and space_id = $2 and archived_at is null`,
    [input.id, input.spaceId],
  );
  if (!rowCount) throw new Error(`No entry ${input.id} to set aside in this space.`);
  await record(tx, actor, {
    spaceId: input.spaceId,
    command: 'entry.archive',
    target: input.id,
    before,
    after: await snapshotOf(tx, input.id),
  });
}
