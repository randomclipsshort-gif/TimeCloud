begin;

create or replace function public.strip_private_financial_fields(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  result jsonb;
  entry record;
begin
  if jsonb_typeof(p_value) = 'object' then
    result := '{}'::jsonb;
    for entry in select key, value from jsonb_each(p_value)
    loop
      if entry.key !~*
        '(salary|wage|pay|earning|compensation|rate|bonus|commission|income|gross|deduction|tax|payroll|allowance|night.?differential|overtime.?multiplier|overtime.?amount|^(base|ot|penalty|est)$)'
      then
        result := result || jsonb_build_object(
          entry.key,
          public.strip_private_financial_fields(entry.value)
        );
      end if;
    end loop;
    return result;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    result := '[]'::jsonb;
    for entry in select value from jsonb_array_elements(p_value)
    loop
      result := result || jsonb_build_array(
        public.strip_private_financial_fields(entry.value)
      );
    end loop;
    return result;
  end if;

  return p_value;
end;
$$;

revoke all on function public.strip_private_financial_fields(jsonb) from public, anon, authenticated;

create or replace function public.preserve_legacy_financial_fields(
  p_existing jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  result jsonb;
  entry record;
  incoming_value jsonb;
  existing_values jsonb[];
  incoming_values jsonb[];
  index integer;
begin
  if jsonb_typeof(p_existing) = 'object'
    and jsonb_typeof(p_incoming) = 'object'
  then
    result := p_incoming;
    for entry in select key, value from jsonb_each(p_existing)
    loop
      if entry.key ~*
        '(salary|wage|pay|earning|compensation|rate|bonus|commission|income|gross|deduction|tax|payroll|allowance|night.?differential|overtime.?multiplier|overtime.?amount|^(base|ot|penalty|est)$)'
      then
        if not (p_incoming ? entry.key) then
          result := result || jsonb_build_object(entry.key, entry.value);
        end if;
      elsif p_incoming ? entry.key
        and jsonb_typeof(entry.value) in ('object', 'array')
        and jsonb_typeof(p_incoming -> entry.key) = jsonb_typeof(entry.value)
      then
        result := jsonb_set(
          result,
          array[entry.key],
          public.preserve_legacy_financial_fields(
            entry.value,
            p_incoming -> entry.key
          ),
          false
        );
      end if;
    end loop;
    return result;
  end if;

  if jsonb_typeof(p_existing) = 'array'
    and jsonb_typeof(p_incoming) = 'array'
  then
    select coalesce(array_agg(value order by ordinal), array[]::jsonb[])
    into existing_values
    from jsonb_array_elements(p_existing) with ordinality as entries(value, ordinal);
    select coalesce(array_agg(value order by ordinal), array[]::jsonb[])
    into incoming_values
    from jsonb_array_elements(p_incoming) with ordinality as entries(value, ordinal);

    result := '[]'::jsonb;
    for index in 1..coalesce(array_length(incoming_values, 1), 0)
    loop
      incoming_value := incoming_values[index];
      if index <= coalesce(array_length(existing_values, 1), 0) then
        incoming_value := public.preserve_legacy_financial_fields(
          existing_values[index],
          incoming_value
        );
      end if;
      result := result || jsonb_build_array(incoming_value);
    end loop;
    return result;
  end if;

  return p_incoming;
end;
$$;

revoke all on function public.preserve_legacy_financial_fields(jsonb, jsonb) from public, anon, authenticated;

update public.attendance_punches
set attendance_record = attendance_record || jsonb_build_object(
  'timeInAt', time_in,
  'timeOutAt', time_out,
  'timeZone', 'Asia/Manila'
);

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
  sanitized_data jsonb;
  attendance_entry record;
  attendance_date date;
  manual_time_in timestamptz;
  manual_time_out timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Invalid workspace data.';
  end if;

  sanitized_data := public.strip_private_financial_fields(p_data);

  if jsonb_typeof(sanitized_data -> 'attendance') = 'object' then
    for attendance_entry in
      select entry.key, entry.value
      from jsonb_each(sanitized_data -> 'attendance') as entry(key, value)
    loop
      if attendance_entry.key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception using errcode = '22023', message = 'Attendance contains an invalid date.';
      end if;
      attendance_date := attendance_entry.key::date;
      if attendance_date::text <> attendance_entry.key
        or jsonb_typeof(attendance_entry.value) is distinct from 'object'
      then
        raise exception using errcode = '22023', message = 'Attendance contains an invalid record.';
      end if;

      if attendance_entry.value ->> 'punchSource' = 'manual' then
        if attendance_entry.value ->> 'timeZone' is distinct from 'Asia/Manila'
          or (
            attendance_entry.value ->> 'type' is distinct from 'Regular'
            and attendance_entry.value ->> 'type' is distinct from 'Absent'
          )
        then
          raise exception using errcode = '22023', message = 'Manual attendance metadata is invalid.';
        end if;

        if attendance_entry.value ->> 'type' = 'Absent' then
          if not (attendance_entry.value ?& array[
            'manualTimeInAt',
            'manualTimeOutAt',
            'timeZone'
          ]::text[])
            or attendance_entry.value -> 'manualTimeInAt' <> 'null'::jsonb
            or attendance_entry.value -> 'manualTimeOutAt' <> 'null'::jsonb
          then
            raise exception using errcode = '22023', message = 'Manual absence timestamps are invalid.';
          end if;
        else
          if coalesce(attendance_entry.value ->> 'manualTimeInAt', '') !~ '^\d{4}-\d{2}-\d{2}T'
            or coalesce(attendance_entry.value ->> 'manualTimeOutAt', '') !~ '^\d{4}-\d{2}-\d{2}T'
            or coalesce(attendance_entry.value ->> 'workStartTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            or coalesce(attendance_entry.value ->> 'workEndTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          then
            raise exception using errcode = '22023', message = 'Manual attendance timestamps are invalid.';
          end if;

          manual_time_in := (attendance_entry.value ->> 'manualTimeInAt')::timestamptz;
          manual_time_out := (attendance_entry.value ->> 'manualTimeOutAt')::timestamptz;
          if manual_time_out <= manual_time_in
            or (manual_time_in at time zone 'Asia/Manila')::date <> attendance_date
            or (manual_time_out at time zone 'Asia/Manila')::date not between attendance_date and attendance_date + 1
            or to_char(manual_time_in at time zone 'Asia/Manila', 'HH24:MI') <>
              attendance_entry.value ->> 'workStartTime'
            or to_char(manual_time_out at time zone 'Asia/Manila', 'HH24:MI') <>
              attendance_entry.value ->> 'workEndTime'
          then
            raise exception using errcode = '22023', message = 'Manual attendance timestamps do not match the recorded times.';
          end if;
        end if;
      end if;
    end loop;
  end if;

  if pg_column_size(sanitized_data) > 1048576 then
    raise exception using errcode = '22023', message = 'Workspace data exceeds the allowed size.';
  end if;

  insert into public.user_workspaces (user_id, data)
  values (auth.uid(), sanitized_data)
  on conflict (user_id) do nothing
  returning revision into saved_revision;

  if found then
    return saved_revision;
  end if;

  update public.user_workspaces
  set data = public.preserve_legacy_financial_fields(
    public.user_workspaces.data,
    sanitized_data
  )
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

create or replace function public.clock_in_for_shift(
  p_shift_date date,
  p_record jsonb
)
returns table (time_at timestamptz, attendance_record jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  punch_time timestamptz := clock_timestamp();
  local_now timestamp without time zone;
  workspace_data jsonb;
  scheduled_record jsonb;
  local_date date;
  local_minutes integer;
  shift_start integer;
  shift_end integer;
  shift_end_absolute integer;
  punch_minutes_absolute integer;
  early_window integer;
  manila_time text;
  manila_display text;
  punch_record jsonb;
  safe_record jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_shift_date is null then
    raise exception using errcode = '22023', message = 'A scheduled shift is required to clock in.';
  end if;

  select workspaces.data
  into workspace_data
  from public.user_workspaces as workspaces
  where workspaces.user_id = caller_id;

  scheduled_record := workspace_data #> array['attendance', p_shift_date::text];
  if jsonb_typeof(scheduled_record) is distinct from 'object'
    or scheduled_record ->> 'type' is distinct from 'Regular'
    or scheduled_record ->> 'hasAssignedShift' is distinct from 'true'
    or coalesce(scheduled_record ->> 'shiftStartTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(scheduled_record ->> 'shiftEndTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  then
    raise exception using errcode = '22023', message = 'A saved scheduled shift is required to clock in.';
  end if;

  shift_start :=
    split_part(scheduled_record ->> 'shiftStartTime', ':', 1)::integer * 60 +
    split_part(scheduled_record ->> 'shiftStartTime', ':', 2)::integer;
  shift_end :=
    split_part(scheduled_record ->> 'shiftEndTime', ':', 1)::integer * 60 +
    split_part(scheduled_record ->> 'shiftEndTime', ':', 2)::integer;

  if shift_start >= 1440 or shift_end >= 1440 then
    raise exception using errcode = '22023', message = 'The saved shift has an invalid time.';
  end if;

  local_now := punch_time at time zone 'Asia/Manila';
  local_date := local_now::date;
  local_minutes := extract(hour from local_now)::integer * 60 +
    extract(minute from local_now)::integer;
  shift_end_absolute := case
    when shift_end <= shift_start then shift_end + 1440
    else shift_end
  end;
  punch_minutes_absolute := case
    when local_date = p_shift_date then local_minutes
    when local_date = p_shift_date + 1 and shift_end <= shift_start then local_minutes + 1440
    else -1
  end;
  early_window := case
    when coalesce(workspace_data ->> 'earlyPunchWindowMinutes', '') ~ '^[0-9]{1,3}$'
      then least(120, (workspace_data ->> 'earlyPunchWindowMinutes')::integer)
    else 15
  end;

  if punch_minutes_absolute < 0
    or punch_minutes_absolute < shift_start - early_window
    or punch_minutes_absolute >= shift_end_absolute
  then
    raise exception using errcode = '22023', message = 'The current time is outside the saved shift punch window.';
  end if;

  safe_record := public.strip_private_financial_fields(scheduled_record);
  manila_time := to_char(punch_time at time zone 'Asia/Manila', 'HH24:MI');
  manila_display := to_char(punch_time at time zone 'Asia/Manila', 'FMHH12:MI AM');
  punch_record := safe_record || jsonb_build_object(
    'in', manila_display,
    'out', '—',
    'workStartTime', manila_time,
    'workEndTime', '',
    'clockedIn', true,
    'punchSource', 'ordinary',
    'timeInAt', punch_time,
    'timeOutAt', null,
    'timeZone', 'Asia/Manila'
  );

  insert into public.attendance_punches (user_id, shift_date, time_in, attendance_record)
  values (caller_id, p_shift_date, punch_time, punch_record);

  return query select punch_time, punch_record;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'A time-in is already recorded for this shift.';
end;
$$;

create or replace function public.clock_out_for_shift(p_shift_date date)
returns table (time_at timestamptz, attendance_record jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  punch_time timestamptz := clock_timestamp();
  local_now timestamp without time zone;
  punch_record jsonb;
  manila_time text;
  manila_display text;
  shift_date date := p_shift_date;
  shift_start integer;
  shift_end integer;
  shift_end_absolute integer;
  punch_minutes_absolute integer;
  local_date date;
  local_minutes integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select punches.attendance_record
  into punch_record
  from public.attendance_punches as punches
  where punches.user_id = caller_id
    and punches.shift_date = shift_date
    and punches.time_out is null
  for update;

  if punch_record is null then
    raise exception using
      errcode = '23514',
      message = 'Time-out requires one active time-in and can only be recorded once.';
  end if;

  if coalesce(punch_record ->> 'shiftStartTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(punch_record ->> 'shiftEndTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  then
    raise exception using errcode = '22023', message = 'The saved shift has invalid times.';
  end if;

  shift_start :=
    split_part(punch_record ->> 'shiftStartTime', ':', 1)::integer * 60 +
    split_part(punch_record ->> 'shiftStartTime', ':', 2)::integer;
  shift_end :=
    split_part(punch_record ->> 'shiftEndTime', ':', 1)::integer * 60 +
    split_part(punch_record ->> 'shiftEndTime', ':', 2)::integer;
  shift_end_absolute := case
    when shift_end <= shift_start then shift_end + 1440
    else shift_end
  end;
  local_now := punch_time at time zone 'Asia/Manila';
  local_date := local_now::date;
  local_minutes := extract(hour from local_now)::integer * 60 +
    extract(minute from local_now)::integer;
  punch_minutes_absolute := case
    when local_date = shift_date then local_minutes
    when local_date = shift_date + 1 and shift_end <= shift_start then local_minutes + 1440
    else -1
  end;
  if punch_minutes_absolute < 0 or punch_minutes_absolute >= shift_end_absolute then
    raise exception using errcode = '22023', message = 'The current time is outside the saved shift clock-out window.';
  end if;

  manila_time := to_char(punch_time at time zone 'Asia/Manila', 'HH24:MI');
  manila_display := to_char(punch_time at time zone 'Asia/Manila', 'FMHH12:MI AM');

  update public.attendance_punches as punches
  set time_out = punch_time,
      attendance_record = punches.attendance_record || jsonb_build_object(
        'out', manila_display,
        'workEndTime', manila_time,
        'clockedIn', false,
        'timeOutAt', punch_time,
        'timeZone', 'Asia/Manila'
      )
  where punches.user_id = caller_id
    and punches.shift_date = shift_date
    and punches.time_out is null
  returning punches.attendance_record into punch_record;

  if punch_record is null then
    raise exception using
      errcode = '23514',
      message = 'Time-out requires one active time-in and can only be recorded once.';
  end if;

  return query select punch_time, punch_record;
end;
$$;

create table if not exists public.private_salary_vault (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ciphertext text not null,
  nonce text not null check (nonce ~ '^[A-Za-z0-9+/]{16}$'),
  salt text not null check (salt ~ '^[A-Za-z0-9+/]{22}==$'),
  format_version integer not null check (format_version = 1),
  key_version integer not null check (key_version > 0),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint private_salary_vault_ciphertext_size
    check (
      length(ciphertext) between 24 and 100000
      and ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'
    )
);

alter table public.private_salary_vault enable row level security;

drop policy if exists "Users can read their own encrypted salary vault"
  on public.private_salary_vault;
create policy "Users can read their own encrypted salary vault"
on public.private_salary_vault
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.private_salary_vault from public, anon, authenticated;
grant select on public.private_salary_vault to authenticated;

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
    or length(p_ciphertext) not between 24 and 100000
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

revoke all on function public.save_user_workspace(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_user_workspace(jsonb, bigint) to authenticated;

revoke all on function public.clock_in_for_shift(date, jsonb) from public, anon, authenticated;
grant execute on function public.clock_in_for_shift(date, jsonb) to authenticated;
revoke all on function public.clock_out_for_shift(date) from public, anon, authenticated;
grant execute on function public.clock_out_for_shift(date) to authenticated;

notify pgrst, 'reload schema';

commit;
