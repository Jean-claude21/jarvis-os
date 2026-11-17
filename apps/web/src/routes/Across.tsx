import { useKinds } from '../lib/kinds';
import { useAgendaRows, useFiles, useKindRows, useTaskRows } from '../engine/sources';
import { addDays, mondayOf, monthOf, timelineRange } from '../engine/renders/time';
import { useViewState, View } from '../engine/View';
import { PageHead } from '../ui';

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

export function PeoplePage() {
  const kinds = useKindsWith('who');
  const source = useKindRows(kinds);
  return (
    <>
      <PageHead title="Personnes" lead="Toutes les personnes et organisations de ta vie." />
      <View source={source} renders={['list', 'table']} />
    </>
  );
}
