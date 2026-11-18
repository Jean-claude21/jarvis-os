-- v3 F7 (D15): what a member sees in a shared space, by kind. An owner opens a member some kinds of
-- the space only (« Courses » and « Repas », not « Finances »): `member.kinds`. Null — the default —
-- opens everything, as before. An owner always sees everything.
--
-- Row-level security does the work, never the application: an entry of another kind is not read,
-- not written; its links, its file and its journal lines are not read either (a journal line keeps
-- an entry's values, a link says what is tied to what).

alter table member add column kinds text[];

-- The kinds opened to the acting person in a space, folded; null when everything is open to her.
create function jarvis_open_kinds(target text) returns text[]
  language sql stable security definer set search_path = public as $$
  select case when m.role = 'owner' or m.kinds is null then null
              else array(select jarvis_fold(k) from unnest(m.kinds) as k) end
    from member m
   where m.space_id = target and m.person_id = jarvis_person() $$;

-- Whether the acting person sees an entry of this kind in this space.
create function jarvis_sees(target text, kind text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from member m
     where m.space_id = target and m.person_id = jarvis_person()
       and (m.role = 'owner' or m.kinds is null
            or jarvis_fold(kind) = any (array(select jarvis_fold(k) from unnest(m.kinds) as k)))) $$;

-- Whether the acting person sees an entry, by its id (links, files, journal lines).
create function jarvis_sees_entry(target text, entry text) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when jarvis_open_kinds($1) is null then jarvis_is_member($1)
    else exists (select 1 from entry e where e.id = $2 and e.space_id = $1
                    and jarvis_fold(e.kind) = any (jarvis_open_kinds($1)))
  end $$;

grant execute on function jarvis_open_kinds(text), jarvis_sees(text, text),
  jarvis_sees_entry(text, text) to jarvis_app;

drop policy entry_read on entry;
create policy entry_read on entry for select using (jarvis_sees(space_id, kind));
drop policy entry_write on entry;
create policy entry_write on entry for insert
  with check (jarvis_can_write(space_id) and jarvis_sees(space_id, kind));
drop policy entry_change on entry;
create policy entry_change on entry for update
  using (jarvis_can_write(space_id) and jarvis_sees(space_id, kind))
  with check (jarvis_can_write(space_id) and jarvis_sees(space_id, kind));
drop policy entry_drop on entry;
create policy entry_drop on entry for delete
  using (jarvis_can_write(space_id) and jarvis_sees(space_id, kind));

-- A link is read when both its ends are.
drop policy link_read on link;
create policy link_read on link for select
  using (jarvis_sees_entry(space_id, from_id) and jarvis_sees_entry(space_id, to_id));

drop policy file_read on file;
create policy file_read on file for select using (jarvis_sees_entry(space_id, entry_id));

-- A journal line about an entry is read when the entry is; the lines about the space itself (who
-- belongs, an app removed) stay readable by every member who sees everything.
drop policy journal_read on journal;
create policy journal_read on journal for select
  using (jarvis_is_member(space_id)
         and (jarvis_open_kinds(space_id) is null or jarvis_sees_entry(space_id, target)));
