-- =============================================================
-- POSTY — Housekeeping: scheduling, backfill, edit/cancel RPCs
-- =============================================================

-- -----------------------------------------------
-- 1. cleaning_schedules (recurring rules)
-- -----------------------------------------------
create table public.cleaning_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  cleaning_type_id uuid not null references public.cleaning_types(id),
  repeat_interval text not null default 'none', -- none | weekly | biweekly | monthly
  repeat_end_date date,
  default_time time not null default '10:00',
  assigned_to uuid references public.profiles(id),
  assigned_role_id uuid references public.roles(id),
  priority text not null default 'normal',
  instructions text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.cleaning_schedules enable row level security;

create policy "Users can view cleaning_schedules of own org"
  on public.cleaning_schedules for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage cleaning_schedules"
  on public.cleaning_schedules for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 2. update_cleaning RPC (edit scheduled cleaning)
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
  if v_cleaning.status not in ('scheduled') then
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
-- 3. cancel_cleaning RPC
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
  if v_cleaning.status not in ('scheduled') then
    raise exception 'Solo se pueden cancelar limpiezas programadas';
  end if;

  update public.room_cleanings
  set status = 'cancelled',
      skipped_reason = p_reason
  where id = p_cleaning_id;

  return json_build_object('success', true);
end;
$$;

-- -----------------------------------------------
-- 4. register_past_cleaning RPC (ya hecha)
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
    'completed', p_started_at, 'manual',
    p_started_at, p_completed_at, coalesce(p_completed_by, v_user_id),
    p_notes, v_user_id,
    case when v_ct.requires_inspection then 'pending'::inspection_status else 'not_required'::inspection_status end
  )
  returning id into v_cleaning_id;

  -- Update room
  update public.rooms
  set last_cleaned_at = p_completed_at,
      last_cleaned_by = coalesce(p_completed_by, v_user_id),
      housekeeping_status = case when v_ct.requires_inspection then 'clean' else 'inspected' end
  where id = p_room_id;

  -- Schedule next weekly if occupied
  select s.* into v_current_stay
  from public.stays s where s.room_id = p_room_id and s.status = 'checked_in' limit 1;

  if v_current_stay is not null then
    v_next_date := p_completed_at + (coalesce(v_config.frequency_days, 7) || ' days')::interval;
    if v_current_stay.check_out_date::timestamp > v_next_date then
      select id into v_weekly_type_id from public.cleaning_types
      where organization_id = v_org_id and system_key = 'weekly_occupied' limit 1;
      select id into v_role_id from public.roles
      where organization_id = v_org_id and system_key = 'room_attendant' limit 1;

      if v_weekly_type_id is not null then
        delete from public.room_cleanings
        where room_id = p_room_id and origin = 'auto_weekly' and status = 'scheduled';

        insert into public.room_cleanings (
          organization_id, room_id, stay_id, cleaning_type_id,
          status, scheduled_for, origin, assigned_role_id
        ) values (
          v_org_id, p_room_id, v_current_stay.id, v_weekly_type_id,
          'scheduled',
          (v_next_date::date::timestamp + coalesce(v_config.default_time, '10:00'::time)) at time zone v_tz,
          'auto_weekly', v_role_id
        );
      end if;
    end if;
  end if;

  return json_build_object('success', true, 'cleaning_id', v_cleaning_id);
end;
$$;

-- -----------------------------------------------
-- 5. create_manual_cleaning RPC (schedule new)
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
    -- If replacing weekly, cancel existing
    if p_replace_weekly or (v_ct.system_key = 'weekly_occupied') then
      update public.room_cleanings
      set status = 'cancelled'
      where room_id = v_room_id and origin = 'auto_weekly' and status = 'scheduled';
    end if;

    -- Find current stay
    select id into v_stay from public.stays
    where room_id = v_room_id and status = 'checked_in' limit 1;

    insert into public.room_cleanings (
      organization_id, room_id, stay_id, cleaning_type_id,
      status, scheduled_for, origin,
      assigned_to, assigned_role_id,
      notes, created_by
    ) values (
      v_org_id, v_room_id, v_stay.id, p_cleaning_type_id,
      'scheduled', p_scheduled_for,
      'manual',
      p_assigned_to, v_role_id,
      p_instructions, v_user_id
    );

    v_count := v_count + 1;
  end loop;

  return json_build_object('success', true, 'count', v_count);
end;
$$;

-- -----------------------------------------------
-- 6. backfill_existing_stays (idempotent)
-- -----------------------------------------------
create or replace function public.backfill_housekeeping_cleanings()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stay record;
  v_room record;
  v_config record;
  v_type_id uuid;
  v_role_id uuid;
  v_tz text;
  v_next_date timestamptz;
  v_pre_count int := 0;
  v_weekly_count int := 0;
  v_checkout_count int := 0;
begin
  -- Process each organization
  for v_config in
    select hc.*, o.timezone, o.default_check_in_time
    from public.housekeeping_config hc
    join public.organizations o on o.id = hc.organization_id
  loop
    v_tz := coalesce(v_config.timezone, 'America/Bogota');

    -- Get role and type IDs for this org
    select id into v_role_id from public.roles
    where organization_id = v_config.organization_id and system_key = 'room_attendant' limit 1;

    -- 1. Reservas reserved con llegada de hoy en adelante → pre_arrival
    select id into v_type_id from public.cleaning_types
    where organization_id = v_config.organization_id and system_key = 'pre_arrival' limit 1;

    if v_type_id is not null then
      for v_stay in
        select s.* from public.stays s
        where s.organization_id = v_config.organization_id
          and s.status = 'reserved'
          and s.room_id is not null
          and s.check_in_date >= current_date
          and not exists (
            select 1 from public.room_cleanings rc
            where rc.stay_id = s.id and rc.origin = 'pre_arrival'
              and rc.status in ('scheduled', 'in_progress', 'completed')
          )
      loop
        insert into public.room_cleanings (
          organization_id, room_id, stay_id, cleaning_type_id,
          status, scheduled_for, origin, assigned_role_id
        ) values (
          v_config.organization_id, v_stay.room_id, v_stay.id, v_type_id,
          'scheduled',
          (v_stay.check_in_date::timestamp + coalesce(v_config.default_check_in_time, '15:00'::time) - interval '2 hours') at time zone v_tz,
          'pre_arrival', v_role_id
        )
        on conflict (stay_id, origin)
          where status in ('scheduled', 'in_progress') and origin in ('pre_arrival', 'checkout')
        do nothing;
        v_pre_count := v_pre_count + 1;
      end loop;
    end if;

    -- 2. Estancias checked_in → semanal
    select id into v_type_id from public.cleaning_types
    where organization_id = v_config.organization_id and system_key = 'weekly_occupied' limit 1;

    if v_type_id is not null then
      for v_stay in
        select s.*, r.last_cleaned_at
        from public.stays s
        join public.rooms r on r.id = s.room_id
        where s.organization_id = v_config.organization_id
          and s.status = 'checked_in'
          and not exists (
            select 1 from public.room_cleanings rc
            where rc.room_id = s.room_id and rc.origin = 'auto_weekly' and rc.status = 'scheduled'
          )
      loop
        -- Calculate next: last cleaned + 7d, or check_in + 7d, or today if overdue
        v_next_date := coalesce(
          (select max(rc.completed_at) + (v_config.frequency_days || ' days')::interval
           from public.room_cleanings rc
           where rc.room_id = v_stay.room_id and rc.status = 'completed'),
          (v_stay.check_in_date + v_config.frequency_days)::timestamp at time zone v_tz
        );

        -- If past, set to today
        if v_next_date < now() then
          v_next_date := (current_date::timestamp + v_config.default_time) at time zone v_tz;
        end if;

        -- Only if stay extends past the next date
        if v_stay.check_out_date::timestamp > v_next_date then
          insert into public.room_cleanings (
            organization_id, room_id, stay_id, cleaning_type_id,
            status, scheduled_for, origin, assigned_role_id
          ) values (
            v_config.organization_id, v_stay.room_id, v_stay.id, v_type_id,
            'scheduled',
            v_next_date,
            'auto_weekly', v_role_id
          )
          on conflict do nothing;
          v_weekly_count := v_weekly_count + 1;
        end if;
      end loop;
    end if;

    -- 3. Habitaciones dirty sin limpieza programada → checkout
    select id into v_type_id from public.cleaning_types
    where organization_id = v_config.organization_id and system_key = 'checkout' limit 1;

    if v_type_id is not null then
      for v_room in
        select r.* from public.rooms r
        where r.organization_id = v_config.organization_id
          and r.housekeeping_status = 'dirty'
          and r.is_active = true
          and not exists (
            select 1 from public.room_cleanings rc
            where rc.room_id = r.id and rc.status in ('scheduled', 'in_progress')
          )
      loop
        insert into public.room_cleanings (
          organization_id, room_id, cleaning_type_id,
          status, scheduled_for, origin, assigned_role_id
        ) values (
          v_config.organization_id, v_room.id, v_type_id,
          'scheduled',
          now() + interval '15 minutes',
          'checkout', v_role_id
        );
        v_checkout_count := v_checkout_count + 1;
      end loop;
    end if;
  end loop;

  return json_build_object(
    'pre_arrival', v_pre_count,
    'weekly', v_weekly_count,
    'checkout', v_checkout_count,
    'total', v_pre_count + v_weekly_count + v_checkout_count
  );
end;
$$;

-- Run the backfill now
select public.backfill_housekeeping_cleanings();
