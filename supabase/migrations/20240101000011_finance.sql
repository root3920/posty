-- =============================================================
-- POSTY — Migration: Finance (expenses, other revenue, budgets, snapshots)
-- =============================================================

-- -----------------------------------------------
-- Expenses
-- -----------------------------------------------
create type public.payment_status as enum ('paid', 'pending');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id),
  supplier text,
  description text not null,
  amount numeric(14,2) not null,
  tax_amount numeric(14,2) not null default 0,
  expense_date date not null,
  payment_status payment_status not null default 'pending',
  due_date date,
  attachment_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_expenses_updated
  before update on public.expenses
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------
-- Other revenue (not tied to a stay)
-- -----------------------------------------------
create table public.other_revenue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revenue_center_id uuid not null references public.revenue_centers(id),
  description text not null,
  amount numeric(14,2) not null,
  tax_amount numeric(14,2) not null default 0,
  revenue_date date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------
-- Budgets (monthly targets)
-- -----------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  metric_key text not null,             -- e.g. 'revenue_total', 'gop', 'occupancy', 'adr'
  amount numeric(14,2) not null,

  unique(organization_id, year, month, metric_key)
);

-- -----------------------------------------------
-- Daily room snapshots (for historical occupancy calculations)
-- -----------------------------------------------
create table public.daily_room_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_date date not null,
  total_rooms int not null,
  available_rooms int not null,         -- not out of service
  occupied_rooms int not null,
  out_of_order_rooms int not null,

  unique(organization_id, snapshot_date)
);

-- -----------------------------------------------
-- Indexes
-- -----------------------------------------------
create index idx_expenses_organization on public.expenses(organization_id);
create index idx_expenses_date on public.expenses(expense_date);
create index idx_expenses_category on public.expenses(category_id);
create index idx_other_revenue_organization on public.other_revenue(organization_id);
create index idx_other_revenue_date on public.other_revenue(revenue_date);
create index idx_budgets_organization on public.budgets(organization_id, year, month);
create index idx_daily_snapshots_org_date on public.daily_room_snapshots(organization_id, snapshot_date);

-- -----------------------------------------------
-- RLS
-- -----------------------------------------------
alter table public.expenses enable row level security;
alter table public.other_revenue enable row level security;
alter table public.budgets enable row level security;
alter table public.daily_room_snapshots enable row level security;

-- Policies added in migration 000015
