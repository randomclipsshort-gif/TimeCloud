begin;

create table if not exists public.attendance_punches (
  user_id uuid not null references auth.users (id) on delete cascade,
  shift_date date not null,
  time_in timestamptz not null,
  time_out timestamptz,
  attendance_record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, shift_date),
  constraint attendance_punches_record_is_object
    check (jsonb_typeof(attendance_record) = 'object'),
  constraint attendance_punches_record_size
    check (pg_column_size(attendance_record) <= 65536),
  constraint attendance_punches_time_order
    check (time_out is null or time_out > time_in)
);

create or replace function public.touch_attendance_punch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_attendance_punch() from public, anon, authenticated;

drop trigger if exists attendance_punches_touch on public.attendance_punches;
create trigger attendance_punches_touch
before update on public.attendance_punches
for each row execute function public.touch_attendance_punch();

alter table public.attendance_punches enable row level security;

drop policy if exists "Users can read their own attendance punches" on public.attendance_punches;
create policy "Users can read their own attendance punches"
on public.attendance_punches
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.attendance_punches from public, anon, authenticated;
grant select on public.attendance_punches to authenticated;

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
  manila_time text;
  manila_display text;
  punch_record jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_shift_date is null
    or jsonb_typeof(p_record) <> 'object'
    or p_record ->> 'type' is distinct from 'Regular'
    or p_record ->> 'hasAssignedShift' is distinct from 'true'
    or not (p_record ? 'shiftStartTime' and p_record ? 'shiftEndTime')
  then
    raise exception using errcode = '22023', message = 'A scheduled shift is required to clock in.';
  end if;

  manila_time := to_char(punch_time at time zone 'Asia/Manila', 'HH24:MI');
  manila_display := to_char(punch_time at time zone 'Asia/Manila', 'FMHH12:MI AM');
  punch_record := p_record || jsonb_build_object(
    'in', manila_display,
    'out', '—',
    'workStartTime', manila_time,
    'workEndTime', '',
    'clockedIn', true,
    'punchSource', 'ordinary'
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
  manila_time text;
  manila_display text;
  punch_record jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  manila_time := to_char(punch_time at time zone 'Asia/Manila', 'HH24:MI');
  manila_display := to_char(punch_time at time zone 'Asia/Manila', 'FMHH12:MI AM');

  update public.attendance_punches as punches
  set time_out = punch_time,
      attendance_record = punches.attendance_record || jsonb_build_object(
        'out', manila_display,
        'workEndTime', manila_time,
        'clockedIn', false
      )
  where punches.user_id = caller_id
    and punches.shift_date = p_shift_date
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

revoke all on function public.clock_in_for_shift(date, jsonb) from public, anon, authenticated;
revoke all on function public.clock_out_for_shift(date) from public, anon, authenticated;
grant execute on function public.clock_in_for_shift(date, jsonb) to authenticated;
grant execute on function public.clock_out_for_shift(date) to authenticated;

commit;
