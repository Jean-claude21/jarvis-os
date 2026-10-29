import { asPerson, query, type QueryResult, type Space } from '@jarvis-os/core';
import type pg from 'pg';
import { z } from 'zod';
import { viewPage } from './base';
import { viewWords } from './words';

/** A widget: one query and how to draw it (decision 0006). Figures are never stored. */
export const widgetSchema = z.object({
  titre: z.string().min(1).max(120),
  requete: z.string().min(1).max(10_000),
  /** « nombre » (one figure), « barres » (compare), « courbe » (over time), « tableau ». */
  graphe: z.enum(['nombre', 'barres', 'courbe', 'tableau']).default('tableau'),
});
export type Widget = z.input<typeof widgetSchema>;

export interface DrawnWidget {
  title: string;
  chart: 'nombre' | 'barres' | 'courbe' | 'tableau';
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  error?: string;
}

export interface Dashboard {
  title: string;
  computedAt: string;
  spaces: string[];
  widgets: DrawnWidget[];
}

/** The widgets of a saved dashboard: `data.widgets`, or the routine's one `requete` and `graphe`. */
export function widgetsOf(data: Record<string, unknown>): Widget[] {
  if (Array.isArray(data.widgets)) return z.array(widgetSchema).parse(data.widgets);
  if (typeof data.requete === 'string') {
    return [
      widgetSchema.parse({
        titre: data.titre ?? 'Résultat',
        requete: data.requete,
        graphe: data.graphe,
      }),
    ];
  }
  throw new Error('This dashboard has no `widgets` (each: titre, requete, graphe).');
}

/** Every widget recomputed now, each in its own read-only query; a failing one says why. */
export async function computeDashboard(
  db: pg.Pool,
  person: string,
  input: { title: string; widgets: Widget[]; spaces: Space[] },
): Promise<Dashboard> {
  const widgets: DrawnWidget[] = [];
  for (const raw of input.widgets) {
    const widget = widgetSchema.parse(raw);
    try {
      const result: QueryResult = await asPerson(db, person, (tx) =>
        query(tx, { spaceIds: input.spaces.map((one) => one.id), sql: widget.requete }),
      );
      widgets.push({ title: widget.titre, chart: widget.graphe, ...result });
    } catch (error) {
      widgets.push({
        title: widget.titre,
        chart: widget.graphe,
        columns: [],
        rows: [],
        truncated: false,
        error: (error as Error).message,
      });
    }
  }
  return {
    title: input.title,
    computedAt: new Date().toISOString(),
    spaces: input.spaces.map((one) => one.name),
    widgets,
  };
}

/** The text a model (or a host without views) reads: each widget's rows, briefly. */
export function dashboardText(dashboard: Dashboard): string {
  return [
    `# ${dashboard.title}`,
    ...dashboard.widgets.map((widget) =>
      widget.error
        ? `## ${widget.title}\nerror: ${widget.error}`
        : `## ${widget.title} (${widget.chart})\n${JSON.stringify(widget.rows.slice(0, 50))}${widget.truncated ? '\n(truncated)' : ''}`,
    ),
  ].join('\n\n');
}

const script = `
const numeric = (value) => value !== null && value !== '' && !isNaN(Number(value));
const fmt = (value) => numeric(value) ? new Intl.NumberFormat(words === WORDS.en ? 'en' : 'fr').format(Number(value)) : esc(value);
function axes(widget) {
  const x = widget.columns[0];
  const y = widget.columns.find((c, i) => i > 0 && widget.rows.some((r) => numeric(r[c]))) || widget.columns.find((c) => widget.rows.some((r) => numeric(r[c])));
  return { x, y };
}
function number(widget) {
  const { y } = axes(widget); const row = widget.rows[0];
  return '<div class="kpi">' + (row && y ? fmt(row[y]) : '—') + '</div>' + (row && widget.columns.length > 1 && y !== widget.columns[0] ? '<div class="muted">' + esc(row[widget.columns[0]]) + '</div>' : '');
}
function bars(widget) {
  const { x, y } = axes(widget); if (!y) return table(widget);
  const max = Math.max(...widget.rows.map((r) => Math.abs(Number(r[y]) || 0)), 1);
  return '<div style="display:grid;gap:8px">' + widget.rows.slice(0, 30).map((r) => {
    const v = Number(r[y]) || 0; const w = Math.max(2, Math.round(Math.abs(v) / max * 100));
    return '<div style="display:grid;grid-template-columns:minmax(70px,34%) 1fr auto;gap:10px;align-items:center">' +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r[x]) + '</span>' +
      '<span style="height:14px;background:var(--clay);border-radius:2px"><span style="display:block;height:100%;width:' + w + '%;background:var(--primary);border-radius:2px"></span></span>' +
      '<span class="num">' + fmt(v) + '</span></div>';
  }).join('') + '</div>';
}
function line(widget) {
  const { x, y } = axes(widget); if (!y || widget.rows.length < 2) return bars(widget);
  const values = widget.rows.map((r) => Number(r[y]) || 0);
  const lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
  const min = lo - pad, max = hi + pad, span = max - min;
  const W = 600, H = 200, L = 8, R = 8, T = 12, B = 24;
  const px = (i) => L + i * (W - L - R) / (values.length - 1);
  const py = (v) => T + (1 - (v - min) / span) * (H - T - B);
  const points = values.map((v, i) => px(i).toFixed(1) + ',' + py(v).toFixed(1)).join(' ');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(widget.title) + '">' +
    '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + py(min) + '" y2="' + py(min) + '" stroke="var(--rule)"/>' +
    '<polyline points="' + points + '" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>' +
    values.map((v, i) => '<circle cx="' + px(i) + '" cy="' + py(v) + '" r="3.5" fill="var(--primary)"><title>' + esc(widget.rows[i][x]) + ' : ' + fmt(v) + '</title></circle>').join('') +
    '<text x="' + L + '" y="' + (H - 6) + '">' + esc(widget.rows[0][x]) + '</text>' +
    '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(widget.rows[values.length - 1][x]) + '</text>' +
    '<text x="' + L + '" y="' + (py(hi) - 6) + '">' + say(words.max, { value: fmt(hi) }) + '</text>' +
    '<text x="' + (W - R) + '" y="' + (py(lo) + 16) + '" text-anchor="end">' + say(words.min, { value: fmt(lo) }) + '</text></svg>';
}
function table(widget) {
  if (!widget.rows.length) return '<p class="empty">' + esc(words.empty) + '</p>';
  const nums = widget.columns.map((c) => widget.rows.every((r) => r[c] == null || numeric(r[c])));
  return '<div class="scroll"><table><thead><tr>' + widget.columns.map((c, i) => '<th class="' + (nums[i] ? 'n' : '') + '">' + esc(c) + '</th>').join('') +
    '</tr></thead><tbody>' + widget.rows.map((r) => '<tr>' + widget.columns.map((c, i) => '<td class="' + (nums[i] ? 'n num' : '') + '">' +
      (r[c] !== null && typeof r[c] === 'object' ? esc(JSON.stringify(r[c])) : fmt(r[c])) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
const draw = { nombre: number, barres: bars, courbe: line, tableau: table };
function render(data) {
  const root = document.getElementById('root');
  if (!data || !data.widgets) { root.innerHTML = '<p class="empty">' + esc(words.nothing) + '</p>'; return; }
  const time = new Date(data.computedAt).toLocaleTimeString(words === WORDS.en ? 'en' : 'fr', { hour: '2-digit', minute: '2-digit' });
  root.innerHTML = '<header class="head"><div><div class="caps">' + esc(words.title) + '</div><h1>' + esc(data.title) + '</h1>' +
    '<div class="meta">' + data.spaces.map((s) => '<span class="badge">' + esc(s) + '</span>').join('') +
    '<span class="muted">' + esc(say(words.computed, { time })) + '</span></div></div></header>' +
    '<section class="grid">' + data.widgets.map((w) => '<article class="card' + (w.chart === 'tableau' || w.chart === 'courbe' ? ' wide' : '') + '">' +
      '<h2>' + esc(w.title) + '</h2>' +
      (w.error ? '<p class="error-text">' + esc(say(words.failed, { reason: w.error })) + '</p>' : (w.rows.length ? draw[w.chart](w) : '<p class="empty">' + esc(words.empty) + '</p>')) +
      (w.truncated ? '<p class="muted">' + esc(words.more) + '</p>' : '') + '</article>').join('') + '</section>';
}
start(render);
`;

/** The dashboard view (`ui://jarvis/dashboard`). */
export const dashboardView = (data?: Dashboard) =>
  viewPage({
    title: 'Jarvis — tableau de bord',
    words: viewWords.dashboard,
    script,
    ...(data ? { data } : {}),
  });
