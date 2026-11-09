-- Spec 025, US4: servers that ask her to sign in (OAuth). What Jarvis keeps of that sign-in (its
-- registration with the server, the tokens, the proof of the request on its way) is sealed by the
-- server in `oauth_sealed`, like a key.
alter table connector drop constraint connector_auth_check;
alter table connector add constraint connector_auth_check
  check (auth in ('none', 'bearer', 'header', 'oauth'));
alter table connector drop constraint connector_state_check;
alter table connector add constraint connector_state_check
  check (state in ('unchecked', 'connected', 'refused', 'unreachable', 'needs_sign_in'));
alter table connector add column oauth_sealed text;
