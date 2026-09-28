-- =============================================================
-- POSTY — Housekeeping: RPC functions & triggers
-- All security definer, set search_path = public, idempotent
-- =============================================================

-- -----------------------------------------------
-- start_cleaning: camarera inicia una limpieza
-- -----------------------------------------------
create or replace function public.start_cleaning(p_cleaning_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cleaning record;
begin
  select * into v_cleaning from public.room_cleanings where id = p_cleaning_id;
  if v_cleaning is null then
    raise exception 'Limpieza no encontrada';
  end if;
  if v_cleaning.status != 'scheduled' and v_cleaning.status != 'in_progress' then
    raise exception 'Esta limpieza no se puede iniciar (estado: %)', v_cleaning.status;
  end if;
  if v_cleaning.status = 'in_progress' then
    return json_build_object('success', true, 'already_started', true);
  end if;

  update public.room_cleanings
  set status = 'in_progress',
      started_at = now(),
      assigned_to = coalesce(assigned_to, auth.uid())
  where id = p_cleaning_id;

  update public.rooms
  set housekeeping_status = 'cleaning'
  where id = v_cleaning.room_id;

  return json_build_object('success', true, 'room_number',
    (select number from public.rooms where id = v_cleaning.room_id));
end;
$$;

-- -----------------------------------------------
-- complete_cleaning: camarera finaliza la limpieza
-- -----------------------------------------------
create or replace function public.complete_cleaning(
  p_cleaning_id uuid,
  p_notes text default null,
  p_issues_found boolean default false,
  p_issue_description text default null,
  p_minibar_charged boolean default false,
  p_checklist jsonb default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cleaning record;
  v_ct record;
  v_config record;
  v_current_stay record;
  v_next_date timestamptz;
  v_next_type_id uuid;
  v_role_id uuid;
  v_room record;
begin
  select * into v_cleaning from public.room_cleanings where id = p_cleaning_id;
  if v_cleaning is null then raise exception 'Limpieza no encontrada'; end if;

  select * into v_ct from public.cleaning_types where id = v_cleaning.cleaning_type_id;
  select * into v_config from public.housekeeping_config where organization_id = v_cleaning.organization_id;
  select * into v_room from public.rooms where id = v_cleaning.room_id;

  -- Mark completed
  update public.room_cleanings
  set status = 'completed',
      completed_at = now(),
      completed_by = auth.uid(),
      notes = coalesce(p_notes, notes),
      issues_found = p_issues_found,
      issue_description = p_issue_description,
      minibar_charged = p_minibar_charged,
      checklist = coalesce(p_checklist, checklist),
      inspection_status = case when v_ct.requires_inspection then 'pending'::inspection_status else 'not_required'::inspection_status end
  where id = p_cleaning_id;

  -- Update room
  update public.rooms
  set last_cleaned_at = now(),
      last_cleaned_by = auth.uid(),
      housekeeping_status = case when v_ct.requires_inspection then 'clean' else 'inspected' end
  where id = v_cleaning.room_id;

  -- Schedule next weekly if room is occupied
  select s.* into v_current_stay
  from public.stays s
  where s.room_id = v_cleaning.room_id and s.status = 'checked_in'
  limit 1;

  if v_current_stay is not null then
    v_next_date := now() + (coalesce(v_config.frequency_days, 7) || ' days')::interval;

    if v_current_stay.check_out_date::timestamp > v_next_date then
      -- Get the weekly type for this org
      select id into v_next_type_id
      from public.cleaning_types
      where organization_id = v_cleaning.organization_id and system_key = 'weekly_occupied'
      limit 1;

      if v_next_type_id is not null then
        -- Delete existing scheduled weekly for this room (unique constraint)
        delete from public.room_cleanings
        where room_id = v_cleaning.room_id
          and origin = 'auto_weekly'
          and status = 'scheduled';

        -- Get camarera role
        select id into v_role_id
        from public.roles
        where organization_id = v_cleaning.organization_id and system_key = 'room_attendant'
        limit 1;

        -- Schedule next
        insert into public.room_cleanings (
          organization_id, room_id, stay_id, cleaning_type_id,
          status, scheduled_for, origin, assigned_role_id, created_by
        ) values (
          v_cleaning.organization_id, v_cleaning.room_id, v_current_stay.id,
          v_next_type_id, 'scheduled',
          (v_next_date::date::timestamp + coalesce(v_config.default_time, '10:00'::time))
            at time zone coalesce(
              (select timezone from public.organizations where id = v_cleaning.organization_id),
              'America/Bogota'
            ),
          'auto_weekly', v_role_id, auth.uid()
        );
      end if;
    end if;
  end if;

  return json_build_object(
    'success', true,
    'room_number', v_room.number,
    'duration_minutes', round(extract(epoch from now() - v_cleaning.started_at) / 60.0, 1),
    'requires_inspection', v_ct.requires_inspection,
    'next_cleaning_date', v_next_date::date
  );
end;
$$;

-- -----------------------------------------------
-- skip_cleaning
-- -----------------------------------------------
create or replace function public.skip_cleaning(
  p_cleaning_id uuid,
  p_reason text,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cleaning record;
  v_config record;
  v_role_id uuid;
  v_consecutive_skips int;
begin
  select * into v_cleaning from public.room_cleanings where id = p_cleaning_id;
  if v_cleaning is null then raise exception 'Limpieza no encontrada'; end if;

  select * into v_config from public.housekeeping_config where organization_id = v_cleaning.organization_id;

  -- Mark skipped
  update public.room_cleanings
  set status = 'skipped',
      skipped_reason = p_reason,
      skipped_note = p_note
  where id = p_cleaning_id;

  -- Reschedule for TOMORROW
  select id into v_role_id
  from public.roles
  where organization_id = v_cleaning.organization_id and system_key = 'room_attendant'
  limit 1;

  -- Delete any existing scheduled weekly
  delete from public.room_cleanings
  where room_id = v_cleaning.room_id
    and origin = 'auto_weekly'
    and status = 'scheduled'
    and id != p_cleaning_id;

  insert into public.room_cleanings (
    organization_id, room_id, stay_id, cleaning_type_id,
    status, scheduled_for, origin, assigned_role_id, created_by
  ) values (
    v_cleaning.organization_id, v_cleaning.room_id, v_cleaning.stay_id,
    v_cleaning.cleaning_type_id, 'scheduled',
    ((current_date + 1)::timestamp + coalesce(v_config.default_time, '10:00'::time))
      at time zone coalesce(
        (select timezone from public.organizations where id = v_cleaning.organization_id),
        'America/Bogota'
      ),
    v_cleaning.origin, v_role_id, auth.uid()
  );

  -- Check 2 consecutive skips → alert Recepción
  select count(*) into v_consecutive_skips
  from public.room_cleanings
  where room_id = v_cleaning.room_id
    and status = 'skipped'
    and created_at > now() - interval '14 days'
  order by created_at desc
  limit 3;

  if v_consecutive_skips >= 2 then
    -- Create task for front_desk
    declare
      v_fd_role_id uuid;
      v_status_id uuid;
      v_guest_name text;
    begin
      select id into v_fd_role_id from public.roles where organization_id = v_cleaning.organization_id and system_key = 'front_desk' limit 1;
      select id into v_status_id from public.task_statuses where organization_id = v_cleaning.organization_id and type = 'open' order by sort_order limit 1;
      select g.first_name || ' ' || g.last_name into v_guest_name
      from public.stays s join public.guests g on g.id = s.primary_guest_id
      where s.id = v_cleaning.stay_id;

      if v_fd_role_id is not null and v_status_id is not null then
        insert into public.tasks (
          organization_id, title, status_id, priority,
          room_id, stay_id, assigned_role_id, source, created_by
        ) values (
          v_cleaning.organization_id,
          'Coordinar limpieza con ' || coalesce(v_guest_name, 'huésped') || ' · Hab. ' || (select number from public.rooms where id = v_cleaning.room_id),
          v_status_id, 'urgent'::task_priority,
          v_cleaning.room_id, v_cleaning.stay_id, v_fd_role_id, 'stay_workflow', auth.uid()
        );
      end if;
    end;
  end if;

  return json_build_object('success', true, 'rescheduled_for', current_date + 1);
end;
$$;

-- -----------------------------------------------
-- inspect_cleaning
-- -----------------------------------------------
create or replace function public.inspect_cleaning(
  p_cleaning_id uuid,
  p_approved boolean,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cleaning record;
begin
  select * into v_cleaning from public.room_cleanings where id = p_cleaning_id;
  if v_cleaning is null then raise exception 'Limpieza no encontrada'; end if;

  if p_approved then
    update public.room_cleanings
    set inspection_status = 'approved',
        inspected_by = auth.uid(),
        inspected_at = now(),
        inspection_notes = p_notes
    where id = p_cleaning_id;

    update public.rooms
    set housekeeping_status = 'inspected'
    where id = v_cleaning.room_id;
  else
    update public.room_cleanings
    set inspection_status = 'rejected',
        inspected_by = auth.uid(),
        inspected_at = now(),
        inspection_notes = p_notes,
        status = 'in_progress'
    where id = p_cleaning_id;

    update public.rooms
    set housekeeping_status = 'cleaning'
    where id = v_cleaning.room_id;
  end if;

  return json_build_object(
    'success', true,
    'approved', p_approved,
    'room_number', (select number from public.rooms where id = v_cleaning.room_id)
  );
end;
$$;

-- -----------------------------------------------
-- schedule_pre_arrival_cleaning
-- -----------------------------------------------
create or replace function public.schedule_pre_arrival_cleaning(p_stay_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stay record;
  v_config record;
  v_type_id uuid;
  v_role_id uuid;
  v_scheduled_for timestamptz;
  v_tz text;
  v_check_in_time time;
begin
  select s.*, o.timezone, o.default_check_in_time
  into v_stay
  from public.stays s
  join public.organizations o on o.id = s.organization_id
  where s.id = p_stay_id;

  if v_stay is null or v_stay.status not in ('reserved', 'checked_in') then return; end if;
  if v_stay.room_id is null then return; end if;

  v_tz := coalesce(v_stay.timezone, 'America/Bogota');
  v_check_in_time := coalesce(v_stay.default_check_in_time, '15:00'::time);

  select * into v_config from public.housekeeping_config where organization_id = v_stay.organization_id;

  -- Calculate scheduled_for: check_in_date at (check_in_time - 2h) in org timezone
  v_scheduled_for := (v_stay.check_in_date::timestamp + v_check_in_time - interval '2 hours')
    at time zone v_tz;

  -- Skip if already past
  if v_scheduled_for < now() then return; end if;

  -- Skip if room was recently cleaned (skip_pre_arrival_hours config)
  if v_config.skip_pre_arrival_hours > 0 then
    declare v_last_cleaned timestamptz;
    begin
      select last_cleaned_at into v_last_cleaned from public.rooms where id = v_stay.room_id;
      if v_last_cleaned is not null
        and extract(epoch from now() - v_last_cleaned) / 3600 < v_config.skip_pre_arrival_hours
      then
        return;
      end if;
    end;
  end if;

  select id into v_type_id from public.cleaning_types
  where organization_id = v_stay.organization_id and system_key = 'pre_arrival' limit 1;

  select id into v_role_id from public.roles
  where organization_id = v_stay.organization_id and system_key = 'room_attendant' limit 1;

  if v_type_id is null then return; end if;

  -- Upsert: create or move existing pre_arrival
  insert into public.room_cleanings (
    organization_id, room_id, stay_id, cleaning_type_id,
    status, scheduled_for, origin, assigned_role_id
  ) values (
    v_stay.organization_id, v_stay.room_id, p_stay_id,
    v_type_id, 'scheduled', v_scheduled_for, 'pre_arrival', v_role_id
  )
  on conflict (stay_id, origin)
    where status in ('scheduled', 'in_progress') and origin in ('pre_arrival', 'checkout')
  do update set
    room_id = excluded.room_id,
    scheduled_for = excluded.scheduled_for;
end;
$$;

-- -----------------------------------------------
-- schedule_checkout_cleaning
-- -----------------------------------------------
create or replace function public.schedule_checkout_cleaning(p_stay_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stay record;
  v_type_id uuid;
  v_role_id uuid;
begin
  select s.* into v_stay from public.stays s where s.id = p_stay_id;
  if v_stay is null then return; end if;

  select id into v_type_id from public.cleaning_types
  where organization_id = v_stay.organization_id and system_key = 'checkout' limit 1;

  select id into v_role_id from public.roles
  where organization_id = v_stay.organization_id and system_key = 'room_attendant' limit 1;

  if v_type_id is null then return; end if;

  -- Cancel pending weekly for this room
  update public.room_cleanings
  set status = 'cancelled'
  where room_id = v_stay.room_id
    and origin = 'auto_weekly'
    and status = 'scheduled';

  -- Create checkout cleaning (+15 min)
  insert into public.room_cleanings (
    organization_id, room_id, stay_id, cleaning_type_id,
    status, scheduled_for, origin, assigned_role_id
  ) values (
    v_stay.organization_id, v_stay.room_id, p_stay_id,
    v_type_id, 'scheduled', now() + interval '15 minutes',
    'checkout', v_role_id
  )
  on conflict (stay_id, origin)
    where status in ('scheduled', 'in_progress') and origin in ('pre_arrival', 'checkout')
  do nothing;
end;
$$;

-- -----------------------------------------------
-- Trigger: schedule pre_arrival on stay creation/update
-- -----------------------------------------------
create or replace function public.trg_schedule_pre_arrival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only for reserved stays with a room assigned
  if new.status in ('reserved') and new.room_id is not null then
    perform public.schedule_pre_arrival_cleaning(new.id);
  end if;

  -- Cancel pre_arrival if stay is cancelled/no_show
  if new.status in ('cancelled', 'no_show') then
    update public.room_cleanings
    set status = 'cancelled'
    where stay_id = new.id and origin = 'pre_arrival' and status in ('scheduled', 'in_progress');
  end if;

  return new;
end;
$$;

create trigger on_stay_housekeeping
  after insert or update on public.stays
  for each row
  execute function public.trg_schedule_pre_arrival();

-- -----------------------------------------------
-- Trigger: schedule first weekly on check-in
-- -----------------------------------------------
create or replace function public.trg_schedule_weekly_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config record;
  v_type_id uuid;
  v_role_id uuid;
  v_next_date timestamptz;
  v_tz text;
begin
  -- Only fire on status change to checked_in
  if not (old.status is distinct from new.status and new.status = 'checked_in') then
    return new;
  end if;

  select * into v_config from public.housekeeping_config where organization_id = new.organization_id;
  v_tz := coalesce((select timezone from public.organizations where id = new.organization_id), 'America/Bogota');

  -- Calculate next date from now (or last_cleaned_at)
  v_next_date := coalesce(
    (select last_cleaned_at from public.rooms where id = new.room_id),
    now()
  ) + (coalesce(v_config.frequency_days, 7) || ' days')::interval;

  -- Only schedule if checkout is after the next date
  if new.check_out_date::timestamp > v_next_date then
    select id into v_type_id from public.cleaning_types
    where organization_id = new.organization_id and system_key = 'weekly_occupied' limit 1;

    select id into v_role_id from public.roles
    where organization_id = new.organization_id and system_key = 'room_attendant' limit 1;

    if v_type_id is not null then
      -- Remove any existing scheduled weekly
      delete from public.room_cleanings
      where room_id = new.room_id and origin = 'auto_weekly' and status = 'scheduled';

      insert into public.room_cleanings (
        organization_id, room_id, stay_id, cleaning_type_id,
        status, scheduled_for, origin, assigned_role_id
      ) values (
        new.organization_id, new.room_id, new.id, v_type_id,
        'scheduled',
        (v_next_date::date::timestamp + coalesce(v_config.default_time, '10:00'::time))
          at time zone v_tz,
        'auto_weekly', v_role_id
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger on_checkin_schedule_weekly
  after update on public.stays
  for each row
  when (old.status is distinct from new.status and new.status = 'checked_in')
  execute function public.trg_schedule_weekly_on_checkin();
