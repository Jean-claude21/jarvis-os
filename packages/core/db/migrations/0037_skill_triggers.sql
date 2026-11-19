-- v3 F6b: one vocabulary for « when » (core/src/triggers.ts). A skill (an entry « Routine ») said
-- what starts it in its own words — `trigger: { phrases, repeat, saved }` (spec 047). It now says
-- it as the rules do — `triggers: [{ phrase }, { schedule }, { saved }]`. Her words are kept: each
-- phrase, the kind saved, and the time when it is five fields (a time in words stays her reminder,
-- `repeat`, as before). Her `repeat` and `remind` (the reminder of a timed skill) are not touched.

update entry e
   set data = (e.data - 'trigger') || jsonb_build_object('triggers', coalesce((
         select jsonb_agg(t) from (
           select jsonb_build_object('phrase', p) as t
             from jsonb_array_elements_text(coalesce(e.data->'trigger'->'phrases', '[]'::jsonb)) as p
            where length(trim(p)) >= 2
           union all
           select jsonb_build_object('schedule', e.data->'trigger'->>'repeat')
            where e.data->'trigger'->>'repeat' ~ '^\S+(\s+\S+){4}$'
           union all
           select jsonb_build_object('saved', e.data->'trigger'->>'saved')
            where coalesce(e.data->'trigger'->>'saved', '') <> ''
         ) as made), '[]'::jsonb))
 where jarvis_fold(e.kind) = 'routine' and jsonb_typeof(e.data->'trigger') = 'object';
