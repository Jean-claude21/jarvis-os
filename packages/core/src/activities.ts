import type pg from 'pg';
import { z } from 'zod';
import { createKey } from './keys';
import type { Actor, Tx } from './db';
import { asPerson } from './db';
import { save } from './entries';
import { CLOSED } from './keywords';
import { zoneOf } from './zone';

// Activities (spec 057): « something to do » is a property a kind can have, as time is (spec 011)
// — a Task, an Execution, any kind whose model says `activity: true`. Its
// state is its `status`, its time its `due` (or `at`); nothing new is stored. Spec 058: all of
// them, as Dataverse shows its activities — what she does (`todo`) and also what happens to her
// (reminders, meetings, any entry with a `start`), in one stream. Executions trace the
// work programs do for her; long work answers later, with a work token bound to one execution.

/** The kinds that are activities without a model saying so. */
// A reminder tells her at a time (spec 006); it is not something to do, so it stays on the agenda.
export const ACTIVITY_KINDS = ['Task', 'Execution'];
/** What happens to her, shown with her activities in the whole stream (spec 058). */
export const HAPPENING_KINDS = ['Reminder', 'Event'];
export const EXECUTION_KIND = 'Execution';
/** The link from an activity to what it concerns, and from an entry to the execution that made it. */
export const ABOUT = 'about';
export const MADE_BY = 'made_by';

export type ActivityGroup = 'review' | 'failed' | 'late' | 'today' | 'week' | 'later' | 'undated';
export type ActivityState = 'open' | 'review' | 'failed' | 'done' | 'all';

export interface Activity {
  id: string;
  kind: string;
  title: string;
  space: string;
  spaceId: string;
  status: string;
  /** Its time as written (« 2026-11-20 », or an instant), or null. */
  due: string | null;
  /** When it happens or is due, whatever the field (due, at, start, next, started), or null. */
  at: string | null;
  /** Something to do (a task, an execution, a kind made one), or something that happens. */
  todo: boolean;
  group: ActivityGroup | 'done';
  who: string | null;
  about: { id: string; kind: string; title: string }[];
  updatedAt: string;
  /** Of an execution: what it did. */
  execution?: {
    service: string | null;
    counts: Record<string, number>;
    error: string | null;
    started: string | null;
    ended: string | null;
  };
}

export const activitiesQuerySchema = z.object({
  state: z.enum(['open', 'review', 'failed', 'done', 'all']).optional(),
  kind: z.string().trim().min(1).max(80).optional(),
  about: z.string().trim().min(1).max(64).optional(),
  when: z.enum(['late', 'today', 'week', 'later', 'undated']).optional(),
  /** `todo` (default): what she has to do; `all`: reminders, meetings and anything dated too. */
  scope: z.enum(['todo', 'all']).optional(),
  /** Of the whole stream: when it happens, on her clock. */
  period: z.enum(['today', 'week', 'month', 'upcoming', 'past', 'any']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export type ActivitiesQuery = z.infer<typeof activitiesQuerySchema>;

const FAILED = new Set(['failed', 'to_fix']);
const ORDER: Record<Activity['group'], number> = {
  review: 0,
  failed: 1,
  late: 2,
  today: 3,
  week: 4,
  later: 5,
  undated: 6,
  done: 7,
};

/** The day of an instant on her clock: « 2026-11-13 ». */
const dayOf = (at: Date, zone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(at);

const addDays = (day: string, days: number) => {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

/** The day a due falls on, on her clock, or null. */
function dueDay(due: string | null, zone: string): string | null {
  if (!due) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return due;
  const at = new Date(due);
  return Number.isNaN(at.getTime()) ? null : dayOf(at, zone);
}

/** Where an activity stands, from its status and due, today being `today` on her clock. */
export function groupOf(
  status: string,
  due: string | null,
  today: string,
  zone: string,
): Activity['group'] {
  if (status === 'proposed') return 'review';
  if (FAILED.has(status)) return 'failed';
  if (CLOSED.has(status) || status === 'done') return 'done';
  const day = dueDay(due, zone);
  if (!day) return 'undated';
  if (day < today) return 'late';
  if (day === today) return 'today';
  if (day <= addDays(today, 7)) return 'week';
  return 'later';
}

/** A time she wrote, as a sortable instant on her clock (« 2026-11-13 » sorts as that day). */
function stamp(at: string | null, zone: string): string {
  if (!at) return '9999';
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return `${at}T00:00`;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '9999';
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${dayOf(date, zone)}T${time}`;
}

/** Whether an activity falls in a period of the stream, today being `today` on her clock. */
function inPeriod(
  at: string | null,
  period: ActivitiesQuery['period'],
  today: string,
  zone: string,
): boolean {
  if (!period || period === 'any') return true;
  const day = dueDay(at, zone);
  if (!day) return false;
  if (period === 'today') return day === today;
  if (period === 'upcoming') return day >= today;
  if (period === 'past') return day < today;
  if (period === 'week') {
    const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
    return day >= monday && day <= addDays(monday, 6);
  }
  return day.slice(0, 7) === today.slice(0, 7);
}

interface Row {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  space_id: string;
  space: string;
  updated_at: string;
}

/** Jarvis writing the trace of the work: the key's limits are on what the service sends, not here. */
const asJarvis = (actor: Actor): Actor =>
  Object.fromEntries(Object.entries(actor).filter(([name]) => name !== 'kinds')) as Actor;

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

/** Her activities in these spaces, those that need her first. */
export async function activities(
  tx: Tx,
  spaceIds: string[],
  query: ActivitiesQuery = {},
  now = new Date(),
  given?: string,
): Promise<Activity[]> {
  const zone = given ?? (await zoneOf(tx));
  const today = dayOf(now, zone);
  const state = query.state ?? 'open';
  const all = query.scope === 'all';
  const { rows } = await tx.query<Row>(
    `with declared as (
       select jarvis_fold(title) as kind from entry
        where space_id = any($1) and archived_at is null and jarvis_fold(kind) = 'model'
          and data->>'activity' = 'true')
     select e.id, e.kind, e.title, e.data, e.space_id, s.name as space,
            to_char(e.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
       from entry e join space s on s.id = e.space_id
      where e.space_id = any($1) and e.archived_at is null
        and (jarvis_fold(e.kind) in (select jarvis_fold(k) from unnest($2::text[]) k)
             or jarvis_fold(e.kind) in (select kind from declared)
             or ($5 and (jarvis_fold(e.kind) in (select jarvis_fold(k) from unnest($6::text[]) k)
                         or (e.data ? 'start'
                             and jarvis_fold(e.kind) not in ('model', 'rule', 'page', 'view')))))
        and ($3::text is null or jarvis_fold(e.kind) = jarvis_fold($3))
        and ($4::text is null or exists (
              select 1 from link l where l.from_id = e.id and l.to_id = $4 and l.role in ('${ABOUT}', 'for')))
      order by e.updated_at desc
      limit 2000`,
    [spaceIds, ACTIVITY_KINDS, query.kind ?? null, query.about ?? null, all, HAPPENING_KINDS],
  );
  const { rows: made } = await tx.query<{ kind: string }>(
    `select jarvis_fold(title) as kind from entry
      where space_id = any($1) and archived_at is null and jarvis_fold(kind) = 'model'
        and data->>'activity' = 'true'`,
    [spaceIds],
  );
  const declared = new Set(made.map((row) => row.kind));
  const folded = (kind: string) =>
    kind
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const items: Activity[] = rows.map((row) => {
    const todo = ACTIVITY_KINDS.includes(row.kind) || declared.has(folded(row.kind));
    const start = text(row.data.start);
    const due = text(row.data.due) ?? text(row.data.at) ?? text(row.data.until);
    const at =
      row.kind === EXECUTION_KIND
        ? text(row.data.started)
        : (due ?? start ?? text(row.data.next) ?? text(row.data.date));
    // What happens to her is done once its time has passed, unless it says otherwise.
    const ends = text(row.data.end) ?? start;
    const passed = Boolean(ends) && new Date(ends!).getTime() < now.getTime();
    const status =
      text(row.data.status) ??
      (row.kind === EXECUTION_KIND ? 'running' : !todo && passed ? 'done' : 'planned');
    const counts =
      row.data.counts && typeof row.data.counts === 'object'
        ? (row.data.counts as Record<string, number>)
        : {};
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      space: row.space,
      spaceId: row.space_id,
      status,
      due: row.kind === EXECUTION_KIND ? null : due,
      at,
      todo,
      group: groupOf(status, row.kind === EXECUTION_KIND ? null : todo ? due : at, today, zone),
      who: text(row.data.who),
      about: [],
      updatedAt: row.updated_at,
      ...(row.kind === EXECUTION_KIND
        ? {
            execution: {
              service: text(row.data.service),
              counts,
              error: text(row.data.error),
              started: text(row.data.started),
              ended: text(row.data.ended),
            },
          }
        : {}),
    };
  });
  const kept = items
    .filter((one) => {
      if (state === 'all') return true;
      if (state === 'done') return one.group === 'done';
      if (state === 'review') return one.group === 'review';
      if (state === 'failed') return one.group === 'failed';
      return one.group !== 'done';
    })
    .filter((one) => !query.when || one.group === query.when)
    .filter((one) => inPeriod(one.at, query.period, today, zone))
    .sort(
      all
        ? // The stream: by when it happens, what has no time last.
          (a, b) =>
            stamp(a.at, zone).localeCompare(stamp(b.at, zone)) ||
            b.updatedAt.localeCompare(a.updatedAt)
        : (a, b) =>
            ORDER[a.group] - ORDER[b.group] ||
            (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
            b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, query.limit ?? 300);
  if (kept.length) {
    const { rows: links } = await tx.query<{
      from_id: string;
      id: string;
      kind: string;
      title: string;
    }>(
      `select l.from_id, e.id, e.kind, e.title from link l join entry e on e.id = l.to_id
        where l.from_id = any($1) and l.role in ('${ABOUT}', 'for') and e.archived_at is null`,
      [kept.map((one) => one.id)],
    );
    const byId = new Map(kept.map((one) => [one.id, one]));
    for (const link of links)
      byId.get(link.from_id)?.about.push({ id: link.id, kind: link.kind, title: link.title });
  }
  return kept;
}

// — Executions —

export const WORK_MINUTES = 30;
export const WORK_MAX_MINUTES = 360;

export interface OpenedExecution {
  id: string;
  /** For long work: the token the service answers with, and until when. */
  token?: string;
  until?: string;
}

/** An execution begun: `running`, linked about what started it; a work token for long work. */
export async function openExecution(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: {
    service: string;
    action?: string | null;
    title?: string;
    about?: string | null;
    long?: boolean;
    minutes?: number;
    /** The kinds the service may write with its token (an execution is always one of them). */
    kinds?: string[];
    /** The connections lent for the work. */
    lend?: string[];
  },
  now = new Date(),
): Promise<OpenedExecution> {
  const minutes = Math.min(Math.max(input.minutes ?? WORK_MINUTES, 1), WORK_MAX_MINUTES);
  const until = new Date(now.getTime() + minutes * 60_000).toISOString();
  const saved = await save(tx, asJarvis(actor), spaceId, {
    entries: [
      {
        kind: EXECUTION_KIND,
        title: (input.title ?? `${input.service}${input.action ? ` — ${input.action}` : ''}`).slice(
          0,
          300,
        ),
        data: {
          service: input.service,
          ...(input.action ? { action: input.action } : {}),
          status: 'running',
          started: now.toISOString(),
          counts: { created: 0, updated: 0, skipped: 0 },
          ...(input.long ? { long: true, until } : {}),
          ...(input.lend?.length ? { lend: input.lend } : {}),
        },
        origin: 'inferred',
      },
    ],
  });
  const id = saved.entries[0]!.id;
  if (input.about) {
    await save(tx, asJarvis(actor), spaceId, {
      links: [{ from: id, to: input.about, role: ABOUT }],
    });
  }
  if (!input.long) return { id };
  const kinds = [...new Set([EXECUTION_KIND, ...(input.kinds ?? [])])];
  const made = await createKey(tx, actor.person, `work:${input.service}`.slice(0, 80), {
    spaceId,
    kinds,
  });
  await tx.query('update personal_key set execution_id = $2, expires_at = $3 where id = $1', [
    made.id,
    id,
    until,
  ]);
  return { id, token: made.key, until };
}

export const closeSchema = z.object({
  status: z.enum(['done', 'failed']),
  counts: z.record(z.string(), z.number().int().min(0).max(1_000_000)).optional(),
  error: z.string().trim().max(1000).optional(),
  log: z.string().max(4000).optional(),
});
export type CloseInput = z.infer<typeof closeSchema>;

const executionOf = async (tx: Tx, spaceId: string, id: string) => {
  const { rows } = await tx.query<{ title: string; data: Record<string, unknown> }>(
    `select title, data from entry
      where id = $1 and space_id = $2 and archived_at is null and kind = '${EXECUTION_KIND}'`,
    [id, spaceId],
  );
  if (!rows[0]) throw new Error(`No execution ${id}.`);
  return rows[0];
};

/** What a service sent, counted on its execution, each entry linked to it (`made_by`). */
export async function countOnExecution(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  id: string,
  result: { created: number; updated: number; skipped: number; ids: string[] },
): Promise<void> {
  const execution = await executionOf(tx, spaceId, id);
  if (execution.data.status !== 'running')
    throw new Error(`The execution ${id} is closed: nothing more is written for it.`);
  const counts = { ...((execution.data.counts as Record<string, number>) ?? {}) };
  for (const name of ['created', 'updated', 'skipped'] as const)
    counts[name] = (counts[name] ?? 0) + result[name];
  const by = asJarvis(actor);
  await save(tx, by, spaceId, {
    entries: [{ id, data: { counts }, origin: 'inferred' }],
    links: result.ids.slice(0, 200).map((made) => ({ from: made, to: id, role: MADE_BY })),
  });
}

/** An execution closed: done or failed, once; its work token answers nothing any more. */
export async function closeExecution(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  id: string,
  raw: CloseInput,
  now = new Date(),
): Promise<void> {
  const input = closeSchema.parse(raw);
  const execution = await executionOf(tx, spaceId, id);
  if (execution.data.status !== 'running')
    throw new Error(`The execution ${id} is already ${String(execution.data.status)}.`);
  const counts = { ...((execution.data.counts as Record<string, number>) ?? {}) };
  for (const [name, value] of Object.entries(input.counts ?? {}))
    counts[name] = Math.max(counts[name] ?? 0, value);
  const by = asJarvis(actor);
  await save(tx, by, spaceId, {
    entries: [
      {
        id,
        data: {
          status: input.status,
          ended: now.toISOString(),
          counts,
          ...(input.error ? { error: input.error } : {}),
          ...(input.log ? { log: input.log } : {}),
        },
        origin: 'inferred',
      },
    ],
  });
  await tx.query(
    'update personal_key set revoked_at = now() where execution_id = $1 and revoked_at is null',
    [id],
  );
  if (input.status === 'failed') {
    const saved = await save(tx, by, spaceId, {
      entries: [
        {
          kind: 'Reminder',
          title: `« ${execution.title} » failed — ${input.error ?? 'no reason given'}`.slice(
            0,
            300,
          ),
          data: { at: now.toISOString(), status: 'planned' },
          origin: 'inferred',
        },
      ],
    });
    await save(tx, by, spaceId, {
      links: [{ from: saved.entries[0]!.id, to: id, role: ABOUT }],
    });
  }
}

/** The connections an execution lends, while it runs (spec 057, US6). */
export async function lentBy(tx: Tx, spaceId: string, id: string): Promise<string[]> {
  const execution = await executionOf(tx, spaceId, id);
  if (execution.data.status !== 'running') throw new Error(`The execution ${id} is closed.`);
  return Array.isArray(execution.data.lend)
    ? execution.data.lend.filter((one): one is string => typeof one === 'string')
    : [];
}

/** The watcher's part: long work past its time without an answer is closed `failed`. */
export async function failOverdueWork(db: pg.Pool, now: Date): Promise<number> {
  const { rows } = await db.query<{ person: string; space_id: string; execution_id: string }>(
    'select person, space_id, execution_id from jarvis_overdue_work($1)',
    [now.toISOString()],
  );
  let failed = 0;
  for (const row of rows) {
    await asPerson(db, row.person, async (tx) => {
      const actor: Actor = { person: row.person, door: 'watcher' };
      const { rows: found } = await tx.query<{ status: string | null }>(
        `select data->>'status' as status from entry where id = $1 and space_id = $2`,
        [row.execution_id, row.space_id],
      );
      if (found[0]?.status === 'running') {
        await closeExecution(
          tx,
          actor,
          row.space_id,
          row.execution_id,
          { status: 'failed', error: 'No answer in time.' },
          now,
        );
        failed += 1;
      } else {
        await tx.query(
          'update personal_key set revoked_at = now() where execution_id = $1 and revoked_at is null',
          [row.execution_id],
        );
      }
    }).catch((error) => console.warn('[watcher] work', (error as Error).message));
  }
  return failed;
}
