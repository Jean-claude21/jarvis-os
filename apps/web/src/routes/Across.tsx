import { useKinds } from '../lib/kinds';
import { useAgendaRows, useFiles, useKindRows, useTaskRows } from '../engine/sources';
import { addDays, mondayOf, monthOf, timelineRange } from '../engine/renders/time';
import { useViewState, View } from '../engine/View';
import { PageHead, Segmented } from '../ui';

// The views across her whole life (v3 D2, D10): one per facet, every app at once — the agenda
// (what is dated), the tasks (what is to do), the documents (her files), the people (who). The
// same engine as an app's tabs; only the source changes.

/** Her kinds that have this facet and hold something. */
function useKindsWith(facet: string) {
  const { data = [] } = useKinds();
  return data
    .filter((one) => one.count > 0 && (one.facets ?? []).some((f) => f.facet === facet))
    .map((one) => one.kind);
}

const TIME_FIELDS = ['start', 'at', 'repeat', 'due', 'date'];
/** Her kinds dated by a field the server's agenda does not read. */
function useKindsDatedApart() {
  const { data = [] } = useKinds();
  return data
    .filter((one) => {
      const dated = (one.facets ?? []).find((f) => f.facet === 'dated') as
        { start?: string } | undefined;
      return one.count > 0 && !!dated?.start && !TIME_FIELDS.includes(dated.start);
    })
    .map((one) => one.kind);
}

export function AgendaPage() {
  const [state] = useViewState();
  const render = state.v ?? 'calendar';
  // The window the render shows, read from the server with repetitions unfolded.
  let from: Date;
  let to: Date;
  if (render === 'timeline') {
    const range = timelineRange(state.m, state.zoom);
    from = range.start;
    to = addDays(range.start, range.days);
  } else if (render === 'calendar') {
    from = mondayOf(monthOf(state.m));
    to = addDays(from, 42);
  } else {
    from = addDays(new Date(new Date().setHours(0, 0, 0, 0)), -1);
    to = addDays(from, 60);
  }
  const agenda = useAgendaRows(from, to);
  // The server's agenda reads the common time fields (start, at, due, date); a kind dated by a
  // field of its own (an offer's « published ») comes from its rows, within the same window.
  const own = useKindsDatedApart();
  const extra = useKindRows(own);
  const inWindow = extra.rows.filter((row) => {
    if (!row.start) return false;
    const at = new Date(row.start.length <= 10 ? `${row.start}T12:00:00` : row.start);
    return at >= from && at < to;
  });
  const source = {
    rows: [...agenda.rows, ...inWindow],
    fields: agenda.fields,
    loading: agenda.loading || extra.loading,
  };
  return (
    <>
      <PageHead
        title="Agenda"
        lead="Tout ce qui est daté dans ta vie, toutes apps confondues — les répétitions comprises."
      />
      <View source={source} renders={['calendar', 'timeline', 'list']} />
    </>
  );
}

export function TasksPage() {
  const source = useTaskRows();
  return (
    <>
      <PageHead title="Tâches" lead="Tout ce qui est à faire, dans toutes tes apps." />
      <View
        source={source}
        renders={['list', 'board', 'table']}
        defaults={{ group: 'when', by: 'status' }}
      />
    </>
  );
}

export function DocumentsPage() {
  const { files, loading } = useFiles();
  return (
    <>
      <PageHead
        title="Documents"
        lead="Tes fichiers, d’où qu’ils viennent : déposés, envoyés par Telegram, liés à tes entrées."
      />
      <View source={{ rows: [], fields: [], loading }} files={files} renders={['files']} />
    </>
  );
}

/** Her circles (v3 D8, gr8r's Teams for a life): the values of the people's « circle » field. */
const CIRCLE_FIELDS = ['circle', 'circles', 'cercle', 'cercles'];

export function PeoplePage() {
  const kinds = useKindsWith('who');
  const source = useKindRows(kinds);
  const [state, set] = useViewState();
  const circleField = source.fields.find((one) => CIRCLE_FIELDS.includes(one.path));
  const counts = new Map<string, number>();
  if (circleField)
    for (const row of source.rows) {
      const held = row.values[circleField.path];
      for (const one of Array.isArray(held) ? held : held ? [held] : [])
        if (typeof one === 'string' && one) counts.set(one, (counts.get(one) ?? 0) + 1);
    }
  const filter = circleField ? `${circleField.path}=` : null;
  const chosen = filter && state.f?.startsWith(filter) ? state.f.slice(filter.length) : 'all';
  return (
    <>
      <PageHead
        title="Personnes"
        lead="Toutes les personnes et organisations de ta vie : qui, où ils travaillent, comment les joindre."
      />
      {counts.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Cercle"
            value={chosen}
            onChange={(value) => set({ f: value === 'all' ? undefined : `${filter}${value}` })}
            options={[
              { value: 'all', label: 'Tous', n: source.rows.length },
              ...[...counts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([value, n]) => ({
                  value,
                  label: circleField!.optionLabels?.[value] ?? value,
                  n,
                })),
            ]}
          />
        </div>
      )}
      <View source={source} renders={['cards', 'list', 'table']} />
    </>
  );
}
