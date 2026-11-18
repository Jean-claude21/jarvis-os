import { useState } from 'react';
import { cn } from '../ui';

// Charts in SVG, on Jarvis's tokens (v3 D21): bars, a line, a share, a funnel, a heatmap, a gauge.
// Light, printable, readable at 390 px; every value has its number written, never only a colour.

export const SERIES = [
  'var(--primary)',
  'var(--info)',
  'var(--ochre)',
  'var(--success)',
  '#8a5a9e',
  '#3b8ea5',
  'var(--bark)',
];
const fmt = (n: number) => n.toLocaleString('fr', { maximumFractionDigits: n < 10 ? 1 : 0 });

export interface Point {
  label: string;
  value: number;
}

/** Bars, one per group, the value written at its end (horizontal: labels stay readable). */
export function Bars({ points, unit }: { points: Point[]; unit?: string | null }) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return (
    <div className="grid gap-2 px-4 py-3">
      {points.map((point, at) => (
        <div
          key={point.label + at}
          className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_auto] items-center gap-3"
        >
          <span className="truncate text-[13px]" title={point.label}>
            {point.label}
          </span>
          <span className="h-5 overflow-hidden rounded-[4px] bg-sand">
            <span
              className="block h-full rounded-[4px]"
              style={{ width: `${(Math.abs(point.value) / max) * 100}%`, background: SERIES[0] }}
            />
          </span>
          <span className="text-right font-mono text-xs text-bark">
            {fmt(point.value)}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A line over time: the points, the last value said, a hover that reads each. */
export function Line({ points, unit }: { points: Point[]; unit?: string | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 180;
  const pad = 24;
  if (!points.length) return null;
  const max = Math.max(...points.map((p) => p.value), 0);
  const min = Math.min(...points.map((p) => p.value), 0);
  const span = max - min || 1;
  const x = (i: number) =>
    pad + (points.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (points.length - 1));
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const shown = hover ?? points.length - 1;
  return (
    <div className="px-4 py-3">
      <p className="mb-1 text-[13px] text-bark">
        {points[shown]!.label} :{' '}
        <b className="text-ink">
          {fmt(points[shown]!.value)}
          {unit ? ` ${unit}` : ''}
        </b>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Courbe">
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
        <path
          d={`${path} L${x(points.length - 1)},${y(min)} L${x(0)},${y(min)} Z`}
          fill="var(--primary)"
          opacity="0.08"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x(i) - 12} y={0} width={24} height={H} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={i === shown ? 5 : 3}
              fill="var(--paper)"
              stroke="var(--primary)"
              strokeWidth="2"
            />
          </g>
        ))}
        <text x={pad} y={H - 4} fontSize="11" fill="var(--faint)">
          {points[0]!.label}
        </text>
        <text x={W - pad} y={H - 4} fontSize="11" fill="var(--faint)" textAnchor="end">
          {points[points.length - 1]!.label}
        </text>
      </svg>
    </div>
  );
}

/** The share of each: a ring and its legend, each with its count and its percentage. */
export function Share({ points }: { points: Point[] }) {
  const total = points.reduce((sum, p) => sum + Math.max(0, p.value), 0) || 1;
  let angle = 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-wrap items-center gap-5 px-4 py-3">
      <svg
        viewBox="0 0 140 140"
        className="h-32 w-32 flex-none"
        role="img"
        aria-label="Répartition"
      >
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--sand)" strokeWidth="18" />
        {points.map((p, i) => {
          const part = Math.max(0, p.value) / total;
          const dash = `${part * C} ${C}`;
          const offset = -angle * C;
          angle += part;
          return (
            <circle
              key={p.label + i}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={SERIES[i % SERIES.length]}
              strokeWidth="18"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
            />
          );
        })}
        <text x="70" y="76" textAnchor="middle" fontSize="20" fontWeight="600" fill="var(--ink)">
          {fmt(total)}
        </text>
      </svg>
      <ul className="grid min-w-0 flex-1 gap-1.5 text-[13px]">
        {points.map((p, i) => (
          <li key={p.label + i} className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: SERIES[i % SERIES.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="font-mono text-xs text-bark">
              {fmt(p.value)} · {Math.round((Math.max(0, p.value) / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How many at each step, each bar the share of the first. */
export function Funnel({ steps }: { steps: Point[] }) {
  const first = Math.max(1, steps[0]?.value ?? 0, ...steps.map((s) => s.value));
  return (
    <div className="grid gap-1.5 px-4 py-3">
      {steps.map((step, at) => (
        <div
          key={step.label + at}
          className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_40px] items-center gap-3"
        >
          <span className="truncate text-[13px]">{step.label}</span>
          <span className="flex h-6 justify-center overflow-hidden rounded-[6px] bg-sand">
            <span
              className="block h-full rounded-[6px]"
              style={{
                width: `${Math.max(step.value ? 4 : 0, (step.value / first) * 100)}%`,
                background: `color-mix(in srgb, var(--primary) ${70 - at * 8}%, var(--paper))`,
              }}
            />
          </span>
          <span className="text-right font-mono text-xs text-bark">{step.value}</span>
        </div>
      ))}
    </div>
  );
}

/** The days done, week by week (columns), Monday on top. */
export function Heat({ cells }: { cells: { day: string; done: boolean | number }[] }) {
  const first = cells[0] ? new Date(`${cells[0].day}T12:00:00`) : new Date();
  const lead = (first.getDay() + 6) % 7;
  const all = [...Array.from({ length: lead }, () => null), ...cells];
  const weeks: (typeof all)[] = [];
  for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
  const done = cells.filter((c) => c.done).length;
  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-[13px] text-bark">
        <b className="text-ink">{done}</b> jour(s) sur {cells.length}
      </p>
      <div className="flex gap-[3px] overflow-x-auto">
        {weeks.map((week, w) => (
          <div key={w} className="grid gap-[3px]">
            {week.map((cell, d) => (
              <span
                key={d}
                title={cell ? `${cell.day}${cell.done ? ' · fait' : ''}` : undefined}
                className={cn('h-3.5 w-3.5 rounded-[3px]', !cell && 'opacity-0')}
                style={{
                  background: cell?.done ? 'var(--success)' : 'var(--sand)',
                  outline: cell ? '1px solid var(--rule)' : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One value against its maximum: a bar, the figures and the percentage written. */
export function GaugeBar({ label, value, max }: { label: string; value: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1.5, value / max)) : 0;
  const over = ratio > 1;
  return (
    <div className="grid gap-1">
      <div className="flex min-w-0 items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate font-semibold">{label}</span>
        <span className="flex-none font-mono text-xs text-bark">
          {fmt(value)} / {fmt(max)} · {Math.round(ratio * 100)} %
        </span>
      </div>
      <span className="h-2 overflow-hidden rounded-full bg-sand">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.min(1, ratio) * 100}%`,
            background: over ? 'var(--error)' : 'var(--success)',
          }}
        />
      </span>
    </div>
  );
}
