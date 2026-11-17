import { keyValue, showValue, sortValue } from './format';
import type { Field, Row, ViewSearch } from './types';

// What the state does to the rows, for every render: search, filters, sort, groups.

/** « kind » and « title » are fields of every row. */
export const valueOf = (row: Row, path: string): unknown =>
  path === 'title' ? row.title : path === 'kind' ? row.kind : row.values[path];

export const filtersOf = (f?: string): [string, string][] =>
  (f ?? '')
    .split(';')
    .map((one) => one.split('='))
    .filter((pair): pair is [string, string] => pair.length === 2 && !!pair[0])
    .map(([path, value]) => [decodeURIComponent(path), decodeURIComponent(value)]);

export const filtersText = (filters: [string, string][]) =>
  filters
    .map(([path, value]) => `${encodeURIComponent(path)}=${encodeURIComponent(value)}`)
    .join(';');

export interface Shaped {
  rows: Row[];
  groups: { key: string; label: string; rows: Row[] }[] | null;
}

export function shape(
  rows: Row[],
  fields: Field[],
  state: ViewSearch,
  kindName: (k: string) => string,
): Shaped {
  const byPath = new Map(fields.map((field) => [field.path, field]));
  const words = (state.q ?? '').trim().toLowerCase();
  const filters = filtersOf(state.f);
  let out = rows.filter((row) => {
    if (state.kind && row.kind !== state.kind) return false;
    for (const [path, value] of filters) if (keyValue(valueOf(row, path)) !== value) return false;
    if (!words) return true;
    const text = [row.title, ...Object.values(row.values).map((one) => showValue(one))]
      .join(' ')
      .toLowerCase();
    return words.split(/\s+/).every((word) => text.includes(word));
  });
  if (state.sort) {
    const key = state.sort;
    out = [...out].sort((a, b) => {
      const x = sortValue(valueOf(a, key));
      const y = sortValue(valueOf(b, key));
      if (x === y) return 0;
      if (x === '') return 1;
      if (y === '') return -1;
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), 'fr');
      return state.desc ? -order : order;
    });
  }
  if (!state.group) return { rows: out, groups: null };
  const field = byPath.get(state.group);
  const groups = new Map<string, Row[]>();
  for (const row of out) {
    const key = keyValue(valueOf(row, state.group));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  // A choice's groups in its own order, then the rest; the empty one last.
  const order = field?.options ?? [];
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
  return {
    rows: out,
    groups: keys.map((key) => ({
      key,
      label: !key
        ? 'Sans valeur'
        : state.group === 'kind'
          ? kindName(key)
          : showValue(key, field) || key,
      rows: groups.get(key)!,
    })),
  };
}
