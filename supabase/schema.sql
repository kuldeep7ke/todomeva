-- Multi-Device Sync for Todo Meva (run once in Supabase SQL Editor)
-- Stores every entity type (category, template, task, activity) in one sync_docs table.
create table if not exists public.sync_docs (
  id text primary key,
  entity text not null default '',
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sync_docs_entity_idx on public.sync_docs (entity);
create index if not exists sync_docs_updated_at_idx on public.sync_docs (updated_at);

alter table public.sync_docs enable row level security;

-- Tables created via the SQL Editor are not exposed to the anon/authenticated
-- roles by default, so explicit grants are required for the app to sync.
grant select, insert, update, delete on table public.sync_docs to anon;
grant select, insert, update, delete on table public.sync_docs to authenticated;

drop policy if exists "sync_docs_anon_all" on public.sync_docs;
create policy "sync_docs_anon_all"
  on public.sync_docs
  for all
  to anon
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sync_docs'
  ) then
    alter publication supabase_realtime add table public.sync_docs;
  end if;
end $$;