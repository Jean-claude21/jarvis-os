import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, cn, colorOf } from '../../ui';
import type { Shaped } from '../apply';
import type { ViewSearch, ViewChange } from '../types';
import { addDays, asDate, dayKey, hhmm, mondayOf, monthKey, monthOf } from './time';

// Le calendrier (the v2 agenda's month, gr8r's calendar): six weeks from Monday, each day its
// chips tinted by kind (an hour before the title when it has one), « +n » beyond three; on a phone
// the grid shows dots and the month's things are listed below.

export function MonthBar({
  label,
  onPrev,
  onNext,
  onToday,
  extra,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-sand px-3 py-2">
      <Button size="sm" onClick={onPrev} aria-label="Précédent">
        <ChevronLeft size={14} />
      </Button>
      <Button size="sm" onClick={onToday}>
        Aujourd’hui
      </Button>
      <Button size="sm" onClick={onNext} aria-label="Suivant">
        <ChevronRight size={14} />
      </Button>
      <b className="font-display text-[15px] font-semibold first-letter:uppercase">{label}</b>
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  );
}

export function CalendarRender({
  shaped,
  state,
  set,
}: {
  shaped: Shaped;
  state: ViewSearch;
  set: (change: ViewChange) => void;
}) {
  const month = monthOf(state.m);
  const from = mondayOf(month);
  const today = dayKey(new Date());
  const byDay = new Map<string, typeof shaped.rows>();
  for (const row of shaped.rows) {
    if (!row.start) continue;
    const key = dayKey(asDate(row.start));
    byDay.set(key, [...(byDay.get(key) ?? []), row]);
  }
  for (const list of byDay.values())
    list.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const days = Array.from({ length: 42 }, (_, at) => addDays(from, at));
  const names = Array.from({ length: 7 }, (_, at) =>
    addDays(from, at).toLocaleDateString('fr', { weekday: 'short' }),
  );
  const go = (delta: number) =>
    set({ m: monthKey(new Date(month.getFullYear(), month.getMonth() + delta, 1)) });
  const inMonth = days.filter(
    (day) => day.getMonth() === month.getMonth() && byDay.has(dayKey(day)),
  );
  const chip = (row: (typeof shaped.rows)[number]) => (
    <Link
      key={row.id + row.start}
      to="/entree/$id"
      params={{ id: row.id }}
      title={row.title}
      className="flex min-w-0 items-baseline gap-1 rounded-[5px] px-1.5 py-0.5 text-[11.5px] leading-tight hover:brightness-95"
      style={{ background: `color-mix(in srgb, ${colorOf(row.kind)} 12%, var(--paper))` }}
    >
      {!row.allDay && row.start && (
        <time className="flex-none font-mono text-[10.5px] text-bark">{hhmm(row.start)}</time>
      )}
      <span className="truncate">{row.title}</span>
    </Link>
  );
  return (
    <div>
      <MonthBar
        label={month.toLocaleDateString('fr', { month: 'long', year: 'numeric' })}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        onToday={() => set({ m: undefined })}
      />
      <div className="grid grid-cols-7">
        {names.map((name) => (
          <div
            key={name}
            className="border-b border-rule py-2 text-center font-mono text-[11px] text-faint"
          >
            {name}
          </div>
        ))}
        {days.map((day, at) => {
          const key = dayKey(day);
          const here = byDay.get(key) ?? [];
          const out = day.getMonth() !== month.getMonth();
          return (
            <div
              key={key}
              className={cn(
                'flex min-h-[64px] min-w-0 flex-col gap-1 border-b border-rule p-1.5 md:min-h-[92px]',
                at % 7 !== 6 && 'border-r',
                out && 'bg-sand text-faint',
              )}
            >
              <span
                className={cn(
                  'self-start font-mono text-xs',
                  key === today && 'rounded-[5px] bg-primary px-1.5 text-on-primary',
                )}
              >
                {day.getDate()}
              </span>
              <span className="hidden flex-col gap-1 md:flex">
                {here.slice(0, 3).map(chip)}
                {here.length > 3 && (
                  <span className="px-1 text-[11px] text-bark">+{here.length - 3} de plus</span>
                )}
              </span>
              {here.length > 0 && (
                <span className="flex flex-wrap gap-0.5 md:hidden">
                  {here.slice(0, 4).map((row) => (
                    <i
                      key={row.id + row.start}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: colorOf(row.kind) }}
                    />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* On a phone, the month's things as a list under the grid. */}
      <div className="md:hidden">
        {inMonth.map((day) => (
          <div
            key={dayKey(day)}
            className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 border-t border-rule px-3 py-2"
          >
            <b className="pt-0.5 text-xs text-bark first-letter:uppercase">
              {day.toLocaleDateString('fr', { weekday: 'short', day: 'numeric' })}
            </b>
            <span className="flex min-w-0 flex-col gap-1">{byDay.get(dayKey(day))!.map(chip)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
