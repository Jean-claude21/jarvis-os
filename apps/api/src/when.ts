import { repetitionFromWords } from '@jarvis-os/core';
import * as chrono from 'chrono-node';

// Dates in her words (spec 030): « demain 9h », « vendredi prochain à 14h30 », « dans 2 semaines »
// — understood by Jarvis on her clock, not by the assistant's arithmetic. A date already written
// (« 2026-11-12 », « 2026-11-12T09:00 ») is kept as it is. The result is a wall-clock time of her
// zone, as Jarvis keeps them (« 2026-11-11T09:00 »), or a day (« 2026-11-16 ») when no hour was said.

/** The fields that hold a moment, in every kind (keywords of the engine). */
export const MOMENT_FIELDS = ['at', 'due', 'start', 'end', 'date', 'next'] as const;

const WRITTEN = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Her wall clock now, as a Date whose local fields are hers: what chrono reads. */
function wallClock(zone: string, now: Date): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return new Date(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!);
}

/** What a phrase means on her clock; null when it is already a date, or says none. */
export function whenOf(
  text: string,
  zone: string,
  now = new Date(),
): { value: string; allDay: boolean } | null {
  // The typographic apostrophe of phones and assistants (« aujourd’hui ») read as the plain one.
  const said = text.trim().replace(/[‘’ʼ]/g, "'");
  if (!said || WRITTEN.test(said)) return null;
  const ref = wallClock(zone, now);
  const found =
    chrono.fr.parse(said, ref, { forwardDate: true })[0] ??
    chrono.en.parse(said, ref, { forwardDate: true })[0];
  if (!found) return null;
  const at = found.start;
  const day = `${at.get('year')}-${pad(at.get('month')!)}-${pad(at.get('day')!)}`;
  if (!at.isCertain('hour')) return { value: day, allDay: true };
  return { value: `${day}T${pad(at.get('hour')!)}:${pad(at.get('minute') ?? 0)}`, allDay: false };
}

/**
 * The moments of entries written in her words, turned into dates on her clock; what was understood,
 * to say back to her.
 */
export function momentsOf<
  T extends { title?: string | undefined; data?: Record<string, unknown> | undefined },
>(
  entries: T[],
  zone: string,
  now = new Date(),
): { entries: T[]; understood: { entry: string; field: string; said: string; date: string }[] } {
  const understood: { entry: string; field: string; said: string; date: string }[] = [];
  const turned = entries.map((entry) => {
    if (!entry.data) return entry;
    const data = { ...entry.data };
    for (const field of MOMENT_FIELDS) {
      const value = data[field];
      if (typeof value !== 'string') continue;
      const when = whenOf(value, zone, now);
      if (!when) continue;
      data[field] = when.value;
      understood.push({ entry: entry.title ?? '', field, said: value, date: when.value });
    }
    // A repetition in her words (spec 036): « tous les lundis à 7h » → « 0 7 * * 1 ».
    if (typeof data.repeat === 'string') {
      const fields = repetitionFromWords(data.repeat);
      if (fields) {
        understood.push({
          entry: entry.title ?? '',
          field: 'repeat',
          said: data.repeat,
          date: fields,
        });
        data.repeat = fields;
      }
    }
    return { ...entry, data };
  });
  return { entries: turned, understood };
}
