-- =============================================================
-- POSTY — Migration: Organizations
-- =============================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,                          -- NIT / ID fiscal
  logo_url text,
  brand_color text default '#4f46e5',   -- Color primario del hotel
  currency text not null default 'COP',
  locale text not null default 'es-CO',
  timezone text not null default 'America/Bogota',
  date_format text not null default 'dd/MM/yyyy',
  default_check_in_time time not null default '15:00',
  default_check_out_time time not null default '12:00',
  tax_rate numeric(5,2) not null default 19.00,  -- IVA Colombia
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_organizations_updated
  before update on public.organizations
  for each row execute function public.handle_updated_at();

-- RLS enabled here; policies added in migration 000015 after all tables exist
alter table public.organizations enable row level security;
