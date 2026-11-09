-- Spec 025: her tools, through Jarvis. A connector is a door from one of her spaces to an MCP
-- server: its address, how it is signed in to, its secret sealed by the server (never readable as
-- such here), and what its last check read (state, tools, resources).
create table connector (
  id text primary key,
  space_id text not null references space(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  url text not null check (url ~ '^https?://'),
  auth text not null default 'none' check (auth in ('none', 'bearer', 'header')),
  header_name text,
  secret_sealed text,
  state text not null default 'unchecked'
    check (state in ('unchecked', 'connected', 'refused', 'unreachable')),
  reason text,
  server_name text,
  tools jsonb not null default '[]',
  resources jsonb not null default '[]',
  checked_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (space_id, name)
);
alter table connector enable row level security;
create policy connector_members on connector
  using (jarvis_is_member(space_id)) with check (jarvis_is_member(space_id));
grant select, insert, update, delete on connector to jarvis_app;
