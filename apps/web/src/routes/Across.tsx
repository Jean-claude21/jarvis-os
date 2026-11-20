import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, Target } from 'lucide-react';
import { api } from '../lib/api';
import { useKinds, useKindName } from '../lib/kinds';
import { GaugeBar } from '../blocks/charts';
import { useAgendaRows, useFiles, useKindRows, useTaskRows } from '../engine/sources';
import { addDays, mondayOf, monthOf, timelineRange } from '../engine/renders/time';
import { useViewState, View } from '../engine/View';
import { weekStart } from '../engine/renders/CalendarRender';
import { Button, PageHead, Panel, Segmented, Sheet, Stat, Stats, inputClass } from '../ui';
import { toast } from '../ui/more';
import { DrivePanel } from './FileParts';
import { GENRE_WORDS } from '../lib/words';

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

/**
 * Her agenda in her phone's calendar (spec 011): a private address to subscribe to. Asking again
 * makes a new one and closes the old.
 */
function SubscribeAgenda() {
  const [open, setOpen] = useState(false);
  const address = useMutation({
    mutationFn: () => api<{ url: string; webcal: string }>('/agenda/address', { method: 'POST' }),
    onError: (error) => toast((error as Error).message, 'error'),
  });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus size={14} />
        Dans mon téléphone
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Ton agenda dans ton téléphone">
        <div className="flex flex-col gap-3 p-4 text-[13.5px]">
          <p className="text-bark">
            Une adresse privée à ajouter comme abonnement dans le calendrier de ton téléphone
            (iPhone : Réglages › Calendrier › Comptes › Ajouter un calendrier avec abonnement ;
            Google Agenda : Autres agendas › À partir de l’URL). Il se met à jour tout seul.
          </p>
          {address.data ? (
            <>
              <a href={address.data.webcal} className="font-semibold text-primary hover:underline">
                L’ouvrir dans mon calendrier
              </a>
              <input
                readOnly
                aria-label="Adresse de l’agenda"
                className={inputClass}
                value={address.data.url}
                onFocus={(event) => event.target.select()}
              />
              <p className="text-xs text-faint">
                Garde-la pour toi : qui l’a voit ton agenda. En demander une autre ferme celle-ci.
              </p>
            </>
          ) : (
            <span>
              <Button tone="solid" disabled={address.isPending} onClick={() => address.mutate()}>
                Créer mon adresse
              </Button>
            </span>
          )}
        </div>
      </Sheet>
    </>
  );
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
  } else if (render === 'calendar' && state.zoom === 'week') {
    from = weekStart(state.d);
    to = addDays(from, 7);
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
        actions={<SubscribeAgenda />}
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
      <View
        source={{
          // Her files as rows too: read one by one in « Liste + détail » (v3 D21).
          rows: files.map((file) => ({
            id: file.entryId,
            kind: 'Fichier',
            title: file.title || file.name,
            values: {
              genre: file.genre ? (GENRE_WORDS[file.genre] ?? null) : null,
              linked: file.links.map((link) => link.title).join(', ') || null,
            },
          })),
          fields: [
            { path: 'genre', type: 'text', label: 'Genre' },
            { path: 'linked', type: 'text', label: 'Lié à' },
          ],
          loading,
        }}
        files={files}
        renders={['files', 'split']}
      />
      <div className="mt-4">
        <DrivePanel />
      </div>
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
      <View source={source} renders={['split', 'cards', 'list', 'table']} />
    </>
  );
}

/** Her kinds with this facet, with the facet's settings (the fields it names). */
function useFacetKinds(facet: string) {
  const { data = [] } = useKinds();
  return data
    .filter((one) => one.count > 0 && (one.facets ?? []).some((f) => f.facet === facet))
    .map((one) => ({
      kind: one.kind,
      facet: (one.facets ?? []).find((f) => f.facet === facet) as Record<string, string>,
    }));
}

const euros = (n: number) =>
  n.toLocaleString('fr', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/**
 * Argent (v3 D5, « montant »): everything with an amount, every app at once — this month's money
 * in and out where her entries say which way, the total of each kind, then the entries themselves.
 */
export function MoneyPage() {
  const kindName = useKindName();
  const kinds = useFacetKinds('amount');
  const source = useKindRows(kinds.map((one) => one.kind));
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = source.rows.filter((row) => (row.start ?? '').slice(0, 7) === month);
  const amountOf = (row: (typeof source.rows)[number]) => {
    const path = kinds.find((one) => one.kind === row.kind)?.facet.amount;
    const value = path ? row.values[path] : null;
    return typeof value === 'number' ? value : 0;
  };
  // Which way the money goes, when her entries say it (a « direction » in or out).
  const way = (row: (typeof source.rows)[number]) => {
    const value = String(row.values.direction ?? row.values.sens ?? '');
    return /^(in|entr)/i.test(value) ? 'in' : /^(out|sort)/i.test(value) ? 'out' : null;
  };
  const income = thisMonth.filter((row) => way(row) === 'in').reduce((s, r) => s + amountOf(r), 0);
  const spent = thisMonth.filter((row) => way(row) === 'out').reduce((s, r) => s + amountOf(r), 0);
  const byKind = kinds
    .map((one) => ({
      kind: one.kind,
      n: source.rows.filter((row) => row.kind === one.kind).length,
      total: source.rows
        .filter((row) => row.kind === one.kind)
        .reduce((s, r) => s + amountOf(r), 0),
    }))
    // A kind whose entries say which way the money goes is in the in/out figures already.
    .filter((one) => one.n > 0)
    .filter((one) => !source.rows.some((row) => row.kind === one.kind && way(row) !== null));
  const label = new Date().toLocaleDateString('fr', { month: 'long' });
  return (
    <>
      <PageHead
        title="Argent"
        lead="Tout ce qui a un montant, dans toutes tes apps : ce qui entre, ce qui sort, ce qui reste à payer."
      />
      <Stats>
        <Stat
          label={`Entrées en ${label}`}
          value={euros(income)}
          sub="ce que tes entrées disent entrant"
        />
        <Stat
          label={`Sorties en ${label}`}
          value={euros(spent)}
          sub="ce que tes entrées disent sortant"
        />
        {byKind.slice(0, 2).map((one) => (
          <Stat
            key={one.kind}
            label={kindName(one.kind)}
            value={euros(one.total)}
            sub={`${one.n} en tout`}
          />
        ))}
      </Stats>
      <View source={source} renders={['table', 'list', 'split']} defaults={{ group: 'kind' }} />
    </>
  );
}

interface Goal {
  id: string;
  ratio: number | null;
}

/**
 * Objectifs (v3 D5, « mesurable »; D6): everything that moves toward a target, every app at once —
 * a goal, a fund's budget, a habit's consistency — each with where it stands, then the entries.
 */
export function GoalsPage() {
  const kinds = useFacetKinds('measurable');
  const source = useKindRows(kinds.map((one) => one.kind));
  // A goal's progress is computed from what feeds it (its steps, spec Objectifs).
  const { data: goals = [] } = useQuery({
    queryKey: ['entries', 'goals'],
    queryFn: () => api<Goal[]>('/goals'),
    enabled: kinds.length > 0,
  });
  // What feeds a goal (its steps) says how far it is, before a figure kept on it.
  const ratioOf = (row: (typeof source.rows)[number]) =>
    goals.find((goal) => goal.id === row.id)?.ratio ?? row.progress ?? null;
  const targetOf = (row: (typeof source.rows)[number]) => {
    const path = kinds.find((one) => one.kind === row.kind)?.facet.target;
    const value = path ? row.values[path] : null;
    return typeof value === 'number' && value > 0 ? value : null;
  };
  const shown = source.rows.filter((row) => ratioOf(row) !== null);
  return (
    <>
      <PageHead
        title="Objectifs"
        lead="Tout ce qui avance vers une cible, dans toutes tes apps : où tu en es, et ce qui reste."
      />
      {shown.length > 0 && (
        <Panel title="Où j’en suis" icon={<Target size={16} />}>
          <div className="grid gap-3 px-4 py-3 md:grid-cols-2">
            {shown.map((row) => {
              const ratio = ratioOf(row)!;
              const target = targetOf(row);
              return (
                <Link
                  key={row.id}
                  to="/entree/$id"
                  params={{ id: row.id }}
                  className="block hover:opacity-90"
                >
                  <GaugeBar
                    label={row.title}
                    value={target ? Math.round(ratio * target * 10) / 10 : Math.round(ratio * 100)}
                    max={target ?? 100}
                  />
                </Link>
              );
            })}
          </div>
        </Panel>
      )}
      <View source={source} renders={['list', 'table', 'split']} />
    </>
  );
}
