import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { api, type Entry as EntryRow, type JournalLine } from '../lib/api';
import { useSession } from '../lib/session';
import { said, whoOf } from '../lib/words';
import { useKindName } from '../lib/kinds';
import { Avatar, Chip, PageHead, Panel, Skeleton, ago } from '../ui';

// La fiche (v3 D10, first form): an entry, its values, and its history. Editing in place, its
// links both ways and its files come with the view engine (V5).

const show = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(show).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text))
    return new Date(text).toLocaleString('fr', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  if (/^\d{4}-\d{2}-\d{2}$/.test(text))
    return new Date(`${text}T12:00:00`).toLocaleDateString('fr', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return text;
};

export function EntryPage() {
  const { id } = useParams({ from: '/entree/$id' });
  const { me } = useSession();
  const kindName = useKindName();
  const entry = useQuery({
    queryKey: ['entry', id],
    queryFn: () => api<EntryRow>(`/entries/${id}`),
  });
  const history = useQuery({
    queryKey: ['history', 'entry', id],
    queryFn: () => api<JournalLine[]>(`/history?limit=30&target=${encodeURIComponent(id)}`),
  });
  if (entry.isLoading) return <Skeleton className="h-40" />;
  if (!entry.data)
    return <PageHead title="Introuvable" lead="Cette entrée n’existe pas dans cet espace." />;
  const fields = Object.entries(entry.data.data).filter(
    ([key]) => !['text', 'source_connection'].includes(key),
  );
  const text = typeof entry.data.data.text === 'string' ? entry.data.data.text : null;
  return (
    <>
      <PageHead title={entry.data.title} lead={<Chip>{kindName(entry.data.kind)}</Chip>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Propriétés">
          <dl className="divide-y divide-rule">
            {fields.map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm"
              >
                <dt className="truncate text-bark">{key}</dt>
                <dd className="min-w-0 break-words">{show(value)}</dd>
              </div>
            ))}
          </dl>
          {text && (
            <p className="border-t border-rule px-4 py-3 text-sm whitespace-pre-wrap">{text}</p>
          )}
        </Panel>
        <Panel title="Son histoire">
          <ul className="max-h-[60vh] overflow-y-auto">
            {(history.data ?? []).map((line) => {
              const who = whoOf(line, me.person.id);
              return (
                <li
                  key={line.id}
                  className="flex items-start gap-2.5 border-b border-rule px-4 py-2.5 last:border-0"
                >
                  <Avatar name={who.name} size={24} />
                  <span className="min-w-0 flex-1 text-sm">
                    <b className="font-medium">{who.name}</b> {said(line.command)}
                  </span>
                  <time className="flex-none text-xs text-faint">{ago(line.at)}</time>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
