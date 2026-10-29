import type { Tx } from './db';

/** Something dated that comes soon: a reminder, a deadline, a day. */
export interface Upcoming {
  id: string;
  /** Its time as she wrote it (or the next time of a repeated reminder). */
  when: string;
  kind: string;
  title: string;
  space: string;
}

/**
 * What comes in the next `days` days (the anticipation, spec 006): her reminders (`prochaine`,
 * `quand`) and anything with an `echeance` or a `date`, unless done, sent or cancelled.
 */
export async function upcoming(tx: Tx, spaceIds: string[], days = 3): Promise<Upcoming[]> {
  const { rows } = await tx.query<Upcoming>(
    `select e.id, coalesce(e.data->>'prochaine', e.data->>'quand', e.data->>'echeance', e.data->>'date') as when,
            e.kind, e.title, s.name as space
       from entry e join space s on s.id = e.space_id
      where e.space_id = any($1) and e.archived_at is null
        and coalesce(e.data->>'statut', '') not in ('fait', 'envoyé', 'annulé')
        and coalesce(e.data->>'prochaine', e.data->>'quand', e.data->>'echeance', e.data->>'date')
            ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        and left(coalesce(e.data->>'prochaine', e.data->>'quand', e.data->>'echeance', e.data->>'date'), 10)
            between to_char(now(), 'YYYY-MM-DD') and to_char(now() + make_interval(days => $2), 'YYYY-MM-DD')
      order by 2 limit 50`,
    [spaceIds, days],
  );
  return rows;
}
