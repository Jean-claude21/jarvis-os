-- Spec 081: a space's identity — its colour (the dot of the sidebar, the agenda, the deadlines) and a
-- line that says what it is for. Changed by an owner, like its name (policy `space_rename`).
alter table space add column color text;
alter table space add column description text;
grant update (color, description) on space to jarvis_app;
