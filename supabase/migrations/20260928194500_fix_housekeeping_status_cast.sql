-- =============================================================
-- POSTY — Fix: explicit enum casts in all housekeeping functions
-- All text → enum assignments now use explicit ::type casts
-- =============================================================

-- -----------------------------------------------
-- start_cleaning: fix housekeeping_status cast
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
  if v_cleaning.status != 'scheduled'::cleaning_status and v_cleaning.status != 'in_progress'::cleaning_status then
    raise exception 'Esta limpieza no se puede iniciar (estado: %)', v_cleaning.status;
  end if;
  if v_cleaning.status = 'in_progress'::cleaning_status then
    return json_build_object('success', true, 'already_started', true);
  end if;

  update public.room_cleanings
  set status = 'in_progress'::cleaning_status,
      started_at = now(),
      assigned_to = coalesce(assigned_to, auth.uid())
  where id = p_cleaning_id;

  update public.rooms
  set housekeeping_status = 'cleaning'::housekeeping_status
  where id = v_cleaning.room_id;

  return json_build_object('success', true, 'room_number',
    (select number from public.rooms where id = v_cleaning.room_id));
end;
$$;

-- -----------------------------------------------
-- complete_cleaning: fix CASE → enum cast
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
  set status = 'completed'::cleaning_status,
      completed_at = now(),
      completed_by = auth.uid(),
      notes = coalesce(p_notes, notes),
      issues_found = p_issues_found,
      issue_description = p_issue_description,
      minibar_charged = p_minibar_charged,
      checklist = coalesce(p_checklist, checklist),
      inspection_status = case when v_ct.requires_inspection then 'pending'::inspection_status else 'not_required'::inspection_status end
  where id = p_cleaning_id;

  -- Update room with explicit enum cast
  update public.rooms
  set last_cleaned_at = now(),
      last_cleaned_by = auth.uid(),
      housekeeping_status = case
        when v_ct.requires_inspection then 'clean'::housekeeping_status
        else 'inspected'::housekeeping_status
      end
  where id = v_cleaning.room_id;

  -- Schedule next weekly if room is occupied
  select s.* into v_current_stay
  from public.stays s
  where s.room_id = v_cleaning.room_id and s.status = 'checked_in'::stay_status
  limit 1;

  if v_current_stay is not null then
    v_next_date := now() + (coalesce(v_config.frequency_days, 7) || ' days')::interval;

    if v_current_stay.check_out_date::timestamp > v_next_date then
      select id into v_next_type_id
      from public.cleaning_types
      where organization_id = v_cleaning.organization_id and system_key = 'weekly_occupied'
      limit 1;

      if v_next_type_id is not null then
        delete from public.room_cleanings
        where room_id = v_cleaning.room_id
          and origin = 'auto_weekly'::cleaning_origin
          and status = 'scheduled'::cleaning_status;

        select id into v_role_id
        from public.roles
        where organization_id = v_cleaning.organization_id and system_key = 'room_attendant'
        limit 1;

        insert into public.room_cleanings (
          organization_id, room_id, stay_id, cleaning_type_id,
          status, scheduled_for, origin, assigned_role_id, created_by
        ) values (
          v_cleaning.organization_id, v_cleaning.room_id, v_current_stay.id,
          v_next_type_id, 'scheduled'::cleaning_status,
          (v_next_date::date::timestamp + coalesce(v_config.default_time, '10:00'::time))
            at time zone coalesce(
              (select timezone from public.organizations where id = v_cleaning.organization_id),
              'America/Bogota'
            ),
          'auto_weekly'::cleaning_origin, v_role_id, auth.uid()
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
-- skip_cleaning: fix enum casts
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

  update public.room_cleanings
  set status = 'skipped'::cleaning_status,
      skipped_reason = p_reason,
      skipped_note = p_note
  where id = p_cleaning_id;

  select id into v_role_id
  from public.roles
  where organization_id = v_cleaning.organization_id and system_key = 'room_attendant'
  limit 1;

  delete from public.room_cleanings
  where room_id = v_cleaning.room_id
    and origin = 'auto_weekly'::cleaning_origin
    and status = 'scheduled'::cleaning_status
    and id != p_cleaning_id;

  insert into public.room_cleanings (
    organization_id, room_id, stay_id, cleaning_type_id,
    status, scheduled_for, origin, assigned_role_id, created_by
  ) values (
    v_cleaning.organization_id, v_cleaning.room_id, v_cleaning.stay_id,
    v_cleaning.cleaning_type_id, 'scheduled'::cleaning_status,
    ((current_date + 1)::timestamp + coalesce(v_config.default_time, '10:00'::time))
      at time zone coalesce(
        (select timezone from public.organizations where id = v_cleaning.organization_id),
        'America/Bogota'
      ),
    v_cleaning.origin, v_role_id, auth.uid()
  );

  select count(*) into v_consecutive_skips
  from public.room_cleanings
  where room_id = v_cleaning.room_id
    and status = 'skipped'::cleaning_status
    and created_at > now() - interval '14 days';

  if v_consecutive_skips >= 2 then
    declare
      v_fd_role_id uuid;
      v_status_id uuid;
      v_guest_name text;
    begin
      select id into v_fd_role_id from public.roles where organization_id = v_cleaning.organization_id and system_key = 'front_desk' limit 1;
      select id into v_status_id from public.task_statuses where organization_id = v_cleaning.organization_id and type = 'open'::task_status_type order by sort_order limit 1;
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
-- inspect_cleaning: fix enum casts
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
    set inspection_status = 'approved'::inspection_status,
        inspected_by = auth.uid(),
        inspected_at = now(),
        inspection_notes = p_notes
    where id = p_cleaning_id;

    update public.rooms
    set housekeeping_status = 'inspected'::housekeeping_status
    where id = v_cleaning.room_id;
  else
    update public.room_cleanings
    set inspection_status = 'rejected'::inspection_status,
        inspected_by = auth.uid(),
        inspected_at = now(),
        inspection_notes = p_notes,
        status = 'in_progress'::cleaning_status
    where id = p_cleaning_id;

    update public.rooms
    set housekeeping_status = 'cleaning'::housekeeping_status
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
-- schedule_checkout_cleaning: fix enum casts
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

  update public.room_cleanings
  set status = 'cancelled'::cleaning_status
  where room_id = v_stay.room_id
    and origin = 'auto_weekly'::cleaning_origin
    and status = 'scheduled'::cleaning_status;

  insert into public.room_cleanings (
    organization_id, room_id, stay_id, cleaning_type_id,
    status, scheduled_for, origin, assigned_role_id
  ) values (
    v_stay.organization_id, v_stay.room_id, p_stay_id,
    v_type_id, 'scheduled'::cleaning_status, now() + interval '15 minutes',
    'checkout'::cleaning_origin, v_role_id
  )
  on conflict (stay_id, origin)
    where status in ('scheduled'::cleaning_status, 'in_progress'::cleaning_status) and origin in ('pre_arrival'::cleaning_origin, 'checkout'::cleaning_origin)
  do nothing;
end;
$$;

-- -----------------------------------------------
-- trg_schedule_pre_arrival: fix enum casts
-- -----------------------------------------------
create or replace function public.trg_schedule_pre_arrival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('reserved'::stay_status) and new.room_id is not null then
    perform public.schedule_pre_arrival_cleaning(new.id);
  end if;

  if new.status in ('cancelled'::stay_status, 'no_show'::stay_status) then
    update public.room_cleanings
    set status = 'cancelled'::cleaning_status
    where stay_id = new.id and origin = 'pre_arrival'::cleaning_origin
      and status in ('scheduled'::cleaning_status, 'in_progress'::cleaning_status);
  end if;

  return new;
end;
$$;

-- -----------------------------------------------
-- cancel_cleaning: fix enum cast
-- -----------------------------------------------
create or replace function public.cancel_cleaning(
  p_cleaning_id uuid,
  p_reason text default null
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
  if v_cleaning.status != 'scheduled'::cleaning_status then
    raise exception 'Solo se pueden cancelar limpiezas programadas';
  end if;

  update public.room_cleanings
  set status = 'cancelled'::cleaning_status,
      skipped_reason = p_reason
  where id = p_cleaning_id;

  return json_build_object('success', true);
end;
$$;

-- -----------------------------------------------
-- update_cleaning: fix enum cast
-- -----------------------------------------------
create or replace function public.update_cleaning(
  p_cleaning_id uuid,
  p_scheduled_for timestamptz default null,
  p_cleaning_type_id uuid default null,
  p_assigned_to uuid default null,
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
  if v_cleaning.status != 'scheduled'::cleaning_status then
    raise exception 'Solo se pueden editar limpiezas programadas';
  end if;

  update public.room_cleanings
  set scheduled_for = coalesce(p_scheduled_for, scheduled_for),
      cleaning_type_id = coalesce(p_cleaning_type_id, cleaning_type_id),
      assigned_to = case when p_assigned_to is not null then p_assigned_to else assigned_to end,
      notes = case when p_notes is not null then p_notes else notes end
  where id = p_cleaning_id;

  return json_build_object('success', true);
end;
$$;

-- -----------------------------------------------
-- register_past_cleaning: fix CASE → enum cast
-- -----------------------------------------------
create or replace function public.register_past_cleaning(
  p_room_id uuid,
  p_cleaning_type_id uuid,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_completed_by uuid default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_ct record;
  v_current_stay record;
  v_cleaning_id uuid;
  v_config record;
  v_next_date timestamptz;
  v_weekly_type_id uuid;
  v_role_id uuid;
  v_tz text;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  select * into v_ct from public.cleaning_types where id = p_cleaning_type_id;
  select * into v_config from public.housekeeping_config where organization_id = v_org_id;
  v_tz := coalesce((select timezone from public.organizations where id = v_org_id), 'America/Bogota');

  insert into public.room_cleanings (
    organization_id, room_id, cleaning_type_id,
    status, scheduled_for, origin,
    started_at, completed_at, completed_by,
    notes, created_by,
    inspection_status
  ) values (
    v_org_id, p_room_id, p_cleaning_type_id,
    'completed'::cleaning_status, p_started_at, 'manual'::cleaning_origin,
    p_started_at, p_completed_at, coalesce(p_completed_by, v_user_id),
    p_notes, v_user_id,
    case when v_ct.requires_inspection then 'pending'::inspection_status else 'not_required'::inspection_status end
  )
  returning id into v_cleaning_id;

  update public.rooms
  set last_cleaned_at = p_completed_at,
      last_cleaned_by = coalesce(p_completed_by, v_user_id),
      housekeeping_status = case
        when v_ct.requires_inspection then 'clean'::housekeeping_status
        else 'inspected'::housekeeping_status
      end
  where id = p_room_id;

  select s.* into v_current_stay
  from public.stays s where s.room_id = p_room_id and s.status = 'checked_in'::stay_status limit 1;

  if v_current_stay is not null then
    v_next_date := p_completed_at + (coalesce(v_config.frequency_days, 7) || ' days')::interval;
    if v_current_stay.check_out_date::timestamp > v_next_date then
      select id into v_weekly_type_id from public.cleaning_types
      where organization_id = v_org_id and system_key = 'weekly_occupied' limit 1;
      select id into v_role_id from public.roles
      where organization_id = v_org_id and system_key = 'room_attendant' limit 1;

      if v_weekly_type_id is not null then
        delete from public.room_cleanings
        where room_id = p_room_id and origin = 'auto_weekly'::cleaning_origin and status = 'scheduled'::cleaning_status;

        insert into public.room_cleanings (
          organization_id, room_id, stay_id, cleaning_type_id,
          status, scheduled_for, origin, assigned_role_id
        ) values (
          v_org_id, p_room_id, v_current_stay.id, v_weekly_type_id,
          'scheduled'::cleaning_status,
          (v_next_date::date::timestamp + coalesce(v_config.default_time, '10:00'::time)) at time zone v_tz,
          'auto_weekly'::cleaning_origin, v_role_id
        );
      end if;
    end if;
  end if;

  return json_build_object('success', true, 'cleaning_id', v_cleaning_id);
end;
$$;

-- -----------------------------------------------
-- create_manual_cleaning: fix enum casts
-- -----------------------------------------------
create or replace function public.create_manual_cleaning(
  p_room_ids uuid[],
  p_cleaning_type_id uuid,
  p_scheduled_for timestamptz,
  p_assigned_to uuid default null,
  p_priority text default 'normal',
  p_instructions text default null,
  p_replace_weekly boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_room_id uuid;
  v_role_id uuid;
  v_ct record;
  v_stay record;
  v_count int := 0;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  select * into v_ct from public.cleaning_types where id = p_cleaning_type_id;
  select id into v_role_id from public.roles
  where organization_id = v_org_id and system_key = 'room_attendant' limit 1;

  foreach v_room_id in array p_room_ids loop
    if p_replace_weekly or (v_ct.system_key = 'weekly_occupied') then
      update public.room_cleanings
      set status = 'cancelled'::cleaning_status
      where room_id = v_room_id and origin = 'auto_weekly'::cleaning_origin and status = 'scheduled'::cleaning_status;
    end if;

    select id into v_stay from public.stays
    where room_id = v_room_id and status = 'checked_in'::stay_status limit 1;

    insert into public.room_cleanings (
      organization_id, room_id, stay_id, cleaning_type_id,
      status, scheduled_for, origin,
      assigned_to, assigned_role_id,
      notes, created_by
    ) values (
      v_org_id, v_room_id, v_stay.id, p_cleaning_type_id,
      'scheduled'::cleaning_status, p_scheduled_for,
      'manual'::cleaning_origin,
      p_assigned_to, v_role_id,
      p_instructions, v_user_id
    );

    v_count := v_count + 1;
  end loop;

  return json_build_object('success', true, 'count', v_count);
end;
$$;
