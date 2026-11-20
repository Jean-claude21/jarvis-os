-- Rest for the database (after the Neon quota of 19 Nov 2026): the watcher no longer looks every
-- minute. After each pass it asks when it is next needed — the next scheduled rule, the next try of
-- a message in the outbox (the reminders and briefs it computes itself) — and sleeps until then, so
-- the database is left alone and its compute suspends. These read past row-level security, like
-- `jarvis_due_rules`, and give a time only: nothing personal.

create function jarvis_next_rule_run()
returns timestamptz
language sql stable security definer set search_path = public as $$
  select min((e.data->>'next')::timestamptz)
    from entry e
   where e.archived_at is null
     and jarvis_fold(e.kind) = 'rule'
     and coalesce(e.data->>'active', 'true') <> 'false'
     and e.data->'when' ? 'schedule'
     and e.data ? 'next'
$$;

create function jarvis_outbox_next()
returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(next_try_at) from outbox where state = 'queued'
$$;

revoke all on function jarvis_next_rule_run() from public;
revoke all on function jarvis_outbox_next() from public;
grant execute on function jarvis_next_rule_run(), jarvis_outbox_next() to jarvis_app;
