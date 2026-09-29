-- =============================================================
-- POSTY — Migration: Contratos de Larga Estadía (Entrega 1)
-- Tablas, enums, funciones, vistas, RLS, permisos
-- =============================================================

-- -----------------------------------------------
-- 0. Sequence for contract codes
-- -----------------------------------------------
create sequence if not exists public.contract_code_seq start 1;

-- -----------------------------------------------
-- 1. Enums
-- -----------------------------------------------
create type public.stay_type as enum ('short_stay', 'long_stay');

create type public.contract_status as enum (
  'draft', 'sent_for_signature', 'signed', 'active',
  'expiring_soon', 'finished', 'terminated_early', 'renewed', 'cancelled'
);

create type public.billing_cycle as enum ('monthly', 'biweekly', 'weekly');

create type public.installment_status as enum (
  'pending', 'paid', 'partial', 'overdue', 'voided'
);

-- -----------------------------------------------
-- 2. Extend room_types with long-stay pricing
-- -----------------------------------------------
alter table public.room_types
  add column if not exists monthly_rate numeric(14,2),
  add column if not exists weekly_rate numeric(14,2),
  add column if not exists biweekly_rate numeric(14,2);

-- -----------------------------------------------
-- 3. Extend stays with stay_type and contract_id
-- -----------------------------------------------
alter table public.stays
  add column if not exists stay_type public.stay_type not null default 'short_stay',
  add column if not exists contract_id uuid;

-- -----------------------------------------------
-- 4. Extend organizations with contract config
-- -----------------------------------------------
alter table public.organizations
  add column if not exists contract_min_nights int not null default 30,
  add column if not exists contract_default_payment_day int not null default 1,
  add column if not exists contract_default_deposit_months int not null default 1,
  add column if not exists contract_provisional_hours int not null default 48;

-- -----------------------------------------------
-- 5. Table: contracts
-- -----------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique
    default 'CTR-' || lpad(nextval('public.contract_code_seq')::text, 6, '0'),

  -- Guest & payer
  guest_id uuid not null references public.guests(id),
  payer_business_name text,
  payer_tax_id text,

  -- Room
  room_id uuid not null references public.rooms(id),
  room_type_id uuid not null references public.room_types(id),

  -- Period
  start_date date not null,
  end_date date not null,

  -- Pricing
  monthly_rate numeric(14,2) not null,
  original_rate numeric(14,2) not null,
  billing_cycle public.billing_cycle not null default 'monthly',
  payment_day int not null default 1
    check (payment_day >= 1 and payment_day <= 28),
  tax_rate numeric(5,2) not null default 0,

  -- Deposit
  deposit_amount numeric(14,2) not null default 0,
  deposit_status text not null default 'pending'
    check (deposit_status in ('pending', 'paid', 'partial', 'returned', 'applied')),
  deposit_paid_amount numeric(14,2) not null default 0,

  -- Included services & cleaning
  included_services text[] not null default '{}',
  cleaning_frequency_days int not null default 7,

  -- Status
  status public.contract_status not null default 'draft',

  -- Linked stay
  stay_id uuid references public.stays(id) on delete set null,

  -- Metadata
  notes text,
  provisional_until timestamptz,
  signed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint check_contract_end_after_start check (end_date > start_date)
);

-- FK from stays.contract_id to contracts
alter table public.stays
  add constraint fk_stays_contract
  foreign key (contract_id) references public.contracts(id) on delete set null;

-- -----------------------------------------------
-- 6. Table: contract_installments
-- -----------------------------------------------
create table public.contract_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  number int not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount numeric(14,2) not null,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (amount + tax_amount) stored,
  paid_amount numeric(14,2) not null default 0,
  status public.installment_status not null default 'pending',
  paid_at timestamptz,
  is_prorated boolean not null default false,
  prorated_days int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_contract_installment_number unique (contract_id, number)
);

-- -----------------------------------------------
-- 7. Table: contract_payments
-- -----------------------------------------------
create table public.contract_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  installment_id uuid references public.contract_installments(id),
  amount numeric(14,2) not null,
  method_id uuid not null references public.payment_methods(id),
  reference text,
  is_deposit boolean not null default false,
  paid_at timestamptz not null default now(),
  received_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------
-- 8. Indexes
-- -----------------------------------------------
create index idx_contracts_organization on public.contracts(organization_id);
create index idx_contracts_guest on public.contracts(guest_id);
create index idx_contracts_room on public.contracts(room_id);
create index idx_contracts_status on public.contracts(status);
create index idx_contracts_dates on public.contracts(start_date, end_date);

create index idx_contract_installments_contract on public.contract_installments(contract_id);
create index idx_contract_installments_status on public.contract_installments(status);
create index idx_contract_installments_due_date on public.contract_installments(due_date);

create index idx_contract_payments_contract on public.contract_payments(contract_id);
create index idx_contract_payments_installment on public.contract_payments(installment_id);

-- -----------------------------------------------
-- 9. Triggers: updated_at
-- -----------------------------------------------
create trigger on_contracts_updated
  before update on public.contracts
  for each row execute function public.handle_updated_at();

create trigger on_contract_installments_updated
  before update on public.contract_installments
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------
-- 10. RLS
-- -----------------------------------------------
alter table public.contracts enable row level security;
alter table public.contract_installments enable row level security;
alter table public.contract_payments enable row level security;

-- contracts
create policy "Users can view contracts of own org"
  on public.contracts for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage contracts"
  on public.contracts for all
  using (organization_id = public.current_org_id());

-- contract_installments
create policy "Users can view installments of own org"
  on public.contract_installments for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage installments"
  on public.contract_installments for all
  using (organization_id = public.current_org_id());

-- contract_payments
create policy "Users can view contract_payments of own org"
  on public.contract_payments for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage contract_payments"
  on public.contract_payments for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 11. Permissions
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('contracts.view', 'contracts', 'view', null, 'Ver contratos de larga estadía'),
  ('contracts.create', 'contracts', 'create', null, 'Crear contratos de larga estadía'),
  ('contracts.edit', 'contracts', 'edit', null, 'Editar contratos de larga estadía'),
  ('contracts.terminate', 'contracts', 'terminate', null, 'Terminar contratos anticipadamente'),
  ('contracts.payments', 'contracts', 'payments', null, 'Registrar pagos de contratos');

-- -----------------------------------------------
-- 12. View: contracts_view
-- -----------------------------------------------
create view public.contracts_view
  with (security_invoker = true)
as
select
  c.*,
  r.number   as room_number,
  r.floor    as room_floor,
  rt.name    as room_type_name,
  g.first_name as guest_first_name,
  g.last_name  as guest_last_name,
  g.first_name || ' ' || g.last_name as guest_full_name,
  dt.code    as guest_document_type_code,
  g.document_number as guest_document_number,
  g.phone    as guest_phone,
  g.email    as guest_email,
  coalesce(inst_summary.total_installments, 0)::int as total_installments,
  coalesce(inst_summary.paid_installments, 0)::int as paid_installments,
  coalesce(inst_summary.overdue_installments, 0)::int as overdue_installments,
  coalesce(inst_summary.total_billed, 0)::numeric(14,2) as total_billed,
  coalesce(inst_summary.total_paid, 0)::numeric(14,2) as total_paid,
  inst_summary.next_due_date,
  inst_summary.next_due_amount,
  inst_summary.next_due_status
from public.contracts c
left join public.rooms r on r.id = c.room_id
left join public.room_types rt on rt.id = c.room_type_id
left join public.guests g on g.id = c.guest_id
left join public.document_types dt on dt.id = g.document_type_id
left join lateral (
  select
    count(*)::int as total_installments,
    count(*) filter (where ci.status = 'paid')::int as paid_installments,
    count(*) filter (where ci.status = 'overdue')::int as overdue_installments,
    sum(ci.total) as total_billed,
    sum(ci.paid_amount) as total_paid,
    min(ci.due_date) filter (where ci.status in ('pending', 'partial', 'overdue')) as next_due_date,
    (array_agg(ci.total order by ci.due_date) filter (where ci.status in ('pending', 'partial', 'overdue')))[1] as next_due_amount,
    (array_agg(ci.status::text order by ci.due_date) filter (where ci.status in ('pending', 'partial', 'overdue')))[1] as next_due_status
  from public.contract_installments ci
  where ci.contract_id = c.id
) inst_summary on true;

-- -----------------------------------------------
-- 13. Update stays_view to include stay_type and contract_id
-- -----------------------------------------------
drop view if exists public.stays_view;
create view public.stays_view
  with (security_invoker = true)
as
select
  s.*,
  r.number   as room_number,
  r.floor    as room_floor,
  rt.name    as room_type_name,
  rt.base_rate as room_type_rate,
  g.first_name as guest_first_name,
  g.last_name  as guest_last_name,
  g.first_name || ' ' || g.last_name as guest_full_name,
  g.nationality as guest_nationality,
  dt.code    as guest_document_type_code,
  g.document_number as guest_document_number,
  g.phone    as guest_phone,
  g.email    as guest_email,
  bc.name    as channel_name,
  tr.name    as travel_reason_name,
  coalesce(fc_total.total_charges, 0) as total_charges,
  coalesce(pay_total.total_payments, 0) as total_payments,
  coalesce(fc_total.total_charges, 0) - coalesce(pay_total.total_payments, 0) as balance
from public.stays s
left join public.rooms r on r.id = s.room_id
left join public.room_types rt on rt.id = r.room_type_id
left join public.guests g on g.id = s.primary_guest_id
left join public.document_types dt on dt.id = g.document_type_id
left join public.booking_channels bc on bc.id = s.channel_id
left join public.travel_reasons tr on tr.id = s.travel_reason_id
left join lateral (
  select sum(fc.total) as total_charges
  from public.folio_charges fc where fc.stay_id = s.id
) fc_total on true
left join lateral (
  select sum(p.amount) as total_payments
  from public.payments p where p.stay_id = s.id
) pay_total on true;

-- -----------------------------------------------
-- 14. Function: generate_contract_installments
-- Generates installments with first/last period proration
-- -----------------------------------------------
create or replace function public.generate_contract_installments(
  p_contract_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_period_start date;
  v_period_end date;
  v_due_date date;
  v_number int := 1;
  v_daily_rate numeric(14,2);
  v_days_in_period int;
  v_amount numeric(14,2);
  v_tax numeric(14,2);
  v_is_prorated boolean;
begin
  select * into v_contract from public.contracts where id = p_contract_id;
  if not found then
    raise exception 'Contrato no encontrado';
  end if;

  -- Delete any existing installments (idempotent)
  delete from public.contract_installments where contract_id = p_contract_id;

  -- Calculate daily rate based on billing cycle
  case v_contract.billing_cycle
    when 'monthly' then
      v_daily_rate := v_contract.monthly_rate / 30.0;
    when 'biweekly' then
      v_daily_rate := (v_contract.monthly_rate / 2.0) / 15.0;
    when 'weekly' then
      v_daily_rate := (v_contract.monthly_rate / 4.0) / 7.0;
  end case;

  v_period_start := v_contract.start_date;

  loop
    exit when v_period_start >= v_contract.end_date;

    -- Calculate period end based on billing cycle
    case v_contract.billing_cycle
      when 'monthly' then
        if extract(day from v_period_start::timestamp)::int <= v_contract.payment_day then
          -- Period ends on payment_day of this month
          v_period_end := make_date(
            extract(year from v_period_start)::int,
            extract(month from v_period_start)::int,
            least(v_contract.payment_day, 28)
          );
          -- If we're ON the payment day, go to next month's payment day
          if v_period_end <= v_period_start then
            v_period_end := (v_period_end + interval '1 month')::date;
            v_period_end := make_date(
              extract(year from v_period_end)::int,
              extract(month from v_period_end)::int,
              least(v_contract.payment_day, 28)
            );
          end if;
        else
          -- Period ends on payment_day of NEXT month
          v_period_end := (v_period_start + interval '1 month')::date;
          v_period_end := make_date(
            extract(year from v_period_end)::int,
            extract(month from v_period_end)::int,
            least(v_contract.payment_day, 28)
          );
        end if;
      when 'biweekly' then
        v_period_end := v_period_start + 15;
      when 'weekly' then
        v_period_end := v_period_start + 7;
    end case;

    -- Cap at contract end
    if v_period_end > v_contract.end_date then
      v_period_end := v_contract.end_date;
    end if;

    v_days_in_period := v_period_end - v_period_start;

    if v_days_in_period <= 0 then
      exit;
    end if;

    -- Determine if this is a full or prorated period
    case v_contract.billing_cycle
      when 'monthly' then
        v_is_prorated := v_days_in_period < 28;
      when 'biweekly' then
        v_is_prorated := v_days_in_period < 15;
      when 'weekly' then
        v_is_prorated := v_days_in_period < 7;
    end case;

    if v_is_prorated then
      v_amount := round(v_daily_rate * v_days_in_period, 2);
    else
      case v_contract.billing_cycle
        when 'monthly' then v_amount := v_contract.monthly_rate;
        when 'biweekly' then v_amount := round(v_contract.monthly_rate / 2.0, 2);
        when 'weekly' then v_amount := round(v_contract.monthly_rate / 4.0, 2);
      end case;
    end if;

    v_tax := round(v_amount * v_contract.tax_rate / 100.0, 2);
    v_due_date := v_period_start;

    insert into public.contract_installments (
      organization_id, contract_id, number,
      period_start, period_end, due_date,
      amount, tax_amount, is_prorated, prorated_days
    ) values (
      v_contract.organization_id, p_contract_id, v_number,
      v_period_start, v_period_end, v_due_date,
      v_amount, v_tax, v_is_prorated,
      case when v_is_prorated then v_days_in_period else null end
    );

    v_number := v_number + 1;
    v_period_start := v_period_end;
  end loop;
end;
$$;

grant execute on function public.generate_contract_installments(uuid) to authenticated;

-- -----------------------------------------------
-- 15. Function: create_contract_with_stay
-- Atomically creates contract + stay + installments
-- -----------------------------------------------
create or replace function public.create_contract_with_stay(
  p_guest_id uuid,
  p_payer_business_name text default null,
  p_payer_tax_id text default null,
  p_room_type_id uuid default null,
  p_room_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_monthly_rate numeric default 0,
  p_billing_cycle text default 'monthly',
  p_payment_day int default 1,
  p_tax_rate numeric default 0,
  p_deposit_amount numeric default 0,
  p_included_services text[] default '{}',
  p_cleaning_frequency_days int default 7,
  p_notes text default null,
  p_additional_guests uuid[] default '{}'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_room_id uuid;
  v_room_number text;
  v_contract_id uuid;
  v_contract_code text;
  v_stay_id uuid;
  v_stay_code text;
  v_type_name text;
  v_provisional_hours int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select organization_id into v_org_id
  from public.profiles where id = v_user_id limit 1;

  if v_org_id is null then
    raise exception 'Perfil no encontrado';
  end if;

  -- Validate dates
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'Las fechas del contrato son inválidas';
  end if;

  if (p_end_date - p_start_date) < 7 then
    raise exception 'El contrato debe ser de al menos 7 días';
  end if;

  -- Get provisional hours
  select contract_provisional_hours into v_provisional_hours
  from public.organizations where id = v_org_id;

  -- Get room type name
  select name into v_type_name
  from public.room_types where id = p_room_type_id;

  -- Room assignment (manual or auto)
  if p_room_id is not null then
    select r.id, r.number into v_room_id, v_room_number
    from public.rooms r
    where r.id = p_room_id
      and r.organization_id = v_org_id
      and r.room_type_id = p_room_type_id
      and r.is_active = true
      and not exists (
        select 1 from public.stays s
        where s.room_id = r.id
          and s.status in ('reserved', 'checked_in')
          and s.check_in_date < p_end_date
          and s.check_out_date > p_start_date
      )
    for update of r skip locked;
  else
    select r.id, r.number into v_room_id, v_room_number
    from public.rooms r
    where r.room_type_id = p_room_type_id
      and r.organization_id = v_org_id
      and r.is_active = true
      and not exists (
        select 1 from public.stays s
        where s.room_id = r.id
          and s.status in ('reserved', 'checked_in')
          and s.check_in_date < p_end_date
          and s.check_out_date > p_start_date
      )
    order by
      (r.housekeeping_status in ('clean', 'inspected')) desc,
      random()
    limit 1
    for update of r skip locked;
  end if;

  if v_room_id is null then
    raise exception 'No hay habitaciones disponibles de tipo "%" para todo el período del contrato',
      coalesce(v_type_name, 'Desconocido');
  end if;

  -- Create the stay that blocks the room for the entire contract period
  insert into public.stays (
    organization_id, room_id, primary_guest_id,
    check_in_date, check_out_date,
    adults, children, status,
    rate_per_night, stay_type, notes, created_by
  ) values (
    v_org_id, v_room_id, p_guest_id,
    p_start_date, p_end_date,
    1, 0, 'reserved'::stay_status,
    round(p_monthly_rate / 30.0, 2), 'long_stay'::stay_type,
    'Estancia de larga estadía', v_user_id
  )
  returning id, code into v_stay_id, v_stay_code;

  -- Add additional guests
  if array_length(p_additional_guests, 1) > 0 then
    insert into public.stay_guests (stay_id, guest_id)
    select v_stay_id, unnest(p_additional_guests);
  end if;

  -- Create the contract
  insert into public.contracts (
    organization_id, guest_id,
    payer_business_name, payer_tax_id,
    room_id, room_type_id,
    start_date, end_date,
    monthly_rate, original_rate,
    billing_cycle, payment_day, tax_rate,
    deposit_amount,
    included_services, cleaning_frequency_days,
    status, stay_id,
    notes, provisional_until,
    created_by
  ) values (
    v_org_id, p_guest_id,
    p_payer_business_name, p_payer_tax_id,
    v_room_id, p_room_type_id,
    p_start_date, p_end_date,
    p_monthly_rate, p_monthly_rate,
    p_billing_cycle::billing_cycle, p_payment_day, p_tax_rate,
    p_deposit_amount,
    p_included_services, p_cleaning_frequency_days,
    'draft'::contract_status, v_stay_id,
    p_notes, now() + (v_provisional_hours || ' hours')::interval,
    v_user_id
  )
  returning id, code into v_contract_id, v_contract_code;

  -- Link the stay back to the contract
  update public.stays set contract_id = v_contract_id where id = v_stay_id;

  -- Generate installments
  perform public.generate_contract_installments(v_contract_id);

  return json_build_object(
    'contract_id', v_contract_id,
    'contract_code', v_contract_code,
    'stay_id', v_stay_id,
    'stay_code', v_stay_code,
    'room_id', v_room_id,
    'room_number', v_room_number
  );
end;
$$;

grant execute on function public.create_contract_with_stay(uuid, text, text, uuid, uuid, date, date, numeric, text, int, numeric, numeric, text[], int, text, uuid[]) to authenticated;

-- -----------------------------------------------
-- 16. Function: register_contract_payment
-- Handles partial payments and overpayment spillover
-- -----------------------------------------------
create or replace function public.register_contract_payment(
  p_installment_id uuid,
  p_amount numeric,
  p_method_id uuid,
  p_reference text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_installment record;
  v_contract record;
  v_remaining numeric;
  v_apply numeric;
  v_next_installment record;
  v_payment_id uuid;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id
  from public.profiles where id = v_user_id limit 1;

  -- Get installment
  select * into v_installment
  from public.contract_installments
  where id = p_installment_id and organization_id = v_org_id;

  if not found then
    raise exception 'Cuota no encontrada';
  end if;

  select * into v_contract
  from public.contracts where id = v_installment.contract_id;

  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  -- Record the payment
  insert into public.contract_payments (
    organization_id, contract_id, installment_id,
    amount, method_id, reference, received_by
  ) values (
    v_org_id, v_contract.id, p_installment_id,
    p_amount, p_method_id, p_reference, v_user_id
  )
  returning id into v_payment_id;

  -- Apply payment to this installment
  v_apply := least(p_amount, v_installment.total - v_installment.paid_amount);
  v_remaining := p_amount - v_apply;

  update public.contract_installments set
    paid_amount = paid_amount + v_apply,
    status = case
      when paid_amount + v_apply >= total then 'paid'::installment_status
      else 'partial'::installment_status
    end,
    paid_at = case
      when paid_amount + v_apply >= total then now()
      else paid_at
    end
  where id = p_installment_id;

  -- If overpayment, apply to next pending installments
  while v_remaining > 0 loop
    select * into v_next_installment
    from public.contract_installments
    where contract_id = v_contract.id
      and status in ('pending', 'partial', 'overdue')
      and id != p_installment_id
      and number > v_installment.number
    order by number
    limit 1;

    exit when not found;

    v_apply := least(v_remaining, v_next_installment.total - v_next_installment.paid_amount);
    v_remaining := v_remaining - v_apply;

    update public.contract_installments set
      paid_amount = paid_amount + v_apply,
      status = case
        when paid_amount + v_apply >= total then 'paid'::installment_status
        else 'partial'::installment_status
      end,
      paid_at = case
        when paid_amount + v_apply >= total then now()
        else paid_at
      end
    where id = v_next_installment.id;

    -- Update reference for loop
    v_installment.number := v_next_installment.number;
  end loop;

  return json_build_object(
    'payment_id', v_payment_id,
    'applied', p_amount - v_remaining,
    'remaining', v_remaining
  );
end;
$$;

grant execute on function public.register_contract_payment(uuid, numeric, uuid, text) to authenticated;

-- -----------------------------------------------
-- 17. Function: register_deposit_payment
-- -----------------------------------------------
create or replace function public.register_deposit_payment(
  p_contract_id uuid,
  p_amount numeric,
  p_method_id uuid,
  p_reference text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_contract record;
  v_new_paid numeric;
  v_payment_id uuid;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id
  from public.profiles where id = v_user_id limit 1;

  select * into v_contract
  from public.contracts
  where id = p_contract_id and organization_id = v_org_id;

  if not found then
    raise exception 'Contrato no encontrado';
  end if;

  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  -- Record payment
  insert into public.contract_payments (
    organization_id, contract_id, installment_id,
    amount, method_id, reference, is_deposit, received_by
  ) values (
    v_org_id, p_contract_id, null,
    p_amount, p_method_id, p_reference, true, v_user_id
  )
  returning id into v_payment_id;

  -- Update deposit status
  v_new_paid := v_contract.deposit_paid_amount + p_amount;

  update public.contracts set
    deposit_paid_amount = v_new_paid,
    deposit_status = case
      when v_new_paid >= deposit_amount then 'paid'
      when v_new_paid > 0 then 'partial'
      else 'pending'
    end
  where id = p_contract_id;

  return json_build_object(
    'payment_id', v_payment_id,
    'deposit_paid', v_new_paid,
    'deposit_total', v_contract.deposit_amount
  );
end;
$$;

grant execute on function public.register_deposit_payment(uuid, numeric, uuid, text) to authenticated;

-- -----------------------------------------------
-- 18. Function: available_rooms_for_contract
-- Like available_rooms_by_type but includes monthly_rate
-- -----------------------------------------------
create or replace function public.available_rooms_for_contract(
  p_start_date date,
  p_end_date date
)
returns table (
  id uuid,
  name text,
  base_rate numeric(14,2),
  monthly_rate numeric(14,2),
  weekly_rate numeric(14,2),
  biweekly_rate numeric(14,2),
  max_adults int,
  max_children int,
  available_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  with org as (
    select organization_id from public.profiles where id = auth.uid() limit 1
  ),
  blocked_rooms as (
    select distinct s.room_id
    from public.stays s
    where s.status in ('reserved', 'checked_in')
      and s.check_in_date < p_end_date
      and s.check_out_date > p_start_date
  )
  select
    rt.id,
    rt.name,
    rt.base_rate,
    rt.monthly_rate,
    rt.weekly_rate,
    rt.biweekly_rate,
    rt.max_adults,
    rt.max_children,
    count(r.id) filter (
      where r.is_active = true
        and r.id not in (select room_id from blocked_rooms)
    ) as available_count
  from public.room_types rt
  cross join org
  left join public.rooms r
    on r.room_type_id = rt.id
    and r.organization_id = org.organization_id
  where rt.organization_id = org.organization_id
    and rt.is_active = true
    and rt.archived_at is null
    and rt.monthly_rate is not null
  group by rt.id, rt.name, rt.base_rate, rt.monthly_rate, rt.weekly_rate, rt.biweekly_rate, rt.max_adults, rt.max_children
  order by rt.name;
$$;

grant execute on function public.available_rooms_for_contract(date, date) to authenticated;

-- -----------------------------------------------
-- 19. Function: available_rooms_of_type_for_period
-- Returns specific rooms of a type available for the full period
-- -----------------------------------------------
create or replace function public.available_rooms_of_type_for_period(
  p_room_type_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  id uuid,
  number text,
  floor text,
  rate_override numeric(14,2)
)
language sql
security definer
stable
set search_path = public
as $$
  with org as (
    select organization_id from public.profiles where id = auth.uid() limit 1
  )
  select r.id, r.number, r.floor, r.rate_override
  from public.rooms r
  cross join org
  where r.room_type_id = p_room_type_id
    and r.organization_id = org.organization_id
    and r.is_active = true
    and not exists (
      select 1 from public.stays s
      where s.room_id = r.id
        and s.status in ('reserved', 'checked_in')
        and s.check_in_date < p_end_date
        and s.check_out_date > p_start_date
    )
  order by r.number;
$$;

grant execute on function public.available_rooms_of_type_for_period(uuid, date, date) to authenticated;

-- -----------------------------------------------
-- 20. Function: get_contract_kpis
-- -----------------------------------------------
create or replace function public.get_contract_kpis()
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_org_id uuid;
  v_result json;
  v_today date;
  v_tz text;
begin
  select organization_id into v_org_id
  from public.profiles where id = auth.uid() limit 1;

  select timezone into v_tz
  from public.organizations where id = v_org_id;

  v_today := (now() at time zone coalesce(v_tz, 'America/Bogota'))::date;

  select json_build_object(
    'active_contracts', (
      select count(*) from public.contracts
      where organization_id = v_org_id
        and status in ('active', 'signed')
    ),
    'expiring_soon', (
      select count(*) from public.contracts
      where organization_id = v_org_id
        and status in ('active', 'signed')
        and end_date between v_today and v_today + 30
    ),
    'overdue_installments_count', (
      select count(*) from public.contract_installments ci
      join public.contracts c on c.id = ci.contract_id
      where c.organization_id = v_org_id
        and ci.status = 'overdue'
    ),
    'overdue_installments_amount', (
      select coalesce(sum(ci.total - ci.paid_amount), 0)
      from public.contract_installments ci
      join public.contracts c on c.id = ci.contract_id
      where c.organization_id = v_org_id
        and ci.status in ('overdue', 'partial')
        and ci.due_date < v_today
    ),
    'monthly_recurring_income', (
      select coalesce(sum(c.monthly_rate), 0) from public.contracts c
      where c.organization_id = v_org_id
        and c.status in ('active', 'signed')
    ),
    'total_deposits', (
      select coalesce(sum(c.deposit_paid_amount), 0) from public.contracts c
      where c.organization_id = v_org_id
        and c.status in ('active', 'signed', 'draft')
        and c.deposit_amount > 0
    ),
    'long_stay_rooms', (
      select count(distinct c.room_id) from public.contracts c
      where c.organization_id = v_org_id
        and c.status in ('active', 'signed')
    ),
    'total_rooms', (
      select count(*) from public.rooms
      where organization_id = v_org_id and is_active = true
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_contract_kpis() to authenticated;

-- -----------------------------------------------
-- 21. Update seed_organization_defaults
-- Add "Larga estadía" revenue center and contract permissions
-- -----------------------------------------------
create or replace function public.seed_organization_defaults(p_org_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_gestor_role_id uuid;
begin
  -- System role: Gestor (owner, all permissions)
  insert into public.roles (organization_id, name, description, color, is_system, home_route)
  values (p_org_id, 'Gestor', 'Administrador con todos los permisos', '#4f46e5', true, '/dashboard')
  returning id into v_gestor_role_id;

  -- Grant ALL permissions to Gestor
  insert into public.role_permissions (role_id, permission_key)
  select v_gestor_role_id, key from public.permissions;

  -- Default roles
  insert into public.roles (organization_id, name, description, color, home_route) values
    (p_org_id, 'Recepcionista', 'Atención en recepción', '#0891b2', '/hotel'),
    (p_org_id, 'Camarera de piso', 'Limpieza de habitaciones', '#65a30d', '/tareas'),
    (p_org_id, 'Mantenimiento', 'Mantenimiento del hotel', '#d97706', '/tareas'),
    (p_org_id, 'Contador', 'Gestión financiera', '#7c3aed', '/finanzas'),
    (p_org_id, 'Jefe de A&B', 'Alimentos y bebidas', '#dc2626', '/dashboard');

  -- Task statuses
  insert into public.task_statuses (organization_id, name, color, sort_order, type, is_system) values
    (p_org_id, 'Por hacer',    '#6b7280', 0, 'open',        true),
    (p_org_id, 'En progreso',  '#3b82f6', 1, 'in_progress', true),
    (p_org_id, 'En revisión',  '#f59e0b', 2, 'in_progress', true),
    (p_org_id, 'Completada',   '#22c55e', 3, 'done',        true),
    (p_org_id, 'Cancelada',    '#ef4444', 4, 'cancelled',   true);

  -- Room statuses
  insert into public.room_statuses (organization_id, name, color, sort_order, counts_as_available, counts_as_out_of_order, is_system) values
    (p_org_id, 'Disponible',      '#22c55e', 0, true,  false, true),
    (p_org_id, 'Ocupada',         '#3b82f6', 1, false, false, true),
    (p_org_id, 'Sucia',           '#f59e0b', 2, false, false, true),
    (p_org_id, 'En limpieza',     '#a855f7', 3, false, false, true),
    (p_org_id, 'Mantenimiento',   '#ef4444', 4, false, true,  true),
    (p_org_id, 'Fuera de servicio','#6b7280', 5, false, true,  true),
    (p_org_id, 'Reservada',       '#0891b2', 6, false, false, true);

  -- Document types
  insert into public.document_types (organization_id, name, code, sort_order, is_system) values
    (p_org_id, 'Cédula de ciudadanía',  'CC',  0, true),
    (p_org_id, 'Cédula de extranjería', 'CE',  1, true),
    (p_org_id, 'Pasaporte',             'PA',  2, true),
    (p_org_id, 'Tarjeta de identidad',  'TI',  3, true),
    (p_org_id, 'NIT',                   'NIT', 4, true),
    (p_org_id, 'PEP',                   'PEP', 5, true);

  -- Booking channels
  insert into public.booking_channels (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Directo',  0, true),
    (p_org_id, 'Walk-in',  1, true),
    (p_org_id, 'Booking',  2, false),
    (p_org_id, 'Expedia',  3, false),
    (p_org_id, 'Airbnb',   4, false),
    (p_org_id, 'Agencia',  5, false);

  -- Travel reasons
  insert into public.travel_reasons (organization_id, name, sort_order) values
    (p_org_id, 'Turismo',      0),
    (p_org_id, 'Negocios',     1),
    (p_org_id, 'Educación',    2),
    (p_org_id, 'Salud',        3),
    (p_org_id, 'Eventos',      4),
    (p_org_id, 'Otro',         5);

  -- Payment methods
  insert into public.payment_methods (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Efectivo',          0, true),
    (p_org_id, 'Tarjeta débito',    1, true),
    (p_org_id, 'Tarjeta crédito',   2, true),
    (p_org_id, 'Transferencia',     3, true),
    (p_org_id, 'Nequi',             4, false),
    (p_org_id, 'Daviplata',         5, false);

  -- Revenue centers (with Larga estadía)
  insert into public.revenue_centers (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Habitaciones',          0, true),
    (p_org_id, 'Alimentos y Bebidas',   1, true),
    (p_org_id, 'Lavandería',            2, false),
    (p_org_id, 'Spa',                   3, false),
    (p_org_id, 'Parqueadero',           4, false),
    (p_org_id, 'Minibar',               5, false),
    (p_org_id, 'Larga estadía',         6, true),
    (p_org_id, 'Otros',                 7, false);

  -- Expense categories — Departmental
  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Costo de habitaciones',    'departmental',  0, true),
    (p_org_id, 'Costo de A&B',            'departmental',  1, true),
    (p_org_id, 'Lavandería',              'departmental',  2, false),
    (p_org_id, 'Amenities',               'departmental',  3, false);

  -- Undistributed
  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Administración',           'undistributed', 10, true),
    (p_org_id, 'Ventas y marketing',       'undistributed', 11, false),
    (p_org_id, 'Mantenimiento',            'undistributed', 12, false),
    (p_org_id, 'Servicios públicos',       'undistributed', 13, true),
    (p_org_id, 'Tecnología',              'undistributed', 14, false),
    (p_org_id, 'Comisiones OTAs',          'undistributed', 15, false);

  -- Fixed
  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Arriendo',                'fixed',         20, false),
    (p_org_id, 'Seguros',                 'fixed',         21, false),
    (p_org_id, 'Impuestos propiedad',     'fixed',         22, false),
    (p_org_id, 'Intereses',               'fixed',         23, false),
    (p_org_id, 'Depreciación',            'fixed',         24, false);

  -- Payroll
  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Nómina',                  'payroll',       30, true);

  -- Shift templates
  insert into public.shift_templates (organization_id, name, start_time, end_time) values
    (p_org_id, 'Mañana',  '06:00', '14:00'),
    (p_org_id, 'Tarde',   '14:00', '22:00'),
    (p_org_id, 'Noche',   '22:00', '06:00');
end;
$$;
