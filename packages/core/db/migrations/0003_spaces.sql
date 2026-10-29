-- Shared spaces (spec 004, decision 0005): a space is a circle of people. Each person keeps one
-- private space; shared ones are joined only through an invitation the invited address accepts.
-- A client reaches only the spaces she allowed it. Every table here carries its space and its
-- row-level security policy (constitution IV).

alter table space add column personal boolean not null default false;
-- The first space of each person is her own, private for good.
update space s set personal = true
 where s.created_at = (select min(o.created_at) from space o where o.created_by = s.created_by);

-- Read past `space`'s and `member`'s own policies, like `jarvis_is_member`.
create function jarvis_is_owner(target text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from member
                        where space_id = target and person_id = jarvis_person() and role = 'owner') $$;
create function jarvis_is_personal(target text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce((select personal from space where id = target), false) $$;

create policy space_rename on space for update
  using (jarvis_is_owner(id)) with check (jarvis_is_owner(id));
-- An owner changes roles; one leaves a shared space, or an owner removes someone else from it.
create policy member_role on member for update
  using (jarvis_is_owner(space_id)) with check (jarvis_is_owner(space_id));
create policy member_leave on member for delete using (
  not jarvis_is_personal(space_id)
  and (person_id = jarvis_person() or jarvis_is_owner(space_id))
);

create table invitation (
  id text primary key,
  space_id text not null references space(id) on delete cascade,
  email text not null check (length(email) between 3 and 320),
  -- Only the hash of the link's secret is kept.
  token_hash text not null unique,
  invited_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by text,
  accepted_at timestamptz,
  withdrawn_at timestamptz
);
create index invitation_space_idx on invitation (space_id, created_at desc);
alter table invitation enable row level security;
create policy invitation_read on invitation for select using (jarvis_is_member(space_id));
create policy invitation_make on invitation for insert with check (
  jarvis_is_owner(space_id) and not jarvis_is_personal(space_id) and invited_by = jarvis_person()
);
create policy invitation_withdraw on invitation for update
  using (jarvis_is_owner(space_id)) with check (jarvis_is_owner(space_id));

-- What a link shows before it is accepted: the space's name and its state, nothing else.
create function jarvis_invitation_preview(hash text)
  returns table (space_name text, email text, state text)
  language sql stable security definer set search_path = public
  as $$ select s.name, i.email,
               case when i.withdrawn_at is not null then 'withdrawn'
                    when i.accepted_at is not null then 'used'
                    when i.expires_at < now() then 'expired'
                    else 'open' end
          from invitation i join space s on s.id = i.space_id where i.token_hash = hash $$;

-- Accepting: the acting person, signed in with the invited address (given by the door, which
-- knows the accounts), becomes a member. Raises in words otherwise.
create function jarvis_accept_invitation(hash text, address text) returns text
  language plpgsql security definer set search_path = public
  as $$
declare
  found_one invitation;
begin
  if jarvis_person() is null then
    raise exception 'Sign in first.';
  end if;
  select * into found_one from invitation where token_hash = hash for update;
  if not found or found_one.withdrawn_at is not null then
    raise exception 'This invitation does not exist or was withdrawn.';
  end if;
  if found_one.accepted_at is not null then
    raise exception 'This invitation was already used.';
  end if;
  if found_one.expires_at < now() then
    raise exception 'This invitation has expired: ask for a new one.';
  end if;
  if lower(found_one.email) <> lower(address) then
    raise exception 'This invitation was sent to another address.';
  end if;
  insert into member (space_id, person_id, role) values (found_one.space_id, jarvis_person(), 'member')
    on conflict do nothing;
  update invitation set accepted_by = jarvis_person(), accepted_at = now() where id = found_one.id;
  return found_one.space_id;
end $$;

-- The spaces a client (an OAuth client: Claude, ChatGPT…) may reach for her.
create table client_space (
  person_id text not null,
  client_id text not null check (length(client_id) between 1 and 200),
  space_id text not null references space(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person_id, client_id, space_id)
);
alter table client_space enable row level security;
create policy client_space_all on client_space for all
  using (person_id = jarvis_person() and jarvis_is_member(space_id))
  with check (person_id = jarvis_person() and jarvis_is_member(space_id));

-- Column grants: a space's name, a member's role, an invitation's withdrawal — never `personal`.
grant update (name) on space to jarvis_app;
grant update (role) on member to jarvis_app;
grant delete on member to jarvis_app;
grant select, insert on invitation to jarvis_app;
grant update (withdrawn_at) on invitation to jarvis_app;
grant select, insert, delete on client_space to jarvis_app;
grant execute on function jarvis_is_owner(text), jarvis_is_personal(text),
  jarvis_invitation_preview(text), jarvis_accept_invitation(text, text) to jarvis_app;
