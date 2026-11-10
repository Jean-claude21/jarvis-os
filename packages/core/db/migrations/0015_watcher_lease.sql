-- Spec 021: one watcher at a time on a database, and the trace of its last pass. The lease holds no
-- one's life; `jarvis_app` reaches it through these functions only.
create table watcher_lease (
  name text primary key,
  holder text not null,
  until timestamptz not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  report jsonb,
  error text
);
revoke all on watcher_lease from public;

-- The lease for `seconds`, when it is free, expired, or already hers; true when taken.
create function jarvis_lease_take(lease text, who text, seconds integer)
returns boolean
language sql volatile security definer set search_path = public as $$
  insert into watcher_lease as held (name, holder, until, started_at)
  values (lease, who, now() + make_interval(secs => seconds), now())
  on conflict (name) do update
     set holder = excluded.holder, until = excluded.until, started_at = excluded.started_at,
         ended_at = null, report = null, error = null
   where held.until < now() or held.holder = excluded.holder
  returning true
$$;

-- The lease given back by its holder, with what the pass did or why it failed.
create function jarvis_lease_give(lease text, who text, done jsonb, failure text)
returns boolean
language sql volatile security definer set search_path = public as $$
  update watcher_lease
     set until = now(), ended_at = now(), report = done, error = failure
   where name = lease and holder = who
  returning true
$$;

-- The last pass: who, when, how it ended.
create function jarvis_lease_last(lease text)
returns table (holder text, until timestamptz, started_at timestamptz, ended_at timestamptz,
               report jsonb, error text)
language sql stable security definer set search_path = public as $$
  select holder, until, started_at, ended_at, report, error from watcher_lease where name = lease
$$;

revoke all on function jarvis_lease_take(text, text, integer) from public;
revoke all on function jarvis_lease_give(text, text, jsonb, text) from public;
revoke all on function jarvis_lease_last(text) from public;
grant execute on function jarvis_lease_take(text, text, integer) to jarvis_app;
grant execute on function jarvis_lease_give(text, text, jsonb, text) to jarvis_app;
grant execute on function jarvis_lease_last(text) to jarvis_app;

