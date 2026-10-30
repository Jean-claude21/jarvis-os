-- Technical names in English (spec 014): the system kinds Jarvis reads (Reminder, Channel, Charter,
-- Dashboard), the fields `text` and `instruction`, a dashboard's widgets, and the link roles Jarvis
-- writes (`for`, `mentions`, `part_of`). Her own kinds, fields and words stay as she wrote them.

update entry
   set kind = case jarvis_fold(kind)
                when 'rappel' then 'Reminder'
                when 'canal' then 'Channel'
                when 'charte' then 'Charter'
                when 'tableau de bord' then 'Dashboard'
              end
 where jarvis_fold(kind) in ('rappel', 'canal', 'charte', 'tableau de bord');

update entry
   set data = jarvis_renamed(data, '{"texte":"text","consigne":"instruction"}'),
       origin = jarvis_renamed(origin, '{"texte":"text","consigne":"instruction"}')
 where data ?| array['texte', 'consigne'];

update entry
   set data = jsonb_set(data, '{widgets}', (
         select coalesce(jsonb_agg(
                  jarvis_renamed(w, '{"titre":"title","requete":"query","graphe":"chart"}')
                  || case when w ? 'graphe' then jsonb_build_object('chart',
                       case w->>'graphe'
                         when 'nombre' then 'number'
                         when 'barres' then 'bar'
                         when 'courbe' then 'line'
                         when 'tableau' then 'table'
                         else w->>'graphe'
                       end) else '{}'::jsonb end
                  order by n), '[]'::jsonb)
           from jsonb_array_elements(data->'widgets') with ordinality as x(w, n)))
 where kind = 'Dashboard' and jsonb_typeof(data->'widgets') = 'array';

update link
   set role = case role
                when 'pour' then 'for'
                when 'mentionne' then 'mentions'
                when 'fait partie de' then 'part_of'
              end
 where role in ('pour', 'mentionne', 'fait partie de')
   and not exists (
     select 1 from link other
      where other.from_id = link.from_id and other.to_id = link.to_id
        and other.role = case link.role
                           when 'pour' then 'for'
                           when 'mentionne' then 'mentions'
                           when 'fait partie de' then 'part_of'
                         end);

create or replace function jarvis_due_reminders(horizon date)
returns table (entry_id text, space_id text, persons text[])
language sql stable security definer set search_path = public as $$
  select e.id, e.space_id,
         array(select m.person_id from member m where m.space_id = e.space_id order by m.created_at)
    from entry e
   where e.archived_at is null
     and jarvis_fold(e.kind) = 'reminder'
     and coalesce(e.data->>'status', '') not in ('sent', 'done', 'cancelled', 'to_fix', 'failed')
     and (
       (e.data ? 'repeat' and not e.data ? 'next')
       or left(coalesce(e.data->>'next', e.data->>'at'), 10) <= to_char(horizon, 'YYYY-MM-DD')
     )
   order by e.id
   limit 500
$$;

create or replace function jarvis_calendar_owner(fingerprint text)
returns text
language sql stable security definer set search_path = public as $$
  select s.created_by
    from entry e join space s on s.id = e.space_id
   where length(fingerprint) = 64
     and e.archived_at is null
     and s.personal
     and jarvis_fold(e.kind) = 'channel'
     and e.data->>'agenda' = fingerprint
   limit 1
$$;
