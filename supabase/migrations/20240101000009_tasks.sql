-- =============================================================
-- POSTY — Migration: Tasks, subtasks, assignees, comments, activity
-- =============================================================

create type public.task_priority as enum ('urgent', 'high', 'normal', 'low');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete cascade,  -- subtasks
  title text not null,
  description text,                     -- markdown
  status_id uuid not null references public.task_statuses(id),
  priority task_priority not null default 'normal',
  created_by uuid not null references public.profiles(id),
  start_date date,
  due_date date,
  completed_at timestamptz,             -- auto-filled by trigger
  room_id uuid,                         -- FK added in hotel migration
  estimated_minutes int,
  sort_order int not null default 0,
  recurrence_rule text,                 -- future: iCal RRULE
  custom_data jsonb default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_tasks_updated
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------
-- Task assignees (many-to-many)
-- -----------------------------------------------
create table public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,

  unique(task_id, profile_id)
);

-- -----------------------------------------------
-- Task label links (many-to-many)
-- -----------------------------------------------
create table public.task_label_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.task_labels(id) on delete cascade,

  unique(task_id, label_id)
);

-- -----------------------------------------------
-- Task comments
-- -----------------------------------------------
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------
-- Task activity log (auto by trigger)
-- -----------------------------------------------
create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null,                 -- 'status_changed', 'assigned', 'priority_changed', etc.
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------
-- Indexes
-- -----------------------------------------------
create index idx_tasks_organization on public.tasks(organization_id);
create index idx_tasks_status on public.tasks(status_id);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_parent on public.tasks(parent_task_id);
create index idx_tasks_room on public.tasks(room_id);
create index idx_task_assignees_task on public.task_assignees(task_id);
create index idx_task_assignees_profile on public.task_assignees(profile_id);
create index idx_task_comments_task on public.task_comments(task_id);
create index idx_task_activity_task on public.task_activity(task_id);

-- -----------------------------------------------
-- Trigger: auto-fill completed_at when status changes to 'done'
-- -----------------------------------------------
create or replace function public.handle_task_completed_at()
returns trigger as $$
declare
  v_status_type task_status_type;
  v_old_status_type task_status_type;
begin
  -- Get new status type
  select type into v_status_type
  from public.task_statuses
  where id = new.status_id;

  -- Get old status type
  if old.status_id is not null then
    select type into v_old_status_type
    from public.task_statuses
    where id = old.status_id;
  end if;

  -- Status changed to done → set completed_at
  if v_status_type = 'done' and (v_old_status_type is null or v_old_status_type != 'done') then
    new.completed_at = now();
  end if;

  -- Status changed from done → clear completed_at
  if v_status_type != 'done' and v_old_status_type = 'done' then
    new.completed_at = null;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger on_task_status_change
  before update on public.tasks
  for each row
  when (old.status_id is distinct from new.status_id)
  execute function public.handle_task_completed_at();

-- Also on insert
create trigger on_task_insert_completed
  before insert on public.tasks
  for each row
  execute function public.handle_task_completed_at();

-- -----------------------------------------------
-- Trigger: log task activity on status/priority/assignment changes
-- -----------------------------------------------
create or replace function public.log_task_activity()
returns trigger as $$
begin
  -- Status change
  if old.status_id is distinct from new.status_id then
    insert into public.task_activity (task_id, actor_id, action, from_value, to_value)
    values (
      new.id,
      auth.uid(),
      'status_changed',
      (select name from public.task_statuses where id = old.status_id),
      (select name from public.task_statuses where id = new.status_id)
    );
  end if;

  -- Priority change
  if old.priority is distinct from new.priority then
    insert into public.task_activity (task_id, actor_id, action, from_value, to_value)
    values (new.id, auth.uid(), 'priority_changed', old.priority::text, new.priority::text);
  end if;

  -- Due date change
  if old.due_date is distinct from new.due_date then
    insert into public.task_activity (task_id, actor_id, action, from_value, to_value)
    values (new.id, auth.uid(), 'due_date_changed', old.due_date::text, new.due_date::text);
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_task_activity_log
  after update on public.tasks
  for each row
  execute function public.log_task_activity();

-- -----------------------------------------------
-- RLS
-- -----------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_label_links enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;

-- Tasks: org isolation
create policy "Users can view tasks of own org"
  on public.tasks for select
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

create policy "Org members can insert tasks"
  on public.tasks for insert
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

create policy "Org members can update tasks"
  on public.tasks for update
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

create policy "Org members can delete tasks"
  on public.tasks for delete
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

-- Task assignees: accessible via task's org
create policy "Users can view task_assignees of own org"
  on public.task_assignees for select
  using (
    task_id in (select id from public.tasks where organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    ))
  );

create policy "Org members can manage task_assignees"
  on public.task_assignees for all
  using (
    task_id in (select id from public.tasks where organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    ))
  );

-- Task label links
create policy "Users can view task_label_links of own org"
  on public.task_label_links for select
  using (
    task_id in (select id from public.tasks where organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    ))
  );

create policy "Org members can manage task_label_links"
  on public.task_label_links for all
  using (
    task_id in (select id from public.tasks where organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    ))
  );

-- Task comments
create policy "Users can view task_comments of own org"
  on public.task_comments for select
  using (
    task_id in (select id from public.tasks where organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    ))
  );

create policy "Org members can insert task_comments"
  on public.task_comments for insert
  with check (
    task_id in (select id from public.tasks where organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    ))
  );

-- Task activity (read-only for users, written by trigger)
create policy "Users can view task_activity of own org"
  on public.task_activity for select
  using (
    task_id in (select id from public.tasks where organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    ))
  );

-- Activity insert is done by security definer trigger, not user directly
