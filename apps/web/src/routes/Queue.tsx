import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { useKindName } from '../lib/kinds';
import { Button, Panel, Tag, rowClass, type TagTone } from '../ui';

// « À valider » (v3 D13): the one queue of what waits for her yes — the core's own (spec 046):
// captures to file, entries proposed, proposals that make several entries, kinds that are one.
// Each nature keeps its own gesture; nothing is done without her yes; every yes can be undone.

export interface ToSort {
  type: 'capture' | 'proposed' | 'proposal' | 'merge';
  id: string;
  title: string;
  spaceId: string;
  detail: Record<string, unknown>;
}

const NATURE: Record<ToSort['type'], { label: string; tone: TagTone }> = {
  proposal: { label: 'proposition', tone: 'late' },
  proposed: { label: 'proposé', tone: 'late' },
  capture: { label: 'à ranger', tone: 'info' },
  merge: { label: 'doublon', tone: 'neutral' },
};

export function useQueue() {
  return useQuery({ queryKey: ['now', 'to-sort'], queryFn: () => api<ToSort[]>('/to-sort') });
}

export function QueuePanel() {
  const client = useQueryClient();
  const kindName = useKindName();
  const { data = [] } = useQueue();
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
    if (one.type === 'capture') {
      const guess = d.guess as { apps?: string[] } | undefined;
      const from = d.source ? `reçu par ${String(d.source)}` : '';
      return [from, guess?.apps?.length ? `pour ${guess.apps.join(', ')}` : '']
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
      <div className="max-h-[min(50vh,520px)] overflow-y-auto">
        {data.map((one) => (
          <div key={one.type + one.id} className={rowClass + ' flex-wrap sm:flex-nowrap'}>
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
              {(one.type === 'proposal' || one.type === 'proposed') && (
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
        ))}
      </div>
    </Panel>
  );
}
