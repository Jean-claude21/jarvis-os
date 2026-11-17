import { Link } from '@tanstack/react-router';
import { useKindName } from '../../lib/kinds';
import { Empty, Segmented, cn, colorOf } from '../../ui';
import { valueOf, type Shaped } from '../apply';
import { keyValue, showValue } from '../format';
import type { Field, Row, ViewSearch, ViewChange } from '../types';
import { MonthBar } from './CalendarRender';
import { addDays, asDate, dayKey, monthKey, monthOf, timelineRange } from './time';

// La frise (gr8r's timeline): weeks (a column per day, week-ends shaded) or months (a column per
// week); each entry a bar from its start to its end, or a point; the rows grouped (by kind unless
// the view groups otherwise); today a red line. The name column stays while the days scroll.

const NAME = 200;

export function TimelineRender({
  shaped,
  fields,
  state,
  set,
}: {
  shaped: Shaped;
  fields: Field[];
  state: ViewSearch;
  set: (change: ViewChange) => void;
}) {
  const kindName = useKindName();
  const zoom = state.zoom ?? 'week';
  const dayWidth = zoom === 'week' ? 32 : 11;
  const anchor = monthOf(state.m);
  const { start, days } = timelineRange(state.m, zoom);
  const width = days * dayWidth;
  const at = (value: string) => (asDate(value).getTime() - start.getTime()) / 86_400_000;
  const dated = shaped.rows.filter((row) => row.start);
  if (!dated.length)
    return <Empty title="Rien de daté ici" lead="La frise montre ce qui a une date." />;
  const groupBy = state.group ?? 'kind';
  const field = fields.find((one) => one.path === groupBy);
  const groups = new Map<string, Row[]>();
  for (const row of [...dated].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))) {
    const key = keyValue(valueOf(row, groupBy));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const today = at(new Date().toISOString());
  const months: { label: string; left: number }[] = [];
  for (let day = 0; day < days; day += 1) {
    const date = addDays(start, day);
    if (date.getDate() === 1 || day === 0)
      months.push({
        label: date.toLocaleDateString('fr', {
          month: 'long',
          year: day === 0 || date.getMonth() === 0 ? 'numeric' : undefined,
        }),
        left: day * dayWidth,
      });
  }
  const go = (delta: number) =>
    set({ m: monthKey(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1)) });
  return (
    <div>
      <MonthBar
        label={`${start.toLocaleDateString('fr', { day: 'numeric', month: 'short' })} – ${addDays(start, days - 1).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        onPrev={() => go(zoom === 'week' ? -1 : -3)}
        onNext={() => go(zoom === 'week' ? 1 : 3)}
        onToday={() => set({ m: undefined })}
        extra={
          <Segmented
            label="Échelle"
            value={zoom}
            onChange={(value) => set({ zoom: value })}
            options={[
              { value: 'week', label: 'Semaines' },
              { value: 'month', label: 'Mois' },
            ]}
          />
        }
      />
      <div className="max-h-[min(66vh,700px)] overflow-auto">
        <div style={{ width: NAME + width }} className="relative">
          {/* The months, and in weeks the days. */}
          <div className="sticky top-0 z-[2] flex border-b border-rule bg-paper">
            <div
              style={{ width: NAME }}
              className="sticky left-0 z-[3] flex-none border-r border-rule bg-paper"
            />
            <div className="relative h-9 flex-none" style={{ width }}>
              {months.map((one) => (
                <span
                  key={one.left}
                  className="absolute top-1 border-l border-rule pl-1.5 font-mono text-[11px] whitespace-nowrap text-bark first-letter:uppercase"
                  style={{ left: one.left }}
                >
                  {one.label}
                </span>
              ))}
              {zoom === 'week' &&
                Array.from({ length: days }, (_, day) => (
                  <span
                    key={day}
                    className={cn(
                      'absolute bottom-0.5 text-center font-mono text-[10px] text-faint',
                      dayKey(addDays(start, day)) === dayKey(new Date()) &&
                        'font-semibold text-primary',
                    )}
                    style={{ left: day * dayWidth, width: dayWidth }}
                  >
                    {addDays(start, day).getDate()}
                  </span>
                ))}
            </div>
          </div>
          {[...groups.entries()].map(([key, rows]) => (
            <div key={key || 'none'}>
              <div
                className="sticky left-0 z-[1] flex border-b border-rule bg-sand"
                style={{ width: NAME + width }}
              >
                <b className="sticky left-0 px-3 py-1.5 text-[12.5px] font-semibold">
                  {!key
                    ? 'Sans valeur'
                    : groupBy === 'kind'
                      ? kindName(key)
                      : showValue(key, field)}
                  <span className="ml-1.5 font-mono text-[11px] font-normal text-faint">
                    {rows.length}
                  </span>
                </b>
              </div>
              {rows.map((row) => {
                const left = at(row.start!);
                const right = row.end ? at(row.end) : null;
                const span = right !== null && right > left ? right - left : null;
                return (
                  <div key={row.id + row.start} className="flex h-10 border-b border-rule">
                    <Link
                      to="/entree/$id"
                      params={{ id: row.id }}
                      style={{ width: NAME }}
                      className="sticky left-0 z-[1] flex flex-none items-center gap-2 border-r border-rule bg-paper px-3 hover:bg-sand"
                    >
                      <span
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ background: colorOf(row.kind) }}
                      />
                      <span className="truncate text-[13px] font-semibold">{row.title}</span>
                    </Link>
                    <div className="relative flex-none" style={{ width }}>
                      {zoom === 'week' &&
                        Array.from({ length: days }, (_, day) =>
                          [5, 6].includes((addDays(start, day).getDay() + 6) % 7) ? (
                            <span
                              key={day}
                              className="absolute inset-y-0 bg-sand/70"
                              style={{ left: day * dayWidth, width: dayWidth }}
                            />
                          ) : null,
                        )}
                      {today >= 0 && today <= days && (
                        <span
                          className="absolute inset-y-0 w-0.5 bg-error/60"
                          style={{ left: today * dayWidth }}
                        />
                      )}
                      {span !== null ? (
                        <Link
                          to="/entree/$id"
                          params={{ id: row.id }}
                          title={`${row.title} · ${showValue(row.start)} → ${showValue(row.end)}`}
                          className="absolute top-1/2 h-5 -translate-y-1/2 rounded-[6px] border"
                          style={{
                            left: Math.max(0, left) * dayWidth,
                            width: Math.max(
                              dayWidth * 0.6,
                              (Math.min(right!, days) - Math.max(0, left)) * dayWidth,
                            ),
                            background: `color-mix(in srgb, ${colorOf(row.kind)} 28%, var(--paper))`,
                            borderColor: colorOf(row.kind),
                          }}
                        />
                      ) : left >= 0 && left <= days ? (
                        <Link
                          to="/entree/$id"
                          params={{ id: row.id }}
                          title={`${row.title} · ${showValue(row.start)}`}
                          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                          style={{ left: (left + 0.5) * dayWidth, background: colorOf(row.kind) }}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
