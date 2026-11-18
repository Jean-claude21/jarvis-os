import { ArrowLeft } from 'lucide-react';
import { useKindName } from '../../lib/kinds';
import { EntryView } from '../../routes/Entry';
import { Button, Empty, cn, colorOf } from '../../ui';
import { Identity } from '../../ui/identity';
import type { Shaped } from '../apply';
import { showValue } from '../format';
import type { Field, Row, ViewChange, ViewSearch } from '../types';

// Liste + détail (v3 D21, the « master-detail » of gr8r, NocoBase and Frappe): the list on the
// left — searched, filtered, grouped like any view — and the fiche of the one chosen on the right.
// On a phone: the list, then the fiche over it with a way back. Any source can take it.

function Line({
  row,
  fields,
  chosen,
  onPick,
}: {
  row: Row;
  fields: Field[];
  chosen: boolean;
  onPick: () => void;
}) {
  const kindName = useKindName();
  const extra = fields
    .filter((one) => one.path !== 'kind' && !['long_text', 'file', 'lines'].includes(one.type))
    .map((one) => showValue(row.values[one.path], one))
    .filter(Boolean)
    .slice(0, 1);
  return (
    <button
      onClick={onPick}
      aria-current={chosen ? 'true' : undefined}
      className={cn(
        'flex w-full min-w-0 cursor-pointer items-center gap-3 border-b border-rule px-3 py-2.5 text-left last:border-0 hover:bg-sand',
        chosen && 'bg-sand',
      )}
    >
      {row.who ? (
        <Identity name={row.title} who={row.who} size={32} />
      ) : (
        <span
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: colorOf(row.kind) }}
        />
      )}
      <span className="min-w-0 flex-1">
        <b className={cn('block truncate', chosen ? 'font-semibold' : 'font-medium')}>
          {row.title}
        </b>
        <span className="block truncate text-[12.5px] text-bark">
          {[kindName(row.kind), ...extra].join(' · ')}
        </span>
      </span>
    </button>
  );
}

export function SplitRender({
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
  if (!shaped.rows.length) return <Empty title="Rien ici" lead="Aucune entrée pour cette vue." />;
  const chosen = shaped.rows.find((row) => row.id === state.sel) ?? null;
  const shown = chosen ?? shaped.rows[0]!;
  const list = (
    <div className="max-h-[calc(100dvh-230px)] min-h-[320px] overflow-y-auto">
      {shaped.groups
        ? shaped.groups.map((band) => (
            <div key={band.key}>
              <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-rule bg-sand px-3 py-1.5">
                <b className="text-[12.5px] font-semibold">{band.label}</b>
                <span className="font-mono text-[11px] text-faint">{band.rows.length}</span>
              </div>
              {band.rows.map((row) => (
                <Line
                  key={row.id}
                  row={row}
                  fields={fields}
                  chosen={row.id === shown.id}
                  onPick={() => set({ sel: row.id })}
                />
              ))}
            </div>
          ))
        : shaped.rows.map((row) => (
            <Line
              key={row.id}
              row={row}
              fields={fields}
              chosen={row.id === shown.id}
              onPick={() => set({ sel: row.id })}
            />
          ))}
    </div>
  );
  return (
    <div className="lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <div className={cn('border-rule lg:block lg:border-r', chosen ? 'hidden' : 'block')}>
        {list}
      </div>
      <div className={cn('min-w-0 p-4 lg:block', chosen ? 'block' : 'hidden')}>
        <Button size="sm" className="mb-3 lg:hidden" onClick={() => set({ sel: undefined })}>
          <ArrowLeft size={14} />
          La liste
        </Button>
        <div className="grid gap-4">
          <EntryView key={shown.id} id={shown.id} embedded />
        </div>
      </div>
    </div>
  );
}
