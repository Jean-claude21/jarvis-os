-- Spec 057: long work done outside Jarvis.
-- A work token is a program's key (spec 050) bound to one execution and to a time: it answers
-- nothing once that time has passed, and is revoked when the execution closes.
alter table personal_key add column execution_id text;
alter table personal_key add column expires_at timestamptz;
create index personal_key_execution_idx on personal_key (execution_id) where execution_id is not null;

-- Whose a key is, its limits, and the execution it serves — nothing else, and never once expired.
drop function jarvis_key_scope(text);
create function jarvis_key_scope(fingerprint text)
returns table (person text, space_id text, kinds text[], name text, execution_id text)
language sql stable security definer set search_path = public as $$
  select person_id, space_id, kinds, name, execution_id from personal_key
   where length(fingerprint) = 64 and personal_key.fingerprint = jarvis_key_scope.fingerprint
     and revoked_at is null
     and (expires_at is null or expires_at > now())
   limit 1
$$;
revoke all on function jarvis_key_scope(text) from public;
grant execute on function jarvis_key_scope(text) to jarvis_app;

-- The work whose time has passed without an answer, for the watcher (any person's): the token
-- tells whose it is, in which space, for which execution.
create function jarvis_overdue_work(at timestamptz)
returns table (person text, space_id text, execution_id text)
language sql stable security definer set search_path = public as $$
  select person_id, space_id, execution_id from personal_key
   where execution_id is not null and revoked_at is null and expires_at <= at
   limit 50
$$;
revoke all on function jarvis_overdue_work(timestamptz) from public;
grant execute on function jarvis_overdue_work(timestamptz) to jarvis_app;

-- A work token reaches the API alone (receive, close, a lent call), never the MCP door, and not
-- once expired.
create or replace function jarvis_key_owner(fingerprint text)
returns text
language sql stable security definer set search_path = public as $$
  select person_id from personal_key
   where length(fingerprint) = 64 and personal_key.fingerprint = jarvis_key_owner.fingerprint
     and revoked_at is null and execution_id is null
     and (expires_at is null or expires_at > now())
   limit 1
$$;
