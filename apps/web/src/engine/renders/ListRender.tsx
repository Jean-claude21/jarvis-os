import { Link } from '@tanstack/react-router';
import { useKindName } from '../../lib/kinds';
import { Empty, Tag, colorOf, rowClass } from '../../ui';
import { Identity, WhoActions } from '../../ui/identity';
import type { Shaped } from '../apply';
import { showValue } from '../format';
import type { Field, Row } from '../types';

// La liste (the v2 nw-row): each entry on a line, its kind and two values under its title, its
// step and its day on the right; groups under sand bands.

export function RowLine({
  row,
  fields,
  group,
}: {
  row: Row;
  fields: Field[];
  group?: string | undefined;
}) {
  const kindName = useKindName();
  const stageField = fields.find((one) => one.path === row.stageField);
  const stage = row.stageField ? row.values[row.stageField] : null;
  const extra = fields
    .filter(
      (one) =>
        one.path !== 'kind' &&
        one.path !== row.stageField &&
        one.path !== group &&
        !['date', 'datetime', 'long_text', 'file'].includes(one.type),
    )
    .map((one) => showValue(row.values[one.path], one))
    .filter(Boolean)
    .slice(0, 2);
  return (
    // The row opens the entry; its links (write, call, the site) stay links of their own.
    <div className={rowClass + ' relative'}>
      {row.who ? (
        <Identity name={row.title} who={row.who} size={30} />
      ) : (
        <span
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: colorOf(row.kind) }}
        />
      )}
      <span className="min-w-0 flex-1">
        <Link
          to="/entree/$id"
          params={{ id: row.id }}
          className="block truncate font-semibold after:absolute after:inset-0"
        >
          {row.title}
        </Link>
        <span className="block truncate text-[12.5px] text-bark">
          {[kindName(row.kind), ...extra].join(' · ')}
        </span>
      </span>
      {stage ? <Tag tone="neutral">{showValue(stage, stageField)}</Tag> : null}
      {row.who && <WhoActions who={row.who} className="relative z-[1] hidden sm:flex" />}
      {row.start && (
        <time className="hidden flex-none font-mono text-xs text-bark sm:block">
          {showValue(row.start)}
        </time>
      )}
    </div>
  );
}

export function ListRender({
  shaped,
  fields,
  group,
}: {
  shaped: Shaped;
  fields: Field[];
  group?: string | undefined;
}) {
  if (!shaped.rows.length) return <Empty title="Rien ici" lead="Aucune entrée pour cette vue." />;
  if (!shaped.groups)
    return (
      <div>
        {shaped.rows.map((row) => (
          <RowLine key={row.id + (row.start ?? '')} row={row} fields={fields} group={group} />
        ))}
      </div>
    );
  return (
    <div>
      {shaped.groups.map((band) => (
        <div key={band.key}>
          <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-rule bg-sand px-4 py-1.5">
            <b className="text-[13px] font-semibold">{band.label}</b>
            <span className="font-mono text-[11px] text-faint">{band.rows.length}</span>
          </div>
          {band.rows.map((row) => (
            <RowLine key={row.id + (row.start ?? '')} row={row} fields={fields} group={group} />
          ))}
        </div>
      ))}
    </div>
  );
}
