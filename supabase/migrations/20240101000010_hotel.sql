-- =============================================================
-- POSTY — Migration: Hotel (rooms, guests, stays, folio, payments)
-- =============================================================

-- -----------------------------------------------
-- Rooms
-- -----------------------------------------------
create type public.housekeeping_status as enum ('clean', 'dirty', 'inspected');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number text not null,
  floor text,
  room_type_id uuid not null references public.room_types(id),
  status_id uuid not null references public.room_statuses(id),
  housekeeping_status housekeeping_status not null default 'clean',
  notes text,
  custom_data jsonb default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(organization_id, number)
);

create trigger on_rooms_updated
  before update on public.rooms
  for each row execute function public.handle_updated_at();

-- Add FK from tasks.room_id to rooms
alter table public.tasks
  add constraint fk_tasks_room
  foreign key (room_id) references public.rooms(id) on delete set null;

-- -----------------------------------------------
-- Guests
-- -----------------------------------------------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  document_type_id uuid references public.document_types(id),
  document_number text,
  nationality text,
  birth_date date,
  phone text,
  email text,
  address text,
  city_of_origin text,
  country_of_origin text,
  notes text,
  custom_data jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_guests_updated
  before update on public.guests
  for each row execute function public.handle_updated_at();

-- Unique guest per org by document (lesson #8)
create unique index idx_guests_document
  on public.guests(organization_id, document_type_id, document_number)
  where document_type_id is not null and document_number is not null;

-- -----------------------------------------------
-- Stays (estancias/reservas)
-- -----------------------------------------------
create type public.stay_status as enum ('reserved', 'checked_in', 'checked_out', 'cancelled', 'no_show');

-- Sequence for human-readable stay codes
create sequence public.stay_code_seq start 1;

create table public.stays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique default 'POS-' || lpad(nextval('public.stay_code_seq')::text, 6, '0'),
  room_id uuid not null references public.rooms(id),
  primary_guest_id uuid not null references public.guests(id),
  check_in_date date not null,
  check_out_date date not null,
  nights int generated always as (check_out_date - check_in_date) stored,
  actual_check_in_at timestamptz,
  actual_check_out_at timestamptz,
  adults int not null default 1,
  children int not null default 0,
  status stay_status not null default 'reserved',
  channel_id uuid references public.booking_channels(id),
  travel_reason_id uuid references public.travel_reasons(id),
  rate_per_night numeric(14,2) not null,
  currency text not null default 'COP',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (check_out_date > check_in_date)
);

create trigger on_stays_updated
  before update on public.stays
  for each row execute function public.handle_updated_at();

-- Anti double-booking exclusion constraint
alter table public.stays
  add constraint no_double_booking
  exclude using gist (
    room_id with =,
    daterange(check_in_date, check_out_date, '[)') with &&
  )
  where (status in ('reserved', 'checked_in'));

-- -----------------------------------------------
-- Stay guests (acompañantes)
-- -----------------------------------------------
create table public.stay_guests (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,

  unique(stay_id, guest_id)
);

-- -----------------------------------------------
-- Folio charges
-- -----------------------------------------------
create table public.folio_charges (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  revenue_center_id uuid not null references public.revenue_centers(id),
  description text not null,
  quantity int not null default 1,
  unit_price numeric(14,2) not null,
  tax_rate numeric(5,2) not null default 0,
  total numeric(14,2) generated always as (quantity * unit_price * (1 + tax_rate / 100)) stored,
  posted_at timestamptz not null default now(),
  posted_by uuid references public.profiles(id)
);

-- -----------------------------------------------
-- Payments
-- -----------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid references public.stays(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric(14,2) not null,
  method_id uuid not null references public.payment_methods(id),
  reference text,
  paid_at timestamptz not null default now(),
  received_by uuid references public.profiles(id)
);

-- -----------------------------------------------
-- Stay balances view
-- -----------------------------------------------
create or replace view public.stay_balances as
select
  s.id as stay_id,
  s.organization_id,
  coalesce(sum(fc.total), 0) as total_charges,
  coalesce((
    select sum(p.amount) from public.payments p where p.stay_id = s.id
  ), 0) as total_payments,
  coalesce(sum(fc.total), 0) - coalesce((
    select sum(p.amount) from public.payments p where p.stay_id = s.id
  ), 0) as balance
from public.stays s
left join public.folio_charges fc on fc.stay_id = s.id
group by s.id, s.organization_id;

-- -----------------------------------------------
-- Indexes
-- -----------------------------------------------
create index idx_rooms_organization on public.rooms(organization_id);
create index idx_rooms_status on public.rooms(status_id);
create index idx_guests_organization on public.guests(organization_id);
create index idx_guests_name on public.guests(organization_id, last_name, first_name);
create index idx_stays_organization on public.stays(organization_id);
create index idx_stays_room on public.stays(room_id);
create index idx_stays_dates on public.stays(check_in_date, check_out_date);
create index idx_stays_status on public.stays(status);
create index idx_folio_charges_stay on public.folio_charges(stay_id);
create index idx_payments_stay on public.payments(stay_id);
create index idx_payments_organization on public.payments(organization_id);

-- -----------------------------------------------
-- RLS
-- -----------------------------------------------
alter table public.rooms enable row level security;
alter table public.guests enable row level security;
alter table public.stays enable row level security;
alter table public.stay_guests enable row level security;
alter table public.folio_charges enable row level security;
alter table public.payments enable row level security;

-- Policies added in migration 000015
