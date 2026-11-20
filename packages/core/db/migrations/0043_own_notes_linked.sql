-- v3 F7 (after 0042): the link from a note she writes to the entry it is on is read back as it is
-- made: a note she wrote counts as seen, for its links too.

create or replace function jarvis_sees_entry(target text, entry text) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when jarvis_open_kinds($1) is null then jarvis_is_member($1)
    else exists (select 1 from entry e where e.id = $2 and e.space_id = $1
                    and (jarvis_fold(e.kind) = any (jarvis_open_kinds($1))
                         or jarvis_structure(e.kind)
                         or (jarvis_fold(e.kind) = 'comment'
                             and (e.data->>'by' = jarvis_person()
                                  or exists (select 1 from link l
                                              where l.space_id = $1 and l.from_id = e.id
                                                and jarvis_fold(l.role) = 'on'
                                                and exists (select 1 from entry d
                                                             where d.id = l.to_id and d.space_id = $1
                                                               and (jarvis_fold(d.kind) = any (jarvis_open_kinds($1))
                                                                    or jarvis_structure(d.kind))))))))
  end $$;
