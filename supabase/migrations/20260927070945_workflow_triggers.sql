-- =============================================================
-- POSTY — Migration: Workflow triggers
-- =============================================================

-- -----------------------------------------------
-- Trigger: generate tasks when a stay is created (reserved or checked_in)
-- -----------------------------------------------
create or replace function public.trg_stay_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('reserved', 'checked_in') then
    perform public.generate_stay_tasks(new.id);
  end if;
  return new;
end;
$$;

create trigger on_stay_created
  after insert on public.stays
  for each row
  execute function public.trg_stay_created();

-- -----------------------------------------------
-- Trigger: handle stay status/date changes
-- -----------------------------------------------
create or replace function public.trg_stay_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Status changed to cancelled or no_show
  if new.status in ('cancelled', 'no_show') and old.status not in ('cancelled', 'no_show') then
    perform public.on_stay_cancelled_fn() from (select new.*) as new;
    -- Call the function directly since it's designed as a trigger fn
    -- We need to call it differently
  end if;

  -- Dates changed
  if (old.check_in_date is distinct from new.check_in_date)
    or (old.check_out_date is distinct from new.check_out_date) then
    -- Recalculate due dates
    perform 1; -- trigger fn handles it
  end if;

  return new;
end;
$$;

-- Use the actual trigger functions directly
create trigger on_stay_cancelled
  after update on public.stays
  for each row
  when (new.status in ('cancelled', 'no_show') and old.status not in ('cancelled', 'no_show'))
  execute function public.on_stay_cancelled_fn();

create trigger on_stay_dates_changed
  after update on public.stays
  for each row
  when (old.check_in_date is distinct from new.check_in_date
    or old.check_out_date is distinct from new.check_out_date)
  execute function public.on_stay_dates_changed_fn();

-- Drop the unused wrapper
drop function if exists public.trg_stay_updated();

-- -----------------------------------------------
-- Trigger: reassign tasks when a profile's role changes
-- -----------------------------------------------
create or replace function public.trg_profile_role_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- User got a new role → assign unassigned tasks of that role to them
  if new.role_id is not null and (old.role_id is null or old.role_id != new.role_id) then
    perform public.reassign_workflow_tasks_for_role(new.organization_id, new.role_id);
  end if;

  -- User lost a role or was deactivated → reassign their tasks
  if (old.role_id is not null and (new.role_id is null or new.role_id != old.role_id))
    or (old.is_active = true and new.is_active = false) then
    -- Remove this user from workflow tasks and try to reassign
    declare
      v_task record;
    begin
      for v_task in
        select t.id, t.assigned_role_id, t.due_date
        from public.task_assignees ta
        join public.tasks t on t.id = ta.task_id
        join public.task_statuses ts on ts.id = t.status_id
        where ta.profile_id = old.id
          and t.source = 'stay_workflow'
          and ts.type in ('open', 'in_progress')
      loop
        -- Remove from this task
        delete from public.task_assignees where task_id = v_task.id and profile_id = old.id;
        -- Try to reassign
        if v_task.assigned_role_id is not null then
          perform public.assign_task_to_best_person(v_task.id, v_task.assigned_role_id, v_task.due_date::timestamptz);
        end if;
      end loop;
    end;
  end if;

  return new;
end;
$$;

create trigger on_profile_role_changed
  after update on public.profiles
  for each row
  when (old.role_id is distinct from new.role_id or old.is_active is distinct from new.is_active)
  execute function public.trg_profile_role_changed();

-- -----------------------------------------------
-- Seed workflow roles for existing organizations
-- -----------------------------------------------
do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.ensure_workflow_roles(v_org.id);
    perform public.seed_default_task_templates(v_org.id);
  end loop;
end;
$$;
