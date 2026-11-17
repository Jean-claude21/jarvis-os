// The days of the calendar and the timeline, on her clock.

export const dayKey = (date: Date) => date.toLocaleDateString('en-CA');
export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** The first day of the month « 2026-11 », or of this month. */
export function monthOf(m?: string) {
  const [year, month] = (m ?? '').split('-').map(Number);
  const now = new Date();
  return year && month
    ? new Date(year, month - 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Monday of the week of this day. */
export const mondayOf = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));

export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** A date-like value as a day on her clock (« 2026-11-18 » stays that day). */
export const asDate = (value: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);

export const hhmm = (value: string) =>
  new Date(value).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });

/** The window of a timeline: in weeks, 13 weeks from two weeks before; in months, 34 weeks. */
export function timelineRange(m: string | undefined, zoom: 'week' | 'month' | undefined) {
  const anchor = monthOf(m);
  const months = zoom === 'month';
  return {
    start: mondayOf(addDays(anchor, months ? -56 : -14)),
    days: months ? 7 * 34 : 7 * 13,
  };
}
