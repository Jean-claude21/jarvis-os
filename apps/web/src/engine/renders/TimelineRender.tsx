import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { peek } from '../peek';
import { Crosshair } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useKindName } from '../../lib/kinds';
import { Button, Empty, Segmented, cn, colorOf } from '../../ui';
import { valueOf, type Shaped } from '../apply';
import { keyValue, showValue } from '../format';
import type { Field, Row, ViewChange, ViewSearch } from '../types';
import { MonthBar } from './CalendarRender';
import { addDays, asDate, dayKey, monthKey, monthOf, timelineRange } from './time';

// La frise (v3 D10, gr8r's timeline), from the facets alone: each entry a bar from its start to
// its end (« dated »), its title inside, how far along it is (a progress field, « measurable »);
// the rows grouped by step (« stages ») unless the view groups otherwise; weeks (a column per day,
// week-ends shaded) or months; today's column marked. A bar dragged moves its dates, an edge
// dragged changes one — written to the fields the facet names, journaled and undoable. Arrows go
// from what comes first (the facet's `after` link) to what follows.

const ROW = 44;
const BAND = 36;
const DAY = 86_400_000;

type Drag = { id: string; mode: 'move' | 'start' | 'end'; x0: number; days: number };

/** A date moved by whole days, written as it was (a day stays a day, an instant an instant). */
function shift(value: string, days: number) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dayKey(addDays(asDate(value), days));
  return new Date(new Date(value).getTime() + days * DAY).toISOString();
}

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
  const client = useQueryClient();
  // The names' column: narrower on a phone, so the days show.
  const NAME = typeof window !== 'undefined' && window.innerWidth < 640 ? 150 : 300;
  const scroller = useRef<HTMLDivElement>(null);
  const zoom = state.zoom ?? 'week';
  const dayWidth = zoom === 'week' ? 40 : 12;
  const { start, days } = timelineRange(state.m, zoom);
  const width = days * dayWidth;
  const [drag, setDrag] = useState<Drag | null>(null);
  // A moved bar keeps its place until the saved dates come back.
  const [moved, setMoved] = useState<Map<string, { start: string; end: string | null }>>(new Map());
  useEffect(() => setMoved(new Map()), [shaped.rows]);

  const offset = (value: string) => (asDate(value).getTime() - start.getTime()) / DAY;
  const dated = useMemo(() => shaped.rows.filter((row) => row.start), [shaped.rows]);
  const groupPath = state.group ?? dated.find((row) => row.stageField)?.stageField ?? 'kind';
  const groupField = fields.find((one) => one.path === groupPath);

  // The rows by group (a step's own order first), each at its height.
  const layout = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of [...dated].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))) {
      const key = keyValue(valueOf(row, groupPath));
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const order = groupField?.options ?? [];
    const keys = [...groups.keys()].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b, 'fr');
    });
    const items: (
      { type: 'band'; key: string; count: number; y: number } | { type: 'row'; row: Row; y: number }
    )[] = [];
    let y = 0;
    for (const key of keys) {
      items.push({ type: 'band', key, count: groups.get(key)!.length, y });
      y += BAND;
      for (const row of groups.get(key)!) {
        items.push({ type: 'row', row, y });
        y += ROW;
      }
    }
    return { items, height: y };
  }, [dated, groupPath, groupField]);

  const save = useMutation({
    mutationFn: ({ row, data }: { row: Row; data: Record<string, string> }) =>
      api('/save', {
        method: 'POST',
        body: { entries: [{ id: row.id, data }] },
        ...(row.spaceId ? { space: row.spaceId } : {}),
      }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: ['now'] });
    },
  });

  // Today in view when the timeline opens.
  const today = offset(new Date().toISOString());
  useEffect(() => {
    if (scroller.current && today >= 0 && today <= days)
      scroller.current.scrollLeft = Math.max(0, today * dayWidth - 160);
  }, [today, days, dayWidth]);

  // The dates a bar shows: its own, moved while dragged, or as moved until saved.
  const datesOf = (row: Row) => {
    const kept = moved.get(row.id);
    let s = kept?.start ?? row.start!;
    let e = kept ? kept.end : (row.end ?? null);
    if (drag && drag.id === row.id && drag.days) {
      if (drag.mode !== 'end') s = shift(s, drag.days);
      if (e && drag.mode !== 'start') e = shift(e, drag.days);
    }
    return { s, e };
  };
  const span = (row: Row) => {
    const { s, e } = datesOf(row);
    const left = offset(s);
    // A day's end covers that day.
    const right = e ? offset(e) + (e.length <= 10 ? 1 : 0) : null;
    return { left, right: right !== null && right > left ? right : null };
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) =>
      setDrag((was) =>
        was ? { ...was, days: Math.round((event.clientX - was.x0) / dayWidth) } : was,
      );
    const onUp = () => {
      setDrag((was) => {
        if (!was || !was.days) return null;
        const row = dated.find((one) => one.id === was.id);
        if (!row?.startField) return null;
        const s = was.mode !== 'end' ? shift(row.start!, was.days) : row.start!;
        const e = row.end && was.mode !== 'start' ? shift(row.end, was.days) : (row.end ?? null);
        if (e && e < s) return null;
        const data: Record<string, string> = { [row.startField]: s };
        if (row.endField && e) data[row.endField] = e;
        setMoved((all) => new Map(all).set(row.id, { start: s, end: e }));
        save.mutate({ row, data });
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, dayWidth, dated, save]);

  if (!dated.length)
    return <Empty title="Rien de daté ici" lead="La frise montre ce qui a une date." />;

  const months: { label: string; left: number }[] = [];
  for (let day = 0; day < days; day += 1) {
    const date = addDays(start, day);
    if (date.getDate() === 1 || day === 0)
      months.push({
        label: date.toLocaleDateString('fr', { month: 'long', year: 'numeric' }),
        left: day * dayWidth,
      });
  }
  const go = (delta: number) => {
    const anchor = monthOf(state.m);
    set({ m: monthKey(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1)) });
  };
  const bandLabel = (key: string) =>
    !key ? 'Sans valeur' : groupPath === 'kind' ? kindName(key) : showValue(key, groupField) || key;
  const rowsById = new Map(
    layout.items.flatMap((item) => (item.type === 'row' ? [[item.row.id, item] as const] : [])),
  );

  return (
    <div className="select-none">
      <MonthBar
        label={`${start.toLocaleDateString('fr', { day: 'numeric', month: 'short' })} – ${addDays(start, days - 1).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        onPrev={() => go(zoom === 'week' ? -1 : -3)}
        onNext={() => go(zoom === 'week' ? 1 : 3)}
        onToday={() => set({ m: undefined })}
        extra={
          <span className="flex items-center gap-2">
            <Segmented
              label="Échelle"
              value={zoom}
              onChange={(value) => set({ zoom: value })}
              options={[
                { value: 'week', label: 'Semaines' },
                { value: 'month', label: 'Mois' },
              ]}
            />
            <Button
              size="sm"
              tone="quiet"
              title="Aller à aujourd’hui"
              onClick={() => {
                if (scroller.current)
                  scroller.current.scrollLeft = Math.max(0, today * dayWidth - 160);
              }}
            >
              <Crosshair size={14} />
            </Button>
          </span>
        }
      />
      <div ref={scroller} className="max-h-[min(70vh,760px)] overflow-auto">
        <div className="relative" style={{ width: NAME + width }}>
          {/* The head: the months, then the days (or each week's Monday). */}
          <div className="sticky top-0 z-[5] flex border-b border-rule bg-paper">
            <div
              style={{ width: NAME }}
              className="sticky left-0 z-[6] flex flex-none items-end border-r border-rule bg-paper px-4 pb-2 text-[13px] text-bark"
            >
              Entrée
            </div>
            <div className="relative h-[58px] flex-none" style={{ width }}>
              {months.map((one) => (
                <span
                  key={one.left}
                  className="absolute top-2 pl-2 font-display text-[13.5px] font-semibold whitespace-nowrap first-letter:uppercase"
                  style={{ left: one.left }}
                >
                  {one.label}
                </span>
              ))}
              {Array.from({ length: days }, (_, day) => {
                const date = addDays(start, day);
                const isToday = dayKey(date) === dayKey(new Date());
                if (zoom === 'month' && date.getDay() !== 1) return null;
                return (
                  <span
                    key={day}
                    className={cn(
                      'absolute bottom-0 border-l border-rule py-1.5 text-center font-mono text-[11.5px] whitespace-nowrap text-bark',
                      isToday && 'font-bold text-primary',
                    )}
                    style={{
                      left: day * dayWidth,
                      width: zoom === 'week' ? dayWidth : dayWidth * 7,
                    }}
                  >
                    {zoom === 'week'
                      ? date.getDate()
                      : date.toLocaleDateString('fr', { day: 'numeric', month: 'short' })}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="relative" style={{ height: layout.height }}>
            {/* The grid: week-ends shaded, the weeks ruled, today's line. */}
            <div className="pointer-events-none absolute inset-y-0" style={{ left: NAME, width }}>
              {zoom === 'week' &&
                Array.from({ length: days }, (_, day) =>
                  [5, 6].includes((addDays(start, day).getDay() + 6) % 7) ? (
                    <span
                      key={day}
                      className="absolute inset-y-0 bg-sand"
                      style={{ left: day * dayWidth, width: dayWidth }}
                    />
                  ) : null,
                )}
              {Array.from({ length: Math.ceil(days / 7) }, (_, week) => (
                <span
                  key={week}
                  className="absolute inset-y-0 w-px bg-rule"
                  style={{ left: week * 7 * dayWidth }}
                />
              ))}
              {today >= 0 && today <= days && (
                <span
                  className="absolute inset-y-0 z-[2] w-0.5 bg-primary"
                  style={{ left: today * dayWidth }}
                />
              )}
            </div>

            {layout.items.map((item) =>
              item.type === 'band' ? (
                <div
                  key={`band-${item.key}`}
                  className="absolute left-0 flex items-center border-b border-rule bg-sand"
                  style={{ top: item.y, height: BAND, width: NAME + width }}
                >
                  <b className="sticky left-0 z-[3] flex items-center gap-2 px-4 text-[13.5px] font-semibold">
                    <span
                      className="h-2.5 w-2.5 rounded-full border-2"
                      style={{ borderColor: colorOf(item.key || 'none') }}
                    />
                    {bandLabel(item.key)}
                    <span className="font-mono text-[11.5px] font-normal text-bark">
                      {item.count}
                    </span>
                  </b>
                </div>
              ) : (
                <div
                  key={item.row.id + item.row.start}
                  className="absolute left-0 flex border-b border-rule"
                  style={{ top: item.y, height: ROW, width: NAME + width }}
                >
                  <Link
                    to="."
                    search={peek(item.row.id)}
                    style={{ width: NAME }}
                    className="sticky left-0 z-[4] flex flex-none items-center gap-2.5 border-r border-rule bg-paper px-4 hover:bg-sand"
                  >
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ background: colorOf(item.row.kind) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{item.row.title}</span>
                    {!!item.row.progress && (
                      <span className="flex-none font-mono text-[11px] text-bark">
                        {Math.round(item.row.progress * 100)}%
                      </span>
                    )}
                  </Link>
                  <Bar
                    row={item.row}
                    left={span(item.row).left}
                    right={span(item.row).right}
                    dayWidth={dayWidth}
                    days={days}
                    dragging={drag?.id === item.row.id}
                    onDrag={(mode, x0) => setDrag({ id: item.row.id, mode, x0, days: 0 })}
                  />
                </div>
              ),
            )}

            {/* What comes first → what follows. */}
            <svg
              className="pointer-events-none absolute top-0 z-[3] overflow-visible"
              style={{ left: NAME, width, height: layout.height }}
            >
              <defs>
                <marker
                  id="timeline-arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--bark)" />
                </marker>
              </defs>
              {layout.items.flatMap((item) => {
                if (item.type !== 'row' || !item.row.after?.length) return [];
                const to = span(item.row);
                return item.row.after.flatMap((id) => {
                  const from = rowsById.get(id);
                  if (!from) return [];
                  const was = span(from.row);
                  const x1 = (was.right ?? was.left + 1) * dayWidth;
                  const y1 = from.y + ROW / 2;
                  const x2 = to.left * dayWidth - 2;
                  const y2 = item.y + ROW / 2;
                  const bend = Math.max(30, Math.abs(x2 - x1) / 2);
                  return [
                    <path
                      key={`${id}→${item.row.id}`}
                      d={`M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`}
                      fill="none"
                      stroke="var(--bark)"
                      strokeWidth="1.3"
                      markerEnd="url(#timeline-arrow)"
                    />,
                  ];
                });
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One bar: its title inside, its progress as a fill; dragged whole or by an edge. */
function Bar({
  row,
  left,
  right,
  dayWidth,
  days,
  dragging,
  onDrag,
}: {
  row: Row;
  left: number;
  right: number | null;
  dayWidth: number;
  days: number;
  dragging: boolean;
  onDrag: (mode: Drag['mode'], x0: number) => void;
}) {
  const color = colorOf(row.kind);
  const movable = !!row.startField;
  const lane = <div className="relative flex-none" style={{ width: days * dayWidth }} />;
  if (right === null) {
    // A single day: a diamond and its title beside it.
    if (left < -1 || left > days) return lane;
    return (
      <div className="relative flex-none" style={{ width: days * dayWidth }}>
        <span
          onPointerDown={(event) => movable && onDrag('move', event.clientX)}
          title={`${row.title} · ${showValue(row.start)}`}
          className={cn(
            'absolute top-1/2 z-[2] flex -translate-y-1/2 items-center gap-1.5',
            movable && 'cursor-grab',
          )}
          style={{ left: (left + 0.5) * dayWidth - 6 }}
        >
          <span
            className="h-3 w-3 rotate-45 rounded-[2px] border-2 bg-paper"
            style={{ borderColor: color }}
          />
          <span className="text-[12.5px] whitespace-nowrap text-ink">{row.title}</span>
        </span>
      </div>
    );
  }
  const from = Math.max(0, left);
  const to = Math.min(days, right);
  if (to <= 0 || from >= days) return lane;
  return (
    <div className="relative flex-none" style={{ width: days * dayWidth }}>
      <div
        title={`${row.title} · ${showValue(row.start)} → ${showValue(row.end)}`}
        onPointerDown={(event) => movable && onDrag('move', event.clientX)}
        className={cn(
          'absolute top-1/2 z-[2] flex h-[30px] -translate-y-1/2 items-center overflow-hidden rounded-[7px] border text-[12.5px] text-ink',
          movable && 'cursor-grab',
          dragging && 'cursor-grabbing shadow-card',
        )}
        style={{
          left: from * dayWidth + 1,
          width: Math.max(dayWidth * 0.8, (to - from) * dayWidth - 2),
          background: `color-mix(in srgb, ${color} 14%, var(--paper))`,
          borderColor: `color-mix(in srgb, ${color} 45%, var(--paper))`,
        }}
      >
        {row.progress !== null && row.progress !== undefined && (
          <span
            className="absolute inset-y-0 left-0"
            style={{
              width: `${row.progress * 100}%`,
              background: `color-mix(in srgb, ${color} 26%, var(--paper))`,
            }}
          />
        )}
        <span className="relative truncate px-2.5 font-medium">{row.title}</span>
        {movable && (
          <>
            <span
              onPointerDown={(event) => {
                event.stopPropagation();
                onDrag('start', event.clientX);
              }}
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
            />
            {row.endField && (
              <span
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onDrag('end', event.clientX);
                }}
                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
