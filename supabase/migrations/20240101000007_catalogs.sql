-- =============================================================
-- POSTY — Migration: Configurable catalogs
-- =============================================================

-- -----------------------------------------------
-- Task statuses
-- -----------------------------------------------
create type public.task_status_type as enum ('open', 'in_progress', 'done', 'cancelled');

create table public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  sort_order int not null default 0,
  type task_status_type not null default 'open',
  is_active boolean not null default true,
  is_system boolean not null default false,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Room statuses
-- -----------------------------------------------
create table public.room_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  sort_order int not null default 0,
  counts_as_available boolean not null default false,
  counts_as_out_of_order boolean not null default false,
  is_active boolean not null default true,
  is_system boolean not null default false,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Room types
-- -----------------------------------------------
create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  base_rate numeric(14,2) not null default 0,
  max_adults int not null default 2,
  max_children int not null default 0,
  amenities text[] default '{}',
  is_active boolean not null default true,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Document types (for guests)
-- -----------------------------------------------
create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,           -- CC, CE, Pasaporte, TI, NIT, PEP
  code text not null,           -- short code
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  archived_at timestamptz,

  unique(organization_id, code)
);

-- -----------------------------------------------
-- Booking channels
-- -----------------------------------------------
create table public.booking_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Travel reasons
-- -----------------------------------------------
create table public.travel_reasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Payment methods
-- -----------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Revenue centers (centros de ingreso)
-- -----------------------------------------------
create table public.revenue_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Expense categories
-- -----------------------------------------------
create type public.expense_category_group as enum ('departmental', 'undistributed', 'fixed', 'payroll');

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category_group expense_category_group not null default 'departmental',
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- Task labels
-- -----------------------------------------------
create table public.task_labels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  is_active boolean not null default true,
  archived_at timestamptz,

  unique(organization_id, name)
);

-- -----------------------------------------------
-- RLS for all catalog tables
-- -----------------------------------------------
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'task_statuses', 'room_statuses', 'room_types', 'document_types',
      'booking_channels', 'travel_reasons', 'payment_methods',
      'revenue_centers', 'expense_categories', 'task_labels'
    ])
  loop
    execute format('alter table public.%I enable row level security', tbl);

    execute format(
      'create policy "Users can view %1$s of own org" on public.%1$I for select using (
        organization_id in (select organization_id from public.profiles where id = auth.uid())
      )', tbl
    );

    execute format(
      'create policy "Org members can manage %1$s" on public.%1$I for all using (
        organization_id in (select organization_id from public.profiles where id = auth.uid())
      )', tbl
    );
  end loop;
end;
$$;
