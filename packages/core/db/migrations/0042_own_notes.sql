-- v3 F7 (after 0040–0041): a member opened some kinds only reads the notes she wrote herself (the
-- note is read back before it is linked to the entry it is on), and those on entries she sees.

drop policy entry_read on entry;
create policy entry_read on entry for select
  using (jarvis_reads(space_id, kind)
         or (jarvis_fold(kind) = 'comment' and jarvis_is_member(space_id)
             and (data->>'by' = jarvis_person() or jarvis_reads_note(space_id, id))));
