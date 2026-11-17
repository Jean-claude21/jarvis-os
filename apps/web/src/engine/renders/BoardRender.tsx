import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useKindName } from '../../lib/kinds';
import { Empty, cn, colorOf } from '../../ui';
import { valueOf, type Shaped } from '../apply';
import { keyValue, showValue } from '../format';
import type { Field, Row } from '../types';

// Le Kanban (the v2 dt-board): a column per step of a choice — the « stages » facet's field by
// default — a card per entry; a card dropped in another column takes that step, journaled and
// undoable like any change.

export function boardField(rows: Row[], fields: Field[], by?: string): Field | null {
  const choices = fields.filter((one) => one.type === 'choice' && one.path !== 'kind');
  return (
    choices.find((one) => one.path === by) ??
    choices.find((one) => one.path === rows[0]?.stageField) ??
    choices[0] ??
    null
  );
}

export function BoardRender({
  shaped,
  fields,
  by,
}: {
  shaped: Shaped;
  fields: Field[];
  by?: string;
}) {
  const kindName = useKindName();
  const client = useQueryClient();
  const [over, setOver] = useState<string | null>(null);
  const field = boardField(shaped.rows, fields, by);
  const move = useMutation({
    mutationFn: ({ row, value }: { row: Row; value: string }) =>
      api('/save', {
        method: 'POST',
        body: { entries: [{ id: row.id, data: { [field!.path]: value || null } }] },
        ...(row.spaceId ? { space: row.spaceId } : {}),
      }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: ['now'] });
    },
  });
  if (!field)
    return (
      <Empty
        title="Pas de colonnes"
        lead="Ce type n’a pas de champ à choix pour faire des colonnes."
      />
    );
  const present = [...new Set(shaped.rows.map((row) => keyValue(valueOf(row, field.path))))];
  const columns = [
    ...(field.options ?? []),
    ...present.filter((one) => one && !(field.options ?? []).includes(one)),
  ];
  if (present.includes('')) columns.push('');
  return (
    <div className="grid auto-cols-[minmax(230px,1fr)] grid-flow-col items-start gap-3 overflow-x-auto p-3 max-md:auto-cols-[minmax(210px,82vw)]">
      {columns.map((column) => {
        const cards = shaped.rows.filter((row) => keyValue(valueOf(row, field.path)) === column);
        return (
          <div
            key={column || 'none'}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(column);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const row = shaped.rows.find(
                (one) => one.id === event.dataTransfer.getData('text/plain'),
              );
              if (row && keyValue(valueOf(row, field.path)) !== column)
                move.mutate({ row, value: column });
            }}
            className={cn(
              'flex min-w-0 flex-col rounded-[10px] border border-transparent bg-sand',
              over === column && 'border-primary',
            )}
          >
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 text-[13px] font-semibold">
              <span className="truncate">{column ? showValue(column, field) : 'Sans valeur'}</span>
              <span className="font-mono text-xs font-medium text-bark">{cards.length}</span>
            </div>
            <div className="flex min-h-[60px] flex-col gap-2 px-2 pt-1 pb-2.5">
              {cards.map((row) => (
                <Link
                  key={row.id}
                  to="/entree/$id"
                  params={{ id: row.id }}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', row.id)}
                  className="flex cursor-grab flex-col gap-1 rounded-[8px] border border-rule bg-paper px-2.5 py-2 hover:border-rule-strong"
                >
                  <span className="text-[13.5px] leading-snug font-semibold">{row.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-bark">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: colorOf(row.kind) }}
                    />
                    {kindName(row.kind)}
                    {row.start ? ` · ${showValue(row.start)}` : ''}
                  </span>
                </Link>
              ))}
              {!cards.length && <span className="py-2 text-center text-xs text-faint">Vide</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
