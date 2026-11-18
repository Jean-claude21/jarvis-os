import { bundleSchema, installApp, type Bundle } from './bundles';
import { mergeProposals } from './common';
import type { Actor, Tx } from './db';
import { archive, find, get, save } from './entries';
import { inboxOf } from './inbox';
import { preferencesOf, type Preferences } from './prefs';
import { linkInputSchema, saveInputSchema, type EntryInput } from './schemas';
import { z } from 'zod';

// What waits for her yes, in one place (spec 046, plan v2 C7, « À ranger »): her captures to file,
// the entries proposed (by a form, a rule, Jarvis), the kinds that are one thing, and proposals
// that make several entries across her apps at once (« j'ai acheté un frigo » — the expense, the
// thing, its warranty). Nothing is done without her yes; each yes is one save, undone at once.

export const PROPOSAL_KIND = 'Proposal';
/** An app an assistant designed for her (v3 D14), waiting for her yes. */
export const APP_PROPOSAL_KIND = 'AppProposal';

export interface ToSort {
  type: 'capture' | 'proposed' | 'proposal' | 'merge' | 'app' | 'verify';
  /** The entry it is about (a capture, a proposed entry, a proposal), or « from→to » for a merge. */
  id: string;
  title: string;
  spaceId: string;
  /** Why it is here, or what it would do. */
  detail: Record<string, unknown>;
  /** The kinds it makes or touches: an app shows what waits for it among them (v3 F5). */
  kinds: string[];
}

const proposalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** Why, in a sentence she reads. */
  why: z.string().trim().max(1000).optional(),
  /** The apps it touches, for her to see. */
  apps: z.array(z.string().min(1).max(60)).max(10).default([]),
  entries: saveInputSchema.shape.entries,
  links: z.array(linkInputSchema).max(100).default([]),
});
export type ProposalInput = z.input<typeof proposalSchema>;

/**
 * An app proposed to her (v3 D14): what it is for, and the app itself — tried first, so a bundle
 * that would not install is refused now, not after her yes.
 */
export async function proposeApp(tx: Tx, actor: Actor, spaceId: string, raw: Bundle, why?: string) {
  const bundle = bundleSchema.parse(raw);
  await installApp(tx, actor, spaceId, bundle, true);
  const saved = await save(tx, actor, spaceId, {
    entries: [
      {
        kind: APP_PROPOSAL_KIND,
        title: bundle.app,
        data: {
          status: 'proposed',
          ...(why ? { why: why.slice(0, 1000) } : {}),
          bundle,
        },
        origin: 'inferred',
      },
    ],
  });
  return { id: saved.entries[0]!.id, app: bundle.app };
}

/** A proposal kept to her yes: what it would make, never made yet. */
export async function propose(tx: Tx, actor: Actor, spaceId: string, input: ProposalInput) {
  const proposal = proposalSchema.parse(input);
  if (!proposal.entries.length) throw new Error('Give what the proposal makes.');
  return save(tx, actor, spaceId, {
    entries: [
      {
        kind: PROPOSAL_KIND,
        title: proposal.title,
        data: {
          status: 'proposed',
          ...(proposal.why ? { why: proposal.why } : {}),
          apps: proposal.apps,
          entries: proposal.entries,
          links: proposal.links,
        },
        origin: 'inferred',
      },
    ],
  });
}

/** A value read from one of her files, waiting for « c'est juste » or a correction (v3 D6, F5). */
export interface ToVerify {
  id: string;
  kind: string;
  title: string;
  fields: { field: string; value: unknown }[];
  /** The file it was read from. */
  from: { id: string; title: string } | null;
}

/**
 * The entries whose values Jarvis read from one of her files and she has not confirmed yet — the
 * newest first. Read values copied from a source she connected (her calendar, an agent's
 * collection) stay « lu » on their fiche without waiting here: they are the source's words, not
 * Jarvis's reading of her papers. A file's own reading (its genre, its facts) is its evidence, not
 * a value to confirm.
 */
export async function toVerifyOf(tx: Tx, spaceId: string, limit = 100): Promise<ToVerify[]> {
  const { rows } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    data: Record<string, unknown>;
    origin: Record<string, string>;
    fromId: string | null;
    fromTitle: string | null;
  }>(
    `select e.id, e.kind, e.title, e.data, e.origin, src.id as "fromId", src.title as "fromTitle"
       from entry e
       join lateral (
         select d.id, d.title from link l
           join entry d on d.id = case when l.from_id = e.id then l.to_id else l.from_id end
           join file f on f.entry_id = d.id
          where (l.from_id = e.id or l.to_id = e.id) and d.archived_at is null
          order by l.created_at limit 1) src on true
      where e.space_id = $1 and e.archived_at is null
        and coalesce(e.data->>'status', '') <> 'proposed'
        and not exists (select 1 from file f where f.entry_id = e.id)
        and exists (select 1 from jsonb_each_text(e.origin) o
                     where o.value = 'read' and e.data ? o.key and e.data->o.key <> 'null'::jsonb)
      order by e.updated_at desc
      limit $2`,
    [spaceId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    fields: readFields(row).map((field) => ({ field, value: row.data[field] })),
    from: row.fromId ? { id: row.fromId, title: row.fromTitle ?? '' } : null,
  }));
}

/** The fields of an entry whose value is still as Jarvis read it. */
const readFields = (one: { data: Record<string, unknown>; origin: Record<string, string> }) =>
  Object.entries(one.origin)
    .filter(([field, origin]) => origin === 'read' && one.data[field] != null)
    .map(([field]) => field);

const amendSchema = z.object({
  /** Which entry of the proposal, by its place. */
  at: z.number().int().min(0).max(99),
  title: z.string().trim().min(1).max(500).optional(),
  /** The values she sets; null takes one off. */
  data: z.record(z.string().min(1).max(80), z.unknown()).default({}),
});
export type Amendment = z.input<typeof amendSchema>;

/**
 * She changes what a proposal would make before saying yes (v3 D13, F5): a title, a value, a value
 * taken off. What she sets is hers (« dit »); what she left keeps how it was known. One save on the
 * proposal, journaled and undone like any other; nothing is made yet.
 */
export async function amendProposal(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  id: string,
  raw: Amendment[],
) {
  const changes = z.array(amendSchema).min(1).max(100).parse(raw);
  const one = await get(tx, spaceId, id);
  if (!one || one.kind !== PROPOSAL_KIND || one.data.status !== 'proposed')
    throw new Error(`No proposal ${id} waits here.`);
  const entries = structuredClone(one.data.entries as EntryInput[]);
  for (const change of changes) {
    const entry = entries[change.at];
    if (!entry) throw new Error(`The proposal makes no entry n° ${change.at + 1}.`);
    const was = entry.origin;
    const data: Record<string, unknown> = { ...(entry.data ?? {}) };
    const origin: Record<string, string> = Object.fromEntries(
      Object.keys(data).map((field) => [
        field,
        typeof was === 'string' ? was : (was?.[field] ?? 'said'),
      ]),
    );
    for (const [field, value] of Object.entries(change.data)) {
      if (value === null) {
        delete data[field];
        delete origin[field];
      } else {
        data[field] = value;
        origin[field] = 'said';
      }
    }
    entries[change.at] = {
      ...entry,
      ...(change.title ? { title: change.title } : {}),
      data,
      origin: origin as EntryInput['origin'],
    };
  }
  const checked = saveInputSchema.shape.entries.parse(entries);
  await save(tx, actor, spaceId, { entries: [{ id, data: { entries: checked } }] });
  return { id, entries: checked };
}

/** Everything that waits for her yes in these spaces, the oldest first in each. */
export async function toSortOf(tx: Tx, spaceIds: string[]): Promise<ToSort[]> {
  const prefs = await preferencesOf(tx).catch(() => ({}) as Preferences);
  const out: ToSort[] = [];
  for (const spaceId of spaceIds) {
    for (const one of await inboxOf(tx, spaceId)) {
      out.push({
        type: 'capture',
        id: one.id,
        title: one.title,
        spaceId,
        detail: { source: one.data.source, at: one.data.at, guess: one.data.guess },
        kinds: [],
      });
    }
    const proposed = (await find(tx, spaceId, { limit: 200 })).filter(
      (one) => one.data.status === 'proposed',
    );
    for (const one of proposed) {
      if (one.kind === APP_PROPOSAL_KIND) {
        const bundle = one.data.bundle as Bundle | undefined;
        out.push({
          type: 'app',
          id: one.id,
          title: one.title,
          spaceId,
          detail: {
            why: one.data.why,
            makes: (bundle?.models ?? []).map((model) => model.title),
          },
          kinds: (bundle?.models ?? []).map((model) => model.title),
        });
        continue;
      }
      const isProposal = one.kind === PROPOSAL_KIND;
      // What it makes, or which entry it changes and the fields it would write there.
      const makes = [];
      for (const entry of isProposal ? (one.data.entries as EntryInput[]) : []) {
        if (entry.id) {
          const target = await get(tx, spaceId, entry.id);
          makes.push({
            kind: target?.kind ?? '',
            title: target?.title ?? entry.id,
            changes: Object.keys(entry.data ?? {}),
          });
        } else makes.push({ kind: entry.kind, title: entry.title });
      }
      out.push({
        type: isProposal ? 'proposal' : 'proposed',
        id: one.id,
        title: one.title,
        spaceId,
        detail: isProposal
          ? { why: one.data.why, apps: one.data.apps, makes }
          : { kind: one.kind, data: one.data, origin: one.origin },
        kinds: isProposal
          ? [...new Set(makes.map((made) => made.kind ?? '').filter(Boolean))]
          : [one.kind],
      });
    }
    for (const one of await toVerifyOf(tx, spaceId)) {
      out.push({
        type: 'verify',
        id: one.id,
        title: one.title,
        spaceId,
        detail: { kind: one.kind, fields: one.fields, from: one.from },
        kinds: [one.kind],
      });
    }
    for (const merge of await mergeProposals(tx, spaceId, prefs.mergesDismissed ?? [])) {
      out.push({
        type: 'merge',
        id: `${merge.from}→${merge.to}`,
        title: `${merge.from} → ${merge.to}`,
        spaceId,
        detail: { ...merge },
        kinds: [merge.from, merge.to],
      });
    }
  }
  return out;
}

/**
 * Her answer to what was proposed (an entry or a proposal), or to values read from her file (yes
 * confirms them): yes makes it — a proposed entry takes
 * the status it was proposed for (`then`, else planned); a proposal makes its entries, linked to
 * it (`from_proposal`) — no sets it aside. Captures are filed (inbox) and merges merged (kinds)
 * by their own doors.
 */
export async function decide(tx: Tx, actor: Actor, spaceId: string, id: string, yes: boolean) {
  const one = await get(tx, spaceId, id);
  // Values read from her file, confirmed as they are (« c'est juste »): they become hers. To
  // correct one, she changes it on the fiche — that is hers too.
  if (one && one.data.status !== 'proposed' && yes) {
    const fields = readFields(one);
    if (fields.length)
      return save(tx, actor, spaceId, {
        entries: [
          { id, data: Object.fromEntries(fields.map((f) => [f, one.data[f]])), origin: 'said' },
        ],
      });
  }
  if (!one || one.data.status !== 'proposed') throw new Error(`No proposal ${id} waits here.`);
  if (one.kind === APP_PROPOSAL_KIND) {
    if (yes) await installApp(tx, actor, spaceId, one.data.bundle as Bundle, false);
    return save(tx, actor, spaceId, {
      entries: [{ id, data: { status: yes ? 'accepted' : 'declined' } }],
    });
  }
  if (!yes) {
    if (one.kind === PROPOSAL_KIND) {
      return save(tx, actor, spaceId, { entries: [{ id, data: { status: 'declined' } }] });
    }
    return archive(tx, actor, { spaceId, id });
  }
  if (one.kind !== PROPOSAL_KIND) {
    const then = typeof one.data.then === 'string' && one.data.then ? one.data.then : 'planned';
    return save(tx, actor, spaceId, { entries: [{ id, data: { status: then, then: null } }] });
  }
  const entries = (one.data.entries as EntryInput[]).map((entry, at) => ({
    ...entry,
    ref: entry.ref ?? `p${at}`,
  }));
  const links = (one.data.links as z.infer<typeof linkInputSchema>[]) ?? [];
  return save(tx, actor, spaceId, {
    entries: [...entries, { id, data: { status: 'accepted' } }],
    links: [
      ...links,
      ...entries
        .filter((entry) => !entry.id)
        .map((entry) => ({
          from: entry.ref!,
          to: id,
          role: 'from_proposal',
        })),
    ],
  });
}
