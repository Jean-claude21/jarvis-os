-- The engine speaks English (spec 014, decision 0008): the keywords specs 006–013 stored in French
-- are renamed in every entry — time and state fields, states, models and their kind. Her own kinds,
-- fields and values stay as she wrote them. The watcher's function reads the new names.

-- An object with some keys renamed; a key whose new name is already there is left as it is.
create function jarvis_renamed(value jsonb, renames jsonb) returns jsonb
  language sql immutable as $$
  select coalesce(
    jsonb_object_agg(
      case when renames ? key and not value ? (renames->>key) then renames->>key else key end,
      item),
    '{}'::jsonb)
  from jsonb_each(value) as e(key, item)
$$;

-- Time and state fields, in her data and in what says where each value comes from.
update entry
   set data = jarvis_renamed(data, '{"debut":"start","fin":"end","duree":"duration","quand":"at","echeance":"due","repete":"repeat","sauf":"except","jusqu":"until","fuseau":"timezone","statut":"status","prochaine":"next","dernier_envoi":"last_sent","erreur":"error"}'),
       origin = jarvis_renamed(origin, '{"debut":"start","fin":"end","duree":"duration","quand":"at","echeance":"due","repete":"repeat","sauf":"except","jusqu":"until","fuseau":"timezone","statut":"status","prochaine":"next","dernier_envoi":"last_sent","erreur":"error"}')
 where jarvis_fold(kind) <> 'modele'
   and data ?| array['debut','fin','duree','quand','echeance','repete','sauf','jusqu','fuseau','statut','prochaine','dernier_envoi','erreur'];

-- States.
update entry
   set data = jsonb_set(data, '{status}', to_jsonb(
         case jarvis_fold(data->>'status')
           when 'propose' then 'proposed'
           when 'fait' then 'done'
           when 'annule' then 'cancelled'
           when 'envoye' then 'sent'
           when 'non envoye' then 'failed'
           when 'a corriger' then 'to_fix'
           when 'a venir' then 'planned'
         end))
 where jarvis_fold(data->>'status') in ('propose', 'fait', 'annule', 'envoye', 'non envoye', 'a corriger', 'a venir');

-- Models: their kind, their keywords, their fields' keywords and types.
update entry
   set kind = 'Model',
       data = jarvis_renamed(data, '{"champs":"fields","ouvert":"open","rangement":"path","colonnes":"columns","regroupement":"groupBy"}')
 where jarvis_fold(kind) = 'modele';

update entry
   set data = jsonb_set(data, '{fields}', (
         select coalesce(jsonb_agg(
                  jarvis_renamed(f, '{"nom":"name","nature":"type","obligatoire":"required","choix":"options","vers":"target","unite":"unit","aide":"help"}')
                  || case when f ? 'nature' then jsonb_build_object('type',
                       case f->>'nature'
                         when 'texte' then 'text'
                         when 'nombre' then 'number'
                         when 'montant' then 'amount'
                         when 'moment' then 'datetime'
                         when 'duree' then 'duration'
                         when 'choix' then 'choice'
                         when 'oui-non' then 'boolean'
                         when 'liste' then 'list'
                         when 'lien' then 'link'
                         else f->>'nature'
                       end) else '{}'::jsonb end
                  order by n), '[]'::jsonb)
           from jsonb_array_elements(data->'fields') with ordinality as x(f, n)))
 where kind = 'Model' and jsonb_typeof(data->'fields') = 'array';

-- The watcher reads the new names.
create or replace function jarvis_due_reminders(horizon date)
returns table (entry_id text, space_id text, persons text[])
language sql stable security definer set search_path = public as $$
  select e.id, e.space_id,
         array(select m.person_id from member m where m.space_id = e.space_id order by m.created_at)
    from entry e
   where e.archived_at is null
     and jarvis_fold(e.kind) = 'rappel'
     and coalesce(e.data->>'status', '') not in ('sent', 'done', 'cancelled', 'to_fix', 'failed')
     and (
       -- A repeated one whose next time is not known yet.
       (e.data ? 'repeat' and not e.data ? 'next')
       or left(coalesce(e.data->>'next', e.data->>'at'), 10) <= to_char(horizon, 'YYYY-MM-DD')
     )
   order by e.id
   limit 500
$$;
