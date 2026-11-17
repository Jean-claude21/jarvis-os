-- v3 D16: one base for every call outside. A connection may now be an `api`: a provider Jarvis
-- knows (Google Agenda, Drive, an ICS calendar…), reached through its relay. Each keeps how its
-- checks went (failures in a row, the last time it answered), and once a day the server checks
-- those not checked since — what breaks shows in « À régler ».
alter table connector drop constraint connector_protocol_check;
alter table connector add constraint connector_protocol_check
  check (protocol in ('mcp', 'http', 'api'));
alter table connector add column provider text;
alter table connector add column failures integer not null default 0;
alter table connector add column last_ok_at timestamptz;

-- The connections the daily check is due for, across spaces, with who keeps each: the server then
-- checks each one as that person (row-level security as always). Ids only.
create or replace function jarvis_connections_due(stale interval)
returns table (id text, person text)
language sql security definer set search_path = public as $$
  select c.id, c.created_by from connector c
   where c.checked_at is null or c.checked_at < now() - stale
   order by c.checked_at nulls first limit 200
$$;
revoke all on function jarvis_connections_due(interval) from public;
grant execute on function jarvis_connections_due(interval) to jarvis_app;
