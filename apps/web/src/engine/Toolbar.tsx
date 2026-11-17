import {
  ArrowDownUp,
  CalendarDays,
  Columns3,
  FileText,
  GanttChart,
  Layers,
  LayoutGrid,
  List,
  ListFilter,
  Search,
  Table2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useKindName } from '../lib/kinds';
import { Button, Menu, cn } from '../ui';
import { filtersOf, filtersText, valueOf } from './apply';
import { keyValue, showValue } from './format';
import type { Field, RenderKey, Row, ViewSearch, ViewChange } from './types';

// The toolbar of every view (the v2 dtToolbar, gr8r's view toolbar): search, filter, sort, group,
// and the renders this source can take. Every choice goes to the URL.

export const RENDER_WORDS: Record<RenderKey, { label: string; icon: LucideIcon }> = {
  list: { label: 'Liste', icon: List },
  cards: { label: 'Cartes', icon: LayoutGrid },
  table: { label: 'Tableau', icon: Table2 },
  board: { label: 'Kanban', icon: Columns3 },
  calendar: { label: 'Calendrier', icon: CalendarDays },
  timeline: { label: 'Frise', icon: GanttChart },
  files: { label: 'Fichiers', icon: FileText },
};

export function Toolbar({
  state,
  set,
  fields,
  rows,
  renders,
}: {
  state: ViewSearch;
  set: (change: ViewChange) => void;
  fields: Field[];
  rows: Row[];
  renders: RenderKey[];
}) {
  const kindName = useKindName();
  const render = state.v ?? renders[0]!;
  const filters = filtersOf(state.f);
  const labelOf = (path: string) =>
    path === 'title' ? 'Titre' : (fields.find((one) => one.path === path)?.label ?? path);
  // Filter and group by what has few values: a choice, a kind, a short text.
  const groupable = fields.filter((field) => {
    const values = new Set(rows.map((row) => keyValue(valueOf(row, field.path))).filter(Boolean));
    return values.size > 0 && values.size <= 30 && field.type !== 'long_text';
  });
  const sortable: Field[] = [{ path: 'title', type: 'text', label: 'Titre' }, ...fields];
  const valuesOf = (path: string) =>
    [...new Set(rows.map((row) => keyValue(valueOf(row, path))).filter(Boolean))].slice(0, 30);
  const field = (path: string) => fields.find((one) => one.path === path);
  const valueLabel = (path: string, value: string) =>
    path === 'kind' ? kindName(value) : showValue(value, field(path)) || value;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-w-[160px] flex-1 items-center gap-2 rounded-[2px] border border-rule bg-paper px-2.5 py-[6px] text-faint sm:max-w-[280px]">
        <Search size={15} />
        <input
          value={state.q ?? ''}
          onChange={(event) => set({ q: event.target.value || undefined })}
          placeholder="Chercher"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none focus-visible:outline-none"
        />
      </label>
      {render !== 'files' && (
        <>
          <Menu
            align="start"
            trigger={
              <Button size="sm">
                <ListFilter size={14} />
                Filtre
              </Button>
            }
            items={groupable.flatMap((one) =>
              valuesOf(one.path).map((value) => ({
                label: (
                  <span className="flex min-w-0 gap-2">
                    <span className="text-bark">{one.label}</span>
                    <span className="truncate">{valueLabel(one.path, value)}</span>
                  </span>
                ),
                onSelect: () =>
                  set({
                    f: filtersText([
                      ...filters.filter(([path]) => path !== one.path),
                      [one.path, value],
                    ]),
                  }),
              })),
            )}
          />
          <Menu
            align="start"
            trigger={
              <Button size="sm" className={cn(state.sort && 'border-primary text-primary')}>
                <ArrowDownUp size={14} />
                {state.sort ? `${labelOf(state.sort)} ${state.desc ? '↓' : '↑'}` : 'Tri'}
              </Button>
            }
            items={[
              ...sortable.map((one) => ({
                label: one.label,
                onSelect: () =>
                  set({ sort: one.path, desc: state.sort === one.path ? !state.desc : undefined }),
              })),
              ...(state.sort
                ? [{ label: 'Sans tri', onSelect: () => set({ sort: undefined, desc: undefined }) }]
                : []),
            ]}
          />
        </>
      )}
      {render !== 'board' && render !== 'calendar' && render !== 'files' && (
        <Menu
          align="start"
          trigger={
            <Button size="sm" className={cn(state.group && 'border-primary text-primary')}>
              <Layers size={14} />
              {state.group ? labelOf(state.group) : 'Grouper'}
            </Button>
          }
          items={[
            ...groupable.map((one) => ({
              label: one.label,
              onSelect: () => set({ group: one.path }),
            })),
            ...(state.group
              ? [{ label: 'Sans groupes', onSelect: () => set({ group: undefined }) }]
              : []),
          ]}
        />
      )}
      {filters.map(([path, value]) => (
        <button
          key={path}
          onClick={() =>
            set({ f: filtersText(filters.filter(([one]) => one !== path)) || undefined })
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-sand px-2.5 py-1 text-[12.5px]"
        >
          <span className="text-bark">{labelOf(path)}</span>
          {valueLabel(path, value)}
          <X size={12} className="text-faint" />
        </button>
      ))}
      {renders.length > 1 && (
        <div
          role="group"
          aria-label="Présentation"
          className="ml-auto inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[2px] border border-rule bg-sand p-[3px]"
        >
          {renders.map((key) => {
            const { label, icon: Icon } = RENDER_WORDS[key];
            return (
              <button
                key={key}
                aria-pressed={key === render}
                title={label}
                onClick={() => set({ v: key })}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] px-2.5 py-[5px] text-[13px] whitespace-nowrap',
                  key === render
                    ? 'bg-paper font-semibold text-ink shadow-card'
                    : 'text-bark hover:text-ink',
                )}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
