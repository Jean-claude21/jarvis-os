import { z } from 'zod';
import { readerOf, type EntryRow } from './compute';
import type { Actor, Tx } from './db';
import { archive, save, snapshotOf } from './entries';
import { isScope, todayOf, type Clock } from './formula';
import { record, recordMany } from './journal';
import type { Label, Model } from './models';
import { AREA_KIND } from './areas';

// Lists (spec 017): any entries — a kind with or without a model, filtered or not — read for what
// they already hold: the day each is about, the folder it sits in, and the statistics of the list.
// Many entries filed, retyped or renamed at once are one change, undone at once.

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const validDay = (y: number, m: number, d: number) =>
  y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

/** The Monday of an ISO week. */
function mondayOf(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000);
  return new Date(monday.getTime() + (week - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}

/** A day (« 2026-08-31 », « 2026 10 01 »), a week (« W33 » with its year) or a month in a text. */
function dayInText(text: string): { day: string } | { month: string } | null {
  const days = [...text.matchAll(/(?<!\d)(\d{4})[-_ .](\d{2})[-_ .](\d{2})(?!\d)/g)];
  for (const found of days.reverse()) {
    const [y, m, d] = [Number(found[1]), Number(found[2]), Number(found[3])];
    if (validDay(y, m, d)) return { day: `${y}-${pad(m)}-${pad(d)}` };
  }
  const year = [...text.matchAll(/(?<!\d)(20\d{2}|19\d{2})(?!\d)/g)].pop()?.[1];
  const week = /(?<![\p{L}\d])W(\d{1,2})(?!\d)/u.exec(text);
  if (year && week && Number(week[1]) >= 1 && Number(week[1]) <= 53)
    return { day: mondayOf(Number(year), Number(week[1])) };
  const months = [...text.matchAll(/(?<!\d)(\d{4})[-_](\d{2})(?!\d)/g)].reverse();
  for (const found of months) {
    const [y, m] = [Number(found[1]), Number(found[2])];
    if (validDay(y, m, 1)) return { month: `${y}-${pad(m)}` };
  }
  if (year) {
    const words = fold(text).split(/[^a-z]+/);
    const month = words.map((word) => MONTHS[word]).find((one) => one);
    if (month) return { month: `${year}-${pad(month)}` };
  }
  return null;
}

export interface DayOf {
  /** « 2026-08-31 », or « 2026-08 » when only the month is known. */
  day: string;
  /** Where it was read: a field, the source path, the title, or the day it was made. */
  from: 'field' | 'source' | 'title' | 'made';
}

const DAY_FIELDS = ['date', 'at', 'start', 'due'];
const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);

/** The day an entry is about: its own field, then its source path, then its title, then made. */
export function dayOf(
  row: { title: string; data: Record<string, unknown>; createdAt: string },
  dateFields: string[] = DAY_FIELDS,
): DayOf {
  for (const field of dateFields)
    if (isDay(row.data[field])) return { day: row.data[field].slice(0, 10), from: 'field' };
  const source = typeof row.data.source === 'string' ? row.data.source : '';
  const inSource = source ? dayInText(source) : null;
  const inTitle = dayInText(row.title);
  // A full day wins over a month, wherever it is read.
  for (const [found, from] of [
    [inSource, 'source'],
    [inTitle, 'title'],
  ] as const)
    if (found && 'day' in found) return { day: found.day, from };
  for (const [found, from] of [
    [inSource, 'source'],
    [inTitle, 'title'],
  ] as const)
    if (found && 'month' in found) return { day: found.month, from };
  return { day: row.createdAt.slice(0, 10), from: 'made' };
}

/** The folder an entry sits in: the one it was filed in, else the folder of its source. */
export function folderOf(data: Record<string, unknown>): string | null {
  const clean = (path: string) =>
    path
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .join('/');
  if (typeof data.folder === 'string' && clean(data.folder)) return clean(data.folder);
  if (typeof data.source === 'string' && data.source.includes('/'))
    return clean(data.source.slice(0, data.source.lastIndexOf('/'))) || null;
  return null;
}

export const listInputSchema = z.object({
  kind: z.string().trim().min(1).max(80).optional(),
  /** Words in the title, the fields or a file's words; every word must be there. */
  text: z.string().trim().max(200).optional(),
  /** On or after, on or before this day (the entry's own day). */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  /** This folder and those under it. */
  folder: z.string().trim().min(1).max(300).optional(),
  sort: z.enum(['day', 'title', 'updated']).default('day'),
  desc: z.boolean().default(true),
  limit: z.number().int().min(1).max(2000).default(500),
});
export type ListInput = z.input<typeof listInputSchema>;

export interface ListRow {
  id: string;
  kind: string;
  title: string;
  day: string;
  dayFrom: DayOf['from'];
  folder: string | null;
  updatedAt: string;
}

type Found = EntryRow & DayOf & { folder: string | null };

/** The entries asked for, with their day and folder, filtered on both. */
async function entriesFor(
  tx: Tx,
  spaceId: string,
  input: z.infer<typeof listInputSchema>,
  dateFields: (kind: string) => string[] | undefined,
): Promise<Found[]> {
  const words = fold(input.text ?? '')
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const { rows } = await tx.query<EntryRow>(
    `select id, kind, title, data - 'text' as data,
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
            to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
       from entry
      where space_id = $1 and archived_at is null
        and ($2::text is null or jarvis_fold(kind) = jarvis_fold($2))
        and (select bool_and(jarvis_fold(title || ' ' || data::text || ' ' || jarvis_file_words(id))
                             like '%' || word || '%')
               from unnest($3::text[]) as word) is not false
      order by updated_at desc limit 5000`,
    [spaceId, input.kind ?? null, words],
  );
  const asDay = (day: string, end: boolean) =>
    day.length === 7 ? `${day}-${end ? '31' : '01'}` : day;
  const folder = input.folder
    ? input.folder
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean)
        .join('/')
    : null;
  return rows
    .map((row) => ({
      ...row,
      ...dayOf(row, [...(dateFields(row.kind) ?? []), ...DAY_FIELDS]),
      folder: folderOf(row.data),
    }))
    .filter(
      (row) =>
        (!input.from || asDay(row.day, true) >= input.from) &&
        (!input.to || asDay(row.day, false) <= input.to) &&
        (!folder ||
          (row.folder !== null && (row.folder === folder || row.folder.startsWith(`${folder}/`)))),
    );
}

const dateFieldsOf = (model: Model | null | undefined) =>
  (model?.fields ?? [])
    .filter((field) => field.type === 'date' || field.type === 'datetime')
    .map((field) => field.name);

/** A list of entries, any kind, with their day and folder; filtered and sorted. */
export async function listEntries(
  tx: Tx,
  spaceId: string,
  raw: ListInput = {},
  clock: Clock = { now: new Date() },
): Promise<{ rows: ListRow[]; total: number; truncated: boolean }> {
  const input = listInputSchema.parse(raw);
  const reader = await readerOf(tx, spaceId, clock);
  const found = await entriesFor(tx, spaceId, input, (kind) => dateFieldsOf(reader.model(kind)));
  const key = (row: Found) =>
    input.sort === 'title' ? row.title : input.sort === 'updated' ? row.updatedAt : row.day;
  found.sort((a, b) => {
    const order = key(a).localeCompare(key(b), undefined, { numeric: true });
    return input.desc ? -order : order;
  });
  return {
    rows: found.slice(0, input.limit).map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      day: row.day,
      dayFrom: row.from,
      folder: row.folder,
      updatedAt: row.updatedAt,
    })),
    total: found.length,
    truncated: found.length > input.limit,
  };
}

export interface ListStats {
  kind: string | null;
  total: number;
  /** Entries of this month, by their own day. */
  thisMonth: number;
  /** Twelve weeks, day by day, Monday first: how many entries each day. */
  days: { day: string; n: number }[];
  /** Days in a row with at least one entry: up to today (or yesterday), and the longest. */
  streak: { current: number; best: number };
  /** Days with at least one entry among the last thirty. */
  active30: number;
  /** Entries by hour of the day, when they say their time; else null. */
  hours: number[] | null;
  /** For each choice, or short value that repeats: how many entries hold each. */
  splits: {
    field: string;
    label: Label | null;
    counts: { option: string; label: Label | null; n: number }[];
  }[];
  /** Entries per week, the last eight weeks. */
  weeks: { field: string; label: Label | null; points: { week: string; n: number }[] } | null;
  /** Sums (amounts) and averages (numbers, ratings, progress, formulas). */
  figures: {
    field: string;
    label: Label | null;
    kind: 'sum' | 'avg';
    value: number;
    unit: string | null;
  }[];
}

const SKIPPED = new Set(['text', 'source', 'folder', 'title', 'note', 'message', 'error', 'id']);
const dayNumber = (day: string) =>
  Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;
const dayFromNumber = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** The hour an entry says (« 2026-10-01T05:10 », « 05:10 »), on her clock when it has a zone. */
function hourOf(value: unknown, zone: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const naive = /^(?:\d{4}-\d{2}-\d{2}[T ])?(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (naive) return Number(naive[1]) < 24 ? Number(naive[1]) : null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return null;
    const hour = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      ...(zone ? { timeZone: zone } : {}),
    }).format(at);
    return Number(hour);
  }
  return null;
}

/** The statistics of any list: by its model when it has one, else read from its values. */
export async function listStats(
  tx: Tx,
  spaceId: string,
  raw: ListInput = {},
  clock: Clock = { now: new Date() },
): Promise<ListStats> {
  const input = listInputSchema.parse(raw);
  const reader = await readerOf(tx, spaceId, clock);
  const model = input.kind ? reader.model(input.kind) : null;
  const found = await entriesFor(tx, spaceId, input, (kind) => dateFieldsOf(reader.model(kind)));
  const today = todayOf(reader.clock);
  const todayN = dayNumber(today);

  const perDay = new Map<string, number>();
  for (const row of found)
    if (row.day.length === 10) perDay.set(row.day, (perDay.get(row.day) ?? 0) + 1);

  const start = todayN - ((new Date(todayN * 86_400_000).getUTCDay() + 6) % 7) - 7 * 11;
  const days = Array.from({ length: todayN - start + 1 }, (_, index) => {
    const day = dayFromNumber(start + index);
    return { day, n: perDay.get(day) ?? 0 };
  });

  // A streak still runs today until the day is over: it counts from yesterday when today is empty.
  let current = 0;
  for (let n = perDay.has(today) ? todayN : todayN - 1; perDay.has(dayFromNumber(n)); n--)
    current++;
  let best = 0;
  let run = 0;
  let last: number | null = null;
  for (const n of [...perDay.keys()].map(dayNumber).sort((a, b) => a - b)) {
    run = last !== null && n === last + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    last = n;
  }
  let active30 = 0;
  for (let n = todayN - 29; n <= todayN; n++) if (perDay.has(dayFromNumber(n))) active30++;

  const hours = Array.from({ length: 24 }, () => 0);
  let timed = 0;
  for (const row of found) {
    const timeField = model?.fields.find(
      (field) => field.type === 'time' || field.type === 'datetime',
    );
    const hour =
      hourOf(timeField ? row.data[timeField.name] : undefined, reader.clock.zone) ??
      hourOf(row.data.at, reader.clock.zone) ??
      hourOf(row.data.start, reader.clock.zone) ??
      hourOf(row.data.time, reader.clock.zone);
    if (hour !== null) {
      hours[hour]!++;
      timed++;
    }
  }

  const weekStart = todayN - ((new Date(todayN * 86_400_000).getUTCDay() + 6) % 7) - 7 * 7;
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const from = dayFromNumber(weekStart + index * 7);
    const to = dayFromNumber(weekStart + (index + 1) * 7);
    return { week: from, n: found.filter((row) => row.day >= from && row.day < to).length };
  });
  const dated = model?.fields.find((field) => field.type === 'date' || field.type === 'datetime');

  const splits: ListStats['splits'] = [];
  const figures: ListStats['figures'] = [];
  if (model) {
    for (const field of model.fields.filter(
      (one) => one.type === 'choice' || one.type === 'multi_choice',
    ))
      splits.push({
        field: field.name,
        label: field.label ?? null,
        counts: (field.options ?? []).map((option) => ({
          option,
          label: field.optionLabels?.[option] ?? null,
          n: found.filter((row) => [row.data[field.name]].flat().includes(option)).length,
        })),
      });
    await reader.around(found.map((row) => row.id));
    const rows = found.map((row) => reader.view(row));
    for (const field of model.fields) {
      if (!['amount', 'number', 'rating', 'progress', 'formula'].includes(field.type)) continue;
      const values: number[] = [];
      for (const view of rows) {
        const value =
          field.type === 'formula' ? await view.get(field.name) : view.row.data[field.name];
        if (typeof value === 'number' && Number.isFinite(value) && !isScope(value))
          values.push(value);
      }
      if (!values.length) continue;
      const sum = values.reduce((total, one) => total + one, 0);
      const kindOf = field.type === 'amount' ? 'sum' : 'avg';
      figures.push({
        field: field.name,
        label: field.label ?? null,
        kind: kindOf,
        value: Math.round((kindOf === 'sum' ? sum : sum / values.length) * 100) / 100,
        unit: field.unit ?? (field.type === 'progress' ? '%' : null),
      });
    }
  } else {
    // Without a model: a short value that repeats is a split; a number is averaged.
    const values = new Map<string, unknown[]>();
    for (const row of found)
      for (const [key, value] of Object.entries(row.data))
        if (!SKIPPED.has(key) && !DAY_FIELDS.includes(key))
          values.set(key, [...(values.get(key) ?? []), value]);
    for (const [key, list] of values) {
      if (list.length < 3) continue;
      const numbers = list.filter(
        (one): one is number => typeof one === 'number' && Number.isFinite(one),
      );
      if (numbers.length >= 3 && numbers.length === list.length) {
        figures.push({
          field: key,
          label: null,
          kind: 'avg',
          value: Math.round((numbers.reduce((t, one) => t + one, 0) / numbers.length) * 100) / 100,
          unit: null,
        });
        continue;
      }
      const words = list.flatMap((one) =>
        (Array.isArray(one) ? one : [one]).filter(
          (word): word is string =>
            typeof word === 'string' && word.trim().length > 0 && word.length <= 40,
        ),
      );
      const counted = new Map<string, number>();
      for (const word of words) counted.set(word, (counted.get(word) ?? 0) + 1);
      if (counted.size < 2 || counted.size > 8 || words.length < found.length * 0.3) continue;
      if ([...counted.values()].every((n) => n === 1)) continue;
      splits.push({
        field: key,
        label: null,
        counts: [...counted]
          .sort((a, b) => b[1] - a[1])
          .map(([option, n]) => ({ option, label: null, n })),
      });
    }
  }

  return {
    kind: model?.kind ?? input.kind ?? null,
    total: found.length,
    thisMonth: found.filter((row) => row.day.slice(0, 7) === today.slice(0, 7)).length,
    days,
    streak: { current, best },
    active30,
    hours: timed >= 3 ? hours : null,
    splits,
    weeks: { field: dated?.name ?? 'day', label: dated?.label ?? null, points: weeks },
    figures,
  };
}

/** The journal lines this person wrote in this space after `since`: one change, grouped. */
async function linesSince(tx: Tx, actor: Actor, spaceId: string, since: number) {
  const { rows } = await tx.query<{ id: string }>(
    `select id from journal where space_id = $1 and id > $2 and actor = $3 and undone_by is null
        and command like 'entry.%'`,
    [spaceId, since, actor.person],
  );
  return rows.map((row) => Number(row.id));
}
async function lastLine(tx: Tx, spaceId: string) {
  const { rows } = await tx.query<{ id: string | null }>(
    'select max(id) as id from journal where space_id = $1',
    [spaceId],
  );
  return Number(rows[0]?.id ?? 0);
}

export const bulkSchema = z
  .object({
    ids: z.array(z.string().min(1).max(64)).min(1).max(1000),
    /** Filed in this folder (« Bilans/Mensuels »); null takes them out of any. */
    folder: z.string().trim().max(300).nullable().optional(),
    /** Another kind for all of them. */
    kind: z.string().trim().min(1).max(80).optional(),
    /** Set aside, never erased. */
    archive: z.boolean().optional(),
  })
  .refine((input) => input.folder !== undefined || input.kind || input.archive, {
    message: 'Say what to do: folder, kind or archive.',
  });
export type BulkInput = z.input<typeof bulkSchema>;

/** Many entries filed, retyped or set aside at once: one change, undone at once. */
export async function changeEntries(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  raw: BulkInput,
): Promise<{ changed: number }> {
  const input = bulkSchema.parse(raw);
  const ids = [...new Set(input.ids)];
  const since = await lastLine(tx, spaceId);
  if (input.archive) {
    for (const id of ids) await archive(tx, actor, { spaceId, id });
  } else {
    const folder =
      input.folder === undefined
        ? undefined
        : input.folder === null || !input.folder.trim()
          ? null
          : input.folder
              .split('/')
              .map((part) => part.trim())
              .filter(Boolean)
              .join('/');
    for (let at = 0; at < ids.length; at += 50) {
      await save(tx, actor, spaceId, {
        entries: ids.slice(at, at + 50).map((id) => ({
          id,
          ...(input.kind ? { kind: input.kind } : {}),
          ...(folder !== undefined ? { data: { folder } } : {}),
        })),
      });
    }
  }
  const lines = await linesSince(tx, actor, spaceId, since);
  await record(tx, actor, {
    spaceId,
    command: 'entries.change',
    target: ids[0]!,
    before: null,
    after: {
      ids: ids.length,
      ...(input.folder !== undefined ? { folder: input.folder } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.archive ? { archive: true } : {}),
      lines,
    },
  });
  return { changed: ids.length };
}

/**
 * A kind renamed (« document » → « Document »), or merged into another: every entry follows, with
 * its model, the groups and the views that name it; one change, undone at once.
 */
export async function renameKind(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { from: string; to: string },
): Promise<{ kind: string; entries: number }> {
  const from = input.from.trim();
  const wanted = input.to.trim();
  if (!from || !wanted || wanted.length > 80) throw new Error('Give the kind and its new name.');
  // Into a kind that already exists (case and accents aside): as it is written there.
  const { rows: existing } = await tx.query<{ kind: string }>(
    `select kind from entry where space_id = $1 and jarvis_fold(kind) = jarvis_fold($2)
        and jarvis_fold(kind) <> jarvis_fold($3) and archived_at is null limit 1`,
    [spaceId, wanted, from],
  );
  const to = existing[0]?.kind ?? wanted;
  const { rows } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    data: Record<string, unknown>;
  }>(
    `select id, kind, title, data from entry
      where space_id = $1 and archived_at is null
        and (jarvis_fold(kind) = jarvis_fold($2)
             or (jarvis_fold(kind) = 'model' and jarvis_fold(title) = jarvis_fold($2))
             or (jarvis_fold(kind) = 'view' and jarvis_fold(coalesce(data->>'kind', '')) = jarvis_fold($2))
             or (jarvis_fold(kind) = 'area' and exists (
                   select 1 from jsonb_array_elements_text(coalesce(data->'kinds', '[]')) k
                    where jarvis_fold(k) = jarvis_fold($2))))`,
    [spaceId, from],
  );
  const own = rows.filter((row) => fold(row.kind) === fold(from));
  if (!own.length) throw new Error(`No kind « ${from} » in this space.`);
  const lines = [];
  for (const row of rows) {
    const before = await snapshotOf(tx, row.id);
    const kindNow = fold(row.kind);
    const change =
      kindNow === fold(from)
        ? { kind: to, title: row.title, data: row.data }
        : kindNow === 'model'
          ? { kind: row.kind, title: to, data: row.data }
          : kindNow === 'view'
            ? { kind: row.kind, title: row.title, data: { ...row.data, kind: to } }
            : {
                kind: row.kind,
                title: row.title,
                data: {
                  ...row.data,
                  kinds: [
                    ...new Set(
                      (row.data.kinds as string[]).map((one) =>
                        fold(one) === fold(from) ? to : one,
                      ),
                    ),
                  ],
                },
              };
    await tx.query(
      'update entry set kind = $2, title = $3, data = $4, updated_at = now() where id = $1',
      [row.id, change.kind, change.title, JSON.stringify(change.data)],
    );
    lines.push({
      spaceId,
      command: 'entry.update' as const,
      target: row.id,
      before,
      after: await snapshotOf(tx, row.id),
    });
  }
  const ids = await recordMany(tx, actor, lines);
  await record(tx, actor, {
    spaceId,
    command: 'kind.rename',
    target: to,
    before: { kind: own[0]!.kind },
    after: { kind: to, lines: ids },
  });
  return { kind: to, entries: own.length };
}

/** A kind filed in one of her groups (created if new), or in none: out of every other. */
export async function groupKind(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { kind: string; group: string | null },
): Promise<{ kind: string; group: string | null }> {
  const kind = input.kind.trim();
  const group = input.group?.trim() || null;
  if (!kind) throw new Error('Give the kind to file.');
  const { rows } = await tx.query<{ id: string; title: string; data: { kinds?: string[] } }>(
    `select id, title, data from entry where space_id = $1 and archived_at is null
        and jarvis_fold(kind) = 'area'`,
    [spaceId],
  );
  const entries: Parameters<typeof save>[3]['entries'] = [];
  for (const row of rows) {
    const kinds = row.data.kinds ?? [];
    const here = group !== null && fold(row.title) === fold(group);
    const without = kinds.filter((one) => fold(one) !== fold(kind));
    const next = here ? [...without, kind] : without;
    if (next.length !== kinds.length || here) entries.push({ id: row.id, data: { kinds: next } });
  }
  if (group !== null && !rows.some((row) => fold(row.title) === fold(group)))
    entries.push({ kind: AREA_KIND, title: group, data: { kinds: [kind] } });
  if (entries.length) await save(tx, actor, spaceId, { entries });
  return { kind, group };
}
