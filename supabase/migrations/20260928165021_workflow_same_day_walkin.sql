-- =============================================================
-- POSTY — Migration: Same-day reservations, walk-ins, assignment fix
-- Depends on: 20260928165010_walkin_enum_value (adds 'walk_in' enum)
-- =============================================================

-- -----------------------------------------------
-- 1. Helper: evaluate_condition (DRY, must be created before generate_stay_tasks)
-- -----------------------------------------------
create or replace function public.evaluate_condition(
  p_condition text,
  p_stay record,
  p_guest record,
  p_channel record,
  p_is_same_day boolean,
  p_room_is_inspected boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  case
    when p_condition = 'always' then return true;
    when p_condition = 'same_day_arrival' then return p_is_same_day;
    when p_condition = 'room_not_inspected' then return not p_room_is_inspected;
    when p_condition = 'is_ota_channel' then return coalesce(p_channel.is_ota, false);
    when p_condition = 'is_foreign_guest' then
      return p_guest.nationality is not null
        and p_guest.nationality != ''
        and lower(p_guest.nationality) != lower(p_stay.country_code);
    when p_condition = 'has_children' then return p_stay.children > 0;
    when p_condition = 'has_notes' then return p_stay.notes is not null and p_stay.notes != '';
    when p_condition like 'lead_time_days_gte:%' then
      return (p_stay.check_in_date - current_date) >= split_part(p_condition, ':', 2)::int;
    else return true;
  end case;
end;
$$;

-- -----------------------------------------------
-- 2. Helper: resolve_title (DRY)
-- -----------------------------------------------
create or replace function public.resolve_title(
  p_template text,
  p_stay record,
  p_guest record,
  p_room record,
  p_today date
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_title text;
begin
  v_title := p_template;
  v_title := replace(v_title, '{guest}', coalesce(p_guest.first_name || ' ' || p_guest.last_name, ''));
  v_title := replace(v_title, '{room}', coalesce(p_room.number, ''));
  v_title := replace(v_title, '{code}', coalesce(p_stay.code, ''));
  v_title := replace(v_title, '{room_type}', coalesce(p_room.type_name, ''));
  v_title := replace(v_title, '{date}', to_char(coalesce(p_today, current_date), 'DD/MM/YYYY'));
  return v_title;
end;
$$;

-- -----------------------------------------------
-- 3. New templates: R0, A0, W1
-- -----------------------------------------------
create or replace function public.seed_same_day_templates(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- R0: Same-day express preparation
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'front_desk',
    'Llegada de hoy: preparación exprés · {guest}',
    'Reserva del mismo día — preparar todo rápidamente.',
    '[{"text":"Confirmar la hora estimada de llegada"},
      {"text":"Asignar la habitación según preferencias"},
      {"text":"Avisar a Ama de llaves, Cocina y Mantenimiento de la llegada de hoy"},
      {"text":"Programar el traslado, si lo pidió"}]',
    'per_stay', 'created_at', 0, 15, 'high', '["same_day_arrival"]', false, 5)
  on conflict do nothing;

  -- A0: Same-day housekeeping express
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'housekeeping_supervisor',
    'Llegada no programada hoy · Hab. {room}',
    'Priorizar la limpieza e inspección de esta habitación para llegada inmediata.',
    '[{"text":"Priorizar la limpieza de esta habitación"},
      {"text":"Inspeccionar con el checklist estándar"},
      {"text":"Avisar a Recepción cuando esté lista"}]',
    'per_stay', 'created_at', 0, 30, 'urgent', '["same_day_arrival","room_not_inspected"]', false, 6)
  on conflict do nothing;

  -- W1: Walk-in registration
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'walk_in', 'front_desk',
    'Registro de walk-in · {guest}',
    'Completar el registro del huésped que llegó sin reserva.',
    '[{"text":"Verificar el documento de identidad"},
      {"text":"Confirmar la garantía o el pago"},
      {"text":"Entregar la llave e información clave: wifi, desayuno, contacto"},
      {"text":"Reportar la entrada en SIRE hoy","conditions":["is_foreign_guest"]}]',
    'per_stay', 'created_at', 0, 10, 'high', '["always"]', false, 1)
  on conflict do nothing;
end;
$$;

-- Seed for existing orgs
do $$
declare v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.seed_same_day_templates(v_org.id);
  end loop;
end;
$$;

-- -----------------------------------------------
-- 4. Updated generate_stay_tasks with same-day rule + walk-in
-- -----------------------------------------------
create or replace function public.generate_stay_tasks(p_stay_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stay record;
  v_tpl record;
  v_role_id uuid;
  v_status_id uuid;
  v_due_at timestamptz;
  v_anchor_dt timestamptz;
  v_title text;
  v_task_id uuid;
  v_digest_date date;
  v_digest_task_id uuid;
  v_subtask_title text;
  v_subtask record;
  v_guest record;
  v_room record;
  v_channel record;
  v_count int := 0;
  v_condition text;
  v_condition_met boolean;
  v_checkin_time time;
  v_today_local date;
  v_created_local date;
  v_is_same_day boolean;
  v_is_walk_in boolean;
  v_task_target_date date;
  v_room_is_inspected boolean;
  v_workflow_filter public.workflow_type;
begin
  -- Load stay with org info
  select s.*, o.timezone, o.country_code,
    o.default_check_in_time, o.default_check_out_time
  into v_stay
  from public.stays s
  join public.organizations o on o.id = s.organization_id
  where s.id = p_stay_id;

  if v_stay is null then return 0; end if;

  -- Is this a walk-in? (created directly as checked_in)
  v_is_walk_in := (v_stay.status = 'checked_in' and v_stay.actual_check_in_at is not null);

  -- Today and creation date in org timezone
  v_today_local := (now() at time zone v_stay.timezone)::date;
  v_created_local := (v_stay.created_at at time zone v_stay.timezone)::date;
  v_is_same_day := (v_created_local = v_stay.check_in_date);

  -- Load related data
  select * into v_guest from public.guests where id = v_stay.primary_guest_id;
  select r.*, rt.name as type_name
  into v_room
  from public.rooms r
  left join public.room_types rt on rt.id = r.room_type_id
  where r.id = v_stay.room_id;
  select * into v_channel from public.booking_channels where id = v_stay.channel_id;

  v_room_is_inspected := coalesce(v_room.housekeeping_status, 'dirty') = 'inspected';

  perform public.ensure_workflow_roles(v_stay.organization_id);

  select id into v_status_id
  from public.task_statuses
  where organization_id = v_stay.organization_id and type = 'open'
  order by sort_order limit 1;

  v_checkin_time := v_stay.default_check_in_time;

  -- Determine which workflow to use
  if v_is_walk_in then
    v_workflow_filter := 'walk_in';
  else
    v_workflow_filter := 'stay_created';
  end if;

  -- Process templates for the determined workflow
  for v_tpl in
    select * from public.task_templates
    where organization_id = v_stay.organization_id
      and workflow = v_workflow_filter
      and is_active = true
    order by sort_order
  loop
    -- Evaluate conditions
    v_condition_met := true;
    for v_condition in select jsonb_array_elements_text(v_tpl.conditions) loop
      v_condition_met := v_condition_met and public.evaluate_condition(
        v_condition, v_stay, v_guest, v_channel, v_is_same_day, v_room_is_inspected
      );
    end loop;
    if not v_condition_met then continue; end if;

    -- ===== SAME-DAY RULE for pre-arrival tasks =====
    if v_tpl.anchor = 'check_in' and v_tpl.offset_days < 0 and not v_is_walk_in then
      v_task_target_date := v_stay.check_in_date + v_tpl.offset_days;
      if v_task_target_date < v_created_local then
        continue; -- task's day already passed at creation time
      end if;
    end if;

    -- Calculate anchor datetime
    case v_tpl.anchor
      when 'created_at' then v_anchor_dt := v_stay.created_at;
      when 'check_in' then
        v_anchor_dt := (v_stay.check_in_date::timestamp + coalesce(v_checkin_time, '15:00'::time))
          at time zone v_stay.timezone;
      when 'check_out' then
        v_anchor_dt := (v_stay.check_out_date::timestamp + coalesce(v_stay.default_check_out_time, '12:00'::time))
          at time zone v_stay.timezone;
      else v_anchor_dt := now();
    end case;

    -- Calculate due_at
    if v_tpl.at_time is not null then
      v_due_at := ((v_stay.check_in_date + v_tpl.offset_days)::timestamp + v_tpl.at_time)
        at time zone v_stay.timezone;
    else
      v_due_at := v_anchor_dt + (v_tpl.offset_days || ' days')::interval
        + (v_tpl.offset_minutes || ' minutes')::interval;
    end if;

    -- Skip if past and skip_if_past = true
    if v_tpl.skip_if_past and v_due_at < now() then continue; end if;
    -- If past and not skipping, set to now + 1 hour
    if v_due_at < now() then v_due_at := now() + interval '1 hour'; end if;

    -- Resolve role
    select id into v_role_id from public.roles
    where organization_id = v_stay.organization_id and system_key = v_tpl.role_system_key;

    v_title := public.resolve_title(v_tpl.title_template, v_stay, v_guest, v_room, v_today_local);

    if v_tpl.scope = 'per_stay' then
      insert into public.tasks (
        organization_id, title, description, status_id, priority,
        created_by, due_date, room_id, assigned_role_id,
        source, stay_id, template_id, sort_order
      ) values (
        v_stay.organization_id, v_title, v_tpl.description, v_status_id,
        v_tpl.priority::task_priority, v_stay.created_by,
        v_due_at::date, v_stay.room_id, v_role_id,
        'stay_workflow', v_stay.id, v_tpl.id, v_tpl.sort_order
      )
      on conflict (stay_id, template_id)
        where stay_id is not null and template_id is not null
          and source = 'stay_workflow' and digest_date is null
      do nothing
      returning id into v_task_id;

      if v_task_id is null then continue; end if;

      -- Create subtasks
      for v_subtask in select * from jsonb_array_elements(v_tpl.subtasks) loop
        v_condition_met := true;
        if v_subtask.value ? 'conditions' then
          for v_condition in select jsonb_array_elements_text(v_subtask.value->'conditions') loop
            v_condition_met := v_condition_met and public.evaluate_condition(
              v_condition, v_stay, v_guest, v_channel, v_is_same_day, v_room_is_inspected
            );
          end loop;
        end if;
        if v_condition_met then
          insert into public.tasks (
            organization_id, parent_task_id, title, status_id, priority,
            created_by, due_date, assigned_role_id, source, stay_id, sort_order
          ) values (
            v_stay.organization_id, v_task_id,
            v_subtask.value->>'text', v_status_id,
            'normal'::task_priority, v_stay.created_by,
            v_due_at::date, v_role_id, 'stay_workflow', v_stay.id, 0
          );
        end if;
      end loop;

      perform public.assign_task_to_best_person(v_task_id, v_role_id, v_due_at);
      v_count := v_count + 1;

    elsif v_tpl.scope = 'daily_digest' then
      v_digest_date := (v_stay.check_in_date + v_tpl.offset_days)::date;

      -- Same-day rule: skip digests from before creation date
      if v_digest_date < v_created_local then continue; end if;

      v_title := replace(v_tpl.title_template, '{date}', to_char(v_digest_date, 'DD/MM/YYYY'));

      select id into v_digest_task_id from public.tasks
      where organization_id = v_stay.organization_id
        and template_id = v_tpl.id and digest_date = v_digest_date
        and source = 'stay_workflow'
      limit 1;

      if v_digest_task_id is null then
        insert into public.tasks (
          organization_id, title, description, status_id, priority,
          created_by, due_date, assigned_role_id,
          source, template_id, digest_date, sort_order
        ) values (
          v_stay.organization_id, v_title, v_tpl.description, v_status_id,
          v_tpl.priority::task_priority, v_stay.created_by,
          v_due_at::date, v_role_id,
          'stay_workflow', v_tpl.id, v_digest_date, v_tpl.sort_order
        )
        returning id into v_digest_task_id;

        for v_subtask in select * from jsonb_array_elements(v_tpl.subtasks) loop
          insert into public.tasks (
            organization_id, parent_task_id, title, status_id, priority,
            created_by, due_date, assigned_role_id, source, sort_order
          ) values (
            v_stay.organization_id, v_digest_task_id,
            v_subtask.value->>'text', v_status_id,
            'normal'::task_priority, v_stay.created_by,
            v_due_at::date, v_role_id, 'stay_workflow', 0
          );
        end loop;

        perform public.assign_task_to_best_person(v_digest_task_id, v_role_id, v_due_at);
        v_count := v_count + 1;
      end if;

      -- Add subtask for this stay
      v_subtask_title := 'Hab. ' || coalesce(v_room.number, '?')
        || ' · ' || coalesce(v_guest.first_name || ' ' || v_guest.last_name, '?')
        || ' · ' || v_stay.adults || ' adulto' || case when v_stay.adults != 1 then 's' else '' end
        || case when v_stay.children > 0 then ' + ' || v_stay.children || ' niño' || case when v_stay.children != 1 then 's' else '' end else '' end;

      if v_stay.notes is not null and v_stay.notes != '' then
        v_subtask_title := v_subtask_title || ' · Nota: ' || left(v_stay.notes, 60);
      end if;

      if not exists (
        select 1 from public.tasks where parent_task_id = v_digest_task_id and stay_id = v_stay.id
      ) then
        insert into public.tasks (
          organization_id, parent_task_id, title, status_id, priority,
          created_by, due_date, assigned_role_id, source, stay_id, room_id, sort_order
        ) values (
          v_stay.organization_id, v_digest_task_id,
          v_subtask_title, v_status_id,
          'normal'::task_priority, v_stay.created_by,
          v_due_at::date, v_role_id, 'stay_workflow', v_stay.id, v_stay.room_id, 0
        );
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------
-- 5. Fix assignment: only exact role match
-- -----------------------------------------------
create or replace function public.assign_task_to_best_person(
  p_task_id uuid,
  p_role_id uuid,
  p_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignee_id uuid;
  v_org_id uuid;
  v_due_date date;
begin
  if p_role_id is null then return null; end if;
  select organization_id into v_org_id from public.tasks where id = p_task_id;
  v_due_date := p_due_at::date;

  select p.id into v_assignee_id
  from public.profiles p
  where p.organization_id = v_org_id
    and p.role_id = p_role_id
    and p.is_active = true
    and not exists (
      select 1 from public.time_off t
      where t.profile_id = p.id and v_due_date between t.start_date and t.end_date
    )
  order by
    (exists (
      select 1 from public.work_schedules ws
      where ws.profile_id = p.id
        and ws.weekday = extract(isodow from v_due_date)::int - 1
        and not ws.is_day_off
    )) desc,
    (select count(*) from public.task_assignees ta
      join public.tasks t on t.id = ta.task_id
      where ta.profile_id = p.id and t.due_date = v_due_date and t.archived_at is null
        and exists (select 1 from public.task_statuses ts where ts.id = t.status_id and ts.type in ('open','in_progress'))
    ) asc,
    random()
  limit 1;

  if v_assignee_id is not null then
    insert into public.task_assignees (task_id, profile_id)
    values (p_task_id, v_assignee_id)
    on conflict (task_id, profile_id) do nothing;
  end if;
  return v_assignee_id;
end;
$$;

-- -----------------------------------------------
-- 6. Cleanup: cancel pre-arrival tasks for same-day stays
-- Disable activity trigger (needs auth.uid() which is null in migrations)
-- -----------------------------------------------
alter table public.tasks disable trigger on_task_activity_log;

do $$
declare
  v_cancelled_status_id uuid;
  v_org record;
  v_task record;
  v_count int := 0;
begin
  for v_org in select id, timezone from public.organizations loop
    select id into v_cancelled_status_id
    from public.task_statuses
    where organization_id = v_org.id and type = 'cancelled'
    order by sort_order limit 1;
    if v_cancelled_status_id is null then continue; end if;

    for v_task in
      select t.id, t.title
      from public.tasks t
      join public.task_templates tt on tt.id = t.template_id
      join public.stays s on s.id = t.stay_id
      join public.task_statuses ts on ts.id = t.status_id
      where t.organization_id = v_org.id
        and t.source = 'stay_workflow'
        and ts.type in ('open', 'in_progress')
        and tt.anchor = 'check_in' and tt.offset_days < 0
        and (s.created_at at time zone v_org.timezone)::date = s.check_in_date
    loop
      update public.tasks set status_id = v_cancelled_status_id, archived_at = now() where id = v_task.id;
      update public.tasks set status_id = v_cancelled_status_id, archived_at = now() where parent_task_id = v_task.id;
      v_count := v_count + 1;
      raise notice 'Cancelled: %', v_task.title;
    end loop;
  end loop;
  raise notice 'Total cancelled: %', v_count;
end;
$$;

-- -----------------------------------------------
-- 7. Fix incorrect assignments (Gestor on non-manager tasks)
-- -----------------------------------------------
do $$
declare
  v_task record;
  v_count int := 0;
begin
  for v_task in
    select t.id, t.assigned_role_id, ta.profile_id, p.full_name
    from public.tasks t
    join public.task_assignees ta on ta.task_id = t.id
    join public.profiles p on p.id = ta.profile_id
    join public.task_statuses ts on ts.id = t.status_id
    where t.source = 'stay_workflow'
      and t.assigned_role_id is not null
      and p.role_id is distinct from t.assigned_role_id
      and ts.type in ('open', 'in_progress')
  loop
    delete from public.task_assignees where task_id = v_task.id and profile_id = v_task.profile_id;
    perform public.assign_task_to_best_person(v_task.id, v_task.assigned_role_id, now());
    v_count := v_count + 1;
    raise notice 'Unassigned % from task %', v_task.full_name, v_task.id;
  end loop;
  raise notice 'Total reassigned: %', v_count;
end;
$$;

-- Re-enable activity trigger
alter table public.tasks enable trigger on_task_activity_log;

-- Grants
grant execute on function public.evaluate_condition(text, record, record, record, boolean, boolean) to authenticated;
grant execute on function public.resolve_title(text, record, record, record, date) to authenticated;
grant execute on function public.seed_same_day_templates(uuid) to authenticated;
