import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useKinds, type Kind } from '../lib/kinds';
import type { Field, Row } from './types';

// The sources of the engine (v3 D10): entries of some kinds (through the server's own view, its
// fields named in her words), the agenda across her life (repetitions unfolded), what she has to
// do, her files. Each gives rows and fields; the renders never know which.

interface ModelField {
  name: string;
  type: string;
  options?: string[];
}
type KindWithModel = Omit<Kind, 'model' | 'facets'> & {
  model?: Kind['model'] & { fields?: ModelField[] };
  facets?: { facet: string; start?: string; end?: string; field?: string }[];
};
interface ViewField {
  path: string;
  type: string;
  label: Record<string, string> | null;
  options?: string[];
  optionLabels?: Record<string, Record<string, string>>;
  via?: string;
}
interface ViewResult {
  fields: ViewField[];
  rows: Record<string, unknown>[];
}

export interface Source {
  rows: Row[];
  fields: Field[];
  loading: boolean;
}

const label = (one: Record<string, string> | null | undefined, fallback: string) =>
  one?.fr ?? one?.en ?? fallback;

/** The entries of these kinds, each through the server's view of its kind. */
export function useKindRows(kinds: string[]): Source {
  const { data: all = [] } = useKinds();
  const known = new Map((all as KindWithModel[]).map((one) => [one.kind, one]));
  const results = useQueries({
    queries: kinds.map((kind) => {
      const own = (known.get(kind)?.model?.fields ?? [])
        .filter((field) => field.type !== 'lines' && field.type !== 'button')
        .map((field) => field.name)
        .slice(0, 20);
      return {
        queryKey: ['entries', 'view', kind, own.join(',')],
        queryFn: () =>
          api<ViewResult>('/views/run', {
            method: 'POST',
            body: {
              view: { kind, type: 'table', ...(own.length ? { columns: own } : {}), limit: 1000 },
            },
          }),
        enabled: all.length > 0,
      };
    }),
  });
  const fields = new Map<string, Field>();
  fields.set('kind', { path: 'kind', type: 'kind', label: 'Type' });
  const rows: Row[] = [];
  results.forEach((result, at) => {
    const kind = kinds[at]!;
    const facets = known.get(kind)?.facets ?? [];
    const dated = facets.find((one) => one.facet === 'dated');
    const stages = facets.find((one) => one.facet === 'stages');
    for (const field of result.data?.fields ?? []) {
      if (field.via || field.path === 'title' || fields.has(field.path)) continue;
      fields.set(field.path, {
        path: field.path,
        type: field.type,
        label: label(field.label, field.path),
        ...(field.options ? { options: field.options } : {}),
        ...(field.optionLabels
          ? {
              optionLabels: Object.fromEntries(
                Object.entries(field.optionLabels).map(([code, words]) => [
                  code,
                  label(words, code),
                ]),
              ),
            }
          : {}),
      });
    }
    for (const line of result.data?.rows ?? []) {
      const { id, title, ...values } = line as { id: string; title: string };
      const start = dated ? (values as Record<string, unknown>)[dated.start ?? ''] : null;
      const end = dated?.end ? (values as Record<string, unknown>)[dated.end] : null;
      rows.push({
        id,
        kind,
        title,
        values,
        start: typeof start === 'string' ? start : null,
        end: typeof end === 'string' ? end : null,
        allDay: typeof start === 'string' && start.length <= 10,
        stageField: stages?.field ?? null,
      });
    }
  });
  return { rows, fields: [...fields.values()], loading: results.some((one) => one.isLoading) };
}

interface Occurrence {
  id: string;
  kind: string;
  title: string;
  spaceId: string;
  space: string;
  start: string;
  end: string | null;
  allDay: boolean;
  status: string | null;
  type: string;
}

/** Everything dated across her life, for a window — repetitions unfolded by the server. */
export function useAgendaRows(from: Date, to: Date): Source {
  const { data, isLoading } = useQuery({
    queryKey: ['now', 'agenda', from.toISOString(), to.toISOString()],
    queryFn: () =>
      api<{ occurrences: Occurrence[] }>(
        `/agenda?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      ),
  });
  const rows: Row[] = (data?.occurrences ?? []).map((one) => ({
    id: one.id,
    kind: one.kind,
    title: one.title,
    spaceId: one.spaceId,
    values: { status: one.status, space: one.space, type: one.type },
    start: one.start,
    end: one.end,
    allDay: one.allDay,
  }));
  return {
    rows,
    fields: [
      { path: 'kind', type: 'kind', label: 'Type' },
      { path: 'space', type: 'text', label: 'Espace' },
      { path: 'status', type: 'text', label: 'Statut' },
    ],
    loading: isLoading,
  };
}

interface Activity {
  id: string;
  kind: string;
  title: string;
  space: string;
  spaceId: string;
  status: string;
  due: string | null;
  at: string | null;
  group: string;
}
const WHEN: Record<string, string> = {
  review: 'À vérifier',
  failed: 'En échec',
  late: 'En retard',
  today: 'Aujourd’hui',
  week: 'Cette semaine',
  later: 'Plus tard',
  undated: 'Sans date',
  done: 'Fait',
};

/** What she has to do, across her spaces and apps. */
export function useTaskRows(): Source {
  const { data = [], isLoading } = useQuery({
    queryKey: ['now', 'activities'],
    queryFn: () => api<Activity[]>('/activities?scope=todo&limit=500', { space: null }),
  });
  return {
    rows: data.map((one) => ({
      id: one.id,
      kind: one.kind,
      title: one.title,
      spaceId: one.spaceId,
      values: { when: one.group, status: one.status, due: one.due ?? one.at, space: one.space },
      start: one.due ?? one.at,
      end: null,
      allDay: !!(one.due ?? one.at) && (one.due ?? one.at)!.length <= 10,
      stageField: 'status',
    })),
    fields: [
      { path: 'kind', type: 'kind', label: 'Type' },
      {
        path: 'when',
        type: 'choice',
        label: 'Quand',
        options: Object.keys(WHEN),
        optionLabels: WHEN,
      },
      { path: 'status', type: 'choice', label: 'Statut' },
      { path: 'due', type: 'date', label: 'Échéance' },
      { path: 'space', type: 'text', label: 'Espace' },
    ],
    loading: isLoading,
  };
}

export interface FileRow {
  entryId: string;
  name: string;
  mediaType: string;
  size: number;
  title: string;
  createdAt: string;
  links: { id: string; title: string; kind: string; role: string }[];
}

/** Her files, or those linked to entries of these kinds. */
export function useFiles(kinds?: string[]) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['entries', 'files'],
    queryFn: () => api<FileRow[]>('/files'),
  });
  const wanted = kinds ? new Set(kinds) : null;
  return {
    files: wanted ? data.filter((one) => one.links.some((link) => wanted.has(link.kind))) : data,
    loading: isLoading,
  };
}
