-- Spec 016. Two things:
--
-- 1. Shares: a public link to a form (« confirme ta présence ») or to a view of one of her
--    collections. A share is an entry « Share » whose `token` is the fingerprint (sha-256) of the
--    link's key. This finds whose share a key is, and nothing else; the page then acts as her, under
--    row-level security.
--
-- 2. Viewers: a member of a shared space who reads and never writes (a child, a guest). Reading
--    stays « is a member »; writing becomes « is a member who is not a viewer ».

create function jarvis_share(fingerprint text)
returns table (person text, space_id text, entry_id text)
language sql stable security definer set search_path = public as $$
  select s.created_by, e.space_id, e.id
    from entry e join space s on s.id = e.space_id
   where length(fingerprint) = 64
     and e.archived_at is null
     and jarvis_fold(e.kind) = 'share'
     and e.data->>'token' = fingerprint
     and coalesce(e.data->>'active', 'true') <> 'false'
   limit 1
$$;

revoke all on function jarvis_share(text) from public;
grant execute on function jarvis_share(text) to jarvis_app;

alter table member drop constraint if exists member_role_check;
alter table member add constraint member_role_check check (role in ('owner', 'member', 'viewer'));

create function jarvis_can_write(target text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from member
                  where space_id = target and person_id = jarvis_person() and role <> 'viewer') $$;

grant execute on function jarvis_can_write(text) to jarvis_app;

drop policy entry_all on entry;
create policy entry_read on entry for select using (jarvis_is_member(space_id));
create policy entry_write on entry for insert with check (jarvis_can_write(space_id));
create policy entry_change on entry for update using (jarvis_can_write(space_id)) with check (jarvis_can_write(space_id));
create policy entry_drop on entry for delete using (jarvis_can_write(space_id));

drop policy link_all on link;
create policy link_read on link for select using (jarvis_is_member(space_id));
create policy link_write on link for insert with check (jarvis_can_write(space_id));
create policy link_change on link for update using (jarvis_can_write(space_id)) with check (jarvis_can_write(space_id));
create policy link_drop on link for delete using (jarvis_can_write(space_id));

drop policy file_all on file;
create policy file_read on file for select using (jarvis_is_member(space_id));
create policy file_write on file for insert with check (jarvis_can_write(space_id));
create policy file_change on file for update using (jarvis_can_write(space_id)) with check (jarvis_can_write(space_id));
create policy file_drop on file for delete using (jarvis_can_write(space_id));

drop policy journal_all on journal;
create policy journal_read on journal for select using (jarvis_is_member(space_id));
-- Who belongs is journaled for viewers too: a viewer may leave.
create policy journal_write on journal for insert
  with check (jarvis_can_write(space_id) or (jarvis_is_member(space_id) and command like 'space.%'));
create policy journal_change on journal for update using (jarvis_can_write(space_id)) with check (jarvis_can_write(space_id));
