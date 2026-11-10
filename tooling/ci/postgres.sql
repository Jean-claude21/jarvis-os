-- The database of a CI run, on the runner itself (no network between the tests and it): roles as
-- on Neon — an owner that is no superuser, and the app's role, under row-level security.
create role jarvis_owner login createrole;
create role jarvis_app login nobypassrls;
create database jarvis owner jarvis_owner;
\connect jarvis
create extension if not exists unaccent;
create extension if not exists pg_trgm;
create extension if not exists vector;
alter schema public owner to jarvis_owner;
