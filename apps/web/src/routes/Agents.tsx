import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  Activity as ActivityIcon,
  Brain,
  FlaskConical,
  Gauge,
  Pause,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useKindName, useKinds } from '../lib/kinds';
import {
  Avatar,
  Button,
  Empty,
  PageHead,
  Panel,
  Segmented,
  Sheet,
  Skeleton,
  Tabs,
  Tag,
  ago,
  cn,
  inputClass,
  rowClass,
  type TagTone,
} from '../ui';
import { Select, toast, useConfirm } from '../ui/more';
import { Journal } from './Activity';

// Her agents and their tasks (spec 109). An agent is who works — its instructions, its mind, its
// access, its freedom, its budget, its memory, its Pause — and has no time of its own; each of its
// tasks says when (a plan she sets freely, a save, a message, a phrase) and what (a reminder, or a
// skill: the method, which lives in the Skills tab). A task is tried before it is kept, run now,
// stopped, given to another agent. Her free text is read as task lines; the rest is instructions.

type Autonomy = 'propose' | 'act_and_report' | 'silent';
export interface Agent {
  id: string | null;
  title: string;
  data: {
    role?: string;
    instructions?: string;
    executor?: 'rule' | 'script' | 'llm' | 'service';
    service?: string;
    reads?: string[];
    writes?: string[];
    builtin?: string[];
    autonomy?: Autonomy;
    budget?: { calls_per_day?: number };
    paused?: boolean;
    report?: 'activity' | 'telegram';
  };
  when: string | null;
  memory: { id: string; text: string; at: string }[];
  callsToday: number;
  runs: {
    id: string;
    title: string;
    status: string;
    started: string | null;
    counts: Record<string, number>;
    error: string | null;
  }[];
  state: 'paused' | 'over_budget' | 'failing' | 'working' | 'idle';
}
export interface Plan {
  every: 'day' | 'weekdays' | 'days' | 'month' | 'hours';
  at: string;
  days?: number[];
  monthDay?: number | 'last';
  hours?: number;
}
export interface Task {
  id: string;
  title: string;
  agent: string | null;
  assigned: boolean;
  when: Record<string, unknown> | null;
  then: Record<string, unknown>[];
  active: boolean;
  app: string | null;
  error: string | null;
  skill: string | null;
  plan: Plan | null;
  next: string[];
}
interface Tried {
  result: { matched: boolean };
  changes: { command: string; target: string; after: Record<string, unknown> | null }[];
  next: string[];
}

const STATE: Record<Agent['state'], { label: string; tone: TagTone }> = {
  idle: { label: 'prêt', tone: 'ok' },
  working: { label: 'au travail', tone: 'info' },
  paused: { label: 'en pause', tone: 'neutral' },
  over_budget: { label: 'budget du jour atteint', tone: 'late' },
  failing: { label: 'en échec', tone: 'error' },
};
const MIND: Record<string, string> = {
  rule: 'Jarvis, sans IA',
  script: 'Jarvis, un script',
  llm: 'un modèle, avec ses skills',
  service: 'un serveur',
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
const BUILTIN: Record<string, { title: string; when: string; does: string }> = {
  lecture: {
    title: 'Lire les documents déposés',
    when: 'à chaque fichier déposé',
    does: 'dit ce qu’est le document, en tire les faits, propose la facture, le fournisseur, la garantie',
  },
  brief: {
    title: 'Le brief du matin',
    when: 'chaque matin, à l’heure choisie',
    does: 'te dit ta journée sur tes canaux',
  },
  rappels: {
    title: 'Les rappels',
    when: 'à l’heure de chaque rappel',
    does: 'te dit chaque rappel sur tes canaux, reprogramme ceux qui se répètent',
  },
};
const DAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const PERIODS = [
  { value: 'day', label: 'le jour' },
  { value: 'week', label: 'la semaine' },
  { value: 'month', label: 'le mois' },
  { value: 'year', label: 'l’année' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

/** « 08:00 » → « 8 h », « 07:30 » → « 7 h 30 ». */
const hour = (at: string) => {
  const [h, m] = at.split(':');
  return `${Number(h)} h${m && m !== '00' ? ` ${m}` : ''}`;
};

/** A plan in her words: « chaque vendredi à 18 h ». */
export function planText(plan: Plan): string {
  switch (plan.every) {
    case 'day':
      return `chaque jour à ${hour(plan.at)}`;
    case 'weekdays':
      return `en semaine à ${hour(plan.at)}`;
    case 'days': {
      const days = WEEK_ORDER.filter((one) => plan.days?.includes(one)).map(
        (one) => DAY_NAMES[one],
      );
      return `chaque ${days.join(' et ')} à ${hour(plan.at)}`;
    }
    case 'month':
      return plan.monthDay === 'last'
        ? `le dernier jour du mois à ${hour(plan.at)}`
        : `le ${plan.monthDay === 1 ? '1er' : (plan.monthDay ?? 1)} de chaque mois à ${hour(plan.at)}`;
    case 'hours':
      return `toutes les ${plan.hours ?? 1} h`;
  }
}

/** A plan as the watcher reads it (the same five fields as the core's `scheduleOf`). */
export function scheduleOf(plan: Plan): string {
  const [h, m] = plan.at.split(':').map(Number);
  switch (plan.every) {
    case 'day':
      return `${m} ${h} * * *`;
    case 'weekdays':
      return `${m} ${h} * * 1-5`;
    case 'days':
      return `${m} ${h} * * ${[...(plan.days ?? [])].sort((a, b) => a - b).join(',')}`;
    case 'month':
      return `${m} ${h} ${plan.monthDay === 'last' ? 'L' : (plan.monthDay ?? 1)} * *`;
    case 'hours':
      return `${m} */${plan.hours ?? 1} * * *`;
  }
}

/** A task's « when » in her words: its plan, or its event. */
export function whenText(
  when: Record<string, unknown> | null,
  plan: Plan | null,
  kindName: (kind: string) => string,
): string {
  if (plan) return planText(plan);
  if (!when) return 'à la demande';
  if (typeof when.schedule === 'string') return `selon « ${when.schedule} »`;
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
  if (typeof when.phrase === 'string') return `quand tu dis « ${when.phrase} »`;
  const message = when.message as { contains?: string } | undefined;
  if (message)
    return message.contains
      ? `à chaque message qui dit « ${message.contains} »`
      : 'à chaque message reçu';
  return 'à la demande';
}

/** What a task does, in her words. */
function whatText(task: Pick<Task, 'then' | 'skill'>, kindName: (kind: string) => string) {
  if (task.skill) return `fait « ${task.skill} »`;
  return task.then
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

const when = (iso: string) =>
  new Date(iso).toLocaleString('fr', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export function useAgents() {
  return useQuery({ queryKey: ['agents'], queryFn: () => api<Agent[]>('/agents') });
}
export function useTasks() {
  return useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
}
function useRefresh() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['tasks'] });
    void client.invalidateQueries({ queryKey: ['agents'] });
    void client.invalidateQueries({ queryKey: ['entries'] });
    void client.invalidateQueries({ queryKey: ['history'] });
  };
}
function usePause() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ title, paused }: { title: string; paused: boolean }) =>
      api(`/agents/${encodeURIComponent(title)}`, { method: 'PATCH', body: { paused } }),
    onSettled: refresh,
  });
}

// ——— The list of her agents ———

/** Every agent on one line: its state, its next work, how many tasks, its Pause; and a new one. */
export function AgentsList() {
  const { data: agents = [], isLoading } = useAgents();
  const { data: tasks = [] } = useTasks();
  const pause = usePause();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const make = useMutation({
    mutationFn: () =>
      api<{ title: string }>('/agents', {
        method: 'POST',
        body: { title: title.trim(), ...(role.trim() ? { role: role.trim() } : {}) },
      }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: (made) => {
      refresh();
      void navigate({ to: '/construire/agents/$name', params: { name: made.title } });
    },
  });
  if (isLoading) return <Skeleton className="h-40" />;
  const nextOf = (agent: Agent) => {
    const mine = tasks.filter((one) => one.agent === agent.title && one.next[0]);
    const first = mine.sort((a, b) => a.next[0]!.localeCompare(b.next[0]!))[0];
    if (first) return `prochaine fois : ${when(first.next[0]!)} · ${first.title}`;
    if (agent.when) return agent.when;
    const builtin = agent.data.builtin?.[0];
    return builtin ? (BUILTIN[builtin]?.when ?? '') : 'aucune tâche à heure fixe';
  };
  return (
    <div className="grid gap-4">
      <Panel
        title="Tes agents"
        icon={<Workflow size={16} />}
        action={
          <Button size="sm" onClick={() => setNaming(true)}>
            <Plus size={14} />
            Nouvel agent
          </Button>
        }
      >
        {naming && (
          <form
            className="grid gap-2 border-b border-rule bg-sand px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim()) make.mutate();
            }}
          >
            <input
              autoFocus
              aria-label="Nom de l’agent"
              placeholder="Bilans, Veille, Maison…"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
            <input
              aria-label="Son rôle"
              placeholder="Ce qu’il fait pour toi, en une phrase"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={inputClass}
            />
            <span className="flex gap-2">
              <Button tone="solid" disabled={!title.trim() || make.isPending}>
                Créer
              </Button>
              <Button type="button" tone="quiet" onClick={() => setNaming(false)}>
                Annuler
              </Button>
            </span>
          </form>
        )}
        {agents.map((agent) => {
          const state = STATE[agent.state];
          const count = tasks.filter((one) => one.agent === agent.title).length;
          const builtin = agent.data.builtin?.length ?? 0;
          return (
            <div key={agent.title} className={cn(rowClass, 'flex-wrap')}>
              <Avatar name={agent.title} size={30} tinted />
              <Link
                to="/construire/agents/$name"
                params={{ name: agent.title }}
                className="min-w-0 flex-1"
              >
                <b className="block truncate font-semibold hover:underline">{agent.title}</b>
                <span className="block truncate text-[12.5px] text-bark">{nextOf(agent)}</span>
              </Link>
              <span className="font-mono text-[11.5px] text-bark">
                {count + builtin} tâche{count + builtin > 1 ? 's' : ''}
              </span>
              <Tag tone={state.tone}>{state.label}</Tag>
              <Button
                size="sm"
                disabled={pause.isPending}
                aria-label={`${agent.data.paused ? 'Reprendre' : 'Mettre en pause'} « ${agent.title} »`}
                onClick={() => pause.mutate({ title: agent.title, paused: !agent.data.paused })}
              >
                {agent.data.paused ? <Play size={14} /> : <Pause size={14} />}
                {agent.data.paused ? 'Reprendre' : 'Pause'}
              </Button>
            </div>
          );
        })}
      </Panel>
      <p className="text-[12.5px] text-bark">
        Un agent n’a pas d’heure : chacune de ses tâches a la sienne. Sa méthode, quand elle demande
        de réfléchir, est un skill (onglet Skills).
      </p>
    </div>
  );
}

// ——— A task: made, tried, kept ———

interface Draft {
  plan?: Plan;
  skill?: string;
  text?: string;
}

/**
 * « Nouvelle tâche » (spec 109): a sentence she completes — when (a plan set freely, or an event),
 * what (a reminder, or a skill over its period) — tried before it is kept.
 */
export function TaskEditor({
  agent,
  task,
  draft,
  open,
  onOpenChange,
  onSaved,
}: {
  agent: string;
  task?: Task | null;
  draft?: Draft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const kindName = useKindName();
  const { data: kinds = [] } = useKinds();
  const refresh = useRefresh();
  const skills = useQuery({
    queryKey: ['skills'],
    queryFn: () => api<{ mine?: { id: string; title: string }[] }>('/skills'),
    enabled: open,
  });
  const [mode, setMode] = useState<'plan' | 'event'>('plan');
  const [plan, setPlan] = useState<Plan>({ every: 'days', at: '18:00', days: [5] });
  const [event, setEvent] = useState<'saved' | 'message' | 'phrase'>('saved');
  const [eventValue, setEventValue] = useState('');
  const [what, setWhat] = useState<'remind' | 'skill'>('remind');
  const [text, setText] = useState('');
  const [skill, setSkill] = useState('');
  const [period, setPeriod] = useState<Period>('week');
  const [title, setTitle] = useState('');
  const [tried, setTried] = useState<Tried | null>(null);
  useEffect(() => {
    if (!open) return;
    setTried(null);
    const when = task?.when ?? null;
    const known = task?.plan ?? draft?.plan ?? null;
    if (when && !task?.plan) {
      setMode('event');
      if (typeof when.saved === 'string') {
        setEvent('saved');
        setEventValue(when.saved);
      } else if (typeof when.phrase === 'string') {
        setEvent('phrase');
        setEventValue(when.phrase);
      } else if (when.message) {
        setEvent('message');
        setEventValue(String((when.message as { contains?: string }).contains ?? ''));
      }
    } else {
      setMode('plan');
      setPlan(known ?? { every: 'days', at: '18:00', days: [5] });
    }
    const named = task?.skill ?? draft?.skill ?? '';
    setWhat(named ? 'skill' : 'remind');
    setSkill(named);
    const remind = task?.then.find((one) => one.remind)?.remind as { text?: string } | undefined;
    setText(task?.skill ? '' : (remind?.text ?? draft?.text ?? ''));
    setTitle(task?.title ?? '');
  }, [open, task, draft]);
  const whenData = (): Record<string, unknown> =>
    mode === 'plan'
      ? { schedule: scheduleOf(plan) }
      : event === 'saved'
        ? { saved: eventValue }
        : event === 'phrase'
          ? { phrase: eventValue.startsWith('/') ? eventValue : `/${eventValue}` }
          : { message: eventValue ? { contains: eventValue } : {} };
  const build = async () => {
    if (mode === 'plan' && plan.every === 'days' && !plan.days?.length)
      throw new Error('Choisis au moins un jour.');
    if (mode === 'event' && event !== 'message' && !eventValue.trim())
      throw new Error(event === 'saved' ? 'Choisis le type d’entrée.' : 'Écris la phrase.');
    if (what === 'remind' && !text.trim()) throw new Error('Écris le rappel.');
    if (what === 'skill' && !skill) throw new Error('Choisis le skill.');
    const then =
      what === 'skill'
        ? (
            await api<{ then: Record<string, unknown>[] }>('/tasks/skill', {
              method: 'POST',
              body: { skill, period },
            })
          ).then
        : [{ remind: { text: text.trim() } }];
    return { when: whenData(), then, agent };
  };
  const tryIt = useMutation({
    mutationFn: async () =>
      api<Tried>('/tasks/try', { method: 'POST', body: { data: await build() } }),
    onSuccess: setTried,
    onError: (error) => toast((error as Error).message, 'error'),
  });
  const keep = useMutation({
    mutationFn: async () => {
      const data = await build();
      const name = title.trim() || (what === 'skill' ? skill : text.trim()).slice(0, 120);
      return api('/save', {
        method: 'POST',
        body: {
          entries: [
            task
              ? { id: task.id, title: name, data: { ...data, active: true } }
              : { kind: 'Rule', title: name, data },
          ],
        },
      });
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: () => {
      toast(task ? 'Tâche modifiée.' : 'Tâche créée.');
      refresh();
      onSaved?.();
      onOpenChange(false);
    },
  });
  const sentence = `${
    mode === 'plan' ? planText(plan) : whenText(whenData(), null, kindName)
  }, ${agent} ${
    what === 'skill'
      ? skill
        ? `fait « ${skill} » sur ${PERIODS.find((one) => one.value === period)!.label}`
        : 'suit un skill…'
      : text.trim()
        ? `te rappelle « ${text.trim()} »`
        : 'te rappelle…'
  }.`;
  const changeText = (change: Tried['changes'][number]) => {
    const after = change.after as {
      kind?: string;
      title?: string;
      data?: { text?: string };
    } | null;
    if (after?.kind === 'Reminder' || after?.kind === 'Rappel')
      return `un rappel : « ${after.data?.text ?? after.title ?? ''} »`;
    return after?.kind
      ? `${change.command === 'update' ? 'change' : 'crée'} ${kindName(after.kind).toLowerCase()} « ${after.title ?? ''} »`
      : change.command;
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={task ? 'Modifier la tâche' : 'Nouvelle tâche'}
      wide
    >
      <div className="grid gap-4 p-4">
        <p className="rounded-[2px] border border-rule bg-sand px-3 py-2 text-[15px] leading-relaxed">
          {sentence.charAt(0).toUpperCase() + sentence.slice(1)}
        </p>
        <section className="grid gap-2" aria-label="Quand">
          <b className="text-[13px] text-bark">Quand</b>
          <Segmented
            label="Quand"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'plan', label: 'À heure fixe' },
              { value: 'event', label: 'À un événement' },
            ]}
          />
          {mode === 'plan' ? (
            <div className="grid gap-2">
              <Segmented
                label="Fréquence"
                value={plan.every}
                onChange={(every) =>
                  setPlan({
                    ...plan,
                    every,
                    ...(every === 'days' && !plan.days?.length ? { days: [5] } : {}),
                    ...(every === 'month' && !plan.monthDay ? { monthDay: 1 } : {}),
                    ...(every === 'hours' && !plan.hours ? { hours: 2 } : {}),
                  })
                }
                options={[
                  { value: 'day', label: 'Chaque jour' },
                  { value: 'weekdays', label: 'En semaine' },
                  { value: 'days', label: 'Certains jours' },
                  { value: 'month', label: 'Chaque mois' },
                  { value: 'hours', label: 'Toutes les N heures' },
                ]}
              />
              {plan.every === 'days' && (
                <span role="group" aria-label="Les jours" className="flex flex-wrap gap-1.5">
                  {WEEK_ORDER.map((day) => {
                    const on = plan.days?.includes(day) ?? false;
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        aria-label={DAY_NAMES[day]}
                        onClick={() =>
                          setPlan({
                            ...plan,
                            days: on
                              ? (plan.days ?? []).filter((one) => one !== day)
                              : [...(plan.days ?? []), day],
                          })
                        }
                        className={cn(
                          'h-8 w-8 cursor-pointer rounded-[2px] border border-rule text-[13px] font-semibold',
                          on ? 'bg-ink text-paper' : 'bg-paper',
                        )}
                      >
                        {DAY_SHORT[day]}
                      </button>
                    );
                  })}
                </span>
              )}
              <span className="flex flex-wrap items-center gap-2 text-[13px]">
                {plan.every === 'month' && (
                  <Select
                    label="Le jour du mois"
                    value={String(plan.monthDay ?? 1)}
                    onChange={(value) =>
                      setPlan({ ...plan, monthDay: value === 'last' ? 'last' : Number(value) })
                    }
                    options={[
                      ...Array.from({ length: 28 }, (_, at) => ({
                        value: String(at + 1),
                        label: `le ${at === 0 ? '1er' : at + 1}`,
                      })),
                      { value: 'last', label: 'le dernier jour' },
                    ]}
                    className="w-40"
                  />
                )}
                {plan.every === 'hours' ? (
                  <Select
                    label="Toutes les"
                    value={String(plan.hours ?? 2)}
                    onChange={(value) => setPlan({ ...plan, hours: Number(value) })}
                    options={[1, 2, 3, 4, 6, 8, 12].map((n) => ({
                      value: String(n),
                      label: `${n} h`,
                    }))}
                    className="w-28"
                  />
                ) : (
                  <>
                    à
                    <input
                      type="time"
                      aria-label="Heure"
                      value={plan.at}
                      onChange={(event) => setPlan({ ...plan, at: event.target.value || '09:00' })}
                      className={inputClass.replace('w-full', 'w-auto')}
                    />
                  </>
                )}
              </span>
            </div>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <Select
                label="L’événement"
                value={event}
                onChange={(value) => {
                  setEvent(value);
                  setEventValue('');
                }}
                options={[
                  { value: 'saved', label: 'Quand j’enregistre un(e)…' },
                  { value: 'message', label: 'Quand un message dit…' },
                  { value: 'phrase', label: 'Quand je dis la phrase…' },
                ]}
                className="w-64"
              />
              {event === 'saved' ? (
                <Select
                  label="Le type d’entrée"
                  value={eventValue}
                  placeholder="Choisir"
                  onChange={setEventValue}
                  options={kinds
                    .filter((one) => one.model)
                    .map((one) => ({ value: one.kind, label: kindName(one.kind) }))}
                  className="w-56"
                />
              ) : (
                <input
                  aria-label={event === 'phrase' ? 'La phrase' : 'Les mots du message'}
                  placeholder={event === 'phrase' ? '/bilan' : 'URGENT'}
                  value={eventValue}
                  onChange={(e) => setEventValue(e.target.value)}
                  className={inputClass.replace('w-full', 'w-56')}
                />
              )}
            </span>
          )}
        </section>
        <section className="grid gap-2" aria-label="Quoi">
          <b className="text-[13px] text-bark">Quoi</b>
          <Segmented
            label="Quoi"
            value={what}
            onChange={setWhat}
            options={[
              { value: 'remind', label: 'Me rappeler' },
              { value: 'skill', label: 'Suivre un skill' },
            ]}
          />
          {what === 'remind' ? (
            <input
              aria-label="Le rappel"
              placeholder="Regarder mes offres du jour"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={inputClass}
            />
          ) : (
            <span className="flex flex-wrap items-center gap-2 text-[13px]">
              <Select
                label="Le skill"
                value={skill}
                placeholder="Choisir un skill"
                onChange={setSkill}
                options={(skills.data?.mine ?? []).map((one) => ({
                  value: one.title,
                  label: one.title,
                }))}
                className="w-56"
              />
              sur
              <Select
                label="La période"
                value={period}
                onChange={setPeriod}
                options={PERIODS.map((one) => ({ value: one.value, label: one.label }))}
                className="w-36"
              />
            </span>
          )}
          {what === 'skill' && (
            <p className="text-[12px] text-bark">
              À l’heure dite, Jarvis prépare le travail (un bilan à rédiger sur la période) et te
              prévient ; ton assistant le rédige quand tu le lui demandes.
            </p>
          )}
        </section>
        <label className="grid gap-1 text-[13px]">
          <span className="text-bark">Nom de la tâche (facultatif)</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
        </label>
        <span className="flex flex-wrap gap-2">
          <Button onClick={() => tryIt.mutate()} disabled={tryIt.isPending}>
            <FlaskConical size={15} />
            Essai à blanc
          </Button>
          <Button tone="solid" onClick={() => keep.mutate()} disabled={keep.isPending}>
            {task ? 'Enregistrer' : 'Créer la tâche'}
          </Button>
        </span>
        {tried && (
          <section
            aria-label="Essai à blanc"
            className="grid gap-1.5 rounded-[2px] border border-rule bg-paper p-3 text-[13px]"
          >
            <b className="flex items-center gap-2">
              <FlaskConical size={15} />
              Essai à blanc — rien n’a été écrit
            </b>
            {tried.changes.length ? (
              <ul className="grid gap-1">
                {tried.changes.map((one, at) => (
                  <li key={at}>· {changeText(one)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-bark">Maintenant, elle ne changerait rien.</p>
            )}
            {tried.next.length > 0 && (
              <p className="text-bark">Prochaines fois : {tried.next.map(when).join(' · ')}</p>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}

// ——— An agent's page: Tâches, Fil, Réglages ———

type AgentTab = 'tasks' | 'thread' | 'settings';

export function AgentPage() {
  const { name } = useParams({ from: '/construire/agents/$name' });
  const kindName = useKindName();
  const { data: agents, isLoading } = useAgents();
  const { data: tasks = [] } = useTasks();
  const pause = usePause();
  const refresh = useRefresh();
  const confirm = useConfirm();
  const [tab, setTab] = useState<AgentTab>('tasks');
  const [editing, setEditing] = useState<{ task?: Task | null; draft?: Draft | null } | null>(null);
  const [triedOf, setTriedOf] = useState<{ id: string; tried: Tried } | null>(null);
  const agent = agents?.find((one) => one.title === name);
  const mine = tasks.filter((one) => one.agent === name);
  const save = (id: string, data: Record<string, unknown>) =>
    api('/save', { method: 'POST', body: { entries: [{ id, data }] } });
  const toggle = useMutation({
    mutationFn: (task: Task) => save(task.id, { active: !task.active }),
    onSettled: refresh,
  });
  const give = useMutation({
    mutationFn: ({ task, to }: { task: Task; to: string }) => save(task.id, { agent: to }),
    onSuccess: (_, { to }) => toast(`Confiée à ${to}.`),
    onSettled: refresh,
  });
  const run = useMutation({
    mutationFn: (task: Task) =>
      api<{ ran: boolean }>(`/tasks/${task.id}/run`, { method: 'POST', body: {} }),
    onSuccess: (done) => toast(done.ran ? 'Lancée : voir son fil.' : 'Rien à faire maintenant.'),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: refresh,
  });
  const tryOne = useMutation({
    mutationFn: async (task: Task) => ({
      id: task.id,
      tried: await api<Tried>('/tasks/try', {
        method: 'POST',
        body: { data: { when: task.when, then: task.then, agent: name } },
      }),
    }),
    onSuccess: setTriedOf,
    onError: (error) => toast((error as Error).message, 'error'),
  });
  const remove = useMutation({
    mutationFn: (task: Task) => api(`/entries/${task.id}/archive`, { method: 'POST', body: {} }),
    onSuccess: () => toast('Tâche retirée. L’Activité la rend d’un geste.'),
    onSettled: refresh,
  });
  if (isLoading) return <Skeleton className="h-40" />;
  if (!agent) return <PageHead title="Introuvable" lead="Aucun agent de ce nom dans cet espace." />;
  const state = STATE[agent.state];
  return (
    <>
      <PageHead
        icon={<Avatar name={agent.title} size={40} tinted />}
        title={agent.title}
        lead={
          <span className="flex flex-wrap items-center gap-1.5">
            <Tag tone={state.tone}>{state.label}</Tag>
            <span>
              Cerveau : {MIND[agent.data.executor ?? 'rule']}
              {agent.data.service ? ` (${agent.data.service})` : ''}
            </span>
            {agent.data.role && <span className="text-bark">· {agent.data.role}</span>}
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
      <Tabs
        label="Cet agent"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'tasks', label: 'Tâches' },
          { key: 'thread', label: 'Fil' },
          { key: 'settings', label: 'Réglages' },
        ]}
      />
      {tab === 'tasks' && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel
            title="Ses tâches"
            icon={<Zap size={16} />}
            action={
              <Button size="sm" onClick={() => setEditing({})}>
                <Plus size={14} />
                Nouvelle tâche
              </Button>
            }
          >
            {(agent.data.builtin ?? []).map((work) => (
              <div key={work} className={rowClass}>
                <span className="min-w-0 flex-1">
                  <b className="block font-semibold">{BUILTIN[work]?.title ?? work}</b>
                  <span className="block text-[12.5px] text-bark">
                    <b className="font-medium text-ink">{agent.when ?? BUILTIN[work]?.when}</b> →{' '}
                    {BUILTIN[work]?.does}
                  </span>
                </span>
                <Tag tone="plain" dot={false}>
                  de Jarvis
                </Tag>
              </div>
            ))}
            {mine.map((task) => (
              <div key={task.id} className="border-b border-rule last:border-b-0">
                <div className={cn(rowClass, 'flex-wrap border-0')}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={task.active}
                    aria-label={`${task.active ? 'Arrêter' : 'Reprendre'} « ${task.title} »`}
                    onClick={() => toggle.mutate(task)}
                    className={cn(
                      'relative h-5 w-9 flex-none cursor-pointer rounded-full transition-colors',
                      task.active ? 'bg-ink' : 'bg-rule-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-all',
                        task.active ? 'left-[18px]' : 'left-0.5',
                      )}
                    />
                  </button>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-semibold">{task.title}</b>
                    <span className="block text-[12.5px] text-bark">
                      <b className="font-medium text-ink">
                        {whenText(task.when, task.plan, kindName)}
                      </b>{' '}
                      → {whatText(task, kindName) || '—'}
                    </span>
                    <span className="block text-[12px] text-faint">
                      {!task.active
                        ? 'arrêtée'
                        : task.next[0]
                          ? `prochaine fois : ${when(task.next[0])}`
                          : ''}
                      {task.error ? <span className="text-error"> · {task.error}</span> : null}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      tone="quiet"
                      aria-label={`Essai à blanc de « ${task.title} »`}
                      onClick={() => tryOne.mutate(task)}
                    >
                      <FlaskConical size={14} />
                    </Button>
                    <Button
                      size="sm"
                      tone="quiet"
                      aria-label={`Lancer « ${task.title} » maintenant`}
                      onClick={() => run.mutate(task)}
                    >
                      <Play size={14} />
                    </Button>
                    <Button
                      size="sm"
                      tone="quiet"
                      aria-label={`Modifier « ${task.title} »`}
                      onClick={() => setEditing({ task })}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      tone="quiet"
                      aria-label={`Retirer « ${task.title} »`}
                      onClick={() =>
                        confirm.ask({
                          title: `Retirer « ${task.title} » ?`,
                          lead: 'Elle ne s’exécutera plus. L’Activité la rend d’un geste.',
                          yes: 'Retirer',
                          danger: true,
                          then: () => remove.mutate(task),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                    {(agents ?? []).length > 1 && (
                      <Select
                        label={`Confier « ${task.title} » à un autre agent`}
                        value=""
                        placeholder="Confier à…"
                        onChange={(to) => give.mutate({ task, to })}
                        options={(agents ?? [])
                          .filter((one) => one.title !== name && !one.data.builtin?.length)
                          .map((one) => ({ value: one.title, label: one.title }))}
                        className="w-36"
                      />
                    )}
                  </span>
                </div>
                {triedOf?.id === task.id && (
                  <div className="mx-4 mb-3 rounded-[2px] border border-rule bg-sand px-3 py-2 text-[12.5px]">
                    <b>Essai à blanc — rien n’a été écrit.</b>{' '}
                    {triedOf.tried.changes.length
                      ? `Elle ferait ${triedOf.tried.changes.length} changement(s) maintenant.`
                      : 'Maintenant, elle ne changerait rien.'}
                    {triedOf.tried.next.length > 0 &&
                      ` Prochaines fois : ${triedOf.tried.next.map(when).join(' · ')}.`}
                  </div>
                )}
              </div>
            ))}
            {!mine.length && !(agent.data.builtin ?? []).length && (
              <Empty
                title="Aucune tâche"
                lead="Crée sa première tâche, ou écris tes consignes : Jarvis en tire les tâches."
              />
            )}
          </Panel>
          <Instructions agent={agent} onDraft={(draft) => setEditing({ draft })} />
        </div>
      )}
      {tab === 'thread' && <Thread agent={agent} />}
      {tab === 'settings' && <AgentSettings agent={agent} />}
      <TaskEditor
        agent={agent.title}
        task={editing?.task ?? null}
        draft={editing?.draft ?? null}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      {confirm.node}
    </>
  );
}

/** Her instructions, in her words: kept for all its tasks, and read as task lines when she asks. */
function Instructions({ agent, onDraft }: { agent: Agent; onDraft: (draft: Draft) => void }) {
  const refresh = useRefresh();
  const [text, setText] = useState(agent.data.instructions ?? '');
  const [read, setRead] = useState<{
    tasks: { plan: Plan; what: string; skill: string | null; sentence: string }[];
    instructions: string;
  } | null>(null);
  const keep = useMutation({
    mutationFn: (instructions: string) =>
      api(`/agents/${encodeURIComponent(agent.title)}`, {
        method: 'PATCH',
        body: { instructions },
      }),
    onSuccess: () => toast('Consignes gardées.'),
    onSettled: refresh,
  });
  const draw = useMutation({
    mutationFn: () =>
      api<NonNullable<typeof read>>('/tasks/from-text', { method: 'POST', body: { text } }),
    onSuccess: (got) => {
      setRead(got);
      if (!got.tasks.length)
        toast('Aucun moment lu : écris par exemple « chaque vendredi à 18 h… ».');
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  return (
    <Panel title="Ses consignes" icon={<Pencil size={16} />}>
      <div className="grid gap-2 px-4 py-3">
        <textarea
          aria-label="Ses consignes"
          className={inputClass + ' h-auto min-h-28 py-2'}
          placeholder="Chaque vendredi à 18 h, fais-moi le bilan de la semaine. Mets toujours mes dépenses en premier."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <span className="flex flex-wrap gap-2">
          <Button size="sm" disabled={keep.isPending} onClick={() => keep.mutate(text.trim())}>
            Garder
          </Button>
          <Button size="sm" disabled={!text.trim() || draw.isPending} onClick={() => draw.mutate()}>
            <Zap size={14} />
            Tirer les tâches
          </Button>
        </span>
        <p className="text-[12px] text-bark">
          Chaque phrase qui dit un moment devient une tâche à confirmer ; le reste reste ses
          consignes, relues à chaque travail. La méthode d’un skill l’emporte sur elles.
        </p>
        {read && read.tasks.length > 0 && (
          <ul className="grid gap-1.5" aria-label="Tâches lues">
            {read.tasks.map((one, at) => (
              <li
                key={at}
                className="flex items-center gap-2 rounded-[2px] border border-rule bg-sand px-2.5 py-1.5 text-[13px]"
              >
                <span className="min-w-0 flex-1">
                  <b className="font-medium">{planText(one.plan)}</b> →{' '}
                  {one.skill ? `« ${one.skill} »` : one.what}
                </span>
                <Button
                  size="sm"
                  aria-label={`Ajouter la tâche « ${one.sentence} »`}
                  onClick={() =>
                    onDraft({
                      plan: one.plan,
                      ...(one.skill ? { skill: one.skill } : { text: one.what }),
                    })
                  }
                >
                  <Plus size={14} />
                  Ajouter
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

const COUNT_WORDS: Record<string, string> = {
  created: 'créée(s)',
  updated: 'mise(s) à jour',
  skipped: 'déjà là',
  problems: 'problème(s)',
};

/** What it did, when, with what result: its runs, then its journal. */
function Thread({ agent }: { agent: Agent }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title="Ses passages" icon={<ActivityIcon size={16} />}>
        {!agent.runs.length ? (
          <p className="px-4 py-5 text-[13px] text-bark">
            Pas encore de passage. Ce qu’il fait s’écrit aussi dans son journal.
          </p>
        ) : (
          agent.runs.map((one) => {
            const counts = Object.entries(one.counts).filter(([, n]) => n > 0);
            return (
              <div key={one.id} className={rowClass + ' flex-wrap'}>
                <Tag
                  tone={one.status === 'done' ? 'ok' : one.status === 'failed' ? 'error' : 'info'}
                >
                  {one.status === 'done' ? 'fait' : one.status === 'failed' ? 'échec' : 'en cours'}
                </Tag>
                <span className="min-w-0 flex-1">
                  <Link
                    to="/entree/$id"
                    params={{ id: one.id }}
                    className="block truncate font-semibold hover:underline"
                  >
                    {one.title}
                  </Link>
                  <span className="block truncate text-[12.5px] text-bark">
                    {counts.length
                      ? counts.map(([key, n]) => `${n} ${COUNT_WORDS[key] ?? key}`).join(' · ')
                      : 'rien de nouveau'}
                    {one.error ? ` · ${one.error}` : ''}
                  </span>
                </span>
                {one.started && (
                  <time className="flex-none font-mono text-xs text-bark">{ago(one.started)}</time>
                )}
              </div>
            );
          })
        )}
      </Panel>
      <Journal
        title="Son journal"
        query={`limit=20&client=${encodeURIComponent(`agent:${agent.title}`)}`}
        queryKey={['history', 'agent', agent.title]}
      />
    </div>
  );
}

/** Its mind, its access, its freedom, its report, its memory, its budget. */
function AgentSettings({ agent }: { agent: Agent }) {
  const kindName = useKindName();
  const refresh = useRefresh();
  const [budget, setBudget] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const change = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api(`/agents/${encodeURIComponent(agent.title)}`, { method: 'PATCH', body: patch }),
    onSettled: () => {
      setBudget(null);
      refresh();
    },
  });
  const keepNote = useMutation({
    mutationFn: (text: string) =>
      api(`/agents/${encodeURIComponent(agent.title)}/memory`, { method: 'POST', body: { text } }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: () => setNote(''),
    onSettled: refresh,
  });
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
      'tout ce que ses tâches demandent'
    );
  const line = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] items-baseline gap-3 border-b border-rule px-4 py-2.5 last:border-0">
      <dt className="text-[13px] text-bark">{label}</dt>
      <dd className="min-w-0 text-[13.5px]">{value}</dd>
    </div>
  );
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="grid gap-4">
        <Panel title="Comment il travaille" icon={<Settings2 size={16} />}>
          <dl>
            {line(
              'Cerveau',
              `${MIND[agent.data.executor ?? 'rule']}${agent.data.service ? ` (${agent.data.service})` : ''}`,
            )}
            {line('Lit', kinds(agent.data.reads))}
            {line('Écrit', kinds(agent.data.writes))}
          </dl>
          <p className="px-4 py-2.5 text-[12px] text-bark">
            Bientôt : lui donner Claude (avec une clé) ou un serveur à toi, pour qu’il fasse seul le
            travail de ses skills à l’heure dite.
          </p>
        </Panel>
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
            <Segmented
              label="Compte rendu"
              value={agent.data.report ?? 'activity'}
              onChange={(value) => change.mutate({ report: value })}
              options={[
                { value: 'activity', label: 'Activité' },
                { value: 'telegram', label: 'Activité et Telegram' },
              ]}
            />
          </div>
        </Panel>
      </div>
      <div className="grid gap-4">
        <Panel title="Sa mémoire" icon={<Brain size={16} />}>
          <form
            className="grid gap-2 border-b border-rule px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (note.trim()) keepNote.mutate(note.trim());
            }}
          >
            <textarea
              aria-label="Une note pour sa mémoire"
              className={inputClass + ' h-auto min-h-16 py-2'}
              placeholder="Ce qu’il doit retenir pour la suite"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <span>
              <Button size="sm" disabled={!note.trim() || keepNote.isPending}>
                Garder
              </Button>
            </span>
          </form>
          {agent.memory.length ? (
            <ul className="max-h-72 overflow-y-auto">
              {agent.memory.map((one) => (
                <li key={one.id} className={rowClass + ' items-baseline'}>
                  <span className="min-w-0 flex-1 text-[13.5px] break-words">{one.text}</span>
                  <time className="flex-none font-mono text-xs text-bark">{ago(one.at)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[13px] text-bark">Rien encore.</p>
          )}
        </Panel>
        <Panel title="Son budget" icon={<Gauge size={16} />}>
          <div className="grid gap-2.5 px-4 py-3 text-[13px]">
            <p>
              Aujourd’hui : <b>{agent.callsToday}</b>
              {limit !== undefined ? ` / ${limit}` : ''} appel(s)
            </p>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const n = Number(budget);
                if (Number.isInteger(n) && n >= 0) change.mutate({ budget: { calls_per_day: n } });
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
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** A schedule read back as a plan (as the core's `planOfSchedule`); null when it says more. */
export function planOfSchedule(schedule: string): Plan | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, month, dow] = parts as [string, string, string, string, string];
  if (!/^\d+$/.test(m) || month !== '*') return null;
  const at = (hours: string) => `${hours.padStart(2, '0')}:${m.padStart(2, '0')}`;
  const every = /^\*\/(\d+)$/.exec(h);
  if (every && dom === '*' && dow === '*')
    return { every: 'hours', at: at('0'), hours: Number(every[1]) };
  if (!/^\d+$/.test(h)) return null;
  if (dom === '*' && dow === '*') return { every: 'day', at: at(h) };
  if (dom === '*' && dow === '1-5') return { every: 'weekdays', at: at(h) };
  if (dom === '*' && /^\d(,\d)*$/.test(dow))
    return { every: 'days', at: at(h), days: dow.split(',').map((one) => Number(one) % 7) };
  if (dom === 'L' && dow === '*') return { every: 'month', at: at(h), monthDay: 'last' };
  if (/^\d+$/.test(dom) && Number(dom) <= 28 && dow === '*')
    return { every: 'month', at: at(h), monthDay: Number(dom) };
  return null;
}
