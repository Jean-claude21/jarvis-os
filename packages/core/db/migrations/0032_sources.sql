-- v3 D16: the calendars she follows (ICS sources), read again every hour by the server — each as
-- the person who keeps it. Ids only.
create or replace function jarvis_ics_sources()
returns table (id text, person text)
language sql security definer set search_path = public as $$
  select c.id, c.created_by from connector c
   where c.protocol = 'api' and c.provider = 'ics' and c.state = 'connected'
   order by c.id limit 500
$$;
revoke all on function jarvis_ics_sources() from public;
grant execute on function jarvis_ics_sources() to jarvis_app;
