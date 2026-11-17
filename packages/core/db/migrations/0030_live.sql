-- v3 D9: the journal, live. Each line written tells the listening servers which space changed, so
-- the screens of that space update without reloading. Only ids and the command travel — never her
-- data; each screen reads what it may see, as always, under row-level security.
create or replace function journal_live() returns trigger language plpgsql as $$
begin
  perform pg_notify('jarvis_journal', json_build_object(
    'space', new.space_id, 'id', new.id, 'command', new.command, 'target', new.target,
    'actor', new.actor, 'door', new.door, 'at', new.at)::text);
  return new;
end $$;

create trigger journal_live after insert on journal for each row execute function journal_live();
