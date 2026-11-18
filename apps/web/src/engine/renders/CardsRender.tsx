import { Link } from '@tanstack/react-router';
import { peek } from '../peek';
import { useKindName } from '../../lib/kinds';
import { AppIcon, Empty, Tag } from '../../ui';
import { Identity, WhoActions } from '../../ui/identity';
import type { Shaped } from '../apply';
import { showValue } from '../format';
import type { Field, Row } from '../types';

// Les cartes (gr8r's gallery, the v2 people cards): one card per entry — who it is (an avatar, a
// logo) or its kind, its title, its first values with their names, its step, and the gestures
// that reach a person. Any source: people, offers, objects.

function Card({ row, fields, group }: { row: Row; fields: Field[]; group?: string | undefined }) {
  const kindName = useKindName();
  const stageField = fields.find((one) => one.path === row.stageField);
  const stage = row.stageField ? row.values[row.stageField] : null;
  const shown = fields
    .filter(
      (one) =>
        one.path !== 'kind' &&
        one.path !== row.stageField &&
        one.path !== group &&
        !['long_text', 'file', 'lines'].includes(one.type) &&
        showValue(row.values[one.path], one),
    )
    .slice(0, 3);
  return (
    <div className="relative flex min-w-0 flex-col gap-3 rounded-[12px] border border-rule bg-paper p-3.5 hover:border-rule-strong">
      <div className="flex min-w-0 items-start gap-3">
        {row.who ? (
          <Identity name={row.title} who={row.who} size={40} />
        ) : (
          <AppIcon name={row.kind} size={32} />
        )}
        <span className="min-w-0 flex-1">
          <Link
            to="."
            search={peek(row.id)}
            className="block truncate font-display text-[15px] font-semibold after:absolute after:inset-0"
          >
            {row.title}
          </Link>
          <span className="block truncate text-[12.5px] text-bark">{kindName(row.kind)}</span>
        </span>
        {stage ? <Tag tone="neutral">{showValue(stage, stageField)}</Tag> : null}
      </div>
      {shown.length > 0 && (
        <dl className="grid gap-1 text-[12.5px]">
          {shown.map((field) => (
            <div key={field.path} className="grid grid-cols-[minmax(0,96px)_minmax(0,1fr)] gap-2">
              <dt className="truncate text-faint">{field.label}</dt>
              <dd className="truncate">{showValue(row.values[field.path], field)}</dd>
            </div>
          ))}
        </dl>
      )}
      {row.who && <WhoActions who={row.who} className="relative z-[1] mt-auto" />}
    </div>
  );
}

export function CardsRender({
  shaped,
  fields,
  group,
}: {
  shaped: Shaped;
  fields: Field[];
  group?: string | undefined;
}) {
  if (!shaped.rows.length) return <Empty title="Rien ici" lead="Aucune entrée pour cette vue." />;
  const grid = (rows: Row[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3 p-3">
      {rows.map((row) => (
        <Card key={row.id} row={row} fields={fields} group={group} />
      ))}
    </div>
  );
  if (!shaped.groups) return grid(shaped.rows);
  return (
    <div>
      {shaped.groups.map((band) => (
        <div key={band.key}>
          <div className="flex items-center gap-2 border-b border-rule bg-sand px-4 py-1.5">
            <b className="text-[13px] font-semibold">{band.label}</b>
            <span className="font-mono text-[11px] text-faint">{band.rows.length}</span>
          </div>
          {grid(band.rows)}
        </div>
      ))}
    </div>
  );
}
