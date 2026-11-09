-- Spec 027: search that forgives a typing slip. Trigrams compare words letter by letter; a word
-- close enough to one she wrote still finds it.
create extension if not exists pg_trgm;
