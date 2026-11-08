-- Rules (spec 014): the watcher finds the rules that may be due in every space — a schedule whose
-- next run has come (or is not known yet), a « before » rule not run today — and the people of
-- each, without reading anything else. It then acts as each person, under row-level security.
-- No table: a rule is an entry « Rule ».

create function jarvis_due_rules(now timestamptz)
returns table (entry_id text, space_id text, persons text[])
language sql stable security definer set search_path = public as $$
  select e.id, e.space_id,
         array(select m.person_id from member m where m.space_id = e.space_id order by m.created_at)
    from entry e
   where e.archived_at is null
     and jarvis_fold(e.kind) = 'rule'
     and coalesce(e.data->>'active', 'true') <> 'false'
     and (
       (e.data->'when' ? 'schedule'
         and (not e.data ? 'next' or (e.data->>'next')::timestamptz <= now))
       or (e.data->'when' ? 'before'
         and coalesce(e.data->>'last_run', '') < to_char(now, 'YYYY-MM-DD'))
     )
   order by e.id
   limit 500
$$;

revoke all on function jarvis_due_rules(timestamptz) from public;
grant execute on function jarvis_due_rules(timestamptz) to jarvis_app;
