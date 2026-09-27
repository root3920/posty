-- =============================================================
-- POSTY — Migration: Profiles
-- =============================================================

-- Availability status enum for manual override
create type public.availability_status as enum ('available', 'busy', 'resting');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  job_title text,
  document_number text,
  hire_date date,
  is_active boolean not null default true,
  availability_override availability_status,
  availability_note text,
  custom_data jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Index for common lookups
create index idx_profiles_organization on public.profiles(organization_id);
create index idx_profiles_role on public.profiles(role_id);

-- RLS enabled here; policies added in migration 000015 after all tables exist
alter table public.profiles enable row level security;
