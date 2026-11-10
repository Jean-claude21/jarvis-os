-- The outbox (spec 020): every message Jarvis sends — a reminder, the morning brief — first enters
-- here, once (its `dedupe` key), then the watcher delivers it on its channel, tries again after a
-- failure, and keeps the trace. A message belongs to the person it is for: she alone reads it.
-- The watcher, which acts for no one, finds the pending ones through a function that returns ids.

create table outbox (
  id bigint generated always as identity primary key,
  person_id text not null,
  space_id text not null references space (id) on delete cascade,
  channel text not null,
  kind text not null,
  subject text not null,
  body text not null,
  entry_id text,
  dedupe text not null unique,
  state text not null default 'queued' check (state in ('queued', 'sent', 'failed', 'acted')),
  attempts integer not null default 0,
  next_try_at timestamptz not null default now(),
  last_error text,
  action text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  acted_at timestamptz
);
create index outbox_pending on outbox (next_try_at) where state = 'queued';
create index outbox_person on outbox (person_id, created_at desc);

alter table outbox enable row level security;
create policy outbox_hers on outbox
  using (person_id = jarvis_person())
  with check (person_id = jarvis_person());
grant select, insert, update on outbox to jarvis_app;

-- The messages to deliver now, and for whom: ids only, the delivery then acts as each person.
create function jarvis_outbox_pending(at timestamptz)
returns table (id bigint, person text)
language sql stable security definer set search_path = public as $$
  select id, person_id from outbox
   where state = 'queued' and next_try_at <= at
   order by id
   limit 200
$$;

-- Whose a message is, for an action link opened by someone not signed in (spec 020).
create function jarvis_outbox_person(message bigint)
returns text
language sql stable security definer set search_path = public as $$
  select person_id from outbox where id = message
$$;

-- Where to send her e-mail: her account's address, and nothing else.
create function jarvis_person_email(person text)
returns text
-- plpgsql: read when called, so a new database migrates before its accounts exist.
language plpgsql stable security definer set search_path = public as $$
begin
  return (select email from "user" where id = person);
end
$$;

revoke all on function jarvis_outbox_pending(timestamptz) from public;
revoke all on function jarvis_outbox_person(bigint) from public;
revoke all on function jarvis_person_email(text) from public;
grant execute on function jarvis_outbox_pending(timestamptz) to jarvis_app;
grant execute on function jarvis_outbox_person(bigint) to jarvis_app;
grant execute on function jarvis_person_email(text) to jarvis_app;
