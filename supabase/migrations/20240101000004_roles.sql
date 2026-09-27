-- =============================================================
-- POSTY — Migration: Roles and role_permissions
-- =============================================================

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  color text default '#6b7280',
  is_system boolean not null default false,  -- System roles can't be deleted
  home_route text not null default '/dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(organization_id, name)
);

create trigger on_roles_updated
  before update on public.roles
  for each row execute function public.handle_updated_at();

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,

  unique(role_id, permission_key)
);

-- RLS enabled here; policies added in migration 000015 after all tables exist
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
