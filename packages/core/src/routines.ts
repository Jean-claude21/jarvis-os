import { z } from 'zod';
import { agenda } from './agenda';
import type { Actor, Tx } from './db';
import { find, get } from './entries';
import { goalsOf } from './goals';
import { inboxOf } from './inbox';
import { lingering, openIntentions } from './intentions';
import { patternsOf } from './patterns';
import { propose } from './proposals';
import { mirrorOf } from './review';
import { repetitionFromWords } from './time';
import { zoneOf } from './zone';

// Structured routines (spec 047, plan v2 C14). A routine is no longer only a text (a skill): it
// has five parts — its trigger (a time, a kind saved, a phrase), its preparation done by Jarvis
// without any AI (her day, a mirror, her goals…), its instructions for the assistant (in her
// style), the references it uses (criteria, filters, style), and its result (the entry it makes,
// e.g. a « Bilan », and the actions). A routine imported as text is proposed in this shape, for
// her yes.

const PREPARE = [
  'agenda_today',
  'agenda_week',
  'mirror_day',
  'mirror_week',
  'goals',
  'patterns',
  'intentions',
  'inbox',
] as const;
export type Preparation = (typeof PREPARE)[number];

export const structureSchema = z.object({
  trigger: z
    .object({
      /** Five fields or her words (« chaque soir à 21h »): kept as the routine's `repeat`. */
      repeat: z.string().min(2).max(80).optional(),
      /** A kind saved that starts it. */
      saved: z.string().min(1).max(80).optional(),
      /** What she says to start it (« /bilan », « mon bilan »). */
      phrases: z.array(z.string().min(1).max(80)).max(10).optional(),
    })
    .default({}),
  prepare: z
    .array(
      z.union([
        z.enum(PREPARE),
        z.object({
          find: z.object({
            kind: z.string().min(1),
            text: z.string().optional(),
            limit: z.number().int().min(1).max(50).optional(),
          }),
        }),
      ]),
    )
    .max(10)
    .default([]),
  instructions: z.string().min(1).max(20_000),
  references: z
    .object({
      style: z.string().max(2000).optional(),
      criteria: z.array(z.string().min(1).max(300)).max(20).optional(),
      kinds: z.array(z.string().min(1).max(80)).max(20).optional(),
    })
    .default({}),
  result: z
    .object({
      kind: z.string().min(1).max(80).optional(),
      fields: z.array(z.string().min(1).max(60)).max(30).optional(),
      actions: z.array(z.string().min(1).max(300)).max(10).optional(),
    })
    .default({}),
});
export type Structure = z.infer<typeof structureSchema>;

/** A routine's structure, when it has one. */
export function structureOf(data: Record<string, unknown>): Structure | null {
  if (!data.instructions && !data.prepare && !data.trigger) return null;
  const parsed = structureSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** What Jarvis prepares for a routine, without any AI. */
export async function prepare(
  tx: Tx,
  spaceIds: string[],
  steps: Structure['prepare'],
  now = new Date(),
): Promise<Record<string, unknown>> {
  const zone = await zoneOf(tx);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now);
  const start = new Date(`${day}T00:00:00Z`);
  const out: Record<string, unknown> = {};
  for (const step of steps) {
    if (typeof step === 'object') {
      const found = [];
      for (const id of spaceIds)
        found.push(
          ...(await find(tx, id, {
            kind: step.find.kind,
            ...(step.find.text ? { text: step.find.text } : {}),
            limit: step.find.limit ?? 20,
          })),
        );
      out[`find:${step.find.kind}`] = found.map((one) => ({
        id: one.id,
        title: one.title,
        data: one.data,
      }));
    } else if (step === 'agenda_today' || step === 'agenda_week') {
      out[step] = await agenda(tx, spaceIds, {
        from: start,
        to: new Date(start.getTime() + (step === 'agenda_today' ? 1 : 7) * 86_400_000),
        today: now,
      });
    } else if (step === 'mirror_day' || step === 'mirror_week') {
      const days = step === 'mirror_day' ? 1 : 7;
      out[step] = await mirrorOf(tx, spaceIds, new Date(now.getTime() - days * 86_400_000), now);
    } else if (step === 'goals') {
      out.goals = (await Promise.all(spaceIds.map((id) => goalsOf(tx, id, day)))).flat();
    } else if (step === 'patterns') {
      out.patterns = await patternsOf(tx, spaceIds, now);
    } else if (step === 'intentions') {
      const list = [];
      for (const id of spaceIds)
        for (const one of await openIntentions(tx, id))
          list.push({ id: one.id, title: one.title, lingering: lingering(one, now) });
      out.intentions = list;
    } else if (step === 'inbox') {
      out.inbox = (await Promise.all(spaceIds.map((id) => inboxOf(tx, id))))
        .flat()
        .map((one) => ({ id: one.id, title: one.title }));
    }
  }
  return out;
}

/** A routine she can follow now: its parts, and what Jarvis prepared. */
export async function routineToFollow(
  tx: Tx,
  spaceIds: string[],
  spaceId: string,
  id: string,
  now = new Date(),
) {
  const entry = await get(tx, spaceId, id);
  if (!entry) throw new Error(`No entry ${id} in this space.`);
  const structure = structureOf(entry.data);
  if (!structure)
    return {
      name: entry.title,
      structured: false as const,
      text: String(entry.data.instruction ?? entry.data.text ?? entry.data.description ?? ''),
    };
  return {
    name: entry.title,
    structured: true as const,
    ...structure,
    prepared: await prepare(tx, spaceIds, structure.prepare, now),
  };
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A routine kept as text, read into its five parts by rules: what Jarvis proposes, for her yes. */
export function structureFromText(name: string, text: string): Structure {
  const said = fold(text);
  const prepare: Preparation[] = [];
  if (/\b(agenda|rendez-vous|calendrier|journee de demain|ma journee)\b/.test(said))
    prepare.push(/semaine/.test(said) ? 'agenda_week' : 'agenda_today');
  if (/\b(bilan|revue|retour sur|ce que j'ai fait|miroir)\b/.test(said))
    prepare.push(/semaine|hebdo/.test(said) ? 'mirror_week' : 'mirror_day');
  if (/\bobjectifs?\b/.test(said)) prepare.push('goals');
  if (/\b(intentions?|promesses?|ce que j'ai dit)\b/.test(said)) prepare.push('intentions');
  if (/\b(motifs?|tendances?|ce qui revient)\b/.test(said)) prepare.push('patterns');
  if (/\b(inbox|a ranger|captures?)\b/.test(said)) prepare.push('inbox');
  const lines = text
    .split(/\n+/)
    .map((one) => one.trim())
    .filter(Boolean);
  const when = lines.find((one) => repetitionFromWords(one) !== null);
  const phrases = [...text.matchAll(/(?:^|\s)(\/[\p{L}\p{N}_-]{2,30})/gu)].map(
    (match) => match[1]!,
  );
  const criteria = lines
    .filter((one) => /^[-*•]\s/.test(one))
    .map((one) => one.replace(/^[-*•]\s+/, ''))
    .slice(0, 20);
  const style = lines.find((one) =>
    /\b(ton|style|tutoie|vouvoie|court|bref|chaleureux)\b/i.test(one),
  );
  const result = /\b(?:cree|creer|enregistre|garde|note)\s+(?:un|une|le|la)\s+(\p{L}+)/u.exec(
    said,
  )?.[1];
  return {
    trigger: {
      ...(when ? { repeat: repetitionFromWords(when)! } : {}),
      phrases: [...new Set([`/${fold(name).replace(/[^a-z0-9]+/g, '')}`, ...phrases])],
    },
    prepare: [...new Set(prepare)],
    instructions: text.trim(),
    references: {
      ...(style ? { style } : {}),
      ...(criteria.length ? { criteria } : {}),
    },
    result: result ? { kind: result.charAt(0).toUpperCase() + result.slice(1) } : {},
  };
}

/** Proposes her routine kept as text in its five parts; made only on her yes (`decide`). */
export async function proposeStructure(tx: Tx, actor: Actor, spaceId: string, id: string) {
  const entry = await get(tx, spaceId, id);
  if (!entry || !/^routine$/i.test(entry.kind)) throw new Error(`No routine ${id} in this space.`);
  if (structureOf(entry.data)) throw new Error(`« ${entry.title} » is already structured.`);
  const text = String(entry.data.instruction ?? entry.data.text ?? entry.data.description ?? '');
  if (!text.trim()) throw new Error(`« ${entry.title} » has no text to read.`);
  const structure = structureFromText(entry.title, text);
  return propose(tx, actor, spaceId, {
    title: `Routine « ${entry.title} » en cinq morceaux`,
    why: 'Son déclencheur, ce que Jarvis prépare, les consignes, les références et le résultat.',
    entries: [
      {
        id,
        data: {
          ...structure,
          ...(structure.trigger.repeat
            ? { repeat: structure.trigger.repeat, remind: ['0 min'] }
            : {}),
        },
      },
    ],
  });
}
