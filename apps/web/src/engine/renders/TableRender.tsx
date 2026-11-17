import { Link } from '@tanstack/react-router';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';
import { Columns3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useKindName } from '../../lib/kinds';
import { Button, Empty, Menu, cn } from '../../ui';
import { valueOf, type Shaped } from '../apply';
import { showValue } from '../format';
import type { Field, Row, ViewSearch, ViewChange } from '../types';

// Le tableau (TanStack Table): a column per field, the title held on the left; a header sorts
// (the engine's sort, in the URL); the columns shown are chosen here.

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
  const shown = fields.filter((one) => one.path !== 'kind' || several);
  const [visibility, setVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(shown.map((one, at) => [one.path, at < 7])),
  );
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'title',
        header: 'Titre',
        cell: ({ row }) => (
          <Link
            to="/entree/$id"
            params={{ id: row.original.id }}
            className="font-semibold hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      ...shown.map((field): ColumnDef<Row> => ({
        id: field.path,
        header: field.label,
        cell: ({ row }) =>
          field.path === 'kind'
            ? kindName(row.original.kind)
            : showValue(valueOf(row.original, field.path), field),
      })),
    ],
    [shown, kindName],
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
      <div className="flex justify-end border-b border-rule bg-sand px-3 py-1.5">
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
              <tr key={row.id} className="border-b border-rule last:border-0 hover:bg-sand">
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
