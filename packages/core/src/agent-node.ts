import { z } from 'zod';
import type { Actor, Tx } from './db';
import { save } from './entries';
import { zoneOf } from './zone';

// The Agent (v3 D12): not a module more — a named setting of the same node. An agent is an entry
// « Agent » that says who does the work (« Le Chasseur d'offres »), what it is for, which of her
// rules it runs (each rule names its agent: `agent`), which of Jarvis's own works it does (reading
// documents), with what tools, on which kinds, how free it is (propose, act and report, silent),
// within which budget — and a Pause. Its rules run where they always ran; the agent's settings
// apply there: paused, it does nothing; over budget, its calls stop for the day; in « propose »,
// what it would write waits for her yes; its changes are journaled with it as their author.

export const AGENT_KIND = 'Agent';

export const agentSettingsSchema = z.object({
  /** What it does, in one sentence she reads. */
  role: z.string().trim().max(400).optional(),
  /** Who runs the work: her rules and scripts, a model with skills, a service. */
  executor: z.enum(['rule', 'script', 'llm', 'service']).optional(),
  /** The connection a service agent reaches (« Atelier »). */
  service: z.string().trim().max(80).optional(),
  /** The skills it follows (Agent Skills: a name, a « when », the instructions). */
  skills: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  /** Its scope: the kinds it reads and those it writes. */
  reads: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  writes: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  /** Jarvis's own works it does: « lecture » reads and understands each file dropped. */
  builtin: z
    .array(z.enum(['lecture']))
    .max(5)
    .optional(),
  autonomy: z.enum(['propose', 'act_and_report', 'silent']).optional(),
  budget: z.object({ calls_per_day: z.number().int().min(0).max(1000).optional() }).optional(),
  paused: z.boolean().optional(),
  app: z.string().trim().max(60).optional(),
});
export type AgentSettings = z.infer<typeof agentSettingsSchema>;

/** The agents Jarvis has in every space, before she changes anything of theirs. */
export const BUILTIN_AGENTS: { title: string; data: AgentSettings }[] = [
  {
    title: 'Secrétaire des papiers',
    data: {
      role: 'Lit chaque document déposé, dit ce qu’il est et propose ce qu’il en tire : la facture, le fournisseur, la garantie.',
      executor: 'rule',
      builtin: ['lecture'],
      skills: ['Ranger ce qui arrive'],
      reads: ['Fichier', 'Organization'],
      writes: ['Bill', 'Transaction', 'Warranty', 'Organization'],
      autonomy: 'propose',
    },
  },
];

export interface Agent {
  /** Its entry, or null for a built-in agent she has not changed yet. */
  id: string | null;
  title: string;
  data: AgentSettings;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** An agent by its name: her entry, else the built-in one, else null. */
export async function agentNamed(tx: Tx, spaceId: string, title: string): Promise<Agent | null> {
  const { rows } = await tx.query<{ id: string; title: string; data: unknown }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) = 'agent'
        and jarvis_fold(title) = jarvis_fold($2)
      order by created_at limit 1`,
    [spaceId, title],
  );
  const builtin = BUILTIN_AGENTS.find((one) => fold(one.title) === fold(title));
  if (rows[0]) {
    const parsed = agentSettingsSchema.safeParse(rows[0].data);
    return {
      id: rows[0].id,
      title: rows[0].title,
      data: { ...(builtin?.data ?? {}), ...(parsed.success ? parsed.data : {}) },
    };
  }
  return builtin ? { id: null, title: builtin.title, data: builtin.data } : null;
}

/** The agent that does one of Jarvis's own works (« lecture »), if any. */
export async function agentDoing(tx: Tx, spaceId: string, work: 'lecture'): Promise<Agent | null> {
  for (const one of BUILTIN_AGENTS)
    if (one.data.builtin?.includes(work)) return agentNamed(tx, spaceId, one.title);
  return null;
}

/** How a change made by an agent is signed in the journal. */
export const agentClient = (title: string) => `agent:${title}`;

/** The day's start in her zone, as an instant. */
async function dayStart(tx: Tx, now: Date): Promise<Date> {
  const zone = await zoneOf(tx).catch(() => 'Europe/Paris');
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => Number(local.find((one) => one.type === type)?.value ?? 0);
  return new Date(
    now.getTime() - (part('hour') * 60 + part('minute')) * 60_000 - now.getSeconds() * 1000,
  );
}

/** The calls its rules made today (each call leaves an execution, spec 057). */
export async function callsToday(tx: Tx, spaceId: string, title: string, now = new Date()) {
  const since = await dayStart(tx, now);
  const { rows } = await tx.query<{ n: number }>(
    `select count(*)::int as n from entry x
       join link l on l.from_id = x.id and l.role = 'about'
       join entry r on r.id = l.to_id
      where x.space_id = $1 and jarvis_fold(x.kind) = 'execution' and x.created_at >= $3
        and jarvis_fold(r.kind) = 'rule' and jarvis_fold(coalesce(r.data->>'agent', '')) = jarvis_fold($2)
        and coalesce(x.data->>'status', '') <> 'skipped'`,
    [spaceId, title, since.toISOString()],
  );
  return rows[0]?.n ?? 0;
}

export interface AgentRule {
  id: string;
  title: string;
  when: Record<string, unknown>;
  active: boolean;
  next: string | null;
  lastRun: string | null;
  error: string | null;
  app: string | null;
}
export interface AgentRun {
  id: string;
  title: string;
  status: string;
  started: string | null;
  ended: string | null;
  counts: Record<string, number>;
  error: string | null;
}
export interface AgentView extends Agent {
  rules: AgentRule[];
  callsToday: number;
  /** What it did last: its calls, the newest first. */
  runs: AgentRun[];
  /** paused · over_budget · failing · working · idle */
  state: 'paused' | 'over_budget' | 'failing' | 'working' | 'idle';
}

/** Her agents in a space: those she has, those her rules name, Jarvis's own. */
export async function agentsOf(tx: Tx, spaceId: string, now = new Date()): Promise<AgentView[]> {
  const { rows: entries } = await tx.query<{ title: string }>(
    `select title from entry where space_id = $1 and archived_at is null and jarvis_fold(kind) = 'agent'
      order by created_at`,
    [spaceId],
  );
  const { rows: rules } = await tx.query<{
    id: string;
    title: string;
    data: Record<string, unknown>;
  }>(
    `select id, title, data from entry where space_id = $1 and archived_at is null
        and jarvis_fold(kind) = 'rule' and coalesce(data->>'agent', '') <> ''
      order by created_at`,
    [spaceId],
  );
  const names = new Map<string, string>();
  for (const one of [
    ...BUILTIN_AGENTS.map((a) => a.title),
    ...entries.map((e) => e.title),
    ...rules.map((r) => String(r.data.agent)),
  ])
    if (!names.has(fold(one))) names.set(fold(one), one);
  const out: AgentView[] = [];
  for (const title of names.values()) {
    const agent = (await agentNamed(tx, spaceId, title)) ?? { id: null, title, data: {} };
    const own = rules.filter((rule) => fold(String(rule.data.agent)) === fold(agent.title));
    const { rows: runs } = await tx.query<{
      id: string;
      title: string;
      data: Record<string, unknown>;
    }>(
      `select x.id, x.title, x.data from entry x
         join link l on l.from_id = x.id and l.role = 'about'
        where x.space_id = $1 and jarvis_fold(x.kind) = 'execution' and l.to_id = any($2::text[])
        order by x.created_at desc limit 8`,
      [spaceId, own.map((rule) => rule.id)],
    );
    const calls = await callsToday(tx, spaceId, agent.title, now);
    const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
    const view: AgentView = {
      ...agent,
      rules: own.map((rule) => ({
        id: rule.id,
        title: rule.title,
        when: (rule.data.when ?? {}) as Record<string, unknown>,
        active: rule.data.active !== false,
        next: text(rule.data.next),
        lastRun: text(rule.data.last_run),
        error: text(rule.data.error),
        app: text(rule.data.app),
      })),
      callsToday: calls,
      runs: runs.map((run) => ({
        id: run.id,
        title: run.title,
        status: String(run.data.status ?? ''),
        started: text(run.data.started),
        ended: text(run.data.ended),
        counts: (run.data.counts ?? {}) as Record<string, number>,
        error: text(run.data.error),
      })),
      state: 'idle',
    };
    const budget = agent.data.budget?.calls_per_day;
    view.state = agent.data.paused
      ? 'paused'
      : budget !== undefined && calls >= budget
        ? 'over_budget'
        : view.runs[0]?.status === 'failed' || view.rules.some((rule) => rule.error)
          ? 'failing'
          : view.runs[0]?.status === 'running'
            ? 'working'
            : 'idle';
    out.push(view);
  }
  return out;
}

/** Changes an agent's settings (Pause, budget, autonomy…) — a built-in one gets its entry now. */
export async function setAgent(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  title: string,
  raw: AgentSettings,
): Promise<Agent> {
  const patch = agentSettingsSchema.parse(raw);
  const agent = await agentNamed(tx, spaceId, title);
  if (!agent) {
    const { rows } = await tx.query(
      `select 1 from entry where space_id = $1 and archived_at is null and jarvis_fold(kind) = 'rule'
          and jarvis_fold(coalesce(data->>'agent', '')) = jarvis_fold($2) limit 1`,
      [spaceId, title],
    );
    if (!rows.length) throw new Error(`No agent « ${title} » in this space.`);
  }
  const saved = await save(tx, actor, spaceId, {
    entries: [
      agent?.id
        ? { id: agent.id, data: patch }
        : {
            kind: AGENT_KIND,
            title: agent?.title ?? title,
            data: { ...(agent?.data ?? {}), ...patch },
          },
    ],
  });
  return {
    id: saved.entries[0]!.id,
    title: agent?.title ?? title,
    data: { ...(agent?.data ?? {}), ...patch },
  };
}
