import type pg from 'pg';
import type { Tx } from './db';

// The outbox (spec 020): every message Jarvis sends enters here once, then is delivered on its
// channel, tried again after a failure, and keeps its trace. The core knows no channel: a channel
// is a word (« telegram », « email ») the doors give meaning to.

/** After a failed delivery, the next try waits this long; after the last, the message has failed. */
export const RETRY_MINUTES = [1, 5, 30] as const;

export interface Message {
  id: number;
  personId: string;
  spaceId: string;
  channel: string;
  kind: string;
  subject: string;
  body: string;
  entryId: string | null;
  state: 'queued' | 'sent' | 'failed' | 'acted';
  attempts: number;
  lastError: string | null;
  action: string | null;
  createdAt: string;
  sentAt: string | null;
  actedAt: string | null;
}

const COLUMNS = `id::int, person_id as "personId", space_id as "spaceId", channel, kind, subject, body,
  entry_id as "entryId", state, attempts, last_error as "lastError", action,
  created_at as "createdAt", sent_at as "sentAt", acted_at as "actedAt"`;

/**
 * Enters a message, once: a second message with the same `dedupe` key is ignored (no message is
 * ever sent twice), unless the first failed for good: then it is tried again (spec 023, « Retry »).
 * Its id, or null when it was there already. Runs as the person it is for.
 */
export async function enterMessage(
  tx: Tx,
  message: {
    person: string;
    spaceId: string;
    channel: string;
    kind: string;
    subject: string;
    body: string;
    entryId?: string | null;
    dedupe: string;
  },
): Promise<number | null> {
  const { rows } = await tx.query<{ id: number }>(
    `insert into outbox (person_id, space_id, channel, kind, subject, body, entry_id, dedupe)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (dedupe) do update
       set state = 'queued', attempts = 0, next_try_at = now(), last_error = null
     where outbox.state = 'failed'
     returning id::int`,
    [
      message.person,
      message.spaceId,
      message.channel,
      message.kind,
      message.subject,
      message.body,
      message.entryId ?? null,
      message.dedupe,
    ],
  );
  return rows[0]?.id ?? null;
}

/** The messages to deliver by `now`, and for whom (the watcher, which acts for no one). */
export async function pendingMessages(
  db: pg.Pool,
  now: Date,
): Promise<{ id: number; person: string }[]> {
  const { rows } = await db.query<{ id: string; person: string }>(
    'select id, person from jarvis_outbox_pending($1)',
    [now.toISOString()],
  );
  return rows.map((row) => ({ id: Number(row.id), person: row.person }));
}

/** Whose a message is (for an action link opened by someone not signed in). */
export async function messagePerson(db: pg.Pool, id: number): Promise<string | null> {
  const { rows } = await db.query<{ person: string | null }>(
    'select jarvis_outbox_person($1) as person',
    [id],
  );
  return rows[0]?.person ?? null;
}

/** Her e-mail address (the watcher, to send her an e-mail). */
export async function personEmail(db: pg.Pool, person: string): Promise<string | null> {
  const { rows } = await db.query<{ email: string | null }>(
    'select jarvis_person_email($1) as email',
    [person],
  );
  return rows[0]?.email ?? null;
}

export async function messageOf(tx: Tx, id: number): Promise<Message | null> {
  const { rows } = await tx.query<Message>(`select ${COLUMNS} from outbox where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function markSent(tx: Tx, id: number, now: Date): Promise<void> {
  await tx.query(
    `update outbox set state = 'sent', sent_at = $2, attempts = attempts + 1, last_error = null
      where id = $1 and state = 'queued'`,
    [id, now.toISOString()],
  );
}

/** A failed delivery: tried again later, or failed for good after the last try. */
export async function markFailed(tx: Tx, id: number, error: string, now: Date): Promise<boolean> {
  const { rows } = await tx.query<{ attempts: number }>(
    'select attempts from outbox where id = $1',
    [id],
  );
  const attempts = (rows[0]?.attempts ?? 0) + 1;
  const wait = RETRY_MINUTES[attempts - 1];
  await tx.query(
    `update outbox set attempts = $2, last_error = $3,
       state = case when $4::timestamptz is null then 'failed' else 'queued' end,
       next_try_at = coalesce($4::timestamptz, next_try_at)
      where id = $1 and state = 'queued'`,
    [
      id,
      attempts,
      error.slice(0, 500),
      wait === undefined ? null : new Date(now.getTime() + wait * 60_000).toISOString(),
    ],
  );
  return wait === undefined;
}

/** An action taken from the message (a link in an e-mail): once only. True when it was the first. */
export async function markActed(tx: Tx, id: number, action: string, now: Date): Promise<boolean> {
  const { rowCount } = await tx.query(
    `update outbox set state = 'acted', action = $2, acted_at = $3
      where id = $1 and state = 'sent' and action is null`,
    [id, action, now.toISOString()],
  );
  return (rowCount ?? 0) > 0;
}

/** Her messages of the last days, newest first. */
export async function recentMessages(tx: Tx, days = 7): Promise<Message[]> {
  const { rows } = await tx.query<Message>(
    `select ${COLUMNS} from outbox
      where created_at > now() - make_interval(days => $1)
      order by created_at desc
      limit 500`,
    [days],
  );
  return rows;
}
