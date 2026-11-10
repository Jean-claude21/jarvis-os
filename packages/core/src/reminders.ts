import type { Actor, Tx } from './db';
import { occurrencesOf } from './agenda';
import { get, save, type Entry } from './entries';
import { TIME_FIELDS } from './time';
import { zoneOf } from './zone';

// Reminders attached to a thing (spec 037, plan v2 C3): « 1 jour avant », « 15 min avant ». A dated
// entry says them in `remind`; Jarvis keeps one « Reminder » per offset, linked to the thing (`for`),
// at the thing's next time minus the offset — moved when the thing moves, the next occurrence's once
// one is sent, set aside when she removes it. Without `remind`, her defaults by kind (and by space)
// apply to a new dated thing. Computed by Jarvis, without any AI.

const UNITS: [RegExp, number][] = [
  [/^(min|mn|minutes?|m)$/, 1],
  [/^(h|heures?|hours?|hr?s?)$/, 60],
  [/^(j|jours?|days?|d)$/, 1440],
  [/^(sem|semaines?|weeks?|w)$/, 10080],
];

/** Minutes before, from her words: « 1 jour avant », « 15 min », « 2h », « la veille ». */
export function offsetOf(said: string): number | null {
  const text = said
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(avant|before|plus tot|earlier)\b/g, '')
    .trim();
  if (/^(la veille|the day before)$/.test(text)) return 1440;
  if (/^(a l heure|sur le moment|at the time|0)$/.test(text.replace(/'/g, ' '))) return 0;
  const match = /^(\d+(?:[.,]\d+)?)\s*([a-z]+)$/.exec(text);
  if (!match) return null;
  const unit = UNITS.find(([re]) => re.test(match[2]!));
  if (!unit) return null;
  const minutes = Math.round(Number(match[1]!.replace(',', '.')) * unit[1]);
  return minutes >= 0 && minutes <= 60 * 24 * 60 ? minutes : null;
}

const said = (value: unknown): string[] | null =>
  Array.isArray(value)
    ? value.filter((one): one is string => typeof one === 'string' && one.trim() !== '')
    : typeof value === 'string' && value.trim()
      ? [value]
      : null;

/** Her defaults for a kind, in a space: « Space/Kind », then « Kind », then « * ». */
export function defaultsFor(
  defaults: Record<string, string[]> | undefined,
  space: string,
  kind: string,
): string[] {
  if (!defaults) return [];
  const fold = (one: string) => one.trim().toLowerCase();
  const keys = Object.keys(defaults);
  const pick = (wanted: string) => keys.find((key) => fold(key) === fold(wanted));
  const key = pick(`${space}/${kind}`) ?? pick(kind) ?? pick('*');
  return key ? (defaults[key] ?? []) : [];
}

/** The next time of a thing from `now`: its start, moment, deadline or day, or its next occurrence. */
function nextOf(
  thing: { id: string; kind: string; title: string; data: Record<string, unknown> },
  now: Date,
  zone: string,
  lead: number,
): Date | null {
  const row = { ...thing, space: '', space_id: '' };
  // Looked for from the earliest a reminder could still be ahead.
  const from = new Date(now.getTime());
  const to = new Date(now.getTime() + (lead + 400 * 1440) * 60_000);
  const found = occurrencesOf(row, from, to, now, zone).filter(
    (one) => !['done', 'cancelled'].includes(String(one.status)),
  );
  for (const one of found) {
    const at = new Date(one.start);
    if (at.getTime() - lead * 60_000 > now.getTime()) return at;
  }
  return null;
}

/**
 * Keeps the reminders of things in step (after a save, and after one is sent): one per offset it
 * says, at its next time minus the offset; moved, created, or set aside. Returns what it did.
 */
export async function syncReminders(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  ids: string[],
  options: { now?: Date; defaults?: Record<string, string[]>; created?: Set<string> } = {},
): Promise<{ made: number; moved: number; removed: number }> {
  const report = { made: 0, moved: 0, removed: 0 };
  const now = options.now ?? new Date();
  const zone = await zoneOf(tx);
  const { rows: spaces } = await tx.query<{ name: string }>(
    'select name from space where id = $1',
    [spaceId],
  );
  const space = spaces[0]?.name ?? '';
  for (const id of ids) {
    const thing = await get(tx, spaceId, id);
    if (!thing || thing.archivedAt || /^reminder$/i.test(thing.kind)) continue;
    const dated = TIME_FIELDS.some((field) => thing.data[field] !== undefined);
    let wanted = said(thing.data.remind);
    if (wanted === null && options.created?.has(id) && dated) {
      wanted = defaultsFor(options.defaults, space, thing.kind);
    }
    // Its reminders: those linked to it as « for », that Jarvis keeps by their offset.
    const attached: Entry[] = [];
    for (const link of thing.links.in) {
      if (link.role !== 'for' || !/^reminder$/i.test(link.entry.kind)) continue;
      const one = await get(tx, spaceId, link.entry.id);
      if (one && !one.archivedAt && typeof one.data.before === 'string') attached.push(one);
    }
    const offsets = new Map<string, number>();
    for (const one of wanted ?? []) {
      const minutes = offsetOf(one);
      if (minutes !== null) offsets.set(one.trim(), minutes);
    }
    const changes: Parameters<typeof save>[3] = { entries: [], links: [] };
    for (const one of attached) {
      const before = String(one.data.before);
      if (wanted !== null && !offsets.has(before)) {
        changes.entries!.push({ id: one.id, data: { status: 'cancelled' } });
        report.removed += 1;
      }
    }
    if (!dated && !attached.length) continue;
    for (const [before, minutes] of offsets) {
      const next = dated ? nextOf(thing, now, zone, minutes) : null;
      const at = next ? new Date(next.getTime() - minutes * 60_000) : null;
      const value = at
        ? new Intl.DateTimeFormat('sv-SE', {
            timeZone: zone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
            .format(at)
            .replace(' ', 'T')
        : null;
      const mine = attached.find((one) => String(one.data.before) === before);
      if (mine) {
        if (!value) {
          // Its time has passed: one sent stays sent; one never sent goes.
          if (!['cancelled', 'sent'].includes(String(mine.data.status))) {
            changes.entries!.push({ id: mine.id, data: { status: 'cancelled' } });
            report.removed += 1;
          }
        } else if (mine.data.at !== value || mine.data.status !== 'planned') {
          changes.entries!.push({
            id: mine.id,
            data: { at: value, status: 'planned', last_sent: null, error: null },
          });
          report.moved += 1;
        }
        continue;
      }
      if (!value) continue;
      const ref = `r${changes.entries!.length}`;
      changes.entries!.push({
        ref,
        kind: 'Reminder',
        title: thing.title,
        data: { at: value, before, status: 'planned', timezone: zone },
        origin: 'inferred',
      });
      changes.links!.push({ from: ref, to: id, role: 'for' });
      report.made += 1;
    }
    if (changes.entries!.length) {
      await save(
        tx,
        { ...actor, client: 'reminders', depth: (actor.depth ?? 0) + 1 },
        spaceId,
        changes,
      );
    }
  }
  return report;
}
