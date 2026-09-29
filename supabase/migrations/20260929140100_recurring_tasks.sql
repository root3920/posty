-- =============================================================
-- POSTY — Recurring tasks: table, cron processor, extensions
-- =============================================================

-- -----------------------------------------------
-- 1. recurring_tasks table
-- -----------------------------------------------
create table public.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  subtasks jsonb not null default '[]',
  assigned_role_id uuid references public.roles(id) on delete set null,
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  frequency_type text not null check (frequency_type in ('daily','weekly','monthly_day','every_n_days')),
  frequency_config jsonb not null default '{}',
  at_time time not null default '08:00',
  priority text not null default 'normal',
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_recurring_tasks_org on public.recurring_tasks(organization_id);

create trigger on_recurring_tasks_updated
  before update on public.recurring_tasks
  for each row execute function public.handle_updated_at();

alter table public.recurring_tasks enable row level security;

create policy "Users can view recurring_tasks of own org"
  on public.recurring_tasks for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage recurring_tasks"
  on public.recurring_tasks for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 2. tasks: new columns for recurring link
-- -----------------------------------------------
alter table public.tasks
  add column if not exists recurring_task_id uuid references public.recurring_tasks(id) on delete set null,
  add column if not exists occurrence_date date;

create unique index idx_tasks_recurring_idempotent
  on public.tasks (recurring_task_id, occurrence_date)
  where recurring_task_id is not null and occurrence_date is not null;

-- -----------------------------------------------
-- 3. housekeeping_config: new toggle columns
-- -----------------------------------------------
alter table public.housekeeping_config
  add column if not exists clean_before_arrival boolean not null default true,
  add column if not exists clean_after_checkout boolean not null default true;

-- -----------------------------------------------
-- 4. process_recurring_tasks() — pg_cron every minute
-- -----------------------------------------------
create or replace function public.process_recurring_tasks()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rt record;
  v_now timestamptz;
  v_today date;
  v_current_time time;
  v_should_create boolean;
  v_status_id uuid;
  v_task_id uuid;
  v_count int := 0;
  v_day_of_week int;
  v_day_of_month int;
  v_last_day int;
  v_subtask record;
begin
  for v_rt in
    select rt.*, o.timezone
    from public.recurring_tasks rt
    join public.organizations o on o.id = rt.organization_id
    where rt.is_active = true
  loop
    v_now := now() at time zone v_rt.timezone;
    v_today := v_now::date;
    v_current_time := v_now::time;

    -- Check date range
    if v_rt.start_date is not null and v_today < v_rt.start_date then continue; end if;
    if v_rt.end_date is not null and v_today > v_rt.end_date then continue; end if;

    -- Check if current time matches at_time (within 1-minute window)
    if v_current_time < v_rt.at_time or v_current_time >= v_rt.at_time + interval '1 minute' then
      continue;
    end if;

    -- Check frequency
    v_should_create := false;
    v_day_of_week := extract(isodow from v_today)::int;  -- 1=Mon..7=Sun
    v_day_of_month := extract(day from v_today)::int;

    case v_rt.frequency_type
      when 'daily' then
        v_should_create := true;
      when 'weekly' then
        v_should_create := v_rt.frequency_config->'days_of_week' ? v_day_of_week::text;
      when 'monthly_day' then
        v_last_day := extract(day from
          (date_trunc('month', v_today) + interval '1 month' - interval '1 day')
        )::int;
        v_should_create := v_day_of_month = least(
          (v_rt.frequency_config->>'day_of_month')::int,
          v_last_day
        );
      when 'every_n_days' then
        v_should_create := (v_today - coalesce(v_rt.start_date, v_rt.created_at::date))
                           % (v_rt.frequency_config->>'every_n_days')::int = 0;
    end case;

    if not v_should_create then continue; end if;

    -- Get open status for this org
    select id into v_status_id from public.task_statuses
    where organization_id = v_rt.organization_id and type = 'open'::task_status_type
    order by sort_order limit 1;

    -- Create task idempotently
    insert into public.tasks (
      organization_id, title, description, status_id, priority,
      created_by, due_date, room_id, assigned_role_id,
      source, recurring_task_id, occurrence_date, sort_order
    ) values (
      v_rt.organization_id, v_rt.title, v_rt.description, v_status_id,
      v_rt.priority::task_priority, v_rt.created_by,
      v_today, v_rt.room_id, v_rt.assigned_role_id,
      'recurring', v_rt.id, v_today, 0
    )
    on conflict (recurring_task_id, occurrence_date)
      where recurring_task_id is not null and occurrence_date is not null
    do nothing
    returning id into v_task_id;

    if v_task_id is null then continue; end if;

    -- Create subtasks
    for v_subtask in select * from jsonb_array_elements(v_rt.subtasks) loop
      insert into public.tasks (
        organization_id, parent_task_id, title, status_id, priority,
        created_by, due_date, source, sort_order
      ) values (
        v_rt.organization_id, v_task_id,
        v_subtask.value->>'text', v_status_id,
        'normal'::task_priority, v_rt.created_by,
        v_today, 'recurring', 0
      );
    end loop;

    -- Assign to specific person or best person for role
    if v_rt.assigned_profile_id is not null then
      insert into public.task_assignees (task_id, profile_id)
      values (v_task_id, v_rt.assigned_profile_id)
      on conflict do nothing;
    elsif v_rt.assigned_role_id is not null then
      perform public.assign_task_to_best_person(v_task_id, v_rt.assigned_role_id, v_today::timestamptz);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Grant execute to authenticated
grant execute on function public.process_recurring_tasks() to authenticated;

-- -----------------------------------------------
-- 5. Register pg_cron job
-- -----------------------------------------------
select cron.schedule(
  'recurring-tasks',
  '* * * * *',
  $$select public.process_recurring_tasks()$$
);

-- -----------------------------------------------
-- 6. Update tasks_view to include recurring_task_id
-- -----------------------------------------------
drop view if exists public.tasks_view;
create view public.tasks_view
  with (security_invoker = true)
as
select
  t.*,
  ts.name    as status_name,
  ts.color   as status_color,
  ts.type    as status_type,
  p_creator.full_name as created_by_name,
  rm.number  as room_number,
  rm.floor   as room_floor,
  rl.name    as assigned_role_name,
  rl.system_key as assigned_role_key,
  rl.color   as assigned_role_color
from public.tasks t
left join public.task_statuses ts on ts.id = t.status_id
left join public.profiles p_creator on p_creator.id = t.created_by
left join public.rooms rm on rm.id = t.room_id
left join public.roles rl on rl.id = t.assigned_role_id;
