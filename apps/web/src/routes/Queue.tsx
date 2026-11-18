import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { fieldWord } from '../engine/format';
import { peek } from '../engine/peek';
import { api } from '../lib/api';
import { useKindName } from '../lib/kinds';
import { Button, Empty, PageHead, Panel, Tag, inputClass, rowClass, type TagTone } from '../ui';
import { toast } from '../ui/more';

// « À valider » (v3 D13): the one queue of what waits for her yes — the core's own (spec 046):
// captures to file, entries proposed, proposals that make several entries, kinds that are one.
// Each nature keeps its own gesture; nothing is done without her yes; every yes can be undone.
// F5: what would be made is changed before the yes (« Modifier »); values read from her files wait
// for « C'est juste » or a correction on the fiche; an app shows what waits among its own kinds.

export interface ToSort {
  type: 'capture' | 'proposed' | 'proposal' | 'merge' | 'app' | 'verify';
  id: string;
  title: string;
  spaceId: string;
  detail: Record<string, unknown>;
  /** The kinds it makes or touches. */
  kinds: string[];
}

/** What waits for one app: among its kinds, and the captures Jarvis guessed are for it. */
export const forApp = (one: ToSort, app: string, kinds: string[]) =>
  one.kinds.some((kind) => kinds.includes(kind)) ||
  ((one.detail.guess as { apps?: string[] } | undefined)?.apps ?? []).includes(app);

const NATURE: Record<ToSort['type'], { label: string; tone: TagTone }> = {
  proposal: { label: 'proposition', tone: 'late' },
  proposed: { label: 'proposé', tone: 'late' },
  capture: { label: 'à ranger', tone: 'info' },
  merge: { label: 'doublon', tone: 'neutral' },
  app: { label: 'app proposée', tone: 'info' },
  verify: { label: 'lu, à vérifier', tone: 'late' },
};

/** A link that reads as a small button (it opens the fiche over the page). */
const pill =
  'inline-flex items-center gap-2 rounded-[2px] border border-rule-strong bg-paper px-[9px] py-[5px] text-[12.5px] font-semibold whitespace-nowrap text-ink hover:bg-sand';

const shown = (value: unknown) =>
  value === null || value === undefined
    ? ''
    : typeof value === 'number'
      ? String(value)
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

export function useQueue() {
  return useQuery({ queryKey: ['now', 'to-sort'], queryFn: () => api<ToSort[]>('/to-sort') });
}

export function QueuePanel({ only }: { only?: (one: ToSort) => boolean } = {}) {
  const client = useQueryClient();
  const kindName = useKindName();
  const [editing, setEditing] = useState<string | null>(null);
  const { data: all = [] } = useQueue();
  const data = only ? all.filter(only) : all;
  const done = () => {
    void client.invalidateQueries({ queryKey: ['now'] });
    void client.invalidateQueries({ queryKey: ['history'] });
    void client.invalidateQueries({ queryKey: ['kinds'] });
  };
  const decide = useMutation({
    mutationFn: ({ one, yes }: { one: ToSort; yes: boolean }) =>
      api(`/to-sort/${encodeURIComponent(one.id)}`, {
        method: 'POST',
        body: { yes },
        space: one.spaceId,
      }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: done,
  });
  const aside = useMutation({
    mutationFn: (one: ToSort) =>
      api(`/entries/${encodeURIComponent(one.id)}/archive`, { method: 'POST', space: one.spaceId }),
    onSettled: done,
  });
  const merge = useMutation({
    mutationFn: ({ one, yes }: { one: ToSort; yes: boolean }) =>
      yes
        ? api('/kinds/merge', {
            method: 'POST',
            body: {
              from: one.detail.from,
              to: one.detail.to,
              steps: one.detail.steps ?? [],
              dryRun: false,
            },
            space: one.spaceId,
          })
        : api('/kinds/merges/dismiss', {
            method: 'POST',
            body: { from: one.detail.from, to: one.detail.to },
            space: one.spaceId,
          }),
    onSettled: done,
  });
  const sure = useMutation({
    mutationFn: () => api('/inbox/sure', { method: 'POST' }),
    onSettled: done,
  });
  const yesAll = useMutation({
    mutationFn: async () => {
      for (const one of data.filter((x) => x.type === 'proposal' || x.type === 'proposed'))
        await api(`/to-sort/${encodeURIComponent(one.id)}`, {
          method: 'POST',
          body: { yes: true },
          space: one.spaceId,
        });
    },
    onSettled: done,
  });
  if (!data.length) return null;
  const proposals = data.filter((x) => x.type === 'proposal' || x.type === 'proposed').length;
  const captures = data.filter((x) => x.type === 'capture').length;
  const busy = decide.isPending || aside.isPending || merge.isPending || yesAll.isPending;

  const what = (one: ToSort): string => {
    const d = one.detail;
    if (one.type === 'proposal') {
      const makes = (d.makes as { kind: string; title: string }[] | undefined) ?? [];
      const why = typeof d.why === 'string' ? d.why : '';
      return [why, makes.length ? `crée ${makes.map((m) => kindName(m.kind)).join(', ')}` : '']
        .filter(Boolean)
        .join(' · ');
    }
    if (one.type === 'proposed') return kindName(String(d.kind ?? ''));
    if (one.type === 'app') {
      const makes = (d.makes as string[] | undefined) ?? [];
      const why = typeof d.why === 'string' ? d.why : '';
      return [why, makes.length ? `crée ${makes.join(', ')}` : ''].filter(Boolean).join(' · ');
    }
    if (one.type === 'capture') {
      const guess = d.guess as { apps?: string[] } | undefined;
      const from = d.source ? `reçu par ${String(d.source)}` : '';
      return [from, guess?.apps?.length ? `pour ${guess.apps.join(', ')}` : '']
        .filter(Boolean)
        .join(' · ');
    }
    if (one.type === 'verify') {
      const fields = (d.fields as { field: string; value: unknown }[] | undefined) ?? [];
      const from = d.from as { title: string } | null | undefined;
      return [
        kindName(String(d.kind ?? '')),
        from ? `lu dans « ${from.title} »` : '',
        fields.map((f) => `${fieldWord(f.field)} : ${shown(f.value)}`).join(', '),
      ]
        .filter(Boolean)
        .join(' · ');
    }
    return `${String(d.count ?? '')} entrée(s) « ${String(d.from)} » rejoindraient « ${String(d.to)} »`;
  };

  return (
    <Panel
      title="À valider"
      action={
        <span className="flex flex-wrap gap-2">
          {captures > 0 && (
            <Button size="sm" disabled={busy} onClick={() => sure.mutate()}>
              Ranger ce qui est sûr
            </Button>
          )}
          {proposals > 1 && (
            <Button size="sm" tone="solid" disabled={busy} onClick={() => yesAll.mutate()}>
              <Check size={14} />
              Tout accepter
            </Button>
          )}
        </span>
      }
    >
      {/* While a proposal is changed, the list takes its height: the form never scrolls in a box. */}
      <div className={editing ? undefined : 'max-h-[min(50vh,520px)] overflow-y-auto'}>
        {data.map((one) => (
          <div key={one.type + one.id}>
            <div className={rowClass + ' flex-wrap sm:flex-nowrap'}>
              <Tag tone={NATURE[one.type].tone}>{NATURE[one.type].label}</Tag>
              <span className="min-w-0 flex-1">
                {one.type === 'merge' ? (
                  <span className="block truncate font-semibold">{one.title}</span>
                ) : (
                  <Link
                    to="/entree/$id"
                    params={{ id: one.id }}
                    className="block truncate font-semibold hover:underline"
                  >
                    {one.title}
                  </Link>
                )}
                <span className="block truncate text-[12.5px] text-bark">{what(one)}</span>
              </span>
              <span className="flex flex-none gap-1.5">
                {one.type === 'verify' && (
                  <>
                    <Button
                      size="sm"
                      tone="solid"
                      disabled={busy}
                      onClick={() => decide.mutate({ one, yes: true })}
                    >
                      <Check size={14} />
                      C’est juste
                    </Button>
                    <Link to="." search={peek(one.id)} className={pill}>
                      <Pencil size={13} />
                      Corriger
                    </Link>
                  </>
                )}
                {one.type === 'proposal' && (
                  <Button
                    size="sm"
                    disabled={busy}
                    aria-expanded={editing === one.id}
                    onClick={() => setEditing(editing === one.id ? null : one.id)}
                  >
                    <Pencil size={13} />
                    Modifier
                  </Button>
                )}
                {one.type === 'proposed' && (
                  <Link to="." search={peek(one.id)} className={pill}>
                    <Pencil size={13} />
                    Modifier
                  </Link>
                )}
                {(one.type === 'proposal' || one.type === 'proposed' || one.type === 'app') && (
                  <>
                    <Button
                      size="sm"
                      tone="solid"
                      disabled={busy}
                      onClick={() => decide.mutate({ one, yes: true })}
                    >
                      <Check size={14} />
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => decide.mutate({ one, yes: false })}
                    >
                      <X size={14} />
                      Refuser
                    </Button>
                  </>
                )}
                {one.type === 'merge' && (
                  <>
                    <Button
                      size="sm"
                      tone="solid"
                      disabled={busy}
                      onClick={() => merge.mutate({ one, yes: true })}
                    >
                      Fusionner
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => merge.mutate({ one, yes: false })}
                    >
                      Ignorer
                    </Button>
                  </>
                )}
                {one.type === 'capture' && (
                  <Button size="sm" disabled={busy} onClick={() => aside.mutate(one)}>
                    Mettre de côté
                  </Button>
                )}
              </span>
            </div>
            {editing === one.id && one.type === 'proposal' && (
              <ProposalEditor one={one} onDone={() => setEditing(null)} />
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

interface Proposed {
  kind: string;
  title: string;
  id?: string;
  data?: Record<string, unknown>;
}

/**
 * What a proposal would make, changed before her yes (F5): each entry's title and values, in
 * place. Only what she changed is sent; it becomes hers (« dit »), the rest stays as it was read.
 */
function ProposalEditor({ one, onDone }: { one: ToSort; onDone: () => void }) {
  const client = useQueryClient();
  const kindName = useKindName();
  const { data: full } = useQuery({
    queryKey: ['entry', one.id],
    queryFn: () =>
      api<{ data: { entries?: Proposed[] } }>(`/entries/${encodeURIComponent(one.id)}`, {
        space: one.spaceId,
      }),
  });
  const entries = full?.data.entries ?? [];
  // Her changes, by entry: a title, and values as she typed them.
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [values, setValues] = useState<Record<number, Record<string, string>>>({});
  const keep = useMutation({
    mutationFn: () => {
      const changes = entries
        .map((entry, at) => {
          const data: Record<string, unknown> = {};
          for (const [field, raw] of Object.entries(values[at] ?? {})) {
            const was = entry.data?.[field];
            const text = raw.trim();
            if (text === shown(was)) continue;
            data[field] =
              text === ''
                ? null
                : typeof was === 'number'
                  ? Number(text.replace(/\s/g, '').replace(',', '.'))
                  : typeof was === 'boolean'
                    ? /^(oui|vrai|true|1)$/i.test(text)
                    : text;
          }
          const title = titles[at]?.trim();
          return { at, ...(title && title !== entry.title ? { title } : {}), data };
        })
        .filter((change) => 'title' in change || Object.keys(change.data).length);
      if (changes.some((change) => Object.values(change.data).some((v) => Number.isNaN(v))))
        return Promise.reject(new Error('Un nombre attendu n’en est pas un.'));
      if (!changes.length) return Promise.resolve(null);
      return api(`/to-sort/${encodeURIComponent(one.id)}`, {
        method: 'PUT',
        body: { entries: changes },
        space: one.spaceId,
      });
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['now'] });
      void client.invalidateQueries({ queryKey: ['entry', one.id] });
      void client.invalidateQueries({ queryKey: ['history'] });
      onDone();
    },
  });
  if (!full) return null;
  return (
    <form
      className="grid gap-3 border-b border-rule bg-sand/40 px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        keep.mutate();
      }}
    >
      {entries.map((entry, at) => (
        <fieldset key={at} className="grid gap-2">
          <legend className="pb-1 text-[12.5px] text-bark">
            {entry.id ? 'change' : 'crée'} · {kindName(entry.kind)}
          </legend>
          {!entry.id && (
            <input
              aria-label="Titre"
              className={inputClass + ' font-semibold'}
              defaultValue={entry.title}
              onChange={(event) => setTitles({ ...titles, [at]: event.target.value })}
            />
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(entry.data ?? {}).map(([field, value]) => (
              <label key={field} className="grid min-w-0 gap-1 text-[12.5px] text-bark">
                {fieldWord(field)}
                <input
                  className={inputClass}
                  defaultValue={shown(value)}
                  readOnly={typeof value === 'object' && value !== null}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      [at]: { ...values[at], [field]: event.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <span className="flex gap-2">
        <Button size="sm" tone="solid" type="submit" disabled={keep.isPending}>
          Garder
        </Button>
        <Button size="sm" type="button" onClick={onDone}>
          Annuler
        </Button>
      </span>
    </form>
  );
}

/** « À valider » as a page of its own (v3 D13): reachable from the menu at any moment. */
export function QueuePage() {
  const { data = [], isLoading } = useQueue();
  return (
    <>
      <PageHead
        title="À valider"
        lead="Tout ce qui attend ton oui : ce que Jarvis a lu, ce qu’un assistant propose, les doublons. Rien ne se fait sans toi, et tout s’annule."
      />
      {isLoading ? null : data.length ? (
        <QueuePanel />
      ) : (
        <Panel>
          <Empty
            title="Rien n’attend ton oui"
            lead="Ce qu’un agent ou un document te propose arrivera ici."
          />
        </Panel>
      )}
    </>
  );
}
