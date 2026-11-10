import type { Tx } from './db';
import { get } from './entries';
import { CLOSED } from './keywords';

// A person's card (spec 045, plan v2 C4), across her apps: the last time they met or spoke, what
// she promised them (open intentions and tasks that name or link them), the next thing with them,
// and everything linked to them or naming them, by kind. Read from what she keeps, without any AI.

export interface PersonCard {
  id: string;
  title: string;
  data: Record<string, unknown>;
  last: { id: string; kind: string; title: string; on: string } | null;
  promises: { id: string; kind: string; title: string; due: string | null }[];
  next: { id: string; kind: string; title: string; on: string } | null;
  /** What touches them, by kind, the latest first. */
  around: { kind: string; n: number; latest: { id: string; title: string }[] }[];
}

const DAY_OF = `coalesce(left(e.data->>'start', 16), left(e.data->>'at', 16), left(e.data->>'date', 10),
  left(e.data->>'due', 16), to_char(e.created_at, 'YYYY-MM-DD"T"HH24:MI'))`;

/** Their card in a space: `id` an entry « Person ». */
export async function personCard(
  tx: Tx,
  spaceId: string,
  id: string,
  now = new Date(),
): Promise<PersonCard> {
  const person = await get(tx, spaceId, id);
  if (!person || !/^person$/i.test(person.kind)) throw new Error(`No person ${id} in this space.`);
  const { rows } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    status: string | null;
    due: string | null;
    on: string;
    timed: boolean;
  }>(
    `select e.id, e.kind, e.title, e.data->>'status' as status, left(e.data->>'due', 16) as due,
            ${DAY_OF} as on,
            (e.data ?| array['start', 'at', 'date', 'due']) as timed
       from entry e
      where e.space_id = $1 and e.id <> $2 and e.archived_at is null
        and jarvis_fold(e.kind) not in ('model', 'rule', 'reminder', 'comment')
        and (exists (select 1 from link l where (l.from_id = e.id and l.to_id = $2)
                                            or (l.from_id = $2 and l.to_id = e.id))
             or (length($3) >= 3 and jarvis_fold(e.title || ' ' || e.data::text) ~ ('\\m' || regexp_replace(jarvis_fold($3), '[^[:alnum:] ]', '', 'g') || '\\M')))
      order by 6 desc limit 300`,
    [spaceId, id, person.title],
  );
  const today = now.toISOString().slice(0, 16);
  const open = (status: string | null) => !status || !CLOSED.has(status.toLowerCase());
  const doing = (kind: string) => /^(task|intention)$/i.test(kind);
  // Another person linked to them is not a time they met.
  const event = (kind: string) => !/^(person|capture)$/i.test(kind);
  // What happened with them: a dated thing (a capture is what she said, not a meeting).
  const past = rows.filter((one) => one.on <= today && !doing(one.kind) && event(one.kind));
  const ahead = rows
    .filter(
      (one) =>
        one.timed &&
        one.on > today &&
        open(one.status) &&
        !/^(intention|capture|person)$/i.test(one.kind),
    )
    .sort((a, b) => a.on.localeCompare(b.on));
  const kinds = new Map<string, { id: string; title: string }[]>();
  for (const one of rows) kinds.set(one.kind, [...(kinds.get(one.kind) ?? []), one]);
  return {
    id: person.id,
    title: person.title,
    data: person.data,
    last: past[0]
      ? { id: past[0].id, kind: past[0].kind, title: past[0].title, on: past[0].on }
      : null,
    promises: rows
      .filter((one) => doing(one.kind) && open(one.status))
      .map((one) => ({ id: one.id, kind: one.kind, title: one.title, due: one.due })),
    next: ahead[0]
      ? { id: ahead[0].id, kind: ahead[0].kind, title: ahead[0].title, on: ahead[0].on }
      : null,
    around: [...kinds]
      .map(([kind, list]) => ({
        kind,
        n: list.length,
        latest: list.slice(0, 5).map((one) => ({ id: one.id, title: one.title })),
      }))
      .sort((a, b) => b.n - a.n),
  };
}
