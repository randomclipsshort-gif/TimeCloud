begin;

alter table public.private_salary_vault
  drop constraint if exists private_salary_vault_ciphertext_size;

alter table public.private_salary_vault
  add constraint private_salary_vault_ciphertext_size
  check (
    length(ciphertext) between 24 and 1000000
    and ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'
  );

create or replace function public.save_private_salary_vault(
  p_ciphertext text,
  p_nonce text,
  p_salt text,
  p_format_version integer,
  p_key_version integer,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  saved_revision bigint;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_ciphertext is null
    or length(p_ciphertext) not between 24 and 1000000
    or p_ciphertext !~ '^[A-Za-z0-9+/]+={0,2}$'
    or p_nonce is null
    or p_nonce !~ '^[A-Za-z0-9+/]{16}$'
    or p_salt is null
    or p_salt !~ '^[A-Za-z0-9+/]{22}==$'
    or p_format_version is distinct from 1
    or p_key_version is null
    or p_key_version < 1
    or p_expected_revision is null
    or p_expected_revision < 0
  then
    raise exception using errcode = '22023', message = 'Invalid encrypted salary-vault data.';
  end if;

  if p_expected_revision = 0 then
    insert into public.private_salary_vault (
      user_id,
      ciphertext,
      nonce,
      salt,
      format_version,
      key_version
    )
    values (
      caller_id,
      p_ciphertext,
      p_nonce,
      p_salt,
      p_format_version,
      p_key_version
    )
    on conflict (user_id) do nothing
    returning revision into saved_revision;

    if saved_revision is not null then
      return saved_revision;
    end if;
  else
    update public.private_salary_vault as vault
    set ciphertext = p_ciphertext,
        nonce = p_nonce,
        salt = p_salt,
        format_version = p_format_version,
        key_version = p_key_version,
        revision = vault.revision + 1,
        updated_at = now()
    where vault.user_id = caller_id
      and vault.revision = p_expected_revision
    returning vault.revision into saved_revision;

    if saved_revision is not null then
      return saved_revision;
    end if;
  end if;

  raise exception using
    errcode = '40001',
    message = 'The salary vault changed in another session. Reload it before saving again.';
end;
$$;

revoke all on function public.save_private_salary_vault(text, text, text, integer, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.save_private_salary_vault(text, text, text, integer, integer, bigint)
  to authenticated;

notify pgrst, 'reload schema';

commit;
