-- Spec 022: each night, each space exported as a Markdown folder into the storage; kept thirty
-- days. A row per backup, read by the space's members; the watcher finds the spaces whose backup of
-- the day is missing and acts as one of their members.
create table space_backup (
  id bigint generated always as identity primary key,
  space_id text not null references space(id) on delete cascade,
  day date not null,
  storage_key text not null,
  size integer not null,
  files integer not null,
  created_at timestamptz not null default now(),
  unique (space_id, day)
);
create index space_backup_space on space_backup (space_id, day desc);
alter table space_backup enable row level security;
create policy space_backup_members on space_backup
  using (jarvis_is_member(space_id)) with check (jarvis_is_member(space_id));
grant select, insert, delete on space_backup to jarvis_app;

-- The spaces without a backup of `today`, each with the member who backs it up (its creator when
-- still a member, else its oldest owner); `max` at most.
create function jarvis_backup_due(today date, max integer)
returns table (space_id text, person text)
language sql stable security definer set search_path = public as $$
  select s.id, (
    select m.person_id from member m
     where m.space_id = s.id
     order by (m.person_id = s.created_by) desc, (m.role = 'owner') desc, m.created_at
     limit 1)
    from space s
   where not exists (select 1 from space_backup b where b.space_id = s.id and b.day = today)
     and exists (select 1 from member m where m.space_id = s.id)
   order by s.id
   limit max
$$;
revoke all on function jarvis_backup_due(date, integer) from public;
grant execute on function jarvis_backup_due(date, integer) to jarvis_app;
