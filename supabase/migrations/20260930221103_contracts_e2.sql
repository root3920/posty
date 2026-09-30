-- =============================================================
-- POSTY — Contracts E2: amendments, documents, termination, renewal
-- =============================================================

-- -----------------------------------------------
-- 1. Table: contract_amendments (otrosí)
-- -----------------------------------------------
create table public.contract_amendments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  amendment_number int not null,
  changes jsonb not null default '{}',
  previous_values jsonb not null default '{}',
  reason text,
  effective_date date not null,
  pdf_path text,
  signed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),

  constraint uq_amendment_number unique (contract_id, amendment_number)
);

create index idx_contract_amendments_contract on public.contract_amendments(contract_id);

alter table public.contract_amendments enable row level security;
create policy "View amendments of own org" on public.contract_amendments for select using (organization_id = public.current_org_id());
create policy "Manage amendments" on public.contract_amendments for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 2. Table: contract_documents
-- -----------------------------------------------
create table public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  doc_type text not null check (doc_type in ('contract', 'amendment', 'termination', 'signature_proof')),
  pdf_path text,
  sign_token text unique,
  sign_token_expires_at timestamptz,
  signer_name text,
  signer_document text,
  signature_image_path text,
  ip_address text,
  user_agent text,
  pdf_hash text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_contract_documents_contract on public.contract_documents(contract_id);
create index idx_contract_documents_token on public.contract_documents(sign_token) where sign_token is not null;

alter table public.contract_documents enable row level security;
create policy "View documents of own org" on public.contract_documents for select using (organization_id = public.current_org_id());
create policy "Manage documents" on public.contract_documents for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. Add termination fields to contracts
-- -----------------------------------------------
alter table public.contracts
  add column if not exists terminated_at timestamptz,
  add column if not exists termination_reason text,
  add column if not exists termination_penalty numeric(14,2) default 0,
  add column if not exists renewed_from_id uuid references public.contracts(id),
  add column if not exists renewed_to_id uuid references public.contracts(id);

-- -----------------------------------------------
-- 4. Function: terminate_contract
-- -----------------------------------------------
create or replace function public.terminate_contract(
  p_contract_id uuid,
  p_termination_date date,
  p_reason text default null,
  p_penalty numeric default 0
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_contract record;
  v_prorated_amount numeric;
  v_pending_total numeric;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_contract from public.contracts where id = p_contract_id and organization_id = v_org_id;
  if not found then raise exception 'Contrato no encontrado'; end if;

  if v_contract.status in ('finished', 'terminated_early', 'cancelled') then
    raise exception 'El contrato ya está finalizado';
  end if;

  -- Void future installments
  update public.contract_installments
  set status = 'voided'::installment_status
  where contract_id = p_contract_id
    and period_start >= p_termination_date
    and status in ('pending', 'partial');

  -- Calculate pending amounts
  select coalesce(sum(total - paid_amount), 0) into v_pending_total
  from public.contract_installments
  where contract_id = p_contract_id
    and status in ('pending', 'partial', 'overdue');

  -- Update contract
  update public.contracts set
    status = 'terminated_early'::contract_status,
    end_date = p_termination_date,
    terminated_at = now(),
    termination_reason = p_reason,
    termination_penalty = p_penalty
  where id = p_contract_id;

  -- Close linked stay
  if v_contract.stay_id is not null then
    update public.stays set
      check_out_date = p_termination_date,
      status = case when status = 'checked_in' then 'checked_out'::stay_status else status end,
      actual_check_out_at = case when status = 'checked_in' then now() else actual_check_out_at end
    where id = v_contract.stay_id;
  end if;

  return json_build_object(
    'success', true,
    'pending_amount', v_pending_total,
    'penalty', p_penalty,
    'deposit_to_return', v_contract.deposit_paid_amount
  );
end;
$$;

grant execute on function public.terminate_contract(uuid, date, text, numeric) to authenticated;

-- -----------------------------------------------
-- 5. Function: renew_contract
-- -----------------------------------------------
create or replace function public.renew_contract(
  p_contract_id uuid,
  p_new_end_date date,
  p_new_rate numeric default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_old record;
  v_new_contract_id uuid;
  v_new_code text;
  v_rate numeric;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_old from public.contracts where id = p_contract_id and organization_id = v_org_id;
  if not found then raise exception 'Contrato no encontrado'; end if;

  v_rate := coalesce(p_new_rate, v_old.monthly_rate);

  -- Create new contract
  insert into public.contracts (
    organization_id, guest_id, payer_business_name, payer_tax_id,
    room_id, room_type_id, start_date, end_date,
    monthly_rate, original_rate, billing_cycle, payment_day, tax_rate,
    deposit_amount, deposit_status, deposit_paid_amount,
    included_services, cleaning_frequency_days,
    status, stay_id, renewed_from_id, created_by
  ) values (
    v_org_id, v_old.guest_id, v_old.payer_business_name, v_old.payer_tax_id,
    v_old.room_id, v_old.room_type_id, v_old.end_date, p_new_end_date,
    v_rate, v_rate, v_old.billing_cycle, v_old.payment_day, v_old.tax_rate,
    v_old.deposit_amount, 'pending', 0,
    v_old.included_services, v_old.cleaning_frequency_days,
    'draft'::contract_status, v_old.stay_id, p_contract_id, v_user_id
  )
  returning id, code into v_new_contract_id, v_new_code;

  -- Link old → new
  update public.contracts set
    status = 'renewed'::contract_status,
    renewed_to_id = v_new_contract_id
  where id = p_contract_id;

  -- Extend stay
  if v_old.stay_id is not null then
    update public.stays set check_out_date = p_new_end_date where id = v_old.stay_id;
  end if;

  -- Generate installments for new contract
  perform public.generate_contract_installments(v_new_contract_id);

  return json_build_object(
    'success', true,
    'new_contract_id', v_new_contract_id,
    'new_code', v_new_code
  );
end;
$$;

grant execute on function public.renew_contract(uuid, date, numeric) to authenticated;

-- -----------------------------------------------
-- 6. Function: create_contract_amendment (otrosí)
-- -----------------------------------------------
create or replace function public.create_contract_amendment(
  p_contract_id uuid,
  p_changes jsonb,
  p_effective_date date,
  p_reason text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_contract record;
  v_amendment_number int;
  v_prev_values jsonb;
  v_key text;
  v_amendment_id uuid;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_contract from public.contracts where id = p_contract_id and organization_id = v_org_id;
  if not found then raise exception 'Contrato no encontrado'; end if;

  -- Get next amendment number
  select coalesce(max(amendment_number), 0) + 1 into v_amendment_number
  from public.contract_amendments where contract_id = p_contract_id;

  -- Save previous values for changed fields
  v_prev_values := '{}'::jsonb;
  for v_key in select jsonb_object_keys(p_changes) loop
    v_prev_values := v_prev_values || jsonb_build_object(v_key, to_jsonb(v_contract) -> v_key);
  end loop;

  -- Insert amendment
  insert into public.contract_amendments (
    organization_id, contract_id, amendment_number,
    changes, previous_values, reason, effective_date, created_by
  ) values (
    v_org_id, p_contract_id, v_amendment_number,
    p_changes, v_prev_values, p_reason, p_effective_date, v_user_id
  )
  returning id into v_amendment_id;

  -- Apply changes to contract
  if p_changes ? 'monthly_rate' then
    update public.contracts set monthly_rate = (p_changes->>'monthly_rate')::numeric where id = p_contract_id;
  end if;
  if p_changes ? 'end_date' then
    update public.contracts set end_date = (p_changes->>'end_date')::date where id = p_contract_id;
    -- Update stay too
    if v_contract.stay_id is not null then
      update public.stays set check_out_date = (p_changes->>'end_date')::date where id = v_contract.stay_id;
    end if;
  end if;
  if p_changes ? 'included_services' then
    update public.contracts set included_services = array(select jsonb_array_elements_text(p_changes->'included_services')) where id = p_contract_id;
  end if;
  if p_changes ? 'cleaning_frequency_days' then
    update public.contracts set cleaning_frequency_days = (p_changes->>'cleaning_frequency_days')::int where id = p_contract_id;
  end if;

  -- Regenerate future installments if rate or end_date changed
  if p_changes ? 'monthly_rate' or p_changes ? 'end_date' then
    -- Void future unpaid installments
    update public.contract_installments
    set status = 'voided'::installment_status
    where contract_id = p_contract_id
      and period_start >= p_effective_date
      and status in ('pending', 'partial');
    -- Regenerate
    perform public.generate_contract_installments(p_contract_id);
  end if;

  return json_build_object('success', true, 'amendment_id', v_amendment_id, 'amendment_number', v_amendment_number);
end;
$$;

grant execute on function public.create_contract_amendment(uuid, jsonb, date, text) to authenticated;

-- -----------------------------------------------
-- 7. Function: send_contract_for_signature
-- -----------------------------------------------
create or replace function public.send_contract_for_signature(p_contract_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_token text;
  v_doc_id uuid;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  -- Generate random token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create document record
  insert into public.contract_documents (
    organization_id, contract_id, doc_type, sign_token, sign_token_expires_at
  ) values (
    v_org_id, p_contract_id, 'contract', v_token, now() + interval '7 days'
  )
  returning id into v_doc_id;

  -- Update contract status
  update public.contracts
  set status = 'sent_for_signature'::contract_status
  where id = p_contract_id and organization_id = v_org_id;

  return json_build_object('success', true, 'token', v_token, 'document_id', v_doc_id);
end;
$$;

grant execute on function public.send_contract_for_signature(uuid) to authenticated;
