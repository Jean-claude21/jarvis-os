import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useKindName } from '../lib/kinds';
import { Panel, Skeleton } from '../ui';
import { shape } from './apply';
import { BoardRender } from './renders/BoardRender';
import { CalendarRender } from './renders/CalendarRender';
import { CardsRender } from './renders/CardsRender';
import { SplitRender } from './renders/SplitRender';
import { FilesRender } from './renders/FilesRender';
import { ListRender } from './renders/ListRender';
import { TableRender } from './renders/TableRender';
import { TimelineRender } from './renders/TimelineRender';
import type { FileRow, Source } from './sources';
import { Toolbar } from './Toolbar';
import type { RenderKey, ViewSearch, ViewChange } from './types';

// One view (v3 D10): the toolbar, then the render chosen, in one panel. Every page that shows
// entries — across her life, in an app, of a kind — is this, with its source and its renders.

/** The view's state, in the URL of whatever page shows it. */
export function useViewState(): [ViewSearch, (change: ViewChange) => void] {
  const search = useSearch({ strict: false }) as ViewSearch;
  const navigate = useNavigate();
  const set = (change: ViewChange) =>
    void navigate({
      to: '.',
      replace: true,
      search: (was: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...was, ...change };
        for (const key of Object.keys(next))
          if (next[key] === undefined || next[key] === '') delete next[key];
        return next as never;
      },
    });
  return [search, set];
}

export function View({
  source,
  files,
  renders,
  defaults = {},
}: {
  source: Source;
  files?: FileRow[];
  renders: RenderKey[];
  /** What a page shows first (« group by when » for tasks). */
  defaults?: ViewChange;
}) {
  const kindName = useKindName();
  const [search, set] = useViewState();
  const render = renders.includes(search.v as RenderKey) ? search.v! : renders[0]!;
  const state: ViewSearch = { ...defaults, ...search, v: render };
  // A board groups by its columns, a calendar by days: their groups are their own.
  const shaped = useMemo(
    () =>
      shape(
        source.rows,
        source.fields,
        render === 'list' ||
          render === 'split' ||
          render === 'cards' ||
          render === 'table' ||
          render === 'timeline'
          ? state
          : { ...state, group: undefined },
        kindName,
      ),
    [source.rows, source.fields, JSON.stringify(state), kindName],
  );
  return (
    <>
      <Toolbar
        state={state}
        set={set}
        fields={source.fields}
        rows={source.rows}
        renders={renders}
      />
      <Panel bodyClassName="min-h-[160px]">
        {source.loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ) : render === 'table' ? (
          <TableRender shaped={shaped} fields={source.fields} state={state} set={set} />
        ) : render === 'board' ? (
          <BoardRender
            shaped={shaped}
            fields={source.fields}
            {...(state.by ? { by: state.by } : {})}
          />
        ) : render === 'calendar' ? (
          <CalendarRender shaped={shaped} state={state} set={set} />
        ) : render === 'timeline' ? (
          <TimelineRender shaped={shaped} fields={source.fields} state={state} set={set} />
        ) : render === 'split' ? (
          <SplitRender shaped={shaped} fields={source.fields} state={state} set={set} />
        ) : render === 'cards' ? (
          <CardsRender shaped={shaped} fields={source.fields} group={state.group} />
        ) : render === 'files' ? (
          <FilesRender files={files ?? []} state={state} set={set} />
        ) : (
          <div className="max-h-[min(68vh,760px)] overflow-y-auto">
            <ListRender shaped={shaped} fields={source.fields} group={state.group} />
          </div>
        )}
      </Panel>
    </>
  );
}
