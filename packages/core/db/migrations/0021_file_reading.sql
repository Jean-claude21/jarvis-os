-- Spec 026: her files read, so that `find` reaches their words — the text of a PDF or a Word
-- document, what a photo shows in writing (OCR). Reading is slow: the watcher does it after the
-- upload, a few files each pass. `read_state`: pending, read, none (nothing to read), failed.
alter table file add column read_state text not null default 'none'
  check (read_state in ('pending', 'read', 'none', 'failed'));
alter table file add column read_error text;
alter table file add column read_at timestamptz;

update file set read_state = 'read', read_at = created_at where text is not null;
update file set read_state = 'pending'
 where text is null and media_type in (
   'application/pdf',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'image/jpeg', 'image/png', 'image/webp');

create index file_pending on file (created_at) where read_state = 'pending';

-- The files waiting to be read, each with a member of its space to read it as (its creator first).
create function jarvis_files_to_read(max integer)
returns table (entry_id text, space_id text, person text, storage_key text, media_type text)
language sql stable security definer set search_path = public as $$
  select f.entry_id, f.space_id, (
    select m.person_id from member m
     where m.space_id = f.space_id
     order by (m.person_id = s.created_by) desc, (m.role = 'owner') desc, m.created_at
     limit 1),
    f.storage_key, f.media_type
    from file f join space s on s.id = f.space_id
   where f.read_state = 'pending'
     and exists (select 1 from member m where m.space_id = f.space_id)
   order by f.created_at
   limit max
$$;
revoke all on function jarvis_files_to_read(integer) from public;
grant execute on function jarvis_files_to_read(integer) to jarvis_app;
