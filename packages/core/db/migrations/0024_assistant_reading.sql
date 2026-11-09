-- Spec 029: the charter received whole. An assistant starts a conversation with `context` (the day,
-- what changed, the charters in full); Jarvis keeps when each of her assistants last read it, so it
-- can remind one that did not, and she sees it.
create table assistant_reading (
  person_id text not null,
  -- The OAuth client, or « direct » for a connection without one (a personal key).
  client_id text not null,
  read_at timestamptz not null default now(),
  primary key (person_id, client_id)
);
alter table assistant_reading enable row level security;
create policy assistant_reading_hers on assistant_reading
  using (person_id = jarvis_person()) with check (person_id = jarvis_person());
grant select, insert, update on assistant_reading to jarvis_app;
