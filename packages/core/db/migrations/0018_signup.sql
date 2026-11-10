-- Spec 024: sign-up on invitation. Before an account exists there is no person to read as: this
-- says only whether an address has an invitation still open, nothing about it.
create function jarvis_invited(address text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from invitation
     where lower(email) = lower(address)
       and accepted_at is null and withdrawn_at is null and expires_at > now())
$$;
revoke all on function jarvis_invited(text) from public;
grant execute on function jarvis_invited(text) to jarvis_app;
