-- =============================================================
-- POSTY — Migration: team_task_stats RPC function
-- Returns task counts per employee per day for the team view.
-- Calculated in Postgres to avoid fetching all tasks to the client.
-- =============================================================

create or replace function public.team_task_stats(
  p_from date,
  p_to date
)
returns table (
  profile_id uuid,
  stat_date date,
  pending_count bigint,
  completed_count bigint,
  overdue_count bigint
)
language plpgsql
security definer
stable
as $$
declare
  v_org_id uuid;
begin
  -- Get current user's organization
  select organization_id into v_org_id
  from public.profiles
  where id = auth.uid();

  if v_org_id is null then
    return;
  end if;

  return query
  select
    p.id as profile_id,
    d.dt as stat_date,
    -- Pending today: tasks with due_date = this day, status open/in_progress
    count(t.id) filter (
      where t.due_date = d.dt
        and ts.type in ('open', 'in_progress')
    ) as pending_count,
    -- Completed today: tasks with completed_at on this day (org timezone)
    count(t.id) filter (
      where (t.completed_at at time zone o.timezone)::date = d.dt
    ) as completed_count,
    -- Overdue: tasks with due_date < this day, not done/cancelled
    count(t.id) filter (
      where t.due_date < d.dt
        and ts.type in ('open', 'in_progress')
    ) as overdue_count
  from public.profiles p
  cross join generate_series(p_from, p_to, '1 day'::interval) as d(dt)
  cross join public.organizations o
  left join public.task_assignees ta on ta.profile_id = p.id
  left join public.tasks t on t.id = ta.task_id
    and t.archived_at is null
    and (
      t.due_date between p_from and p_to
      or (t.completed_at at time zone o.timezone)::date between p_from and p_to
      or (t.due_date < p_from and ts.type in ('open', 'in_progress'))
    )
  left join public.task_statuses ts on ts.id = t.status_id
  where p.organization_id = v_org_id
    and p.is_active = true
    and o.id = v_org_id
  group by p.id, d.dt
  order by p.id, d.dt;
end;
$$;
