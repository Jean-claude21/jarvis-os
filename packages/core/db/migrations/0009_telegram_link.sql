-- Linking her Telegram from the app (spec 015): she opens the bot with a code made for her; the
-- watcher reads the code the bot received and finds whose it is — the fingerprint (sha-256) of a
-- code still valid in the « Channel » entry of a personal space — and nothing else. It then acts as
-- her, under row-level security.

create function jarvis_channel_by_code(fingerprint text)
returns table (person text, space_id text, entry_id text)
language sql stable security definer set search_path = public as $$
  select s.created_by, e.space_id, e.id
    from entry e join space s on s.id = e.space_id
   where length(fingerprint) = 64
     and e.archived_at is null
     and s.personal
     and jarvis_fold(e.kind) = 'channel'
     and e.data->>'telegram_code' = fingerprint
     and (e.data->>'telegram_code_until')::timestamptz > now()
   limit 1
$$;

revoke all on function jarvis_channel_by_code(text) from public;
grant execute on function jarvis_channel_by_code(text) to jarvis_app;
