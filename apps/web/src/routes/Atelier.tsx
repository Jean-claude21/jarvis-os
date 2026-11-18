import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  Activity as ActivityIcon,
  BookOpen,
  Download,
  Gauge,
  Pause,
  Play,
  Settings2,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useKindName } from '../lib/kinds';
import {
  Avatar,
  Button,
  PageHead,
  Panel,
  Segmented,
  Sheet,
  Skeleton,
  Tabs,
  Tag,
  ago,
  inputClass,
  rowClass,
  type TagTone,
} from '../ui';
import { Journal } from './Activity';
import { Select, toast } from '../ui/more';
import { Markdown } from '../ui/Markdown';
import { ComponentsCatalog } from './Catalog';

// L'Atelier (v3 D12, D17 « Construire »): who works for her — her agents, each a named setting of
// the one node (its triggers, its executor, its skills, what it reads and writes, how free it is,
// its budget, its Pause) — and the skills they follow, in the Agent Skills format.

export type AtelierTab = 'automations' | 'skills' | 'components';
export const atelierSearch = (search: Record<string, unknown>): { t?: AtelierTab } =>
  search.t === 'skills' || search.t === 'components' ? { t: search.t } : {};

interface AgentRule {
  id: string;
  title: string;
  when: Record<string, unknown>;
  active: boolean;
  next: string | null;
  lastRun: string | null;
  error: string | null;
  app: string | null;
}
interface AgentRun {
  id: string;
  title: string;
  status: string;
  started: string | null;
  ended: string | null;
  counts: Record<string, number>;
  error: string | null;
}
type Autonomy = 'propose' | 'act_and_report' | 'silent';
interface Agent {
  id: string | null;
  title: string;
  data: {
    role?: string;
    executor?: 'rule' | 'script' | 'llm' | 'service';
    service?: string;
    skills?: string[];
    reads?: string[];
    writes?: string[];
    builtin?: string[];
    autonomy?: Autonomy;
    budget?: { calls_per_day?: number };
    paused?: boolean;
  };
  rules: AgentRule[];
  callsToday: number;
  runs: AgentRun[];
  state: 'paused' | 'over_budget' | 'failing' | 'working' | 'idle';
}

const STATE: Record<Agent['state'], { label: string; tone: TagTone }> = {
  idle: { label: 'prêt', tone: 'ok' },
  working: { label: 'au travail', tone: 'info' },
  paused: { label: 'en pause', tone: 'neutral' },
  over_budget: { label: 'budget du jour atteint', tone: 'late' },
  failing: { label: 'en échec', tone: 'error' },
};
const EXECUTOR: Record<string, string> = {
  rule: 'ses règles, sans IA',
  script: 'un script',
  llm: 'un modèle avec ses skills',
  service: 'un service',
};
const AUTONOMY: { value: Autonomy; label: string; lead: string }[] = [
  {
    value: 'propose',
    label: 'Propose',
    lead: 'tout ce qu’il écrirait t’attend dans « À valider »',
  },
  {
    value: 'act_and_report',
    label: 'Agit et rend compte',
    lead: 'il agit, tout est au journal, annulable',
  },
  {
    value: 'silent',
    label: 'Discret',
    lead: 'pour le trivial seulement : il agit sans te le signaler',
  },
];

const pad = (n: string) => n.padStart(2, '0');
/** A rule's « when », in her words. */
export function whenText(when: Record<string, unknown>, kindName: (kind: string) => string) {
  if (typeof when.schedule === 'string') {
    const [m, h, , , days] = when.schedule.trim().split(/\s+/);
    if (m && h && /^\d+$/.test(m) && /^\d+$/.test(h)) {
      const at = `${h} h ${pad(m)}`;
      if (!days || days === '*') return `chaque jour à ${at}`;
      if (days === '1-5') return `en semaine à ${at}`;
      return `certains jours (${days}) à ${at}`;
    }
    return `selon « ${when.schedule} »`;
  }
  if (typeof when.saved === 'string')
    return `à chaque ${kindName(when.saved).toLowerCase()} enregistré(e)`;
  const changed = when.changed as { kind?: string; field?: string } | undefined;
  if (changed?.kind)
    return `quand « ${changed.field} » change sur un(e) ${kindName(changed.kind).toLowerCase()}`;
  const before = when.before as { kind?: string; field?: string; days?: number } | undefined;
  if (before?.kind)
    return before.days
      ? `${before.days} j avant « ${before.field} » d’un(e) ${kindName(before.kind).toLowerCase()}`
      : `le jour de « ${before.field} » d’un(e) ${kindName(before.kind).toLowerCase()}`;
  return 'à la demande';
}
const BUILTIN_WHEN: Record<string, string> = { lecture: 'à chaque fichier déposé' };

function useAgents() {
  return useQuery({ queryKey: ['agents'], queryFn: () => api<Agent[]>('/agents') });
}
function usePause() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ title, paused }: { title: string; paused: boolean }) =>
      api(`/agents/${encodeURIComponent(title)}`, { method: 'PATCH', body: { paused } }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['agents'] }),
  });
}

function triggersOf(agent: Agent, kindName: (kind: string) => string): string[] {
  return [
    ...(agent.data.builtin ?? []).map((one) => BUILTIN_WHEN[one] ?? one),
    ...agent.rules.map((rule) => whenText(rule.when, kindName)),
  ].filter((one, at, all) => all.indexOf(one) === at);
}

export function AtelierPage() {
  const search = useSearch({ strict: false }) as { t?: AtelierTab };
  const navigate = useNavigate();
  const tab = search.t ?? 'automations';
  return (
    <>
      <PageHead
        title="Construire"
        lead="Ce qui travaille pour toi, comment, et dans quelles limites."
      />
      <Tabs
        tabs={[
          { key: 'automations', label: 'Agents et automatismes' },
          { key: 'skills', label: 'Skills' },
          { key: 'components', label: 'Composants' },
        ]}
        value={tab}
        label="Construire"
        onChange={(key) =>
          void navigate({ to: '/construire', search: key === 'automations' ? {} : { t: key } })
        }
      />
      {tab === 'automations' ? (
        <Automations />
      ) : tab === 'skills' ? (
        <SkillsList />
      ) : (
        <ComponentsCatalog />
      )}
    </>
  );
}

interface Skill {
  name: string;
  when: string;
  /** Its instructions, in Markdown: read here, without downloading. */
  text?: string;
}
const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function SkillsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api<{ jarvis?: Skill[]; mine?: MineSkill[] }>('/skills'),
  });
  const [open, setOpen] = useState<Skill | null>(null);
  if (isLoading) return <Skeleton className="h-40" />;
  const skills = data?.jarvis ?? [];
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Panel
        title="Les skills de Jarvis"
        icon={<BookOpen size={16} />}
        action={
          <span className="text-xs text-faint">
            au format Agent Skills : ils marchent aussi dans Claude
          </span>
        }
      >
        {skills.map((one) => (
          <div key={one.name} className={rowClass + ' flex-wrap'}>
            <button
              onClick={() => setOpen(one)}
              className="min-w-0 flex-1 cursor-pointer text-left"
            >
              <b className="block truncate font-semibold hover:underline">{one.name}</b>
              <span className="line-clamp-2 text-[12.5px] text-bark">Quand {one.when}</span>
            </button>
            <Button size="sm" onClick={() => setOpen(one)}>
              <BookOpen size={14} />
              Lire
            </Button>
            <a
              href={`/api/skills/${slug(one.name)}/SKILL.md?download=1`}
              className="inline-flex h-8 flex-none items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 text-[13px] font-semibold hover:border-rule-strong"
            >
              <Download size={14} />
              SKILL.md
            </a>
          </div>
        ))}
      </Panel>
      <Panel title="Tes skills" icon={<BookOpen size={16} />}>
        {!(data?.mine ?? []).length ? (
          <p className="px-4 py-4 text-[13px] text-bark">
            Aucun skill à toi : dis à Claude « fais-en un skill » après une façon de faire qui te
            plaît.
          </p>
        ) : (
          (data?.mine ?? []).map((one) => (
            <div key={one.id} className={rowClass}>
              <span className="min-w-0 flex-1">
                <Link
                  to="/entree/$id"
                  params={{ id: one.id }}
                  className="block truncate font-semibold hover:underline"
                >
                  {one.title}
                </Link>
                <span className="line-clamp-2 text-[12.5px] text-bark">
                  {one.when || one.excerpt}
                </span>
              </span>
            </div>
          ))
        )}
      </Panel>
      <Sheet
        open={!!open}
        onOpenChange={(value) => !value && setOpen(null)}
        title={open?.name ?? ''}
      >
        {open && (
          <div className="grid gap-3 p-4">
            <p className="text-[13px] text-bark">
              <b className="text-ink">Quand :</b> {open.when}
            </p>
            <Markdown text={open.text ?? ''} />
            <a
              href={`/api/skills/${slug(open.name)}/SKILL.md?download=1`}
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 text-[13px] font-semibold hover:border-rule-strong"
            >
              <Download size={14} />
              Télécharger SKILL.md
            </a>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export function AgentPage() {
  const { name } = useParams({ from: '/construire/agents/$name' });
  const kindName = useKindName();
  const client = useQueryClient();
  const { data, isLoading } = useAgents();
  const pause = usePause();
  const agent = data?.find((one) => one.title === name);
  const [budget, setBudget] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api(`/agents/${encodeURIComponent(name)}`, { method: 'PATCH', body: patch }),
    onSettled: () => {
      setBudget(null);
      void client.invalidateQueries({ queryKey: ['agents'] });
    },
  });
  if (isLoading) return <Skeleton className="h-40" />;
  if (!agent) return <PageHead title="Introuvable" lead="Aucun agent de ce nom dans cet espace." />;
  const state = STATE[agent.state];
  const limit = agent.data.budget?.calls_per_day;
  const kinds = (list?: string[]) =>
    list?.length ? (
      <span className="flex flex-wrap gap-1">
        {list.map((one) => (
          <Tag key={one} tone="neutral" dot={false}>
            {kindName(one)}
          </Tag>
        ))}
      </span>
    ) : (
      '—'
    );
  const line = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] items-baseline gap-3 border-b border-rule px-4 py-2.5 last:border-0">
      <dt className="text-[13px] text-bark">{label}</dt>
      <dd className="min-w-0 text-[13.5px]">{value}</dd>
    </div>
  );
  return (
    <>
      <PageHead
        icon={<Avatar name={agent.title} size={40} tinted />}
        title={agent.title}
        lead={
          <span className="flex flex-wrap items-center gap-1.5">
            <Tag tone={state.tone}>{state.label}</Tag>
            {agent.data.role && <span>{agent.data.role}</span>}
          </span>
        }
        actions={
          <Button
            tone={agent.data.paused ? 'solid' : 'plain'}
            disabled={pause.isPending}
            onClick={() => pause.mutate({ title: agent.title, paused: !agent.data.paused })}
          >
            {agent.data.paused ? <Play size={15} /> : <Pause size={15} />}
            {agent.data.paused ? 'Reprendre' : 'Mettre en pause'}
          </Button>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Comment il travaille" icon={<Settings2 size={16} />}>
            <dl>
              {line(
                'Quand',
                <ul className="grid gap-0.5">
                  {triggersOf(agent, kindName).map((one) => (
                    <li key={one}>{one}</li>
                  ))}
                </ul>,
              )}
              {line(
                'Avec',
                `${EXECUTOR[agent.data.executor ?? 'rule']}${agent.data.service ? ` : ${agent.data.service}` : ''}`,
              )}
              {line(
                'Skills',
                agent.data.skills?.length ? (
                  <span className="flex flex-wrap gap-2">
                    {agent.data.skills.map((one) => (
                      <a
                        key={one}
                        href={`/api/skills/${slug(one)}/SKILL.md`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {one}
                      </a>
                    ))}
                  </span>
                ) : (
                  '—'
                ),
              )}
              {line('Lit', kinds(agent.data.reads))}
              {line('Écrit', kinds(agent.data.writes))}
            </dl>
          </Panel>
          <Panel title="Ses comptes rendus" icon={<ActivityIcon size={16} />}>
            {!agent.runs.length ? (
              <p className="px-4 py-5 text-[13px] text-bark">
                Pas encore d’appel. Ce qu’il écrit apparaît aussi dans son journal ci-dessous.
              </p>
            ) : (
              agent.runs.map((run) => {
                const counts = Object.entries(run.counts).filter(([, n]) => n > 0);
                return (
                  <div key={run.id} className={rowClass + ' flex-wrap'}>
                    <Tag
                      tone={
                        run.status === 'done' ? 'ok' : run.status === 'failed' ? 'error' : 'info'
                      }
                    >
                      {run.status === 'done'
                        ? 'fait'
                        : run.status === 'failed'
                          ? 'échec'
                          : 'en cours'}
                    </Tag>
                    <span className="min-w-0 flex-1">
                      <Link
                        to="/entree/$id"
                        params={{ id: run.id }}
                        className="block truncate font-semibold hover:underline"
                      >
                        {run.title}
                      </Link>
                      <span className="block truncate text-[12.5px] text-bark">
                        {counts.length
                          ? counts.map(([key, n]) => `${n} ${COUNT_WORDS[key] ?? key}`).join(' · ')
                          : 'rien de nouveau'}
                        {run.error ? ` · ${run.error}` : ''}
                      </span>
                    </span>
                    {run.started && (
                      <time className="flex-none font-mono text-xs text-bark">
                        {ago(run.started)}
                      </time>
                    )}
                  </div>
                );
              })
            )}
          </Panel>
          <Journal
            title="Son journal"
            query={`limit=15&client=${encodeURIComponent(`agent:${agent.title}`)}`}
            queryKey={['history', 'agent', agent.title]}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Sa liberté" icon={<Workflow size={16} />}>
            <div className="grid gap-2 px-4 py-3">
              <Segmented
                label="Autonomie"
                value={agent.data.autonomy ?? 'act_and_report'}
                onChange={(value) => change.mutate({ autonomy: value })}
                options={AUTONOMY.map((one) => ({ value: one.value, label: one.label }))}
              />
              <p className="text-[12.5px] text-bark">
                {
                  AUTONOMY.find((one) => one.value === (agent.data.autonomy ?? 'act_and_report'))
                    ?.lead
                }
                . Ce qu’il lit dehors est une donnée, jamais un ordre : il n’envoie, ne paie ni
                n’efface rien sans toi.
              </p>
            </div>
          </Panel>
          <Panel title="Son budget" icon={<Gauge size={16} />}>
            <div className="grid gap-2.5 px-4 py-3 text-[13px]">
              <p>
                Aujourd’hui : <b>{agent.callsToday}</b>
                {limit !== undefined ? ` / ${limit}` : ''} appel(s)
              </p>
              {limit !== undefined && limit > 0 && (
                <span className="h-2 overflow-hidden rounded-full bg-sand">
                  <span
                    className={
                      'block h-full rounded-full ' +
                      (agent.callsToday >= limit ? 'bg-ochre' : 'bg-success')
                    }
                    style={{ width: `${Math.min(100, (agent.callsToday / limit) * 100)}%` }}
                  />
                </span>
              )}
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const n = Number(budget);
                  if (Number.isInteger(n) && n >= 0)
                    change.mutate({ budget: { calls_per_day: n } });
                }}
              >
                <input
                  type="number"
                  min={0}
                  max={1000}
                  className={inputClass.replace('w-full', 'w-24 flex-none')}
                  value={budget ?? (limit !== undefined ? String(limit) : '')}
                  placeholder="—"
                  onChange={(e) => setBudget(e.target.value)}
                  aria-label="Appels par jour au plus"
                />
                <span className="text-bark">appels par jour au plus</span>
                <Button size="sm" disabled={budget === null || change.isPending}>
                  Garder
                </Button>
              </form>
              <p className="text-xs text-faint">
                Le budget atteint, ses appels attendent le lendemain.
              </p>
            </div>
          </Panel>
          <Panel title="Ses règles" icon={<Workflow size={16} />}>
            {!agent.rules.length ? (
              <p className="px-4 py-4 text-[13px] text-bark">
                {agent.data.builtin?.length
                  ? 'Il fait un travail de Jarvis : aucune règle à lui.'
                  : 'Aucune règle.'}
              </p>
            ) : (
              agent.rules.map((rule) => (
                <div key={rule.id} className={rowClass + ' flex-wrap'}>
                  <span className="min-w-0 flex-1">
                    <Link
                      to="/entree/$id"
                      params={{ id: rule.id }}
                      className="block truncate font-semibold hover:underline"
                    >
                      {rule.title}
                    </Link>
                    <span className="block truncate text-[12.5px] text-bark">
                      {whenText(rule.when, kindName)}
                      {rule.app ? ` · ${rule.app}` : ''}
                    </span>
                    {rule.error && (
                      <span className="block truncate text-[12px] text-error">{rule.error}</span>
                    )}
                  </span>
                  {!rule.active && <Tag tone="neutral">arrêtée</Tag>}
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

const COUNT_WORDS: Record<string, string> = {
  created: 'créée(s)',
  updated: 'mise(s) à jour',
  skipped: 'déjà là',
  problems: 'problème(s)',
};

interface RuleEntry {
  id: string;
  title: string;
  data: {
    when?: Record<string, unknown>;
    then?: Record<string, unknown>[];
    agent?: string;
    app?: string;
    active?: boolean;
    next?: string;
    error?: string;
  };
}
interface MineSkill {
  id: string;
  title: string;
  when: string;
  phrases: string[];
  repeat: string | null;
  saved: string | null;
  excerpt: string;
}

/** What a rule does, in her words. */
function thenText(then: Record<string, unknown>[] | undefined, kindName: (kind: string) => string) {
  return (then ?? [])
    .map((action) => {
      if (action.create)
        return `crée un(e) ${kindName(String((action.create as { kind?: string }).kind ?? '')).toLowerCase()}`;
      if (action.update) return 'change des champs';
      if (action.link) return 'relie';
      if (action.remind)
        return `te rappelle « ${String((action.remind as { text?: string }).text ?? '')} »`;
      if (action.run_script)
        return `lance le script « ${String((action.run_script as { script?: string }).script ?? '')} »`;
      if (action.call)
        return `appelle ${String((action.call as { connection?: string }).connection ?? 'un service')}`;
      return '';
    })
    .filter(Boolean)
    .join(', puis ');
}

/**
 * Everything that runs by itself, in one place (v3 D12): her rules — with their agent or none —
 * and her routines, each with when it runs, what it does, and a way to stop it. And the simplest
 * one made here: « chaque jour à 7 h, rappelle-moi… ».
 */
function Automations() {
  const client = useQueryClient();
  const rules = useQuery({
    queryKey: ['entries', 'rules'],
    queryFn: () => api<RuleEntry[]>('/entries?kind=Rule&limit=200'),
  });
  const skills = useQuery({
    queryKey: ['skills'],
    queryFn: () => api<{ mine?: MineSkill[] }>('/skills'),
  });
  const [time, setTime] = useState('07:00');
  const [text, setText] = useState('');
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['entries', 'rules'] });
    void client.invalidateQueries({ queryKey: ['agents'] });
  };
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api('/save', { method: 'POST', body: { entries: [{ id, data: { active } }] } }),
    onSettled: refresh,
  });
  const make = useMutation({
    mutationFn: () => {
      const [h, m] = time.split(':');
      return api('/save', {
        method: 'POST',
        body: {
          entries: [
            {
              kind: 'Rule',
              title: `Chaque jour à ${time} : ${text}`.slice(0, 120),
              data: {
                when: { schedule: `${Number(m)} ${Number(h)} * * *` },
                then: [{ remind: { text } }],
                agent: 'Veilleur d’échéances',
              },
            },
          ],
        },
      });
    },
    onSuccess: () => {
      setText('');
      toast('Automatisme créé : il apparaît ci-dessous et chez le Veilleur.');
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: refresh,
  });
  if (rules.isLoading) return <Skeleton className="h-40" />;
  const list = (rules.data ?? []).filter((one) => one.data.when);
  const mine = skills.data?.mine ?? [];
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <AgentGroups
        rules={list}
        busy={toggle.isPending}
        onToggle={(id, active) => toggle.mutate({ id, active })}
        refresh={refresh}
      />
      <div className="grid gap-4">
        <Panel title="Chaque jour, à heure fixe" icon={<Gauge size={16} />}>
          <form
            className="grid gap-2 px-4 py-3 text-[13px]"
            onSubmit={(event) => {
              event.preventDefault();
              if (text.trim()) make.mutate();
            }}
          >
            <span className="flex flex-wrap items-center gap-2">
              Chaque jour à
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass.replace('w-full', 'w-auto')}
                aria-label="Heure"
              />
              rappelle-moi :
            </span>
            <input
              className={inputClass}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="« Regarder mes offres du jour »"
              aria-label="Le rappel"
            />
            <span>
              <Button tone="solid" disabled={!text.trim() || make.isPending}>
                Créer
              </Button>
            </span>
            <p className="text-xs text-faint">
              Pour plus (un bilan écrit, une page à ouvrir, une collecte), dis-le à Claude : il crée
              l’automatisme et son agent, visibles ici.
            </p>
          </form>
        </Panel>
        <Panel title="Tes routines" icon={<BookOpen size={16} />}>
          {!mine.length ? (
            <p className="px-4 py-4 text-[13px] text-bark">
              Aucune routine à toi : un bilan du soir, une revue de la semaine… se créent avec
              Claude.
            </p>
          ) : (
            mine.map((one) => (
              <div key={one.id} className={rowClass}>
                <span className="min-w-0 flex-1">
                  <Link
                    to="/entree/$id"
                    params={{ id: one.id }}
                    className="block truncate font-semibold hover:underline"
                  >
                    {one.title}
                  </Link>
                  <span className="block truncate text-[12.5px] text-bark">
                    {one.repeat
                      ? `répétée : ${one.repeat}`
                      : one.phrases.length
                        ? `quand tu dis « ${one.phrases[0]} »`
                        : one.when || 'à la demande'}
                  </span>
                </span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}

/**
 * Automations by agent (v3 D12): each agent — who, its state, its budget, its Pause — then what it
 * runs (its rules, or Jarvis's own work it does). The rules no agent carries yet come last, each
 * given to one in a click: nothing runs without someone answering for it.
 */
function AgentGroups({
  rules,
  onToggle,
  busy,
  refresh,
}: {
  rules: RuleEntry[];
  onToggle: (id: string, active: boolean) => void;
  busy: boolean;
  refresh: () => void;
}) {
  const kindName = useKindName();
  const { data: agents = [], isLoading } = useAgents();
  const pause = usePause();
  const give = useMutation({
    mutationFn: ({ id, agent }: { id: string; agent: string }) =>
      api('/save', { method: 'POST', body: { entries: [{ id, data: { agent } }] } }),
    onSuccess: () => toast('Confié.'),
    onSettled: refresh,
  });
  if (isLoading) return <Skeleton className="h-40" />;
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const of = (agent: Agent) =>
    rules.filter((rule) => rule.data.agent && fold(rule.data.agent) === fold(agent.title));
  const orphans = rules.filter(
    (rule) =>
      !rule.data.agent || !agents.some((agent) => fold(agent.title) === fold(rule.data.agent!)),
  );
  const ruleLine = (rule: RuleEntry, offer?: boolean) => {
    const active = rule.data.active !== false;
    return (
      <div key={rule.id} className={rowClass + ' flex-wrap'}>
        <span className="min-w-0 flex-1">
          <Link
            to="/entree/$id"
            params={{ id: rule.id }}
            className="block truncate font-semibold hover:underline"
          >
            {rule.title}
          </Link>
          <span className="block text-[12.5px] text-bark">
            <b className="font-medium text-ink">{whenText(rule.data.when ?? {}, kindName)}</b> →{' '}
            {thenText(rule.data.then, kindName) || '—'}
            {rule.data.app ? <span className="text-faint"> · {rule.data.app}</span> : null}
          </span>
          {rule.data.error && (
            <span className="block truncate text-[12px] text-error">{rule.data.error}</span>
          )}
        </span>
        {!active && <Tag tone="neutral">arrêté</Tag>}
        {offer && agents.length > 0 && (
          <Select
            label={`Confier « ${rule.title} » à un agent`}
            value=""
            placeholder="Confier à…"
            onChange={(agent) => give.mutate({ id: rule.id, agent })}
            options={agents
              .filter((a) => !a.data.builtin?.length)
              .map((a) => ({ value: a.title, label: a.title }))}
            className="w-44"
          />
        )}
        <Button size="sm" disabled={busy} onClick={() => onToggle(rule.id, !active)}>
          {active ? <Pause size={14} /> : <Play size={14} />}
          {active ? 'Arrêter' : 'Reprendre'}
        </Button>
      </div>
    );
  };
  return (
    <div className="grid gap-4">
      {agents.map((agent) => {
        const state = STATE[agent.state];
        const budget = agent.data.budget?.calls_per_day;
        const mine = of(agent);
        return (
          <Panel
            key={agent.title}
            title={
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={agent.title} size={26} tinted />
                <Link
                  to="/construire/agents/$name"
                  params={{ name: agent.title }}
                  className="truncate hover:underline"
                >
                  {agent.title}
                </Link>
              </span>
            }
            action={
              <span className="flex flex-wrap items-center gap-2">
                <Tag tone={state.tone}>{state.label}</Tag>
                <span className="font-mono text-[11.5px] text-bark">
                  {budget !== undefined
                    ? `${agent.callsToday} / ${budget} appels`
                    : `${agent.callsToday} appel(s)`}{' '}
                  aujourd’hui
                </span>
                <Button
                  size="sm"
                  disabled={pause.isPending}
                  onClick={() => pause.mutate({ title: agent.title, paused: !agent.data.paused })}
                >
                  {agent.data.paused ? <Play size={14} /> : <Pause size={14} />}
                  {agent.data.paused ? 'Reprendre' : 'Pause'}
                </Button>
              </span>
            }
          >
            {agent.data.role && (
              <p className="border-b border-rule px-4 py-2.5 text-[13px] text-bark">
                {agent.data.role}
                <span className="text-faint">
                  {' '}
                  · {WHERE[agent.data.executor ?? 'rule']}
                  {agent.data.service ? ` : ${agent.data.service}` : ''}
                </span>
              </p>
            )}
            {(agent.data.builtin ?? []).map((work) => (
              <div key={work} className={rowClass}>
                <span className="min-w-0 flex-1">
                  <b className="block font-semibold">{BUILTIN_TITLE[work] ?? work}</b>
                  <span className="block text-[12.5px] text-bark">
                    <b className="font-medium text-ink">{BUILTIN_WHEN[work] ?? work}</b> →{' '}
                    {BUILTIN_DOES[work] ?? ''}
                  </span>
                </span>
              </div>
            ))}
            {mine.map((rule) => ruleLine(rule))}
            {!mine.length && !(agent.data.builtin ?? []).length && (
              <p className="px-4 py-3 text-[13px] text-bark">Aucun automatisme confié.</p>
            )}
          </Panel>
        );
      })}
      {orphans.length > 0 && (
        <Panel title="Sans agent : à confier" icon={<Workflow size={16} />}>
          <p className="border-b border-rule px-4 py-2.5 text-[13px] text-bark">
            Ils tournent, mais personne n’en répond : pas de Pause commune, pas de budget, signés «
            règle ». Confie-les à un agent.
          </p>
          {orphans.map((rule) => ruleLine(rule, true))}
        </Panel>
      )}
    </div>
  );
}

/** Where an agent's work runs, in her words. */
const WHERE: Record<string, string> = {
  rule: 'tourne dans Jarvis, sans IA',
  script: 'tourne dans Jarvis (un script)',
  llm: 'un modèle avec ses skills',
  service: 'tourne sur un serveur',
};
const BUILTIN_TITLE: Record<string, string> = { lecture: 'Lire les documents déposés' };
const BUILTIN_DOES: Record<string, string> = {
  lecture:
    'dit ce qu’est le document, en tire les faits, propose la facture, le fournisseur, la garantie',
};
