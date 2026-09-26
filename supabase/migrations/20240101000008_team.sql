-- =============================================================
-- POSTY — Migration: Team (schedules, time off, shift templates)
-- =============================================================

-- -----------------------------------------------
-- Shift templates (reusable)
-- -----------------------------------------------
create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,           -- e.g. "Mañana", "Tarde", "Noche"
  start_time time not null,
  end_time time not null,       -- if end < start, it crosses midnight
  is_active boolean not null default true,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Work schedules (per employee, per weekday)
-- -----------------------------------------------
create table public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0=Monday, 6=Sunday
  start_time time not null,
  end_time time not null,
  is_day_off boolean not null default false,

  unique(profile_id, weekday, start_time)
);

-- -----------------------------------------------
-- Time off
-- -----------------------------------------------
create type public.time_off_type as enum ('vacation', 'sick_leave', 'personal', 'other');

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type time_off_type not null default 'vacation',
  note text,
  created_at timestamptz not null default now(),

  check (end_date >= start_date)
);

-- Indexes
create index idx_work_schedules_profile on public.work_schedules(profile_id);
create index idx_time_off_profile on public.time_off(profile_id);
create index idx_time_off_dates on public.time_off(start_date, end_date);

-- RLS
alter table public.shift_templates enable row level security;
alter table public.work_schedules enable row level security;
alter table public.time_off enable row level security;

-- Shift templates: org members
create policy "Users can view shift_templates of own org"
  on public.shift_templates for select
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

create policy "Org members can manage shift_templates"
  on public.shift_templates for all
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

-- Work schedules: visible to org members (via profile's org)
create policy "Users can view work_schedules of own org"
  on public.work_schedules for select
  using (
    profile_id in (
      select p2.id from public.profiles p2
      join public.profiles p1 on p1.organization_id = p2.organization_id
      where p1.id = auth.uid()
    )
  );

create policy "Org members can manage work_schedules"
  on public.work_schedules for all
  using (
    profile_id in (
      select p2.id from public.profiles p2
      join public.profiles p1 on p1.organization_id = p2.organization_id
      where p1.id = auth.uid()
    )
  );

-- Time off: visible to org members
create policy "Users can view time_off of own org"
  on public.time_off for select
  using (
    profile_id in (
      select p2.id from public.profiles p2
      join public.profiles p1 on p1.organization_id = p2.organization_id
      where p1.id = auth.uid()
    )
  );

create policy "Org members can manage time_off"
  on public.time_off for all
  using (
    profile_id in (
      select p2.id from public.profiles p2
      join public.profiles p1 on p1.organization_id = p2.organization_id
      where p1.id = auth.uid()
    )
  );
