-- Files' words (spec 002): `find` reaches what a text file says, through this function, which reads
-- `file` under the same row-level security as the entry it belongs to.
create function jarvis_file_words(target text) returns text
  language sql stable
  as $$ select coalesce((select text from file where entry_id = target), '') $$;

grant execute on function jarvis_file_words(text) to jarvis_app;
