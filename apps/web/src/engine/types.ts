import type { Who } from '../ui/identity';
// The view engine (v3 D10): a source gives rows and their fields; a state (search, filters, sort,
// groups, render) kept in the URL shapes them; a render draws them. One engine, every scope.

export interface Field {
  path: string;
  type: string;
  label: string;
  options?: string[];
  optionLabels?: Record<string, string>;
}

export interface Row {
  id: string;
  kind: string;
  title: string;
  spaceId?: string;
  values: Record<string, unknown>;
  /** From the « dated » facet (or the agenda): when it starts and ends. */
  start?: string | null;
  end?: string | null;
  allDay?: boolean;
  /** From the « stages » facet: the field that holds its step. */
  stageField?: string | null;
  /** The fields its dates are written in, when they can be moved (a timeline's drag). */
  startField?: string | null;
  endField?: string | null;
  /** The entries that come before it (the « dated » facet's `after` link): the arrows. */
  after?: string[];
  /** How far along, from 0 to 1 (a progress field, or the « measurable » facet). */
  progress?: number | null;
  /** From the « who » facet: a person or an organisation, and how to reach them. */
  who?: Who | null;
}

export type RenderKey =
  'split' | 'list' | 'cards' | 'table' | 'board' | 'calendar' | 'timeline' | 'files';

/** The state of a view, in the URL. */
export interface ViewSearch {
  v?: RenderKey | undefined;
  q?: string | undefined;
  sort?: string | undefined;
  desc?: boolean | undefined;
  group?: string | undefined;
  /** A board's columns: a choice field. */
  by?: string | undefined;
  /** Filters « path=value », several joined by « ; ». */
  f?: string | undefined;
  /** One kind among several (an app). */
  kind?: string | undefined;
  /** A calendar's or a timeline's first month: « 2026-11 ». */
  m?: string | undefined;
  zoom?: 'week' | 'month' | undefined;
  /** « Liste + détail »: the entry read on the right. */
  sel?: string | undefined;
  /** The entry open in the side card, over the page (F2). */
  fiche?: string | undefined;
}

/** A change of the state: a key set to undefined is taken away. */
export type ViewChange = { [K in keyof ViewSearch]?: ViewSearch[K] | undefined };

const RENDERS: RenderKey[] = [
  'split',
  'list',
  'cards',
  'table',
  'board',
  'calendar',
  'timeline',
  'files',
];
/** Reads a view's state from the URL, keeping only what it understands. */
export function viewSearch(search: Record<string, unknown>): ViewSearch {
  const text = (value: unknown, max = 200) =>
    typeof value === 'string' && value.length <= max ? value : undefined;
  const out: ViewSearch = {};
  if (RENDERS.includes(search.v as RenderKey)) out.v = search.v as RenderKey;
  for (const key of ['q', 'sort', 'group', 'by', 'f', 'kind', 'sel', 'fiche'] as const) {
    const value = text(search[key]);
    if (value) out[key] = value;
  }
  if (search.desc === true || search.desc === 'true') out.desc = true;
  if (typeof search.m === 'string' && /^\d{4}-\d{2}$/.test(search.m)) out.m = search.m;
  if (search.zoom === 'week' || search.zoom === 'month') out.zoom = search.zoom;
  return out;
}
