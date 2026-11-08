-- Personal keys (spec 015): a key she makes in her settings for an app of her own (the Jarvis
-- desktop or phone app to come) to reach her life through the REST API, as her. Like the accounts
-- and sessions, it belongs to the person, not to a space: no space_id, and its policy is hers alone.
-- Only the key's fingerprint (sha-256) is kept; the key is shown once.

create table personal_key (
  id text primary key,
  person_id text not null,
  name text not null,
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table personal_key enable row level security;
create policy personal_key_hers on personal_key
  using (person_id = current_setting('jarvis.person', true))
  with check (person_id = current_setting('jarvis.person', true));
grant select, insert, update on personal_key to jarvis_app;

-- Whose a key is, from its fingerprint, and nothing else; then the request acts as her.
create function jarvis_key_owner(fingerprint text)
returns text
language sql stable security definer set search_path = public as $$
  select person_id from personal_key
   where length(fingerprint) = 64 and personal_key.fingerprint = jarvis_key_owner.fingerprint
     and revoked_at is null
   limit 1
$$;

revoke all on function jarvis_key_owner(text) from public;
grant execute on function jarvis_key_owner(text) to jarvis_app;
