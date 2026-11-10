import { agenda, type Occurrence } from './agenda';
import type { Tx } from './db';
import { lingering, openIntentions } from './intentions';
import { CLOSED } from './keywords';
import { inZone } from './time';
import { zoneOf } from './zone';

// What needs her now (spec 013), read from what she already keeps — no new field, no new kind:
// what went wrong, what is late, what Jarvis proposed, what comes today and this week. The
// platform's « Maintenant » draws it; her day is the calendar of today.

export type AttentionGroup = 'fix' | 'late' | 'proposed' | 'intent' | 'today' | 'week';

export interface AttentionItem {
  id: string;
  kind: string;
  title: string;
  space: string;
  spaceId: string;
  group: AttentionGroup;
  /** ISO instant it is placed at, or null (a thing to fix has no time). */
  when: string | null;
  allDay: boolean;
  status: string | null;
  /** Why it is here, in a word the app translates: « error », « late », « proposed », … */
  reason: string;
  /** For whom (spec 038): her, or nobody in particular — what is for another stays theirs. */
  who: string | null;
  /** An intention nothing followed (spec 040): how many times she said it, since when. */
  said?: { times: number; since: string };
}

export interface Attention {
  items: AttentionItem[];
  /** Today's calendar, everything, for her day at a glance. */
  day: Occurrence[];
}

const DONE = new Set([...CLOSED, 'to_fix']);
const TO_FIX = ['to_fix', 'failed'];

/** Midnight of the day of `at` on her clock, and of the next. */
function dayBounds(at: Date, zone: string): { start: Date; end: Date } {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: zone })
    .format(at)
    .split('-')
    .map(Number) as [number, number, number];
  return {
    start: inZone({ year, month, day, hour: 0, minute: 0 }, zone),
    end: inZone({ year, month, day: day + 1, hour: 0, minute: 0 }, zone),
  };
}

export async function attention(
  tx: Tx,
  spaceIds: string[],
  now = new Date(),
  given?: string,
): Promise<Attention> {
  const zone = given ?? (await zoneOf(tx));
  const { rows: me } = await tx.query<{ person: string | null }>(
    "select current_setting('jarvis.person', true) as person",
  );
  const self = me[0]?.person ?? null;
  // What is for another member is theirs: not in her « Maintenant ».
  const others = (who: unknown) => typeof who === 'string' && who !== '' && who !== self;
  const { start, end } = dayBounds(now, zone);
  const items: AttentionItem[] = [];
  const seen = new Set<string>();
  const add = (item: AttentionItem) => {
    if (seen.has(item.id) || others(item.who)) return;
    seen.add(item.id);
    items.push(item);
  };

  // What went wrong: the watcher could not tell her, or a repetition must be corrected.
  const { rows: broken } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    space: string;
    space_id: string;
    status: string;
    who: string | null;
  }>(
    `select e.id, e.kind, e.title, s.name as space, e.space_id, e.data->>'status' as status,
            e.data->>'who' as who
       from entry e join space s on s.id = e.space_id
      where e.space_id = any($1) and e.archived_at is null and e.data->>'status' = any($2)
      order by e.updated_at desc limit 20`,
    [spaceIds, TO_FIX],
  );
  for (const row of broken) {
    add({
      id: row.id,
      kind: row.kind,
      title: row.title,
      space: row.space,
      spaceId: row.space_id,
      group: 'fix',
      when: null,
      allDay: false,
      status: row.status,
      reason: 'error',
      who: row.who,
    });
  }

  const open = (one: Occurrence) => !one.status || !DONE.has(one.status.toLowerCase());
  const item = (one: Occurrence, group: AttentionGroup, reason: string): AttentionItem => ({
    id: one.id,
    kind: one.kind,
    title: one.title,
    space: one.space,
    spaceId: one.spaceId,
    group,
    when: one.start,
    allDay: one.allDay,
    status: one.status,
    reason,
    who: one.who,
  });

  // Late: a deadline of the last month that passed and is not done, or a moment said to be done
  // (it has a status: planned, to do). An event that happened is not late, nor a moment she noted
  // (a prayer at 05:10); a repetition goes on by itself.
  const month = await agenda(tx, spaceIds, {
    from: new Date(start.getTime() - 30 * 86_400_000),
    to: end,
    today: now,
  });
  for (const one of month) {
    if (one.repeated || !open(one)) continue;
    const passed = one.allDay ? new Date(one.end ?? one.start) <= start : new Date(one.start) < now;
    if (passed && ((one.type === 'moment' && one.status) || one.type === 'deadline'))
      add(item(one, 'late', 'late'));
  }

  const ahead = await agenda(tx, spaceIds, {
    from: start,
    to: new Date(end.getTime() + 7 * 86_400_000),
    today: now,
  });
  for (const one of ahead) if (one.proposed && open(one)) add(item(one, 'proposed', 'proposed'));
  // Today and this week: what is planned — the blocks that repeat stay in her day, not in the list.
  for (const one of ahead) {
    if (!open(one) || (one.repeated && one.type === 'span')) continue;
    const today = new Date(one.start) < end;
    // A `date` of today is most often a fact of the day (an expense, a note), not something to do.
    if (today && one.type === 'day') continue;
    if (today && !one.allDay && one.end === null && new Date(one.start) < now && one.repeated)
      continue;
    add(item(one, today ? 'today' : 'week', today ? 'today' : 'soon'));
  }

  // A proposal not placed in time still waits for her answer.
  const { rows: proposed } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    space: string;
    space_id: string;
    who: string | null;
  }>(
    `select e.id, e.kind, e.title, s.name as space, e.space_id, e.data->>'who' as who
       from entry e join space s on s.id = e.space_id
      where e.space_id = any($1) and e.archived_at is null and e.data->>'status' = 'proposed'
      order by e.created_at desc limit 20`,
    [spaceIds],
  );
  for (const row of proposed) {
    add({
      id: row.id,
      kind: row.kind,
      title: row.title,
      space: row.space,
      spaceId: row.space_id,
      group: 'proposed',
      when: null,
      allDay: false,
      status: 'proposed',
      reason: 'proposed',
      who: row.who,
    });
  }

  // What she said she would do and nothing followed (spec 040): plan it, hand it over, or drop it.
  for (const spaceId of spaceIds) {
    const { rows: named } = await tx.query<{ name: string }>(
      'select name from space where id = $1',
      [spaceId],
    );
    for (const one of await openIntentions(tx, spaceId)) {
      const said = lingering(one, now);
      if (!said) continue;
      add({
        id: one.id,
        kind: one.kind,
        title: one.title,
        space: named[0]?.name ?? '',
        spaceId,
        group: 'intent',
        when: null,
        allDay: false,
        status: 'open',
        reason: 'said',
        who: typeof one.data.who === 'string' ? one.data.who : null,
        said,
      });
    }
  }

  const order: AttentionGroup[] = ['fix', 'late', 'proposed', 'intent', 'today', 'week'];
  items.sort(
    (a, b) =>
      order.indexOf(a.group) - order.indexOf(b.group) ||
      (a.when === b.when
        ? 0
        : a.when === null
          ? 1
          : b.when === null
            ? -1
            : a.when < b.when
              ? -1
              : 1),
  );
  return {
    items,
    day: ahead.filter((one) => new Date(one.start) < end && !others(one.who)),
  };
}
