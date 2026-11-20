-- The morning brief for whoever chose an hour (v3): Telegram is no longer required. The watcher
-- tells it through her channels — Telegram when linked, else e-mail (`channelsFor`). Nothing else
-- changes: who chose an hour, in her own space's « Channel ».

create or replace function jarvis_brief_people()
returns table (person text)
language sql stable security definer set search_path = public as $$
  select s.created_by
    from entry e join space s on s.id = e.space_id
   where e.archived_at is null
     and s.personal
     and jarvis_fold(e.kind) = 'channel'
     and coalesce(e.data->'preferences'->>'brief', '') <> ''
   limit 5000
$$;
