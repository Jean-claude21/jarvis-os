-- v3 F7 (after 0034–0036): a member opened some kinds only reads the notes on the entries she sees,
-- and writes some. A note (« Comment ») is read when the entry it is on is; she may write one in any
-- case (it holds only her words): she reads it once it is on an entry she sees.

-- Whether the acting person reads this note: it is on an entry she sees.
create function jarvis_reads_note(target text, note text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from link l
     where l.space_id = $1 and l.from_id = $2 and jarvis_fold(l.role) = 'on'
       and jarvis_sees_entry($1, l.to_id)) $$;

-- An entry seen by its id (links, files, journal lines): a note on what she sees counts too.
create or replace function jarvis_sees_entry(target text, entry text) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when jarvis_open_kinds($1) is null then jarvis_is_member($1)
    else exists (select 1 from entry e where e.id = $2 and e.space_id = $1
                    and (jarvis_fold(e.kind) = any (jarvis_open_kinds($1))
                         or jarvis_structure(e.kind)
                         or (jarvis_fold(e.kind) = 'comment'
                             and exists (select 1 from link l
                                          where l.space_id = $1 and l.from_id = e.id
                                            and jarvis_fold(l.role) = 'on'
                                            and exists (select 1 from entry d
                                                         where d.id = l.to_id and d.space_id = $1
                                                           and (jarvis_fold(d.kind) = any (jarvis_open_kinds($1))
                                                                or jarvis_structure(d.kind)))))))
  end $$;

grant execute on function jarvis_reads_note(text, text) to jarvis_app;

drop policy entry_read on entry;
create policy entry_read on entry for select
  using (jarvis_reads(space_id, kind)
         or (jarvis_fold(kind) = 'comment' and jarvis_is_member(space_id)
             and jarvis_reads_note(space_id, id)));

drop policy entry_write on entry;
create policy entry_write on entry for insert
  with check (jarvis_can_write(space_id)
              and (jarvis_sees(space_id, kind) or jarvis_fold(kind) = 'comment'));
