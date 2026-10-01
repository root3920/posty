-- =============================================================
-- POSTY — DIAN Electronic Invoicing
-- Resolución 000165/2023, UBL 2.1, validación previa
-- =============================================================

-- -----------------------------------------------
-- 1. Extend organizations with DIAN fiscal data
-- -----------------------------------------------
alter table public.organizations
  add column if not exists dian_regime text,
  add column if not exists dian_fiscal_responsibilities text[] default '{}',
  add column if not exists dian_ciiu_code text default '5511',
  add column if not exists dian_numbering_prefix text,
  add column if not exists dian_numbering_from int,
  add column if not exists dian_numbering_to int,
  add column if not exists dian_numbering_current int default 0,
  add column if not exists dian_resolution_number text,
  add column if not exists dian_resolution_date date,
  add column if not exists dian_provider text,
  add column if not exists dian_provider_api_key text,
  add column if not exists ica_rate numeric(5,2) default 0,
  add column if not exists consumption_tax_rate numeric(5,2) default 8;

-- -----------------------------------------------
-- 2. Invoice sequence
-- -----------------------------------------------
create sequence if not exists public.invoice_number_seq start 1;

-- -----------------------------------------------
-- 3. Table: invoices
-- -----------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  prefix text,
  invoice_date date not null default current_date,
  due_date date,

  -- Issuer
  issuer_nit text not null,
  issuer_name text not null,
  issuer_address text,

  -- Customer
  customer_name text not null,
  customer_nit text,
  customer_document_type text,
  customer_document_number text,
  customer_email text,
  customer_address text,
  customer_phone text,

  -- Links
  stay_id uuid references public.stays(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  event_booking_id uuid references public.event_bookings(id) on delete set null,

  -- Totals
  subtotal numeric(14,2) not null default 0,
  tax_base numeric(14,2) not null default 0,
  iva_rate numeric(5,2) not null default 19,
  iva_amount numeric(14,2) not null default 0,
  ica_amount numeric(14,2) not null default 0,
  consumption_tax numeric(14,2) not null default 0,
  withholding_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,

  -- DIAN
  cufe text,
  qr_code_url text,
  dian_status text not null default 'draft'
    check (dian_status in ('draft', 'pending', 'validated', 'rejected', 'cancelled')),
  dian_response jsonb,
  pdf_path text,

  -- Payment
  payment_method_dian text,
  payment_means_dian text,

  -- Metadata
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_invoice_number unique (organization_id, invoice_number)
);

create index idx_invoices_org on public.invoices(organization_id);
create index idx_invoices_date on public.invoices(invoice_date);
create index idx_invoices_stay on public.invoices(stay_id);
create index idx_invoices_status on public.invoices(dian_status);

create trigger on_invoices_updated
  before update on public.invoices
  for each row execute function public.handle_updated_at();

alter table public.invoices enable row level security;
create policy "View invoices of own org" on public.invoices for select using (organization_id = public.current_org_id());
create policy "Manage invoices" on public.invoices for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 4. Table: invoice_lines
-- -----------------------------------------------
create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_number int not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 19,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  revenue_center_id uuid references public.revenue_centers(id)
);

create index idx_invoice_lines_invoice on public.invoice_lines(invoice_id);

alter table public.invoice_lines enable row level security;
create policy "View invoice_lines via invoice" on public.invoice_lines for select
  using (invoice_id in (select id from public.invoices where organization_id = public.current_org_id()));
create policy "Manage invoice_lines" on public.invoice_lines for all
  using (invoice_id in (select id from public.invoices where organization_id = public.current_org_id()));

-- -----------------------------------------------
-- 5. Table: credit_notes
-- -----------------------------------------------
create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  credit_note_number text not null,
  reason text not null,
  amount numeric(14,2) not null,
  cufe text,
  dian_status text not null default 'draft'
    check (dian_status in ('draft', 'pending', 'validated', 'rejected')),
  dian_response jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.credit_notes enable row level security;
create policy "View credit_notes of own org" on public.credit_notes for select using (organization_id = public.current_org_id());
create policy "Manage credit_notes" on public.credit_notes for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 6. Function: create_invoice_from_stay
-- -----------------------------------------------
create or replace function public.create_invoice_from_stay(p_stay_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_org record;
  v_stay record;
  v_guest record;
  v_doc_type record;
  v_invoice_id uuid;
  v_invoice_number text;
  v_subtotal numeric := 0;
  v_iva numeric := 0;
  v_total numeric := 0;
  v_charge record;
  v_line_num int := 0;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_org from public.organizations where id = v_org_id;
  select s.*, r.number as room_number into v_stay
  from public.stays s join public.rooms r on r.id = s.room_id
  where s.id = p_stay_id and s.organization_id = v_org_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  select * into v_guest from public.guests where id = v_stay.primary_guest_id;
  select * into v_doc_type from public.document_types where id = v_guest.document_type_id;

  -- Generate invoice number
  v_invoice_number := coalesce(v_org.dian_numbering_prefix, '') ||
    lpad((coalesce(v_org.dian_numbering_current, 0) + 1)::text, 8, '0');

  -- Update numbering sequence
  update public.organizations set dian_numbering_current = coalesce(dian_numbering_current, 0) + 1
  where id = v_org_id;

  -- Create invoice
  insert into public.invoices (
    organization_id, invoice_number, prefix, invoice_date,
    issuer_nit, issuer_name, issuer_address,
    customer_name, customer_nit, customer_document_type, customer_document_number,
    customer_email, customer_phone,
    stay_id, iva_rate, payment_method_dian, created_by
  ) values (
    v_org_id, v_invoice_number, v_org.dian_numbering_prefix, current_date,
    v_org.tax_id, v_org.name, v_org.address,
    v_guest.first_name || ' ' || v_guest.last_name,
    case when v_doc_type.code = 'NIT' then v_guest.document_number else null end,
    coalesce(v_doc_type.dian_code, v_doc_type.code), v_guest.document_number,
    v_guest.email, v_guest.phone,
    p_stay_id, v_org.tax_rate, '10', v_user_id
  )
  returning id into v_invoice_id;

  -- Create lines from folio charges
  for v_charge in
    select fc.*, rc.name as revenue_center_name
    from public.folio_charges fc
    left join public.revenue_centers rc on rc.id = fc.revenue_center_id
    where fc.stay_id = p_stay_id
    order by fc.posted_at
  loop
    v_line_num := v_line_num + 1;
    v_subtotal := v_subtotal + (v_charge.quantity * v_charge.unit_price);
    v_iva := v_iva + (v_charge.quantity * v_charge.unit_price * v_charge.tax_rate / 100);

    insert into public.invoice_lines (
      invoice_id, line_number, description, quantity, unit_price,
      tax_rate, tax_amount, total, revenue_center_id
    ) values (
      v_invoice_id, v_line_num, v_charge.description,
      v_charge.quantity, v_charge.unit_price,
      v_charge.tax_rate,
      round(v_charge.quantity * v_charge.unit_price * v_charge.tax_rate / 100, 2),
      v_charge.total,
      v_charge.revenue_center_id
    );
  end loop;

  v_total := v_subtotal + v_iva;

  -- Update invoice totals
  update public.invoices set
    subtotal = v_subtotal,
    tax_base = v_subtotal,
    iva_amount = v_iva,
    total = v_total
  where id = v_invoice_id;

  return json_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'subtotal', v_subtotal,
    'iva', v_iva,
    'total', v_total,
    'lines', v_line_num
  );
end;
$$;

grant execute on function public.create_invoice_from_stay(uuid) to authenticated;

-- -----------------------------------------------
-- 7. Permissions
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('invoicing.view', 'invoicing', 'view', null, 'Ver facturas'),
  ('invoicing.create', 'invoicing', 'create', null, 'Crear facturas'),
  ('invoicing.cancel', 'invoicing', 'cancel', null, 'Anular facturas'),
  ('invoicing.configure', 'invoicing', 'configure', null, 'Configurar facturación DIAN')
on conflict (key) do nothing;

-- Backfill
do $$
declare v_role record;
begin
  for v_role in select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor') loop
    insert into public.role_permissions (role_id, permission_key)
    select v_role.id, p.key from public.permissions p where p.module = 'invoicing'
    on conflict do nothing;
  end loop;
  for v_role in select id from public.roles where system_key = 'front_desk' loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'invoicing.view'), (v_role.id, 'invoicing.create')
    on conflict do nothing;
  end loop;
end;
$$;
