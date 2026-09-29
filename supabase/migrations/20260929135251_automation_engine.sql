-- =============================================================
-- POSTY — Automation engine: tables, outbox, queue processor
-- =============================================================

-- -----------------------------------------------
-- 1. Permissions
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('automations.view', 'automations', 'view', null, 'Ver automatizaciones'),
  ('automations.manage', 'automations', 'manage', null, 'Crear, editar y publicar automatizaciones'),
  ('automations.run', 'automations', 'run', null, 'Ejecutar automatizaciones manuales')
on conflict (key) do nothing;

-- Grant to Gestor
do $$
declare v_role record;
begin
  for v_role in select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor') loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'automations.view'),
      (v_role.id, 'automations.manage'),
      (v_role.id, 'automations.run')
    on conflict do nothing;
  end loop;
end;
$$;

-- -----------------------------------------------
-- 2. automations
-- -----------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  icon text default 'zap',
  folder text,
  is_active boolean not null default false,
  is_system boolean not null default false,
  system_key text,
  trigger_type text not null,       -- 'stay.created', 'stay.checked_in', 'room.status_changed', 'schedule.daily', 'manual', etc.
  trigger_config jsonb default '{}', -- type-specific config (e.g. time for scheduled, webhook URL)
  conditions jsonb default '[]',     -- ConditionGroup[]
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_automations_system_key
  on public.automations (organization_id, system_key)
  where system_key is not null;

create trigger on_automations_updated
  before update on public.automations
  for each row execute function public.handle_updated_at();

alter table public.automations enable row level security;

create policy "Users can view automations of own org"
  on public.automations for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage automations"
  on public.automations for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. automation_steps
-- -----------------------------------------------
create table public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  position int not null default 0,
  parent_step_id uuid references public.automation_steps(id) on delete cascade,
  branch text check (branch in ('yes', 'no')),  -- null for non-branch steps
  action_type text not null,  -- 'create_task', 'update_room_status', 'notify', 'wait', 'condition_branch', 'stop'
  action_config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_automation_steps_automation on public.automation_steps(automation_id);

alter table public.automation_steps enable row level security;

create policy "Users can view automation_steps via automation"
  on public.automation_steps for select
  using (exists (
    select 1 from public.automations a
    where a.id = automation_steps.automation_id
      and a.organization_id = public.current_org_id()
  ));

create policy "Org members can manage automation_steps"
  on public.automation_steps for all
  using (exists (
    select 1 from public.automations a
    where a.id = automation_steps.automation_id
      and a.organization_id = public.current_org_id()
  ));

-- -----------------------------------------------
-- 4. automation_events (outbox)
-- -----------------------------------------------
create table public.automation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,       -- 'stay.created', 'stay.checked_in', 'room.status_changed', etc.
  entity_type text not null,      -- 'stay', 'room', 'task', 'guest', 'cleaning'
  entity_id uuid not null,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  depth int not null default 0
);

create index idx_automation_events_pending
  on public.automation_events (occurred_at)
  where processed_at is null;

create index idx_automation_events_org
  on public.automation_events (organization_id);

alter table public.automation_events enable row level security;

create policy "Users can view automation_events of own org"
  on public.automation_events for select
  using (organization_id = public.current_org_id());

create policy "System can insert automation_events"
  on public.automation_events for insert
  with check (true);  -- triggers insert with security definer

-- -----------------------------------------------
-- 5. automation_runs
-- -----------------------------------------------
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  event_id uuid references public.automation_events(id) on delete set null,
  status text not null default 'running' check (status in ('running','waiting','succeeded','failed','skipped','cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index idx_automation_runs_idempotent
  on public.automation_runs (automation_id, event_id)
  where event_id is not null;

create index idx_automation_runs_automation on public.automation_runs(automation_id);

alter table public.automation_runs enable row level security;

create policy "Users can view automation_runs via automation"
  on public.automation_runs for select
  using (exists (
    select 1 from public.automations a
    where a.id = automation_runs.automation_id
      and a.organization_id = public.current_org_id()
  ));

create policy "Org members can manage automation_runs"
  on public.automation_runs for all
  using (exists (
    select 1 from public.automations a
    where a.id = automation_runs.automation_id
      and a.organization_id = public.current_org_id()
  ));

-- -----------------------------------------------
-- 6. automation_run_steps
-- -----------------------------------------------
create table public.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  step_id uuid not null references public.automation_steps(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','skipped','waiting')),
  run_at timestamptz,            -- for wait actions: when to resume
  input jsonb,
  output jsonb,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_automation_run_steps_run on public.automation_run_steps(run_id);
create index idx_automation_run_steps_waiting
  on public.automation_run_steps (run_at)
  where status = 'waiting' and run_at is not null;

alter table public.automation_run_steps enable row level security;

create policy "Users can view run_steps via run"
  on public.automation_run_steps for select
  using (exists (
    select 1 from public.automation_runs r
    join public.automations a on a.id = r.automation_id
    where r.id = automation_run_steps.run_id
      and a.organization_id = public.current_org_id()
  ));

create policy "Org members can manage run_steps"
  on public.automation_run_steps for all
  using (exists (
    select 1 from public.automation_runs r
    join public.automations a on a.id = r.automation_id
    where r.id = automation_run_steps.run_id
      and a.organization_id = public.current_org_id()
  ));

-- -----------------------------------------------
-- 7. notifications — use existing table, add missing columns
-- -----------------------------------------------
alter table public.notifications
  add column if not exists role_id uuid references public.roles(id) on delete set null;

create index if not exists idx_notifications_profile
  on public.notifications(profile_id) where is_read = false;

-- -----------------------------------------------
-- 8. Outbox event triggers (additive — existing triggers stay)
-- -----------------------------------------------
create or replace function public.trg_emit_stay_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
begin
  if TG_OP = 'INSERT' then
    v_event_type := 'stay.created';
  elsif old.status is distinct from new.status then
    v_event_type := 'stay.' || new.status::text;
  else
    v_event_type := 'stay.updated';
  end if;

  insert into public.automation_events (organization_id, event_type, entity_type, entity_id, payload)
  values (
    new.organization_id, v_event_type, 'stay', new.id,
    jsonb_build_object(
      'old_status', case when TG_OP = 'UPDATE' then old.status::text else null end,
      'new_status', new.status::text,
      'room_id', new.room_id,
      'guest_id', new.primary_guest_id,
      'check_in_date', new.check_in_date,
      'check_out_date', new.check_out_date
    )
  );
  return new;
end;
$$;

create trigger on_stay_automation_event
  after insert or update on public.stays
  for each row
  execute function public.trg_emit_stay_event();

-- Room status changes
create or replace function public.trg_emit_room_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status_id is distinct from new.status_id or
     old.housekeeping_status is distinct from new.housekeeping_status then
    insert into public.automation_events (organization_id, event_type, entity_type, entity_id, payload)
    values (
      new.organization_id,
      case
        when old.housekeeping_status is distinct from new.housekeeping_status
          then 'room.housekeeping_changed'
        else 'room.status_changed'
      end,
      'room', new.id,
      jsonb_build_object(
        'old_status_id', old.status_id,
        'new_status_id', new.status_id,
        'old_housekeeping', old.housekeeping_status::text,
        'new_housekeeping', new.housekeeping_status::text
      )
    );
  end if;
  return new;
end;
$$;

create trigger on_room_automation_event
  after update on public.rooms
  for each row
  execute function public.trg_emit_room_event();

-- Task changes
create or replace function public.trg_emit_task_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_type text;
  v_new_type text;
begin
  if TG_OP = 'INSERT' then
    insert into public.automation_events (organization_id, event_type, entity_type, entity_id, payload)
    values (new.organization_id, 'task.created', 'task', new.id, '{}'::jsonb);
  elsif old.status_id is distinct from new.status_id then
    select type into v_new_type from public.task_statuses where id = new.status_id;
    select type into v_old_type from public.task_statuses where id = old.status_id;
    if v_new_type = 'done' and v_old_type != 'done' then
      insert into public.automation_events (organization_id, event_type, entity_type, entity_id, payload)
      values (new.organization_id, 'task.completed', 'task', new.id,
        jsonb_build_object('old_status_type', v_old_type, 'new_status_type', v_new_type));
    else
      insert into public.automation_events (organization_id, event_type, entity_type, entity_id, payload)
      values (new.organization_id, 'task.status_changed', 'task', new.id,
        jsonb_build_object('old_status_type', v_old_type, 'new_status_type', v_new_type));
    end if;
  end if;
  return new;
end;
$$;

create trigger on_task_automation_event
  after insert or update on public.tasks
  for each row
  execute function public.trg_emit_task_event();

-- -----------------------------------------------
-- 9. process_automation_queue()
-- -----------------------------------------------
create or replace function public.process_automation_queue()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_automation record;
  v_step record;
  v_run_id uuid;
  v_count int := 0;
  v_hour_count int;
  v_action_result jsonb;
begin
  -- Process up to 50 unprocessed events
  for v_event in
    select * from public.automation_events
    where processed_at is null
    order by occurred_at
    limit 50
    for update skip locked
  loop
    -- Mark as processed immediately to prevent re-processing
    update public.automation_events
    set processed_at = now()
    where id = v_event.id;

    -- Skip if depth > 3 (loop protection)
    if v_event.depth > 3 then
      continue;
    end if;

    -- Find matching automations (only non-system, active)
    for v_automation in
      select * from public.automations
      where organization_id = v_event.organization_id
        and trigger_type = v_event.event_type
        and is_active = true
        and is_system = false
    loop
      -- Rate limit: max 500 runs per hour per org
      select count(*) into v_hour_count
      from public.automation_runs r
      join public.automations a on a.id = r.automation_id
      where a.organization_id = v_event.organization_id
        and r.started_at > now() - interval '1 hour';

      if v_hour_count >= 500 then
        continue;
      end if;

      -- Idempotency: skip if already ran for this event
      if exists (
        select 1 from public.automation_runs
        where automation_id = v_automation.id and event_id = v_event.id
      ) then
        continue;
      end if;

      -- TODO: evaluate automation.conditions against v_event.payload
      -- For now, skip condition evaluation (all conditions pass)

      -- Create run
      insert into public.automation_runs (automation_id, event_id, status)
      values (v_automation.id, v_event.id, 'running')
      returning id into v_run_id;

      -- Execute steps in order
      for v_step in
        select * from public.automation_steps
        where automation_id = v_automation.id
          and parent_step_id is null
        order by position
      loop
        -- Record step execution
        insert into public.automation_run_steps (run_id, step_id, status, input)
        values (v_run_id, v_step.id, 'running', v_event.payload);

        -- Execute action based on type
        begin
          case v_step.action_type
            when 'create_task' then
              perform public.execute_automation_create_task(
                v_event.organization_id, v_step.action_config, v_event.payload, v_event.entity_id
              );
            when 'notify' then
              perform public.execute_automation_notify(
                v_event.organization_id, v_step.action_config, v_event.payload
              );
            when 'stop' then
              null; -- just stop
            else
              null; -- unknown action, skip
          end case;

          -- Mark step succeeded
          update public.automation_run_steps
          set status = 'succeeded'
          where run_id = v_run_id and step_id = v_step.id;

        exception when others then
          -- Mark step failed
          update public.automation_run_steps
          set status = 'failed', error = SQLERRM
          where run_id = v_run_id and step_id = v_step.id;

          -- Mark run failed
          update public.automation_runs
          set status = 'failed', finished_at = now(), error = SQLERRM
          where id = v_run_id;

          exit; -- stop executing remaining steps
        end;

        -- If stop action, break
        if v_step.action_type = 'stop' then
          exit;
        end if;
      end loop;

      -- Mark run succeeded (if not already failed)
      update public.automation_runs
      set status = 'succeeded', finished_at = now()
      where id = v_run_id and status = 'running';

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------
-- 10. Action executors
-- -----------------------------------------------

-- Create task action
create or replace function public.execute_automation_create_task(
  p_org_id uuid,
  p_config jsonb,
  p_payload jsonb,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_status_id uuid;
  v_role_id uuid;
begin
  v_title := coalesce(p_config->>'title', 'Tarea automática');

  -- Resolve variables in title
  v_title := replace(v_title, '{entity_id}', p_entity_id::text);

  select id into v_status_id from public.task_statuses
  where organization_id = p_org_id and type = 'open'::task_status_type
  order by sort_order limit 1;

  if p_config->>'role_system_key' is not null then
    select id into v_role_id from public.roles
    where organization_id = p_org_id and system_key = p_config->>'role_system_key'
    limit 1;
  end if;

  insert into public.tasks (
    organization_id, title, description, status_id,
    priority, assigned_role_id, source,
    stay_id, room_id
  ) values (
    p_org_id, v_title,
    p_config->>'description',
    v_status_id,
    coalesce(p_config->>'priority', 'normal')::task_priority,
    v_role_id,
    'automation',
    case when p_config->>'link_stay' = 'true' then p_entity_id else null end,
    case when p_payload->>'room_id' is not null then (p_payload->>'room_id')::uuid else null end
  );
end;
$$;

-- Notify action
create or replace function public.execute_automation_notify(
  p_org_id uuid,
  p_config jsonb,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
begin
  if p_config->>'user_id' is not null then
    v_user_id := (p_config->>'user_id')::uuid;
  elsif p_config->>'role_system_key' is not null then
    select id into v_role_id from public.roles
    where organization_id = p_org_id and system_key = p_config->>'role_system_key'
    limit 1;
    -- Notify all users with this role
    insert into public.notifications (organization_id, profile_id, role_id, title, body, type)
    select p_org_id, p.id, v_role_id,
      coalesce(p_config->>'title', 'Notificación'),
      p_config->>'body',
      'automation'
    from public.profiles p
    where p.organization_id = p_org_id and p.role_id = v_role_id and p.is_active = true;
    return;
  end if;

  insert into public.notifications (organization_id, profile_id, title, body, type)
  values (
    p_org_id, v_user_id,
    coalesce(p_config->>'title', 'Notificación'),
    p_config->>'body',
    'automation'
  );
end;
$$;

-- -----------------------------------------------
-- 11. Register pg_cron job
-- -----------------------------------------------
select cron.schedule(
  'automation-queue',
  '* * * * *',
  $$SELECT public.process_automation_queue()$$
);
