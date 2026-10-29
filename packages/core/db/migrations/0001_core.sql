-- The core (spec 001): a person's life as a space; entries of any kind, links, the journal of
-- every change, and the blob of a file. Every table carries its space and its row-level security
-- policy here, in the same migration (constitution IV).

-- Words compared accents and case aside: « Pharmacie » is « pharmacie », « Dépense » « depense ».
create extension if not exists unaccent;
create function jarvis_fold(value text) returns text
  language sql immutable parallel safe
  as $$ select lower(public.unaccent('public.unaccent'::regdictionary, value)) $$;

-- The acting person, set by the application in each transaction (`jarvis.person`).
create function jarvis_person() returns text
  language sql stable
  as $$ select nullif(current_setting('jarvis.person', true), '') $$;

create table space (
  id text primary key,
  name text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table member (
  space_id text not null references space(id) on delete cascade,
  person_id text not null,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (space_id, person_id)
);
create index member_person_idx on member (person_id);

-- Whether the acting person is a member of a space: read past `member`'s own policy.
create function jarvis_is_member(target text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from member where space_id = target and person_id = jarvis_person()) $$;

create table entry (
  id text primary key,
  space_id text not null references space(id) on delete cascade,
  kind text not null check (length(kind) between 1 and 80),
  title text not null check (length(title) between 1 and 300),
  data jsonb not null default '{}'::jsonb,
  -- Where each field comes from: said by her, read on a file (to check), inferred.
  origin jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, space_id)
);
create index entry_space_kind_idx on entry (space_id, kind) where archived_at is null;
create index entry_space_updated_idx on entry (space_id, updated_at desc);

create table link (
  id text primary key,
  space_id text not null references space(id) on delete cascade,
  from_id text not null,
  to_id text not null,
  role text not null check (length(role) between 1 and 80),
  created_at timestamptz not null default now(),
  foreign key (from_id, space_id) references entry (id, space_id) on delete cascade,
  foreign key (to_id, space_id) references entry (id, space_id) on delete cascade,
  unique (from_id, to_id, role)
);
create index link_to_idx on link (to_id);

create table journal (
  id bigint generated always as identity primary key,
  space_id text not null references space(id) on delete cascade,
  at timestamptz not null default clock_timestamp(),
  command text not null,
  target text not null,
  before jsonb,
  after jsonb,
  actor text not null,
  door text not null,
  client text,
  undone_by bigint references journal(id)
);
create index journal_space_idx on journal (space_id, id desc);
create index journal_target_idx on journal (target);

create table file (
  entry_id text primary key,
  space_id text not null,
  storage_key text not null,
  name text not null,
  media_type text not null,
  size bigint not null,
  text text,
  created_at timestamptz not null default now(),
  foreign key (entry_id, space_id) references entry (id, space_id) on delete cascade
);

alter table space enable row level security;
alter table member enable row level security;
alter table entry enable row level security;
alter table link enable row level security;
alter table journal enable row level security;
alter table file enable row level security;

create policy space_read on space for select using (jarvis_is_member(id));
create policy space_make on space for insert with check (created_by = jarvis_person());
create policy member_read on member for select using (person_id = jarvis_person() or jarvis_is_member(space_id));
-- One makes oneself the owner of a space one just created (read past `space`'s own policy: she
-- is not its member yet).
create function jarvis_created(target text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from space where id = target and created_by = jarvis_person()) $$;
create policy member_make on member for insert with check (
  person_id = jarvis_person() and jarvis_created(space_id)
);
create policy entry_all on entry for all using (jarvis_is_member(space_id)) with check (jarvis_is_member(space_id));
create policy link_all on link for all using (jarvis_is_member(space_id)) with check (jarvis_is_member(space_id));
create policy journal_all on journal for all using (jarvis_is_member(space_id)) with check (jarvis_is_member(space_id));
create policy file_all on file for all using (jarvis_is_member(space_id)) with check (jarvis_is_member(space_id));

-- What a query runs as (decision 0004): it is granted nothing here. Each query copies her rows
-- into temporary tables (`my_entries`, `my_links`, `my_files`) and grants it only those, so no
-- trick on the session's settings can reach anyone else's life.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'jarvis_reader') then
    create role jarvis_reader nologin nobypassrls;
  end if;
end $$;

grant usage on schema public to jarvis_app, jarvis_reader;
grant select, insert on space, member to jarvis_app;
grant select, insert, update on entry, journal, file to jarvis_app;
grant select, insert, delete on link to jarvis_app;
grant execute on function jarvis_person(), jarvis_is_member(text), jarvis_created(text) to jarvis_app;
grant execute on function jarvis_fold(text) to jarvis_app, jarvis_reader;
grant jarvis_reader to jarvis_app;
