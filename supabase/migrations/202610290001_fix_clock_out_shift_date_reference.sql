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
    and punches.shift_date = p_shift_date
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
    when local_date = p_shift_date then local_minutes
    when local_date = p_shift_date + 1 and shift_end <= shift_start then local_minutes + 1440
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
