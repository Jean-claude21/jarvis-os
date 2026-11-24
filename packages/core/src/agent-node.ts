import { z } from 'zod';
import { comment, commentsOf } from './comments';
import type { Actor, Tx } from './db';
import { find, save } from './entries';
import { enterMessage } from './outbox';
import { preferencesOf } from './prefs';
import { spacesOf } from './spaces';
import { zoneOf } from './zone';

// The Agent (v3 D12): not a module more — a named setting of the same node. An agent is an entry
// « Agent » that says who does the work (« Le Chasseur d'offres »), what it is for, which of her
// rules it runs (each rule names its agent: `agent`), which of Jarvis's own works it does (reading
// documents), with what tools, on which kinds, how free it is (propose, act and report, silent),
// within which budget — and a Pause. Its rules run where they always ran; the agent's settings
// apply there: paused, it does nothing; over budget, its calls stop for the day; in « propose »,
// what it would write waits for her yes; its changes are journaled with it as their author.

export const AGENT_KIND = 'Agent';

/** The works Jarvis does by itself, each done by one built-in agent. */
export const BUILTIN_WORKS = ['lecture', 'brief', 'rappels'] as const;
export type BuiltinWork = (typeof BUILTIN_WORKS)[number];

export const agentSettingsSchema = z.object({
  /** What it does, in one sentence she reads. */
  role: z.string().trim().max(400).optional(),
  /**
   * Her instructions, in her words (spec 109): how she wants its work done, for all its tasks —
   * read by whoever does the work; a skill's own method wins over them when they differ.
   */
  instructions: z.string().trim().max(8000).optional(),
  /** Who runs the work: her rules and scripts, a model with skills, a service. */
  executor: z.enum(['rule', 'script', 'llm', 'service']).optional(),
  /** The connection a service agent reaches (« Atelier »). */
  service: z.string().trim().max(80).optional(),
  /** The skills it follows (Agent Skills: a name, a « when », the instructions). */
  skills: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  /** Its scope: the kinds it reads and those it writes. */
  reads: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  writes: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  /**
   * Jarvis's own works it does: « lecture » reads and understands each file dropped, « brief » tells
   * her her day each morning, « rappels » tells her each reminder on time (v3 F6).
   */
  builtin: z.array(z.enum(BUILTIN_WORKS)).max(5).optional(),
  /** Where it says what it did: the Activity always, and Telegram when she asks (v3 F6). */
  report: z.enum(['activity', 'telegram']).optional(),
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
  {
    title: 'Assistant du matin',
    data: {
      role: 'Chaque matin, à l’heure choisie, te dit ta journée : ce qui ne va pas, ce qui est en retard, ton agenda, tes habitudes.',
      executor: 'rule',
      builtin: ['brief'],
      autonomy: 'act_and_report',
    },
  },
  {
    title: 'Gardien des rappels',
    data: {
      role: 'Te dit chaque rappel à son heure, sur tes canaux, et reprogramme ceux qui se répètent.',
      executor: 'rule',
      builtin: ['rappels'],
      autonomy: 'act_and_report',
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

/** The agent that does one of Jarvis's own works (« lecture », « brief », « rappels »), if any. */
export async function agentDoing(
  tx: Tx,
  spaceId: string,
  work: BuiltinWork,
): Promise<Agent | null> {
  for (const one of BUILTIN_AGENTS)
    if (one.data.builtin?.includes(work)) return agentNamed(tx, spaceId, one.title);
  return null;
}

/** Who answers for her own automations, made outside any app, that do more than remind. */
export const STEWARD = 'Intendant';
const REMINDERS = 'Gardien des rappels';

interface RuleLike {
  id: string;
  title: string;
  data: Record<string, unknown>;
}

const actionsOf = (rule: RuleLike) =>
  (Array.isArray(rule.data.then) ? rule.data.then : []) as Record<string, unknown>[];

/**
 * Who answers for each rule (v3 D12, F6b): every automation has an agent — its Pause, its budget,
 * its name in the journal. The one it names; else the agent that reaches the service it calls; else
 * the one agent its app's other rules name; else an agent named after its app; else, for her own,
 * the Gardien des rappels when it only reminds, the Intendant otherwise. Nothing is written: she
 * gives it to another agent when she likes (« Confier à… »).
 */
export async function agentsOfRules(
  tx: Tx,
  spaceId: string,
): Promise<Map<string, { title: string; assigned: boolean }>> {
  const { rows: rules } = await tx.query<RuleLike>(
    `select id, title, data from entry where space_id = $1 and archived_at is null
        and jarvis_fold(kind) = 'rule'`,
    [spaceId],
  );
  const { rows: agents } = await tx.query<{ title: string; data: Record<string, unknown> }>(
    `select title, data from entry where space_id = $1 and archived_at is null
        and jarvis_fold(kind) = 'agent'`,
    [spaceId],
  );
  const services = [...agents, ...BUILTIN_AGENTS].flatMap((one) =>
    typeof one.data.service === 'string' ? [{ title: one.title, service: one.data.service }] : [],
  );
  const named = (rule: RuleLike) =>
    typeof rule.data.agent === 'string' && rule.data.agent.trim() ? rule.data.agent : null;
  const out = new Map<string, { title: string; assigned: boolean }>();
  for (const rule of rules) {
    const own = named(rule);
    if (own) {
      out.set(rule.id, { title: own, assigned: true });
      continue;
    }
    const calls = actionsOf(rule).flatMap((action) => {
      const call = action.call as { connection?: unknown } | undefined;
      return typeof call?.connection === 'string' ? [fold(call.connection)] : [];
    });
    const reaching = services.find((one) => calls.includes(fold(one.service)));
    const app = typeof rule.data.app === 'string' && rule.data.app ? rule.data.app : null;
    const siblings = app
      ? [
          ...new Set(
            rules
              .filter((other) => other.data.app === app && named(other))
              .map((other) => named(other)!),
          ),
        ]
      : [];
    const title =
      reaching?.title ??
      (siblings.length === 1
        ? siblings[0]!
        : (app ?? (actionsOf(rule).every((action) => 'remind' in action) ? REMINDERS : STEWARD)));
    out.set(rule.id, { title, assigned: false });
  }
  return out;
}

/** The agent that answers for one rule, with its settings. */
export async function agentOfRule(tx: Tx, spaceId: string, rule: RuleLike): Promise<Agent> {
  const title =
    (typeof rule.data.agent === 'string' && rule.data.agent) ||
    (await agentsOfRules(tx, spaceId)).get(rule.id)?.title ||
    STEWARD;
  return (await agentNamed(tx, spaceId, title)) ?? { id: null, title, data: {} };
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
  /** Given to this agent by her (or its app), or answered for by default (F6b). */
  assigned: boolean;
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
/** A note an agent keeps (v3 D12, « mémoire »): what it learnt, in words, journaled like any note. */
export interface AgentNote {
  id: string;
  text: string;
  at: string;
}

export interface AgentView extends Agent {
  rules: AgentRule[];
  /** When a built-in agent works, in her words (« chaque jour à 07:00 »); null for the others. */
  when: string | null;
  /** Its memory, the newest first. */
  memory: AgentNote[];
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
        and jarvis_fold(kind) = 'rule'
      order by created_at`,
    [spaceId],
  );
  const answering = await agentsOfRules(tx, spaceId);
  const agentOf = (rule: { id: string }) => answering.get(rule.id)?.title ?? STEWARD;
  // The morning brief is told from her own space: its agent lives there only.
  const personal = (await spacesOf(tx)).find((one) => one.id === spaceId)?.personal ?? false;
  const names = new Map<string, string>();
  for (const one of [
    ...BUILTIN_AGENTS.filter((a) => personal || !a.data.builtin?.includes('brief')).map(
      (a) => a.title,
    ),
    ...entries.map((e) => e.title),
    ...rules.map((r) => agentOf(r)),
  ])
    if (!names.has(fold(one))) names.set(fold(one), one);
  const out: AgentView[] = [];
  for (const title of names.values()) {
    const agent = (await agentNamed(tx, spaceId, title)) ?? { id: null, title, data: {} };
    const own = rules.filter((rule) => fold(agentOf(rule)) === fold(agent.title));
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
    // An agent that exists only because rules answer to it says what it is for.
    if (!agent.data.role && !agent.id)
      agent.data = {
        ...agent.data,
        role:
          fold(agent.title) === fold(STEWARD)
            ? 'Fait tourner les automatismes que tu as faits toi-même.'
            : `Fait tourner les automatismes de ${agent.title}.`,
      };
    const view: AgentView = {
      ...agent,
      when: await whenOf(tx, agent),
      memory: agent.id ? await memoryOf(tx, spaceId, agent.id) : [],
      rules: own.map((rule) => ({
        id: rule.id,
        assigned: answering.get(rule.id)?.assigned ?? false,
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
    const answering = [...(await agentsOfRules(tx, spaceId)).values()];
    if (!answering.some((one) => fold(one.title) === fold(title)))
      throw new Error(`No agent « ${title} » in this space.`);
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

/** When a built-in agent works, in her words. */
async function whenOf(tx: Tx, agent: Agent): Promise<string | null> {
  const works = agent.data.builtin ?? [];
  if (works.includes('brief')) {
    const at = (await preferencesOf(tx).catch(() => ({}) as { brief?: string })).brief;
    return at ? `chaque jour à ${at}` : 'quand tu choisis une heure dans Réglages › Compte';
  }
  if (works.includes('rappels')) return 'à l’heure de chaque rappel';
  if (works.includes('lecture')) return 'à chaque fichier déposé';
  return null;
}

/** An agent's memory: the notes on its entry, the newest first. */
async function memoryOf(tx: Tx, spaceId: string, id: string): Promise<AgentNote[]> {
  return (await commentsOf(tx, spaceId, id))
    .reverse()
    .slice(0, 50)
    .map((note) => ({
      id: note.id,
      text: String(note.data.text ?? note.title),
      at: note.createdAt,
    }));
}

/**
 * An agent keeps a note in its memory (v3 D12): what it learnt, for its next run — written by the
 * agent (signed with its name) or by her. A built-in agent gets its entry now.
 */
export async function remember(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  title: string,
  text: string,
): Promise<AgentNote> {
  const agent = await agentNamed(tx, spaceId, title);
  const id = agent?.id ?? (await setAgent(tx, actor, spaceId, title, {})).id;
  if (!id) throw new Error(`No agent « ${title} » in this space.`);
  const note = await comment(tx, actor, spaceId, id, text);
  return { id: note.id, text: String(note.data.text ?? note.title), at: note.createdAt };
}

/**
 * What an agent did, told to her on Telegram when she asked it to report there (v3 F6): one
 * message in the outbox, once per run, for whom the run was made — only when her Telegram is
 * linked. The Activity keeps it in any case (its changes are signed with its name).
 */
export async function reportRun(
  tx: Tx,
  person: string,
  agent: Agent,
  what: string,
  key: string,
): Promise<boolean> {
  if (agent.data.report !== 'telegram') return false;
  const own = (await spacesOf(tx)).find((one) => one.personal);
  if (!own) return false;
  const [channel] = await find(tx, own.id, { kind: 'Channel', limit: 1 });
  if (
    !channel ||
    (typeof channel.data.telegram !== 'string' && typeof channel.data.telegram !== 'number')
  )
    return false;
  const id = await enterMessage(tx, {
    person,
    spaceId: own.id,
    channel: 'telegram',
    kind: 'report',
    subject: agent.title,
    body: what,
    dedupe: `report:${agent.title}:${key}:${person}`,
  });
  return id !== null;
}
