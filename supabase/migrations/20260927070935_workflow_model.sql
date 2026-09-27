-- =============================================================
-- POSTY — Migration: Workflow model (task_templates, schema changes)
-- =============================================================

-- -----------------------------------------------
-- 1. roles.system_key (unique per org, nullable)
-- -----------------------------------------------
alter table public.roles
  add column if not exists system_key text;

create unique index if not exists idx_roles_system_key
  on public.roles (organization_id, system_key)
  where system_key is not null;

-- -----------------------------------------------
-- 2. booking_channels.is_ota
-- -----------------------------------------------
alter table public.booking_channels
  add column if not exists is_ota boolean not null default false;

-- Mark known OTAs
update public.booking_channels set is_ota = true
where name in ('Booking', 'Expedia', 'Airbnb');

-- -----------------------------------------------
-- 3. tasks: workflow columns
-- -----------------------------------------------
alter table public.tasks
  add column if not exists assigned_role_id uuid references public.roles(id) on delete set null,
  add column if not exists source text not null default 'manual',
  add column if not exists stay_id uuid references public.stays(id) on delete set null,
  add column if not exists template_id uuid,  -- FK added after task_templates created
  add column if not exists digest_date date;

-- -----------------------------------------------
-- 4. task_templates
-- -----------------------------------------------
create type public.workflow_type as enum ('stay_created', 'guest_arrived');
create type public.template_scope as enum ('per_stay', 'daily_digest');
create type public.template_anchor as enum ('created_at', 'check_in', 'check_out', 'arrival_confirmed');

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow workflow_type not null,
  role_system_key text not null,
  title_template text not null,
  description text,
  subtasks jsonb default '[]',          -- [{text, conditions?}]
  scope template_scope not null default 'per_stay',
  anchor template_anchor not null default 'check_in',
  offset_days int not null default 0,
  at_time time,                         -- null = use offset_minutes from anchor
  offset_minutes int not null default 0,
  priority text not null default 'normal',
  conditions jsonb default '["always"]',
  skip_if_past boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_task_templates_updated
  before update on public.task_templates
  for each row execute function public.handle_updated_at();

-- FK from tasks.template_id to task_templates
alter table public.tasks
  add constraint fk_tasks_template
  foreign key (template_id) references public.task_templates(id) on delete set null;

-- -----------------------------------------------
-- 5. Idempotency indexes
-- -----------------------------------------------
create unique index if not exists idx_tasks_stay_template
  on public.tasks (stay_id, template_id)
  where stay_id is not null and template_id is not null and source = 'stay_workflow' and digest_date is null;

create unique index if not exists idx_tasks_digest_unique
  on public.tasks (organization_id, template_id, digest_date)
  where template_id is not null and source = 'stay_workflow' and digest_date is not null;

-- Other indexes
create index if not exists idx_tasks_stay on public.tasks (stay_id) where stay_id is not null;
create index if not exists idx_tasks_source on public.tasks (source) where source = 'stay_workflow';
create index if not exists idx_tasks_assigned_role on public.tasks (assigned_role_id) where assigned_role_id is not null;
create index if not exists idx_task_templates_org on public.task_templates (organization_id);

-- -----------------------------------------------
-- 6. RLS on task_templates
-- -----------------------------------------------
alter table public.task_templates enable row level security;

create policy "Users can view task_templates of own org"
  on public.task_templates for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage task_templates"
  on public.task_templates for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 7. Update existing roles with system_keys
-- -----------------------------------------------
update public.roles set system_key = 'manager' where name = 'Gestor' and is_system = true and system_key is null;
update public.roles set system_key = 'front_desk' where name = 'Recepcionista' and system_key is null;
update public.roles set system_key = 'room_attendant' where name = 'Camarera de piso' and system_key is null;
update public.roles set system_key = 'maintenance' where name = 'Mantenimiento' and system_key is null;
