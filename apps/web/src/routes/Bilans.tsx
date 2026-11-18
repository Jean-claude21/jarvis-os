import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Copy, NotebookPen, Plus } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { HighlightsBlock } from '../blocks/review';
import { type Drawn } from '../blocks/Blocks';
import { Button, Empty, PageHead, Panel, Segmented, Sheet, Skeleton, Tag, cn } from '../ui';
import { Markdown } from '../ui/Markdown';
import { DateInput, Select, toast } from '../ui/more';

// Ses bilans (v3, spec 083 kept): a bilan is a document — an entry « Bilan » (its type: the routine
// that makes it; its days; « à écrire » then « écrit »; its text in Markdown) written by her
// assistant following HER routine (bilan-hebdo, bilan-mensuel, any she adds), from the facts of
// that period only. Here: her bilans to the left, the one chosen read to the right; a new one is
// prepared here and written by the assistant. Jarvis never invents its structure.

interface Bilan {
  id: string;
  title: string;
  createdAt: string;
  data: {
    type?: string;
    skill?: string;
    from?: string;
    to?: string;
    status?: string;
    text?: string;
  };
}
interface Skill {
  id: string;
  title: string;
  result: string | null;
  excerpt: string;
}

const FREE = 'Bilan libre';
const typeOf = (one: Bilan) => String(one.data.type ?? one.data.skill ?? FREE);
const endOf = (one: Bilan) => String(one.data.to ?? one.data.from ?? one.createdAt).slice(0, 10);
const day = (iso: string, year = false) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr', {
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
  });
const spanOf = (one: Bilan) =>
  one.data.from && one.data.to
    ? `du ${day(one.data.from)} au ${day(one.data.to, true)}`
    : one.data.from
      ? day(one.data.from, true)
      : day(one.createdAt.slice(0, 10), true);
const localDay = (d: Date) => d.toLocaleDateString('en-CA');
/** The sentence that asks her assistant to write it (routine « Les bilans »). */
const askOf = (one: Bilan) =>
  `Écris mon bilan « ${typeOf(one)} » ${spanOf(one)} (entrée ${one.id}) en suivant ma routine${
    one.data.skill ? ` « ${one.data.skill} »` : ''
  }.`;

/** Her routines that make a bilan: those that say so, and those named for one. */
const makesBilan = (skill: Skill) =>
  String(skill.result ?? '').toLowerCase() === 'bilan' || /bilan/i.test(skill.title);

export function BilansPage() {
  const search = useSearch({ from: '/bilans' });
  const navigate = useNavigate();
  const [type, setType] = useState('all');
  const [period, setPeriod] = useState('all');
  const [making, setMaking] = useState(false);
  const bilans = useQuery({
    queryKey: ['entries', 'bilans'],
    queryFn: () => api<Bilan[]>('/entries?kind=Bilan&limit=200'),
  });
  const all = [...(bilans.data ?? [])].sort((a, b) => endOf(b).localeCompare(endOf(a)));
  const types = [...new Set(all.map(typeOf))];
  const since =
    period === 'all' ? '' : localDay(new Date(Date.now() - Number(period) * 86_400_000));
  const shown = all.filter(
    (one) => (type === 'all' || typeOf(one) === type) && (!since || endOf(one) >= since),
  );
  const open = all.find((one) => one.id === search.page) ?? shown[0];
  const choose = (id: string) => void navigate({ to: '/bilans', search: { page: id } });
  return (
    <>
      <PageHead
        title="Bilans"
        lead="Tes bilans, écrits selon tes routines à partir de ce que la période a donné. Tu les lis ici."
        actions={
          <Button tone="solid" onClick={() => setMaking(true)}>
            <Plus size={15} />
            Nouveau bilan
          </Button>
        }
      />
      {bilans.isLoading ? (
        <Skeleton className="h-60" />
      ) : !all.length ? (
        <Panel>
          <Empty
            title="Aucun bilan pour l’instant"
            lead="Prépare-en un : choisis la routine qui le structure et sa période ; ton assistant l’écrit."
          />
          <div className="flex justify-center pb-5">
            <Button tone="solid" onClick={() => setMaking(true)}>
              <Plus size={15} />
              Nouveau bilan
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <Panel>
            <div className="grid gap-2 border-b border-rule p-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ['all', `Tous ${all.length}`],
                  ...types.map((t) => [t, `${t} ${all.filter((one) => typeOf(one) === t).length}`]),
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setType(key!)}
                    aria-pressed={type === key}
                    className={cn(
                      'cursor-pointer rounded-[6px] border px-2 py-0.5 text-[12.5px]',
                      type === key
                        ? 'border-primary bg-sand font-semibold'
                        : 'border-rule bg-paper',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Segmented
                label="Période"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'all', label: 'Tout' },
                  { value: '30', label: '30 j' },
                  { value: '90', label: '3 mois' },
                  { value: '365', label: '12 mois' },
                ]}
              />
            </div>
            {shown.length === 0 && (
              <p className="px-4 py-4 text-[13px] text-bark">Aucun bilan pour ces filtres.</p>
            )}
            {shown.map((one) => (
              <button
                key={one.id}
                onClick={() => choose(one.id)}
                aria-current={open?.id === one.id ? 'true' : undefined}
                className={cn(
                  'flex w-full cursor-pointer items-start gap-2.5 border-b border-rule px-3 py-2.5 text-left last:border-0',
                  open?.id === one.id ? 'bg-sand' : 'hover:bg-sand/60',
                )}
              >
                <NotebookPen size={16} className="mt-0.5 flex-none text-bark" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{one.title}</span>
                  <span className="block truncate text-[12px] text-bark">{spanOf(one)}</span>
                </span>
                {one.data.status === 'to_write' && (
                  <Tag tone="info" dot={false}>
                    à écrire
                  </Tag>
                )}
              </button>
            ))}
          </Panel>
          {open ? <BilanView key={open.id} one={open} /> : null}
        </div>
      )}
      {making && (
        <NewBilan
          onClose={() => setMaking(false)}
          onMade={(id) => {
            setMaking(false);
            choose(id);
          }}
        />
      )}
    </>
  );
}

/** One bilan: written, read as a document; still to write, the facts of its period and the ask. */
function BilanView({ one }: { one: Bilan }) {
  const text = String(one.data.text ?? '');
  const facts = useQuery({
    queryKey: ['entries', 'bilan-facts', one.id],
    queryFn: () =>
      api<{ blocks: Drawn[] }>('/pages/try', {
        method: 'POST',
        body: {
          format: 'review',
          filters: [
            { name: 'period', type: 'period', default: `${one.data.from}..${one.data.to}` },
          ],
          blocks: [{ block: 'highlights' }],
        },
      }),
    enabled: !text && !!one.data.from && !!one.data.to,
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(askOf(one));
      toast('Phrase copiée : donne-la à ton assistant.');
    } catch {
      toast(askOf(one));
    }
  };
  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <h2 className="font-display text-[22px] font-semibold">{one.title}</h2>
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-bark">
          <Tag tone="neutral">{typeOf(one)}</Tag>
          {spanOf(one)}
        </p>
      </div>
      {text ? (
        <Panel>
          <Markdown text={text} contents className="px-4 py-4 sm:px-6" />
        </Panel>
      ) : (
        <>
          <Panel title="À écrire par ton assistant">
            <div className="grid gap-3 px-4 py-3 text-[13.5px]">
              <p className="text-bark">
                Ce bilan suit{' '}
                {one.data.skill ? <b>ta routine « {one.data.skill} »</b> : 'un bilan libre'} : sa
                structure, son style, ses critères. Ton assistant l’écrit à partir des faits de la
                période seulement ; ce qui manque est écrit « non renseigné ».
              </p>
              <p className="rounded-[10px] bg-sand px-3 py-2 font-mono text-[12.5px]">
                {askOf(one)}
              </p>
              <span>
                <Button size="sm" onClick={() => void copy()}>
                  <Copy size={14} />
                  Copier la phrase
                </Button>
              </span>
            </div>
          </Panel>
          <Panel title="Ce que la période a donné">
            {facts.isLoading || !facts.data ? (
              <Skeleton className="m-3 h-32" />
            ) : (
              <HighlightsBlock
                block={facts.data.blocks[0]!}
                vocabulary={{}}
                refresh={() => undefined}
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

/** A new bilan: the routine that structures it, its period; the entry waits « à écrire ». */
function NewBilan({ onClose, onMade }: { onClose: () => void; onMade: (id: string) => void }) {
  const client = useQueryClient();
  const skills = useQuery({
    queryKey: ['skills'],
    queryFn: () => api<{ mine: Skill[] }>('/skills'),
  });
  const mine = (skills.data?.mine ?? []).filter(makesBilan);
  const [chosen, setSkill] = useState<string | null>(null);
  // Her routine first: a free bilan only when she picks it.
  const skill = chosen ?? mine[0]?.title ?? '';
  const now = new Date();
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  const add = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const presets: Record<string, [Date, Date]> = {
    week: [monday, add(monday, 6)],
    lastweek: [add(monday, -7), add(monday, -1)],
    month: [
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    ],
    lastmonth: [
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      new Date(now.getFullYear(), now.getMonth(), 0),
    ],
  };
  const [preset, setPreset] = useState('week');
  const [from, setFrom] = useState(localDay(presets.week![0]));
  const [to, setTo] = useState(localDay(presets.week![1]));
  const make = useMutation({
    mutationFn: async () => {
      if (!from || !to || to < from) throw new Error('La période va d’un jour à un jour qui suit.');
      const type = skill || FREE;
      const draft = { id: '', title: '', createdAt: '', data: { from, to } } as Bilan;
      const saved = await api<{ entries: { id: string }[] }>('/save', {
        method: 'POST',
        body: {
          entries: [
            {
              kind: 'Bilan',
              title: `${type} — ${spanOf(draft)}`,
              data: { type, ...(skill ? { skill } : {}), from, to, status: 'to_write' },
              origin: 'said',
            },
          ],
        },
      });
      return saved.entries[0]!.id;
    },
    onSuccess: (id) => {
      void client.invalidateQueries({ queryKey: ['entries'] });
      toast('Bilan préparé : il attend que ton assistant l’écrive.');
      onMade(id);
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title="Nouveau bilan">
      <div className="grid gap-4 p-4 text-[13px]">
        <div className="grid gap-1.5">
          <span className="font-semibold">La routine qui le structure</span>
          <Select
            label="Routine"
            value={skill}
            onChange={setSkill}
            options={[
              ...mine.map((one) => ({ value: one.title, label: one.title })),
              { value: '', label: FREE },
            ]}
          />
          {!mine.length && !skills.isLoading && (
            <span className="text-faint">
              Aucune de tes routines ne fait de bilan : écris-en une dans Construire › Skills.
            </span>
          )}
        </div>
        <div className="grid gap-1.5">
          <span className="font-semibold">La période</span>
          <Segmented
            label="Période"
            value={preset}
            onChange={(next) => {
              setPreset(next);
              const p = presets[next];
              if (p) {
                setFrom(localDay(p[0]));
                setTo(localDay(p[1]));
              }
            }}
            options={[
              { value: 'week', label: 'Cette semaine' },
              { value: 'lastweek', label: 'Semaine dernière' },
              { value: 'month', label: 'Ce mois' },
              { value: 'lastmonth', label: 'Mois dernier' },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <DateInput
              label="Du"
              value={from}
              onChange={(v) => {
                setFrom(v);
                setPreset('');
              }}
            />
            <DateInput
              label="Au"
              value={to}
              onChange={(v) => {
                setTo(v);
                setPreset('');
              }}
            />
          </div>
        </div>
        <p className="rounded-[10px] bg-sand px-3 py-2 text-bark">
          Jarvis prépare l’entrée « à écrire » et te donne la phrase pour ton assistant : il l’écrit
          en suivant ta routine, avec les faits de cette période seulement.
        </p>
        <span className="flex gap-2">
          <Button tone="solid" disabled={make.isPending} onClick={() => make.mutate()}>
            Préparer le bilan
          </Button>
          <Button onClick={onClose}>Annuler</Button>
        </span>
      </div>
    </Sheet>
  );
}
