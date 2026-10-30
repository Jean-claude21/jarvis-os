import type { Occurrence } from '@jarvis-os/core';

// Her calendar as iCalendar (RFC 5545), for the calendar of her phone (spec 011): read-only, one
// event per occurrence, her own words only.

/** How far back and ahead the subscription reaches. */
export const FEED_DAYS_BEFORE = 31;
export const FEED_DAYS_AFTER = 334;

const text = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** A whole day as the date on her clock. */
const dayOf = (iso: string, zone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(iso)).replace(/-/g, '');

/** Lines longer than 75 octets go on, folded (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    // Never cut a character in two.
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end -= 1;
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return parts.join('\r\n ');
}

/** What a repeated entry says of itself, for one event that repeats in her phone. */
export interface Series {
  repete: string;
  /** Minutes; none for a moment. */
  duree: number | null;
  /** Days she skips (« 2026-11-04 »). */
  sauf: string[];
  /** Its zone. */
  fuseau: string;
  /** The last day it repeats, if she said one. */
  jusqu: string | null;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** A list or a range of numbers (« 1-5 », « 2,3 », « 0-5 »), or null when it is anything else. */
function numbers(field: string, low: number, high: number): number[] | null {
  const out: number[] = [];
  for (const part of field.split(',')) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) return null;
    const from = Number(match[1]);
    const to = Number(match[2] ?? match[1]);
    if (from < low || to > high || from > to) return null;
    for (let value = from; value <= to; value += 1) out.push(value);
  }
  return out;
}

/**
 * The repetition as an RRULE (RFC 5545) when her phone can repeat it itself: one time a day, on
 * every day, some weekdays, some days of the month (L, the last), or one day a year. Null for
 * anything else — the occurrences are then given one by one.
 */
export function rruleOf(repete: string): { rule: string; hour: number; minute: number } | null {
  const parts = repete.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minuteField, hourField, day, month, weekday] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (!/^\d+$/.test(minuteField) || !/^\d+$/.test(hourField)) return null;
  const minute = Number(minuteField);
  const hour = Number(hourField);
  if (minute > 59 || hour > 23) return null;
  const at = { hour, minute };
  if (month === '*' && day === '*' && weekday === '*') return { rule: 'FREQ=DAILY', ...at };
  if (month === '*' && day === '*') {
    const weekdays = numbers(weekday, 0, 7);
    if (!weekdays) return null;
    const byday = [...new Set(weekdays.map((one) => DAYS[one % 7]!))];
    return { rule: `FREQ=WEEKLY;BYDAY=${byday.join(',')}`, ...at };
  }
  if (month === '*' && weekday === '*') {
    const days = day.toUpperCase() === 'L' ? [-1] : numbers(day, 1, 31);
    if (!days) return null;
    return { rule: `FREQ=MONTHLY;BYMONTHDAY=${days.join(',')}`, ...at };
  }
  if (weekday === '*' && /^\d+$/.test(month) && /^\d+$/.test(day)) {
    return { rule: `FREQ=YEARLY;BYMONTH=${Number(month)};BYMONTHDAY=${Number(day)}`, ...at };
  }
  return null;
}

/** A wall-clock time in its zone, as iCalendar writes it with TZID. */
function local(iso: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function icsOf(
  occurrences: Occurrence[],
  options: {
    name: string;
    now: Date;
    zone: string;
    proposed: string;
    /** Repeated entries her phone can repeat itself, by id. */
    series?: Map<string, Series>;
  },
): string {
  const now = stamp(options.now.toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jarvis OS//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(options.name)}`,
    `X-WR-TIMEZONE:${options.zone}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  const describe = (one: Occurrence) => {
    const title = one.proposed ? `${options.proposed} · ${one.title}` : one.title;
    lines.push(
      `SUMMARY:${text(title)}`,
      `DESCRIPTION:${text(`${one.kind} · ${one.space}`)}`,
      `CATEGORIES:${text(one.kind)}`,
      `STATUS:${one.proposed ? 'TENTATIVE' : 'CONFIRMED'}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  };
  const repeated = new Set<string>();
  for (const one of occurrences) {
    const series = one.repeated ? options.series?.get(one.id) : undefined;
    const rule = series ? rruleOf(series.repete) : null;
    if (series && rule) {
      // One event from its first time in the window; her phone repeats it.
      if (repeated.has(one.id)) continue;
      repeated.add(one.id);
      const until = series.jusqu
        ? `;UNTIL=${series.jusqu.replace(/-/g, '').slice(0, 8)}T235959Z`
        : '';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${one.id}@jarvis-os`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=${series.fuseau}:${local(one.start, series.fuseau)}`,
        ...(series.duree ? [`DURATION:PT${Math.round(series.duree)}M`] : []),
        `RRULE:${rule.rule}${until}`,
        ...series.sauf.map(
          (day) =>
            `EXDATE;TZID=${series.fuseau}:${day.replace(/-/g, '')}T${pad(rule.hour)}${pad(rule.minute)}00`,
        ),
      );
      describe(one);
      continue;
    }
    lines.push('BEGIN:VEVENT', `UID:${one.id}-${stamp(one.start)}@jarvis-os`, `DTSTAMP:${now}`);
    if (one.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dayOf(one.start, options.zone)}`);
      if (one.end) lines.push(`DTEND;VALUE=DATE:${dayOf(one.end, options.zone)}`);
    } else {
      lines.push(`DTSTART:${stamp(one.start)}`);
      if (one.end) lines.push(`DTEND:${stamp(one.end)}`);
    }
    describe(one);
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
