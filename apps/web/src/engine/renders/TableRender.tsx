import { Link } from '@tanstack/react-router';
import { peek } from '../peek';
import { rowMenu } from '../RowMenu';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Columns3, FolderInput } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useKindName } from '../../lib/kinds';
import { Button, Empty, Menu, cn, inputClass } from '../../ui';
import { toast } from '../../ui/more';
import { valueOf, type Shaped } from '../apply';
import { Value } from '../../ui/Value';
import type { Field, Row, ViewSearch, ViewChange } from '../types';

// Le tableau (TanStack Table): a column per field, the title held on the left; a header sorts
// (the engine's sort, in the URL); the columns shown are chosen here. Rows ticked are acted on
// together (spec 017): set aside, or filed in a folder — one change, undone at once.

export function TableRender({
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
  const several = new Set(shaped.rows.map((row) => row.kind)).size > 1;
  const client = useQueryClient();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState<string | null>(null);
  const bulk = useMutation({
    mutationFn: (change: { archive?: boolean; folder?: string | null }) =>
      api<{ changed?: number }>('/entries/bulk', {
        method: 'POST',
        body: { ids: [...ticked], ...change },
      }),
    onSuccess: (_done, change) => {
      toast(
        `${ticked.size} entrée(s) ${change.archive ? 'mise(s) de côté' : 'rangée(s)'} — annulable dans l’Activité.`,
      );
      setTicked(new Set());
      setFolder(null);
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: ['history'] });
    },
  });
  const tick = (id: string) =>
    setTicked((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allTicked = shaped.rows.length > 0 && shaped.rows.every((row) => ticked.has(row.id));
  const shown = fields.filter((one) => one.path !== 'kind' || several);
  const [visibility, setVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(shown.map((one, at) => [one.path, at < 7])),
  );
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'tick',
        header: () => (
          <input
            type="checkbox"
            aria-label="Tout cocher"
            checked={allTicked}
            onChange={() =>
              setTicked(allTicked ? new Set() : new Set(shaped.rows.map((row) => row.id)))
            }
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Cocher « ${row.original.title} »`}
            checked={ticked.has(row.original.id)}
            onChange={() => tick(row.original.id)}
          />
        ),
      },
      {
        id: 'title',
        header: 'Titre',
        cell: ({ row }) => (
          <Link to="." search={peek(row.original.id)} className="font-semibold hover:underline">
            {row.original.title}
          </Link>
        ),
      },
      ...shown.map((field): ColumnDef<Row> => ({
        id: field.path,
        header: field.label,
        cell: ({ row }) =>
          field.path === 'kind' ? (
            kindName(row.original.kind)
          ) : (
            <Value value={valueOf(row.original, field.path)} field={field} />
          ),
      })),
    ],
    [shown, kindName, ticked, allTicked],
  );
  const table = useReactTable({
    data: shaped.rows,
    columns,
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
  });
  if (!shaped.rows.length) return <Empty title="Rien ici" lead="Aucune entrée pour cette vue." />;
  const numeric = (type: string) =>
    ['amount', 'number', 'formula', 'rating', 'progress'].includes(type);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-rule bg-sand px-3 py-1.5">
        {ticked.size > 0 && (
          <span className="mr-auto flex flex-wrap items-center gap-2 text-[13px]">
            <b>{ticked.size} cochée(s)</b>
            <Button
              size="sm"
              disabled={bulk.isPending}
              onClick={() => bulk.mutate({ archive: true })}
            >
              <Archive size={14} />
              Mettre de côté
            </Button>
            {folder === null ? (
              <Button size="sm" onClick={() => setFolder('')}>
                <FolderInput size={14} />
                Ranger dans un dossier
              </Button>
            ) : (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  bulk.mutate({ folder: folder.trim() || null });
                }}
              >
                <input
                  autoFocus
                  aria-label="Dossier"
                  placeholder="Bilans/Mensuels"
                  className={inputClass.replace('w-full', 'w-44')}
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                />
                <Button size="sm" tone="solid" disabled={bulk.isPending}>
                  Ranger
                </Button>
              </form>
            )}
          </span>
        )}
        <Menu
          trigger={
            <Button size="sm" tone="quiet">
              <Columns3 size={14} />
              Colonnes
            </Button>
          }
          items={shown.map((field) => ({
            label: (
              <span className="flex items-center gap-2">
                <input type="checkbox" readOnly checked={visibility[field.path] !== false} />
                {field.label}
              </span>
            ),
            onSelect: () =>
              setVisibility((was) => ({ ...was, [field.path]: was[field.path] === false })),
          }))}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-rule bg-sand/60">
                {group.headers.map((header) => {
                  const field = fields.find((one) => one.path === header.id);
                  const sorted = state.sort === header.id;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-3 py-2 text-left font-mono text-[11px] font-medium tracking-[0.04em] whitespace-nowrap text-bark uppercase',
                        header.id === 'title' && 'sticky left-0 bg-sand',
                        header.id === 'tick' && 'w-8',
                        field && numeric(field.type) && 'text-right',
                      )}
                    >
                      <button
                        className="cursor-pointer hover:text-ink"
                        onClick={() =>
                          set({ sort: header.id, desc: sorted ? !state.desc : undefined })
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted ? (state.desc ? ' ↓' : ' ↑') : ''}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-rule last:border-0 hover:bg-sand"
                {...rowMenu(row.original.id, row.original.title)}
              >
                {row.getVisibleCells().map((cell) => {
                  const field = fields.find((one) => one.path === cell.column.id);
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'max-w-[280px] truncate px-3 py-2',
                        cell.column.id === 'title' && 'sticky left-0 max-w-[320px] bg-paper',
                        field && numeric(field.type) && 'text-right font-mono',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
