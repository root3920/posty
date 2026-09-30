-- =============================================================
-- POSTY — Hotel E2: Convert stay modality (short ↔ long)
-- =============================================================

-- -----------------------------------------------
-- 1. Function: convert_short_to_long_stay
-- -----------------------------------------------
create or replace function public.convert_short_to_long_stay(
  p_stay_id uuid,
  p_end_date date,
  p_monthly_rate numeric,
  p_billing_cycle text default 'monthly',
  p_payment_day int default 1,
  p_tax_rate numeric default 0,
  p_deposit_amount numeric default 0,
  p_included_services text[] default '{}',
  p_cleaning_frequency_days int default 7,
  p_apply_retroactive boolean default false
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_stay record;
  v_tz text;
  v_today date;
  v_contract_id uuid;
  v_contract_code text;
  v_new_stay_id uuid;
  v_new_stay_code text;
  v_credit_amount numeric;
  v_rc_id uuid;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;
  select timezone into v_tz from public.organizations where id = v_org_id;
  v_today := (now() at time zone coalesce(v_tz, 'America/Bogota'))::date;

  select * into v_stay from public.stays where id = p_stay_id and organization_id = v_org_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  if v_stay.stay_type != 'short_stay' then
    raise exception 'La estancia ya es de larga estadía';
  end if;

  if v_stay.status not in ('reserved', 'checked_in') then
    raise exception 'Solo se pueden convertir estancias activas';
  end if;

  -- Snapshot guest data
  update public.stays set guest_snapshot = snapshot_guest_data(v_stay.primary_guest_id) where id = p_stay_id;

  if v_stay.status = 'reserved' then
    -- FUTURE RESERVATION: update in place
    update public.stays set
      stay_type = 'long_stay'::stay_type,
      check_out_date = p_end_date,
      rate_per_night = round(p_monthly_rate / 30.0, 2)
    where id = p_stay_id;

    -- Create contract linked to this stay
    insert into public.contracts (
      organization_id, guest_id, room_id, room_type_id,
      start_date, end_date, monthly_rate, original_rate,
      billing_cycle, payment_day, tax_rate, deposit_amount,
      included_services, cleaning_frequency_days,
      status, stay_id, origin_stay_id, created_by
    ) values (
      v_org_id, v_stay.primary_guest_id, v_stay.room_id,
      (select room_type_id from public.rooms where id = v_stay.room_id),
      v_stay.check_in_date, p_end_date, p_monthly_rate, p_monthly_rate,
      p_billing_cycle::billing_cycle, p_payment_day, p_tax_rate, p_deposit_amount,
      p_included_services, p_cleaning_frequency_days,
      'draft'::contract_status, p_stay_id, p_stay_id, v_user_id
    )
    returning id, code into v_contract_id, v_contract_code;

    update public.stays set contract_id = v_contract_id where id = p_stay_id;

    perform generate_contract_installments(v_contract_id);

    return json_build_object(
      'success', true,
      'mode', 'future',
      'stay_id', p_stay_id,
      'contract_id', v_contract_id,
      'contract_code', v_contract_code
    );

  else
    -- CHECKED IN: close short stay, create new long stay
    -- Assign visit_id if not set
    if v_stay.visit_id is null then
      update public.stays set visit_id = gen_random_uuid() where id = p_stay_id;
      select visit_id into v_stay.visit_id from public.stays where id = p_stay_id;
    end if;

    -- Close the short stay at today WITHOUT physical checkout
    update public.stays set
      check_out_date = v_today,
      status = 'checked_out'::stay_status,
      actual_check_out_at = now()
    where id = p_stay_id;

    -- Create new long stay from today
    insert into public.stays (
      organization_id, room_id, primary_guest_id,
      check_in_date, check_out_date,
      actual_check_in_at, adults, children,
      status, rate_per_night, stay_type,
      visit_id, converted_from_stay_id,
      guest_snapshot, created_by
    ) values (
      v_org_id, v_stay.room_id, v_stay.primary_guest_id,
      v_today, p_end_date,
      now(), v_stay.adults, v_stay.children,
      'checked_in'::stay_status, round(p_monthly_rate / 30.0, 2), 'long_stay'::stay_type,
      v_stay.visit_id, p_stay_id,
      snapshot_guest_data(v_stay.primary_guest_id), v_user_id
    )
    returning id, code into v_new_stay_id, v_new_stay_code;

    -- Create contract
    insert into public.contracts (
      organization_id, guest_id, room_id, room_type_id,
      start_date, end_date, monthly_rate, original_rate,
      billing_cycle, payment_day, tax_rate, deposit_amount,
      included_services, cleaning_frequency_days,
      status, stay_id, origin_stay_id, created_by
    ) values (
      v_org_id, v_stay.primary_guest_id, v_stay.room_id,
      (select room_type_id from public.rooms where id = v_stay.room_id),
      v_today, p_end_date, p_monthly_rate, p_monthly_rate,
      p_billing_cycle::billing_cycle, p_payment_day, p_tax_rate, p_deposit_amount,
      p_included_services, p_cleaning_frequency_days,
      'draft'::contract_status, v_new_stay_id, p_stay_id, v_user_id
    )
    returning id, code into v_contract_id, v_contract_code;

    update public.stays set contract_id = v_contract_id where id = v_new_stay_id;

    perform generate_contract_installments(v_contract_id);

    -- Retroactive rate adjustment
    if p_apply_retroactive then
      v_credit_amount := (v_today - v_stay.check_in_date) * v_stay.rate_per_night
                       - (v_today - v_stay.check_in_date) * round(p_monthly_rate / 30.0, 2);

      if v_credit_amount > 0 then
        select id into v_rc_id from public.revenue_centers
        where organization_id = v_org_id and name ilike '%larga%' limit 1;

        if v_rc_id is not null then
          insert into public.folio_charges (
            stay_id, revenue_center_id, description, quantity, unit_price, tax_rate
          ) values (
            p_stay_id, v_rc_id,
            'Nota crédito — Ajuste tarifa larga estadía',
            1, -v_credit_amount, 0
          );
        end if;
      end if;
    end if;

    return json_build_object(
      'success', true,
      'mode', 'checked_in',
      'old_stay_id', p_stay_id,
      'new_stay_id', v_new_stay_id,
      'new_stay_code', v_new_stay_code,
      'contract_id', v_contract_id,
      'contract_code', v_contract_code,
      'credit_amount', coalesce(v_credit_amount, 0)
    );
  end if;
end;
$$;

grant execute on function public.convert_short_to_long_stay(uuid, date, numeric, text, int, numeric, numeric, text[], int, boolean) to authenticated;

-- -----------------------------------------------
-- 2. Function: convert_long_to_short_stay
-- -----------------------------------------------
create or replace function public.convert_long_to_short_stay(
  p_contract_id uuid,
  p_rate_per_night numeric,
  p_new_check_out date
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_contract record;
  v_stay record;
  v_tz text;
  v_today date;
  v_new_stay_id uuid;
  v_new_stay_code text;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;
  select timezone into v_tz from public.organizations where id = v_org_id;
  v_today := (now() at time zone coalesce(v_tz, 'America/Bogota'))::date;

  select * into v_contract from public.contracts where id = p_contract_id and organization_id = v_org_id;
  if not found then raise exception 'Contrato no encontrado'; end if;

  select * into v_stay from public.stays where id = v_contract.stay_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  -- Terminate the contract
  perform terminate_contract(p_contract_id, v_today, 'Conversión a estancia corta', 0);

  -- Create new short stay continuing from today
  if v_stay.visit_id is null then
    update public.stays set visit_id = gen_random_uuid() where id = v_stay.id;
    select visit_id into v_stay.visit_id from public.stays where id = v_stay.id;
  end if;

  insert into public.stays (
    organization_id, room_id, primary_guest_id,
    check_in_date, check_out_date,
    actual_check_in_at, adults, children,
    status, rate_per_night, stay_type,
    visit_id, converted_from_stay_id, created_by
  ) values (
    v_org_id, v_stay.room_id, v_stay.primary_guest_id,
    v_today, p_new_check_out,
    now(), v_stay.adults, v_stay.children,
    'checked_in'::stay_status, p_rate_per_night, 'short_stay'::stay_type,
    v_stay.visit_id, v_stay.id, v_user_id
  )
  returning id, code into v_new_stay_id, v_new_stay_code;

  return json_build_object(
    'success', true,
    'new_stay_id', v_new_stay_id,
    'new_stay_code', v_new_stay_code
  );
end;
$$;

grant execute on function public.convert_long_to_short_stay(uuid, numeric, date) to authenticated;

-- -----------------------------------------------
-- 3. Trigger: snapshot guest on check-in
-- -----------------------------------------------
create or replace function public.trg_snapshot_guest_on_checkin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'checked_in' and (old.status is null or old.status != 'checked_in') then
    new.guest_snapshot := snapshot_guest_data(new.primary_guest_id);
  end if;
  return new;
end;
$$;

create trigger trg_stays_guest_snapshot
  before update on public.stays
  for each row
  when (new.status = 'checked_in' and old.status is distinct from 'checked_in')
  execute function public.trg_snapshot_guest_on_checkin();
