-- The accounts' migration granted every table it did not know to `jarvis_app` (found here, spec
-- 021). It now grants Better Auth's tables only; these tables get back the grants their own
-- migrations gave. Revoking a table's privileges revokes its columns' too: those are given again.
revoke all on watcher_lease from jarvis_app;
revoke all on outbox from jarvis_app;
grant select, insert, update on outbox to jarvis_app;
revoke all on personal_key from jarvis_app;
grant select, insert, update on personal_key to jarvis_app;
revoke all on client_space from jarvis_app;
grant select, insert, delete on client_space to jarvis_app;
revoke all on invitation from jarvis_app;
grant select, insert on invitation to jarvis_app;
grant update (withdrawn_at) on invitation to jarvis_app;
