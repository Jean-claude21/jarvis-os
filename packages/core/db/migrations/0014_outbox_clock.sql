-- Spec 020: a message is due by the later of the watcher's clock and the database's. A message
-- entered in a pass is stamped by the database; a server clock a little behind it would leave it
-- waiting for the next pass.
create or replace function jarvis_outbox_pending(at timestamptz)
returns table (id bigint, person text)
language sql stable security definer set search_path = public as $$
  select id, person_id from outbox
   where state = 'queued' and next_try_at <= greatest(at, now())
   order by id
   limit 200
$$;
