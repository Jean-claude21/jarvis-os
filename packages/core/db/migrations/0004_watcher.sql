-- The watcher (spec 006): it finds the reminders that may be due in every space, and the people
-- of each, without reading anything else. It then acts as each person, under row-level security.
-- No table: a reminder is an entry « Rappel »; where she is told is an entry « Canal ».

create function jarvis_due_reminders(horizon date)
returns table (entry_id text, space_id text, persons text[])
language sql stable security definer set search_path = public as $$
  select e.id, e.space_id,
         array(select m.person_id from member m where m.space_id = e.space_id order by m.created_at)
    from entry e
   where e.archived_at is null
     and jarvis_fold(e.kind) = 'rappel'
     and coalesce(e.data->>'statut', '') not in ('envoyé', 'envoye', 'fait', 'annulé', 'annule', 'à corriger', 'non envoyé')
     and (
       -- A repeated one whose next time is not known yet.
       (e.data ? 'repete' and not e.data ? 'prochaine')
       or left(coalesce(e.data->>'prochaine', e.data->>'quand'), 10) <= to_char(horizon, 'YYYY-MM-DD')
     )
   order by e.id
   limit 500
$$;

revoke all on function jarvis_due_reminders(date) from public;
grant execute on function jarvis_due_reminders(date) to jarvis_app;
