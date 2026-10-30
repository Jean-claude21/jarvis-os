-- The calendar (spec 011): no table — time is a property of entries. Her phone's calendar reads
-- her Jarvis calendar through a private address; the address carries a key whose fingerprint
-- (sha-256) is kept in her « Canal » entry. This finds whose key it is, and nothing else; the feed
-- is then read as her, under row-level security.

create function jarvis_calendar_owner(fingerprint text)
returns text
language sql stable security definer set search_path = public as $$
  select s.created_by
    from entry e join space s on s.id = e.space_id
   where length(fingerprint) = 64
     and e.archived_at is null
     and s.personal
     and jarvis_fold(e.kind) = 'canal'
     and e.data->>'agenda' = fingerprint
   limit 1
$$;

revoke all on function jarvis_calendar_owner(text) from public;
grant execute on function jarvis_calendar_owner(text) to jarvis_app;
