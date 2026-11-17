import { DEFAULT_ZONE, inZone } from './time';

// Reading a calendar published as iCalendar (RFC 5545), for an ICS source (v3 D16): its events,
// each with its uid, its start and end as instants (or days for a whole day), its place. Repeating
// rules are not unfolded here: a published timetable lists its classes one by one.

export interface IcsEvent {
  uid: string;
  title: string;
  /** « 2026-11-18T08:00:00.000Z », or « 2026-11-18 » for a whole day. */
  start: string;
  end: string | null;
  allDay: boolean;
  place: string | null;
  description: string | null;
  /** Its own repeating rule, kept as written. */
  rrule: string | null;
}

const unescape = (text: string) =>
  text.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

/** A date-time as the calendar writes it: UTC (`Z`), on a named clock (`TZID`), or a day. */
function instant(value: string, params: Record<string, string>, zone: string) {
  const day = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (day || params.VALUE === 'DATE') {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
    return m ? { at: `${m[1]}-${m[2]}-${m[3]}`, allDay: true } : null;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (z)
    return { at: new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!)).toISOString(), allDay: false };
  const clock = params.TZID?.replace(/^"|"$/g, '') || zone;
  let at: Date;
  try {
    at = inZone({ year: +y!, month: +mo!, day: +d!, hour: +h!, minute: +mi! }, clock);
  } catch {
    at = inZone({ year: +y!, month: +mo!, day: +d!, hour: +h!, minute: +mi! }, zone);
  }
  return { at: at.toISOString(), allDay: false };
}

/** The events of an iCalendar text; those that cannot be read are left out. */
export function readIcs(text: string, zone = DEFAULT_ZONE): IcsEvent[] {
  // Lines folded by a space or a tab continue the line before.
  const lines = text
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/);
  const out: IcsEvent[] = [];
  let current: Record<string, { value: string; params: Record<string, string> }> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) {
        const start =
          current.DTSTART && instant(current.DTSTART.value, current.DTSTART.params, zone);
        const end = current.DTEND && instant(current.DTEND.value, current.DTEND.params, zone);
        const uid = current.UID?.value;
        if (start && uid && current.STATUS?.value !== 'CANCELLED')
          out.push({
            uid,
            title: unescape(current.SUMMARY?.value ?? '').trim() || '(sans titre)',
            start: start.at,
            end: end ? end.at : null,
            allDay: start.allDay,
            place: current.LOCATION ? unescape(current.LOCATION.value).trim() || null : null,
            description: current.DESCRIPTION
              ? unescape(current.DESCRIPTION.value).trim().slice(0, 2000) || null
              : null,
            rrule: current.RRULE?.value ?? null,
          });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const [name, ...rest] = line.slice(0, colon).split(';');
    const params: Record<string, string> = {};
    for (const one of rest) {
      const eq = one.indexOf('=');
      if (eq > 0) params[one.slice(0, eq).toUpperCase()] = one.slice(eq + 1);
    }
    current[name!.toUpperCase()] = { value: line.slice(colon + 1), params };
  }
  return out;
}
