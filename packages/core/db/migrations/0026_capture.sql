-- Spec 035: what she writes to the bot is kept in her own space. The watcher finds whose a chat is —
-- the « Channel » of a personal space that names it — and nothing else, then acts as her.
create function jarvis_person_by_chat(chat text)
returns table (person text, space_id text)
language sql stable security definer set search_path = public as $$
  select s.created_by, e.space_id
    from entry e join space s on s.id = e.space_id
   where length(chat) between 1 and 40
     and e.archived_at is null
     and s.personal
     and jarvis_fold(e.kind) = 'channel'
     and e.data->>'telegram' = chat
   limit 1
$$;
revoke all on function jarvis_person_by_chat(text) from public;
grant execute on function jarvis_person_by_chat(text) to jarvis_app;
