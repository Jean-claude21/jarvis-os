import { agenda } from './agenda';
import type { Tx } from './db';
import { DEFAULT_ZONE, inZone } from './time';

/** Something dated that comes soon: a reminder, an event, a deadline, a day. */
export interface Upcoming {
  id: string;
  /** Its time on her clock: « 2026-11-03 09:00 », or the day alone. */
  when: string;
  kind: string;
  title: string;
  space: string;
}

const DONE = new Set(['fait', 'envoyé', 'envoye', 'non envoyé']);

/** « 2026-11-03 09:00 » on her clock, or « 2026-11-03 » for a whole day. */
function shown(iso: string, allDay: boolean, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  return allDay ? day : `${day} ${get('hour')}:${get('minute')}`;
}

/**
 * What comes in the next `days` days (the anticipation, spec 006): the calendar (spec 011) from
 * the start of today, without what is done or sent.
 */
export async function upcoming(
  tx: Tx,
  spaceIds: string[],
  days = 3,
  now = new Date(),
  zone = DEFAULT_ZONE,
): Promise<Upcoming[]> {
  const local = shown(now.toISOString(), true, zone).split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const from = inZone({ year: local[0], month: local[1], day: local[2], hour: 0, minute: 0 }, zone);
  const to = new Date(from.getTime() + (days + 1) * 86_400_000);
  const seen = await agenda(tx, spaceIds, { from, to, today: now });
  return seen
    .filter((one) => !one.status || !DONE.has(one.status.toLowerCase()))
    .slice(0, 50)
    .map((one) => ({
      id: one.id,
      when: shown(one.start, one.allDay, zone),
      kind: one.kind,
      title: one.title,
      space: one.space,
    }));
}
