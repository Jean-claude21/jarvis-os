-- Spec 050: agents outside Jarvis.
-- A key for a program keeps its limits: one space (null: all of hers, as a personal key) and the
-- kinds it may write (null: any). The request acts as her, within them.
alter table personal_key add column space_id text references space(id) on delete cascade;
alter table personal_key add column kinds text[];

-- Whose a key is, and its limits, from its fingerprint — nothing else.
create function jarvis_key_scope(fingerprint text)
returns table (person text, space_id text, kinds text[], name text)
language sql stable security definer set search_path = public as $$
  select person_id, space_id, kinds, name from personal_key
   where length(fingerprint) = 64 and personal_key.fingerprint = jarvis_key_scope.fingerprint
     and revoked_at is null
   limit 1
$$;
revoke all on function jarvis_key_scope(text) from public;
grant execute on function jarvis_key_scope(text) to jarvis_app;

-- A connection speaks MCP, or plain HTTP (an agent's own address, called by a rule's `call`).
alter table connector add column protocol text not null default 'mcp'
  check (protocol in ('mcp', 'http'));
