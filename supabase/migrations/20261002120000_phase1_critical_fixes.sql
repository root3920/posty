-- =============================================================
-- POSTY — Phase 1: Critical bug fixes
-- Bug 1: Data leak (stay_balances view)
-- Bug 2: Global unique constraints → per-org
-- Bug 3: Event double-booking exclusion constraint
-- =============================================================

-- -----------------------------------------------
-- BUG 1: Fix stay_balances view — add security_invoker
-- -----------------------------------------------
create or replace view public.stay_balances
  with (security_invoker = true)
as
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
-- BUG 2: Per-org unique constraints + counters
-- -----------------------------------------------

-- 2a. Organization counters table
create table if not exists public.organization_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  last_value bigint not null default 0,
  primary key (organization_id, key)
);

alter table public.organization_counters enable row level security;
create policy "Org members can view own counters"
  on public.organization_counters for select
  using (organization_id = public.current_org_id());
create policy "Org members can manage own counters"
  on public.organization_counters for all
  using (organization_id = public.current_org_id());

-- 2b. Atomic counter function
create or replace function public.next_counter(p_org_id uuid, p_key text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_val bigint;
begin
  insert into public.organization_counters (organization_id, key, last_value)
  values (p_org_id, p_key, 1)
  on conflict (organization_id, key) do update
    set last_value = organization_counters.last_value + 1
  returning last_value into v_val;
  return v_val;
end;
$$;

-- 2c. Initialize counters from existing data (DO NOT renumber)
do $$
declare
  v_org record;
  v_max_stay bigint;
  v_max_event bigint;
  v_max_contract bigint;
begin
  for v_org in select id from public.organizations loop
    -- Stays: extract number from 'POS-000123'
    select coalesce(max(nullif(regexp_replace(code, '[^0-9]', '', 'g'), '')::bigint), 0)
    into v_max_stay
    from public.stays where organization_id = v_org.id;

    if v_max_stay > 0 then
      insert into public.organization_counters (organization_id, key, last_value)
      values (v_org.id, 'stay_code', v_max_stay)
      on conflict (organization_id, key) do update set last_value = greatest(organization_counters.last_value, v_max_stay);
    end if;

    -- Events: extract number from 'EV-000002'
    select coalesce(max(nullif(regexp_replace(code, '[^0-9]', '', 'g'), '')::bigint), 0)
    into v_max_event
    from public.event_bookings where organization_id = v_org.id;

    if v_max_event > 0 then
      insert into public.organization_counters (organization_id, key, last_value)
      values (v_org.id, 'event_code', v_max_event)
      on conflict (organization_id, key) do update set last_value = greatest(organization_counters.last_value, v_max_event);
    end if;

    -- Contracts: extract number from 'CTR-000001'
    select coalesce(max(nullif(regexp_replace(code, '[^0-9]', '', 'g'), '')::bigint), 0)
    into v_max_contract
    from public.contracts where organization_id = v_org.id;

    if v_max_contract > 0 then
      insert into public.organization_counters (organization_id, key, last_value)
      values (v_org.id, 'contract_code', v_max_contract)
      on conflict (organization_id, key) do update set last_value = greatest(organization_counters.last_value, v_max_contract);
    end if;
  end loop;
end;
$$;

-- 2d. Change unique constraints from global to per-org

-- stays.code: drop global unique, add per-org unique
alter table public.stays drop constraint if exists stays_code_key;
create unique index if not exists uq_stays_org_code on public.stays (organization_id, code);

-- event_bookings.code: drop global unique, add per-org unique
alter table public.event_bookings drop constraint if exists event_bookings_code_key;
create unique index if not exists uq_event_bookings_org_code on public.event_bookings (organization_id, code);

-- contracts.code: drop global unique, add per-org unique
alter table public.contracts drop constraint if exists contracts_code_key;
create unique index if not exists uq_contracts_org_code on public.contracts (organization_id, code);

-- 2e. Remove the global sequence defaults.
-- Set default to empty string — triggers will fill with per-org code.
alter table public.stays alter column code set default '';
alter table public.event_bookings alter column code set default '';
alter table public.contracts alter column code set default '';

-- 2f. Update create_stay_with_auto_room to use next_counter
create or replace function public.create_stay_with_auto_room(
  p_room_type_id uuid,
  p_room_id uuid default null,
  p_check_in date default null,
  p_check_out date default null,
  p_status text default 'reserved',
  p_adults int default 1,
  p_children int default 0,
  p_rate_per_night numeric default 0,
  p_channel_id uuid default null,
  p_travel_reason_id uuid default null,
  p_notes text default null,
  p_guest_first_name text default null,
  p_guest_last_name text default null,
  p_guest_document_type_id uuid default null,
  p_guest_document_number text default null,
  p_guest_nationality text default null,
  p_guest_birth_date date default null,
  p_guest_phone text default null,
  p_guest_email text default null,
  p_guest_address text default null,
  p_guest_city_of_origin text default null,
  p_guest_country_of_origin text default null,
  p_guest_notes text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_room_id uuid;
  v_room_number text;
  v_room_type_name text;
  v_guest_id uuid;
  v_stay_id uuid;
  v_stay_code text;
  v_nights int;
begin
  -- Auth
  if v_user_id is null then raise exception 'No autenticado'; end if;
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then raise exception 'Sin organización'; end if;

  -- Room assignment
  if p_room_id is not null then
    select r.id, r.room_number, rt.name
    into v_room_id, v_room_number, v_room_type_name
    from public.rooms r
    join public.room_types rt on rt.id = r.room_type_id
    where r.id = p_room_id
      and r.organization_id = v_org_id
    for update of r skip locked;
    if v_room_id is null then raise exception 'Habitación no disponible'; end if;
  else
    select r.id, r.room_number, rt.name
    into v_room_id, v_room_number, v_room_type_name
    from public.rooms r
    join public.room_types rt on rt.id = r.room_type_id
    where rt.id = p_room_type_id
      and r.organization_id = v_org_id
      and r.status = 'available'
      and not exists (
        select 1 from public.stays s
        where s.room_id = r.id
          and s.status in ('reserved', 'checked_in')
          and daterange(s.check_in_date, s.check_out_date, '[)') &&
              daterange(p_check_in, p_check_out, '[)')
      )
    order by r.room_number
    limit 1
    for update of r skip locked;
    if v_room_id is null then raise exception 'No hay habitaciones disponibles de ese tipo para las fechas seleccionadas'; end if;
  end if;

  -- Guest find-or-create
  if p_guest_document_type_id is not null and p_guest_document_number is not null and btrim(p_guest_document_number) != '' then
    select id into v_guest_id
    from public.guests
    where organization_id = v_org_id
      and document_type_id = p_guest_document_type_id
      and document_number = btrim(p_guest_document_number);
  end if;

  if v_guest_id is null then
    insert into public.guests (
      organization_id, first_name, last_name, document_type_id, document_number,
      nationality, birth_date, phone, email, address, city_of_origin, country_of_origin, notes
    ) values (
      v_org_id, p_guest_first_name, p_guest_last_name, p_guest_document_type_id,
      nullif(btrim(p_guest_document_number), ''),
      p_guest_nationality, p_guest_birth_date, p_guest_phone, p_guest_email,
      p_guest_address, p_guest_city_of_origin, p_guest_country_of_origin, p_guest_notes
    ) returning id into v_guest_id;
  else
    -- Update existing guest
    update public.guests set
      first_name = coalesce(p_guest_first_name, first_name),
      last_name = coalesce(p_guest_last_name, last_name),
      nationality = coalesce(p_guest_nationality, nationality),
      birth_date = coalesce(p_guest_birth_date, birth_date),
      phone = coalesce(p_guest_phone, phone),
      email = coalesce(p_guest_email, email),
      address = coalesce(p_guest_address, address)
    where id = v_guest_id;
  end if;

  -- Generate per-org code
  v_stay_code := 'POS-' || lpad(public.next_counter(v_org_id, 'stay_code')::text, 6, '0');

  -- Create stay
  insert into public.stays (
    organization_id, code, room_id, primary_guest_id, check_in_date, check_out_date,
    status, adults, children, rate_per_night, channel_id, travel_reason_id, notes
  ) values (
    v_org_id, v_stay_code, v_room_id, v_guest_id, p_check_in, p_check_out,
    p_status, p_adults, p_children, p_rate_per_night, p_channel_id, p_travel_reason_id, p_notes
  ) returning id into v_stay_id;

  -- Create folio charge
  v_nights := coalesce(p_check_out - p_check_in, 0);
  if v_nights > 0 and p_rate_per_night > 0 then
    insert into public.folio_charges (
      organization_id, stay_id, description, quantity, unit_price, total
    ) values (
      v_org_id, v_stay_id,
      'Alojamiento ' || v_room_type_name || ' (' || v_room_number || ') x ' || v_nights || ' noches',
      v_nights, p_rate_per_night, v_nights * p_rate_per_night
    );
  end if;

  -- Update room status if checking in
  if p_status = 'checked_in' then
    update public.rooms set status = 'occupied' where id = v_room_id;
  end if;

  return json_build_object(
    'stay_id', v_stay_id,
    'stay_code', v_stay_code,
    'room_id', v_room_id,
    'room_number', v_room_number,
    'guest_id', v_guest_id
  );
end;
$$;

-- 2g. Patch create_contract_with_stay to use next_counter
-- The function creates both a stay and a contract via direct INSERT.
-- Since we removed the default code generation, we need to provide codes explicitly.
-- We wrap the original INSERT by using a trigger instead of modifying the entire function.

-- Trigger: auto-generate code on INSERT if missing (fallback for direct inserts)
create or replace function public.generate_stay_code()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'POS-' || lpad(public.next_counter(new.organization_id, 'stay_code')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_generate_stay_code
  before insert on public.stays
  for each row
  when (new.code is null or new.code = '')
  execute function public.generate_stay_code();

-- Same for contracts
create or replace function public.generate_contract_code()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'CTR-' || lpad(public.next_counter(new.organization_id, 'contract_code')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_generate_contract_code
  before insert on public.contracts
  for each row
  when (new.code is null or new.code = '')
  execute function public.generate_contract_code();

-- Same for event_bookings
create or replace function public.generate_event_code()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'EV-' || lpad(public.next_counter(new.organization_id, 'event_code')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_generate_event_code
  before insert on public.event_bookings
  for each row
  when (new.code is null or new.code = '')
  execute function public.generate_event_code();

-- -----------------------------------------------
-- BUG 3: Event double-booking exclusion constraint
-- -----------------------------------------------

-- 3b. Add exclusion constraint on event_bookings
-- Prevents overlapping bookings for the same venue on the same date + time range.
-- PostgreSQL has no `timerange`, so we use tstzrange combining date + time.
-- Only applies to non-cancelled bookings.
-- NOTE: If existing overlapping bookings exist, cancel the duplicates first.
do $$
declare
  v_dup record;
begin
  -- Find and cancel duplicate overlapping bookings (keep the oldest one)
  for v_dup in
    select b2.id
    from public.event_bookings b1
    join public.event_bookings b2
      on b1.venue_id = b2.venue_id
      and b1.event_date = b2.event_date
      and b1.id < b2.id  -- b1 is older
      and b1.status != 'cancelled'
      and b2.status != 'cancelled'
      and b1.start_time < b2.end_time
      and b1.end_time > b2.start_time
  loop
    update public.event_bookings
    set status = 'cancelled'::event_booking_status
    where id = v_dup.id;
    raise notice 'Cancelled duplicate event booking: %', v_dup.id;
  end loop;
end;
$$;

alter table public.event_bookings
  add constraint no_double_booking_venue
  exclude using gist (
    venue_id with =,
    tstzrange(
      (event_date + start_time)::timestamptz,
      (event_date + end_time)::timestamptz,
      '[)'
    ) with &&
  )
  where (status != 'cancelled'::event_booking_status);

-- 3c. Add idempotency_key column for deduplication
alter table public.event_bookings
  add column if not exists idempotency_key text;

create unique index if not exists uq_event_bookings_idempotency
  on public.event_bookings (organization_id, idempotency_key)
  where idempotency_key is not null;

-- 3d. Recreate create_event_booking with per-org counter + idempotency
-- Drop old signature (14 params) before creating new one (15 params)
drop function if exists public.create_event_booking(uuid, date, time, time, int, text, text, text, text, boolean, text, numeric, uuid, text);

create or replace function public.create_event_booking(
  p_venue_id uuid,
  p_event_date date,
  p_start_time time,
  p_end_time time,
  p_guest_count int,
  p_client_name text,
  p_client_phone text,
  p_client_document text default null,
  p_client_email text default null,
  p_is_hotel_guest boolean default false,
  p_room_number text default null,
  p_deposit_received numeric default 0,
  p_deposit_method_id uuid default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_venue record;
  v_conflict record;
  v_total numeric(14,2);
  v_deposit_required numeric(14,2);
  v_status public.event_booking_status;
  v_deposit_status public.event_deposit_status;
  v_booking_id uuid;
  v_booking_code text;
begin
  -- Auth
  if v_user_id is null then raise exception 'No autenticado'; end if;
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then raise exception 'Sin organización'; end if;

  -- Idempotency: return existing booking if key matches
  if p_idempotency_key is not null then
    select id, code into v_booking_id, v_booking_code
    from public.event_bookings
    where organization_id = v_org_id
      and idempotency_key = p_idempotency_key;
    if v_booking_id is not null then
      return json_build_object('booking_id', v_booking_id, 'code', v_booking_code, 'deduplicated', true);
    end if;
  end if;

  -- Validate venue
  select * into v_venue
  from public.event_venues
  where id = p_venue_id and organization_id = v_org_id and is_active = true;
  if v_venue is null then raise exception 'Espacio no encontrado o inactivo'; end if;

  -- Validate times
  if p_end_time <= p_start_time then
    raise exception 'La hora de fin debe ser posterior a la de inicio';
  end if;
  if v_venue.min_hours is not null and
     extract(epoch from (p_end_time - p_start_time)) / 3600 < v_venue.min_hours then
    raise exception 'La reserva mínima es de % horas', v_venue.min_hours;
  end if;
  if v_venue.max_capacity is not null and p_guest_count > v_venue.max_capacity then
    raise exception 'La capacidad máxima del espacio es de % personas', v_venue.max_capacity;
  end if;
  if p_event_date < current_date then
    raise exception 'No se pueden crear reservas en fechas pasadas';
  end if;

  -- Check conflicts (with FOR UPDATE lock on existing rows)
  select * into v_conflict
  from public.event_bookings
  where venue_id = p_venue_id
    and event_date = p_event_date
    and status != 'cancelled'::event_booking_status
    and start_time < p_end_time
    and end_time > p_start_time
  for update;

  if v_conflict is not null then
    raise exception 'Ese espacio ya está reservado de % a % ese día (reserva %)',
      v_conflict.start_time::text, v_conflict.end_time::text, v_conflict.code;
  end if;

  -- Calculate pricing
  case v_venue.pricing_type
    when 'per_hour'::venue_pricing_type then
      v_total := v_venue.base_price * (extract(epoch from (p_end_time - p_start_time)) / 3600);
    when 'per_person'::venue_pricing_type then
      v_total := v_venue.base_price * p_guest_count;
    else
      v_total := v_venue.base_price;
  end case;

  v_deposit_required := coalesce(v_venue.deposit_amount, 0);

  -- Determine status
  if v_deposit_required > 0 and p_deposit_received >= v_deposit_required then
    v_status := 'confirmed'::event_booking_status;
    v_deposit_status := 'received'::event_deposit_status;
  elsif v_deposit_required > 0 then
    v_status := 'pending_deposit'::event_booking_status;
    v_deposit_status := 'pending'::event_deposit_status;
  else
    v_status := 'confirmed'::event_booking_status;
    v_deposit_status := 'pending'::event_deposit_status;
  end if;

  -- Generate per-org code
  v_booking_code := 'EV-' || lpad(public.next_counter(v_org_id, 'event_code')::text, 6, '0');

  -- Insert
  insert into public.event_bookings (
    organization_id, code, venue_id, event_date, start_time, end_time,
    guest_count, client_name, client_document, client_phone, client_email,
    is_hotel_guest, room_number, rental_total, rental_paid,
    deposit_required, deposit_received, deposit_method_id, deposit_status,
    status, notes, created_by, idempotency_key
  ) values (
    v_org_id, v_booking_code, p_venue_id, p_event_date, p_start_time, p_end_time,
    p_guest_count, p_client_name, p_client_document, p_client_phone, p_client_email,
    p_is_hotel_guest, p_room_number, v_total, false,
    v_deposit_required, p_deposit_received, p_deposit_method_id, v_deposit_status,
    v_status, p_notes, v_user_id, p_idempotency_key
  ) returning id into v_booking_id;

  -- Record history
  insert into public.event_booking_history (
    organization_id, booking_id, action, actor_id, details
  ) values (
    v_org_id, v_booking_id, 'created', v_user_id,
    json_build_object('status', v_status::text, 'total', v_total)
  );

  -- Auto-create cleaning tasks if confirmed
  if v_status = 'confirmed'::event_booking_status then
    -- "Preparar espacio" 1h before start
    insert into public.tasks (
      organization_id, title, description, due_date, priority,
      status_id, created_by
    )
    select
      v_org_id,
      'Preparar ' || v_venue.name || ' para evento',
      'Reserva ' || v_booking_code || ' — ' || p_client_name || ' — ' || p_guest_count || ' personas',
      p_event_date,
      'high',
      ts.id,
      v_user_id
    from public.task_statuses ts
    where ts.organization_id = v_org_id and ts.type = 'open'
    order by ts.sort_order limit 1;

    -- "Limpiar después del evento"
    insert into public.tasks (
      organization_id, title, description, due_date, priority,
      status_id, created_by
    )
    select
      v_org_id,
      'Limpiar ' || v_venue.name || ' después del evento',
      'Reserva ' || v_booking_code || ' — limpieza post-evento',
      p_event_date,
      'medium',
      ts.id,
      v_user_id
    from public.task_statuses ts
    where ts.organization_id = v_org_id and ts.type = 'open'
    order by ts.sort_order limit 1;
  end if;

  return json_build_object('booking_id', v_booking_id, 'code', v_booking_code);
end;
$$;
