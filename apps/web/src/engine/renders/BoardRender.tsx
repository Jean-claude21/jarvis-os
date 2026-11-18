import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useKindName } from '../../lib/kinds';
import { Empty, cn, colorOf, inputClass } from '../../ui';
import { toast } from '../../ui/more';
import { valueOf, type Shaped } from '../apply';
import { keyValue, showValue } from '../format';
import { peek } from '../peek';
import { rowMenu } from '../RowMenu';
import type { Field, Row } from '../types';

// Le Kanban (the v2 dt-board, gr8r's board): a column per step of a choice — the « stages »
// facet's field by default — a card per entry.
// - A card dropped in another column takes that step (journaled, undoable).
// - A card dropped on another one goes before it: her own order, kept per board and column in her
//   preferences (never written into her entries).
// - « Ajouter » makes an entry right in a column.

export function boardField(rows: Row[], fields: Field[], by?: string): Field | null {
  const choices = fields.filter((one) => one.type === 'choice' && one.path !== 'kind');
  return (
    choices.find((one) => one.path === by) ??
    choices.find((one) => one.path === rows[0]?.stageField) ??
    choices[0] ??
    null
  );
}

type Orders = Record<string, string[]>;

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
  const [adding, setAdding] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const field = boardField(shaped.rows, fields, by);
  const place = location.pathname.replace(/^\/v3/, '') || '/';
  const prefs = useQuery({
    queryKey: ['me', 'prefs'],
    queryFn: () => api<{ boardOrder?: Orders }>('/me/prefs'),
  });
  const orders = prefs.data?.boardOrder ?? {};
  const keyOf = (column: string) => `${place}|${field?.path ?? ''}|${column}`;
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['entries'] });
    void client.invalidateQueries({ queryKey: ['now'] });
  };
  const move = useMutation({
    mutationFn: ({ row, value }: { row: Row; value: string }) =>
      api('/save', {
        method: 'POST',
        body: { entries: [{ id: row.id, data: { [field!.path]: value || null } }] },
        ...(row.spaceId ? { space: row.spaceId } : {}),
      }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: refresh,
  });
  const order = useMutation({
    mutationFn: (next: Orders) => api('/me/prefs', { method: 'POST', body: { boardOrder: next } }),
    onMutate: (next) => client.setQueryData(['me', 'prefs'], { ...prefs.data, boardOrder: next }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['me', 'prefs'] }),
  });
  // The kind a new card is made of: the one the column holds most, else the board's.
  const kindFor = (cards: Row[]) => {
    const counts = new Map<string, number>();
    for (const row of cards.length ? cards : shaped.rows)
      counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const add = useMutation({
    mutationFn: ({ kind, column }: { kind: string; column: string }) =>
      api('/save', {
        method: 'POST',
        body: { entries: [{ kind, title: title.trim(), data: { [field!.path]: column || null } }] },
      }),
    onSuccess: () => {
      setTitle('');
      setAdding(null);
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: refresh,
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
  // Her order first, then the others in the view's order.
  const ordered = (column: string, cards: Row[]) => {
    const mine = orders[keyOf(column)] ?? [];
    const at = (row: Row) => {
      const i = mine.indexOf(row.id);
      return i === -1 ? mine.length + cards.indexOf(row) : i;
    };
    return [...cards].sort((a, b) => at(a) - at(b));
  };
  const dropOn = (column: string, cards: Row[], before: string | null, id: string) => {
    const row = shaped.rows.find((one) => one.id === id);
    if (!row) return;
    if (keyValue(valueOf(row, field.path)) !== column) move.mutate({ row, value: column });
    const ids = cards.map((one) => one.id).filter((one) => one !== id);
    const at = before ? ids.indexOf(before) : -1;
    ids.splice(at === -1 ? ids.length : at, 0, id);
    order.mutate({ ...orders, [keyOf(column)]: ids });
  };
  return (
    <div className="grid auto-cols-[minmax(230px,1fr)] grid-flow-col items-start gap-3 overflow-x-auto p-3 max-md:auto-cols-[minmax(210px,82vw)]">
      {columns.map((column) => {
        const cards = ordered(
          column,
          shaped.rows.filter((row) => keyValue(valueOf(row, field.path)) === column),
        );
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
              dropOn(column, cards, null, event.dataTransfer.getData('text/plain'));
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
            <div className="flex min-h-[60px] flex-col gap-2 px-2 pt-1 pb-2">
              {cards.map((row) => (
                <Link
                  key={row.id}
                  to="."
                  search={peek(row.id)}
                  draggable
                  {...rowMenu(row.id, row.title)}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', row.id)}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOver(null);
                    dropOn(column, cards, row.id, event.dataTransfer.getData('text/plain'));
                  }}
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
              {adding === column ? (
                <form
                  className="grid gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const kind = kindFor(cards);
                    if (title.trim() && kind) add.mutate({ kind, column });
                  }}
                >
                  <input
                    autoFocus
                    className={cn(inputClass, 'h-8')}
                    value={title}
                    placeholder="Titre de la carte"
                    aria-label={`Nouvelle carte dans « ${column ? showValue(column, field) : 'Sans valeur'} »`}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => event.key === 'Escape' && setAdding(null)}
                    onBlur={() => !title.trim() && setAdding(null)}
                  />
                </form>
              ) : (
                <button
                  onClick={() => {
                    setTitle('');
                    setAdding(column);
                  }}
                  className="flex cursor-pointer items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-bark hover:bg-paper hover:text-ink"
                >
                  <Plus size={13} />
                  Ajouter
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
