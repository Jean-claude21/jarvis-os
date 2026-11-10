-- Spec 028: finding the entries to turn without reading them all. An entry is turned again when it
-- or its file's words changed after its vector (dates), not by hashing every entry at each pass.
create or replace function jarvis_entries_to_embed(current_model text, max integer)
returns table (entry_id text, space_id text, person text)
language sql stable security definer set search_path = public as $$
  select e.id, e.space_id, (
    select m.person_id from member m
     where m.space_id = e.space_id
     order by (m.person_id = s.created_by) desc, (m.role = 'owner') desc, m.created_at
     limit 1)
    from entry e join space s on s.id = e.space_id
    left join entry_vector v on v.entry_id = e.id
    left join file f on f.entry_id = e.id
   where e.archived_at is null
     and exists (select 1 from member m where m.space_id = e.space_id)
     and (v.entry_id is null or v.model <> current_model
          or e.updated_at > v.updated_at or f.read_at > v.updated_at)
   order by e.updated_at desc
   limit max
$$;

create index if not exists entry_updated on entry (updated_at desc) where archived_at is null;
