-- Spec 028: search by meaning. Each entry's words (title, fields, a file's words) are turned into a
-- vector by an outside model; an entry whose words changed is turned again. Read by the space's
-- members only, like the entry.
create extension if not exists vector;

create table entry_vector (
  entry_id text primary key references entry(id) on delete cascade,
  space_id text not null references space(id) on delete cascade,
  model text not null,
  -- What was turned: a hash of the words, to know when they changed.
  said_hash text not null,
  embedding vector(1024) not null,
  updated_at timestamptz not null default now()
);
create index entry_vector_space on entry_vector (space_id);
create index entry_vector_near on entry_vector using hnsw (embedding vector_cosine_ops);
alter table entry_vector enable row level security;
create policy entry_vector_members on entry_vector
  using (jarvis_is_member(space_id)) with check (jarvis_is_member(space_id));
grant select, insert, update, delete on entry_vector to jarvis_app;

-- What an entry says, as turned into a vector; read as whoever asks (her rights apply).
create function jarvis_said(target text) returns text
language sql stable set search_path = public as $$
  select left(e.title || E'\n' || (e.data - 'source')::text || E'\n' || jarvis_file_words(e.id), 8000)
    from entry e where e.id = target
$$;
grant execute on function jarvis_said(text) to jarvis_app;

-- The entries whose vector is missing or old (their words changed, or another model), each with a
-- member of its space to read it as; the most recently changed first.
create function jarvis_entries_to_embed(current_model text, max integer)
returns table (entry_id text, space_id text, person text)
language sql stable security definer set search_path = public as $$
  select e.id, e.space_id, (
    select m.person_id from member m
     where m.space_id = e.space_id
     order by (m.person_id = s.created_by) desc, (m.role = 'owner') desc, m.created_at
     limit 1)
    from entry e join space s on s.id = e.space_id
    left join entry_vector v on v.entry_id = e.id
   where e.archived_at is null
     and exists (select 1 from member m where m.space_id = e.space_id)
     and (v.entry_id is null or v.model <> current_model or v.said_hash <> md5(jarvis_said(e.id)))
   order by e.updated_at desc
   limit max
$$;
revoke all on function jarvis_entries_to_embed(text, integer) from public;
grant execute on function jarvis_entries_to_embed(text, integer) to jarvis_app;
