begin;

create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_workspaces_data_is_object
    check (jsonb_typeof(data) = 'object'),
  constraint user_workspaces_data_size
    check (pg_column_size(data) <= 1048576)
);

create or replace function public.touch_user_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;

revoke all on function public.touch_user_workspace() from public, anon, authenticated;

drop trigger if exists user_workspaces_touch on public.user_workspaces;
create trigger user_workspaces_touch
before update on public.user_workspaces
for each row execute function public.touch_user_workspace();

alter table public.user_workspaces enable row level security;

drop policy if exists "Users can read their own workspace" on public.user_workspaces;
create policy "Users can read their own workspace"
on public.user_workspaces
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own workspace" on public.user_workspaces;
create policy "Users can create their own workspace"
on public.user_workspaces
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own workspace" on public.user_workspaces;
create policy "Users can update their own workspace"
on public.user_workspaces
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own workspace" on public.user_workspaces;
create policy "Users can delete their own workspace"
on public.user_workspaces
for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.user_workspaces from public, anon, authenticated;
grant select on public.user_workspaces to authenticated;

create or replace function public.save_user_workspace(
  p_data jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_revision bigint;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 1048576 then
    raise exception using errcode = '22023', message = 'Invalid workspace data.';
  end if;

  insert into public.user_workspaces (user_id, data)
  values (auth.uid(), p_data)
  on conflict (user_id) do nothing
  returning revision into saved_revision;

  if found then
    return saved_revision;
  end if;

  update public.user_workspaces
  set data = p_data
  where user_id = auth.uid()
    and revision = p_expected_revision
  returning revision into saved_revision;

  if saved_revision is null then
    raise exception using
      errcode = '40001',
      message = 'Workspace changed in another session. Reload cloud data before saving again.';
  end if;

  return saved_revision;
end;
$$;

revoke all on function public.save_user_workspace(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_user_workspace(jsonb, bigint) to authenticated;

commit;
