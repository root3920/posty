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

-- RLS
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

create policy "Users can view roles of own org"
  on public.roles for select
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Users can view role_permissions of own org"
  on public.role_permissions for select
  using (
    role_id in (
      select r.id from public.roles r
      join public.profiles p on p.organization_id = r.organization_id
      where p.id = auth.uid()
    )
  );

-- Insert/update/delete on roles managed via has_permission (Phase 2 will tighten)
create policy "Org members can manage roles"
  on public.roles for all
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Org members can manage role_permissions"
  on public.role_permissions for all
  using (
    role_id in (
      select r.id from public.roles r
      join public.profiles p on p.organization_id = r.organization_id
      where p.id = auth.uid()
    )
  );
