-- v3 F7 (after 0034): a member opened some kinds only still reads how the space is built — its
-- models, pages, views, apps, areas, agents, rules and scripts — so her screens draw. These hold
-- no one's life, only its shape. She writes none of them: only the kinds opened to her.

create function jarvis_structure(kind text) returns boolean
  language sql immutable as $$
  select jarvis_fold(kind) in ('model', 'page', 'view', 'app', 'area', 'agent', 'rule', 'script') $$;

-- What the acting person reads: what she sees, and the space's structure.
create function jarvis_reads(target text, kind text) returns boolean
  language sql stable security definer set search_path = public as $$
  select jarvis_sees(target, kind) or (jarvis_structure(kind) and jarvis_is_member(target)) $$;

create or replace function jarvis_sees_entry(target text, entry text) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when jarvis_open_kinds($1) is null then jarvis_is_member($1)
    else exists (select 1 from entry e where e.id = $2 and e.space_id = $1
                    and (jarvis_fold(e.kind) = any (jarvis_open_kinds($1))
                         or jarvis_structure(e.kind)))
  end $$;

grant execute on function jarvis_structure(text), jarvis_reads(text, text) to jarvis_app;

drop policy entry_read on entry;
create policy entry_read on entry for select using (jarvis_reads(space_id, kind));
