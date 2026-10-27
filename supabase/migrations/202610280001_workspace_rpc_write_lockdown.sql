begin;

alter function public.save_user_workspace(jsonb, bigint) security definer;
alter function public.save_user_workspace(jsonb, bigint) set search_path = '';

revoke all on public.user_workspaces from public, anon, authenticated;
grant select on public.user_workspaces to authenticated;

revoke all on function public.save_user_workspace(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_user_workspace(jsonb, bigint) to authenticated;

commit;
