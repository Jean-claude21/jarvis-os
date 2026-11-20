-- v3 F7 (after 0040): a member opened some kinds only reads her own journal lines — they hold only
-- what she wrote (a note on an entry she sees is journaled before it is linked to that entry).

drop policy journal_read on journal;
create policy journal_read on journal for select
  using (jarvis_is_member(space_id)
         and (jarvis_open_kinds(space_id) is null
              or actor = jarvis_person()
              or jarvis_sees_entry(space_id, target)));
