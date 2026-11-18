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
  Empty,
  PageHead,
  Panel,
  Segmented,
  Skeleton,
  Tabs,
  Tag,
  ago,
  inputClass,
  rowClass,
  type TagTone,
} from '../ui';
import { Journal } from './Activity';

// L'Atelier (v3 D12, D17 « Construire »): who works for her — her agents, each a named setting of
// the one node (its triggers, its executor, its skills, what it reads and writes, how free it is,
// its budget, its Pause) — and the skills they follow, in the Agent Skills format.

export type AtelierTab = 'agents' | 'skills';
export const atelierSearch = (search: Record<string, unknown>): { t?: AtelierTab } =>
  search.t === 'skills' ? { t: 'skills' } : {};

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
  const tab = search.t ?? 'agents';
  return (
    <>
      <PageHead
        title="Atelier"
        lead="Ce qui travaille pour toi, comment, et dans quelles limites."
      />
      <Tabs
        tabs={[
          { key: 'agents', label: 'Agents' },
          { key: 'skills', label: 'Skills' },
        ]}
        value={tab}
        label="Atelier"
        onChange={(key) =>
          void navigate({ to: '/atelier', search: key === 'agents' ? {} : { t: key } })
        }
      />
      {tab === 'agents' ? <AgentsList /> : <SkillsList />}
    </>
  );
}

function AgentsList() {
  const kindName = useKindName();
  const { data, isLoading } = useAgents();
  const pause = usePause();
  if (isLoading) return <Skeleton className="h-40" />;
  if (!data?.length)
    return (
      <Panel>
        <Empty title="Aucun agent" lead="Les apps que tu ajoutes viennent avec leurs agents." />
      </Panel>
    );
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
      {data.map((agent) => {
        const state = STATE[agent.state];
        const budget = agent.data.budget?.calls_per_day;
        return (
          <div
            key={agent.title}
            className="relative flex min-w-0 flex-col gap-3 rounded-[12px] border border-rule bg-paper p-4 hover:border-rule-strong"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Avatar name={agent.title} size={40} tinted />
              <span className="min-w-0 flex-1">
                <Link
                  to="/atelier/agents/$name"
                  params={{ name: agent.title }}
                  className="block truncate font-display text-[16px] font-semibold after:absolute after:inset-0"
                >
                  {agent.title}
                </Link>
                <Tag tone={state.tone}>{state.label}</Tag>
              </span>
            </div>
            {agent.data.role && (
              <p className="line-clamp-3 text-[13px] text-bark">{agent.data.role}</p>
            )}
            <dl className="grid gap-1 text-[12.5px]">
              <div className="grid grid-cols-[minmax(0,96px)_minmax(0,1fr)] gap-2">
                <dt className="text-faint">Quand</dt>
                <dd className="truncate">{triggersOf(agent, kindName).join(' · ') || '—'}</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,96px)_minmax(0,1fr)] gap-2">
                <dt className="text-faint">Aujourd’hui</dt>
                <dd>
                  {budget !== undefined
                    ? `${agent.callsToday} / ${budget} appels`
                    : `${agent.callsToday} appel(s)`}
                  {agent.runs[0]?.started ? ` · dernier passage ${ago(agent.runs[0].started)}` : ''}
                </dd>
              </div>
            </dl>
            <span className="relative z-[1] mt-auto flex gap-2">
              <Button
                size="sm"
                disabled={pause.isPending}
                onClick={() => pause.mutate({ title: agent.title, paused: !agent.data.paused })}
              >
                {agent.data.paused ? <Play size={14} /> : <Pause size={14} />}
                {agent.data.paused ? 'Reprendre' : 'Pause'}
              </Button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface Skill {
  name: string;
  when: string;
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
    queryFn: () => api<{ jarvis?: Skill[] }>('/skills'),
  });
  if (isLoading) return <Skeleton className="h-40" />;
  const skills = data?.jarvis ?? [];
  return (
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
          <span className="min-w-0 flex-1">
            <b className="block truncate font-semibold">{one.name}</b>
            <span className="line-clamp-2 text-[12.5px] text-bark">Quand {one.when}</span>
          </span>
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
  );
}

export function AgentPage() {
  const { name } = useParams({ from: '/atelier/agents/$name' });
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
