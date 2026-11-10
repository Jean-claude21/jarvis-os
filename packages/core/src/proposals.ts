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

export interface ToSort {
  type: 'capture' | 'proposed' | 'proposal' | 'merge';
  /** The entry it is about (a capture, a proposed entry, a proposal), or « from→to » for a merge. */
  id: string;
  title: string;
  spaceId: string;
  /** Why it is here, or what it would do. */
  detail: Record<string, unknown>;
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
      });
    }
    const proposed = (await find(tx, spaceId, { limit: 200 })).filter(
      (one) => one.data.status === 'proposed',
    );
    for (const one of proposed) {
      const isProposal = one.kind === PROPOSAL_KIND;
      out.push({
        type: isProposal ? 'proposal' : 'proposed',
        id: one.id,
        title: one.title,
        spaceId,
        detail: isProposal
          ? {
              why: one.data.why,
              apps: one.data.apps,
              makes: (one.data.entries as EntryInput[]).map((entry) => ({
                kind: entry.kind,
                title: entry.title,
              })),
            }
          : { kind: one.kind, data: one.data, origin: one.origin },
      });
    }
    for (const merge of await mergeProposals(tx, spaceId, prefs.mergesDismissed ?? [])) {
      out.push({
        type: 'merge',
        id: `${merge.from}→${merge.to}`,
        title: `${merge.from} → ${merge.to}`,
        spaceId,
        detail: { ...merge },
      });
    }
  }
  return out;
}

/**
 * Her answer to what was proposed (an entry or a proposal): yes makes it — a proposed entry takes
 * the status it was proposed for (`then`, else planned); a proposal makes its entries, linked to
 * it (`from_proposal`) — no sets it aside. Captures are filed (inbox) and merges merged (kinds)
 * by their own doors.
 */
export async function decide(tx: Tx, actor: Actor, spaceId: string, id: string, yes: boolean) {
  const one = await get(tx, spaceId, id);
  if (!one || one.data.status !== 'proposed') throw new Error(`No proposal ${id} waits here.`);
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
