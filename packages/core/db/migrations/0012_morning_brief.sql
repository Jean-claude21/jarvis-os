-- The morning brief (spec 018): the watcher finds the people who chose an hour for it and have
-- where to be told — a « Channel » of their own space with a Telegram chat and `preferences.brief`
-- — and nothing else. It then acts as each person, under row-level security. No table.

create function jarvis_brief_people()
returns table (person text)
language sql stable security definer set search_path = public as $$
  select s.created_by
    from entry e join space s on s.id = e.space_id
   where e.archived_at is null
     and s.personal
     and jarvis_fold(e.kind) = 'channel'
     and coalesce(e.data->>'telegram', '') <> ''
     and coalesce(e.data->'preferences'->>'brief', '') <> ''
   limit 5000
$$;

revoke all on function jarvis_brief_people() from public;
grant execute on function jarvis_brief_people() to jarvis_app;
