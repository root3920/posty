-- =============================================================
-- POSTY — Module: Events (venue rental & bookings)
-- =============================================================

-- -----------------------------------------------
-- 1. Enums
-- -----------------------------------------------
create type public.venue_pricing_type as enum ('per_hour', 'per_person', 'flat_rate');
create type public.event_booking_status as enum ('pending_deposit', 'confirmed', 'finished', 'cancelled');
create type public.event_deposit_status as enum ('pending', 'received', 'returned', 'retained');

-- -----------------------------------------------
-- 2. Sequence
-- -----------------------------------------------
create sequence if not exists public.event_booking_code_seq start 1;

-- -----------------------------------------------
-- 3. Table: event_venues
-- -----------------------------------------------
create table public.event_venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  pricing_type public.venue_pricing_type not null,
  price numeric(14,2) not null check (price > 0),
  deposit numeric(14,2) not null default 0 check (deposit >= 0),
  max_capacity int not null check (max_capacity > 0),
  open_time time not null,
  close_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_venue_name unique (organization_id, name),
  constraint check_venue_hours check (close_time > open_time)
);

create index idx_event_venues_org on public.event_venues(organization_id);

create trigger on_event_venues_updated
  before update on public.event_venues
  for each row execute function public.handle_updated_at();

alter table public.event_venues enable row level security;

create policy "Users can view event_venues of own org"
  on public.event_venues for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage event_venues"
  on public.event_venues for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 4. Table: event_bookings
-- -----------------------------------------------
create table public.event_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique
    default 'EV-' || lpad(nextval('public.event_booking_code_seq')::text, 6, '0'),
  venue_id uuid not null references public.event_venues(id),
  event_date date not null,
  start_time time not null,
  end_time time not null,
  guest_count int not null check (guest_count > 0),

  -- Client info
  client_name text not null,
  client_document text,
  client_phone text not null,
  client_email text,
  is_hotel_guest boolean not null default false,
  room_number text,

  -- Pricing (snapshot)
  rental_total numeric(14,2) not null,
  rental_paid boolean not null default false,
  deposit_required numeric(14,2) not null default 0,
  deposit_received numeric(14,2) not null default 0,
  deposit_method_id uuid references public.payment_methods(id),
  deposit_status public.event_deposit_status not null default 'pending',
  deposit_retained_reason text,

  -- Status
  status public.event_booking_status not null default 'pending_deposit',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint check_event_times check (end_time > start_time)
);

create index idx_event_bookings_org on public.event_bookings(organization_id);
create index idx_event_bookings_venue on public.event_bookings(venue_id);
create index idx_event_bookings_date on public.event_bookings(event_date);
create index idx_event_bookings_status on public.event_bookings(status);

create trigger on_event_bookings_updated
  before update on public.event_bookings
  for each row execute function public.handle_updated_at();

alter table public.event_bookings enable row level security;

create policy "Users can view event_bookings of own org"
  on public.event_bookings for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage event_bookings"
  on public.event_bookings for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 5. Table: event_booking_history
-- -----------------------------------------------
create table public.event_booking_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid not null references public.event_bookings(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index idx_event_booking_history_booking on public.event_booking_history(booking_id);

alter table public.event_booking_history enable row level security;

create policy "Users can view event_booking_history of own org"
  on public.event_booking_history for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage event_booking_history"
  on public.event_booking_history for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 6. View: event_bookings_view
-- -----------------------------------------------
create view public.event_bookings_view
  with (security_invoker = true)
as
select
  b.*,
  v.name as venue_name,
  v.pricing_type as venue_pricing_type,
  v.max_capacity as venue_max_capacity,
  v.price as venue_price,
  v.deposit as venue_deposit,
  p.full_name as creator_name
from public.event_bookings b
left join public.event_venues v on v.id = b.venue_id
left join public.profiles p on p.id = b.created_by;

-- -----------------------------------------------
-- 7. Permissions
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('events.view', 'events', 'view', null, 'Ver eventos y reservas de espacios'),
  ('events.create', 'events', 'create', null, 'Crear reservas de espacios'),
  ('events.edit', 'events', 'edit', null, 'Editar reservas de espacios'),
  ('events.delete', 'events', 'delete', null, 'Cancelar reservas de espacios'),
  ('events.manage_deposits', 'events', 'manage_deposits', null, 'Gestionar depósitos (devolver/retener)');

-- -----------------------------------------------
-- 8. Function: create_event_booking
-- -----------------------------------------------
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
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_venue record;
  v_conflict record;
  v_rental_total numeric(14,2);
  v_hours numeric;
  v_status event_booking_status;
  v_dep_status event_deposit_status;
  v_booking_id uuid;
  v_booking_code text;
  v_tz text;
  v_today date;
  v_task_status_id uuid;
  v_cleaning_role_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'No autenticado'; end if;

  select organization_id into v_org_id
  from public.profiles where id = v_user_id limit 1;
  if v_org_id is null then raise exception 'Perfil no encontrado'; end if;

  -- Get timezone for "today" check
  select timezone into v_tz from public.organizations where id = v_org_id;
  v_today := (now() at time zone coalesce(v_tz, 'America/Bogota'))::date;

  -- Validate venue
  select * into v_venue from public.event_venues
  where id = p_venue_id and organization_id = v_org_id;
  if not found then raise exception 'Espacio no encontrado'; end if;
  if not v_venue.is_active then raise exception 'Este espacio no está disponible para reservas'; end if;

  -- Validate date
  if p_event_date < v_today then raise exception 'No se pueden crear reservas en fechas pasadas'; end if;

  -- Validate times
  if p_end_time <= p_start_time then raise exception 'La hora de fin debe ser posterior a la de inicio'; end if;
  if p_start_time < v_venue.open_time then
    raise exception 'El espacio abre a las %', v_venue.open_time::text;
  end if;
  if p_end_time > v_venue.close_time then
    raise exception 'El espacio cierra a las %', v_venue.close_time::text;
  end if;

  -- Validate capacity
  if p_guest_count > v_venue.max_capacity then
    raise exception 'Máximo % personas para este espacio', v_venue.max_capacity;
  end if;

  -- Check for conflicts (lock rows to prevent concurrent double-booking)
  select * into v_conflict
  from public.event_bookings
  where venue_id = p_venue_id
    and event_date = p_event_date
    and status != 'cancelled'::event_booking_status
    and start_time < p_end_time
    and end_time > p_start_time
  for update;

  if found then
    raise exception 'Se cruza con % de % (%–%)',
      v_conflict.code, v_conflict.client_name,
      v_conflict.start_time::text, v_conflict.end_time::text;
  end if;

  -- Calculate rental total
  case v_venue.pricing_type
    when 'per_hour' then
      v_hours := extract(epoch from (p_end_time - p_start_time)) / 3600.0;
      v_rental_total := round(v_venue.price * v_hours, 2);
    when 'per_person' then
      v_rental_total := round(v_venue.price * p_guest_count, 2);
    when 'flat_rate' then
      v_rental_total := v_venue.price;
  end case;

  -- Determine status
  if v_venue.deposit = 0 or p_deposit_received >= v_venue.deposit then
    v_status := 'confirmed'::event_booking_status;
    v_dep_status := case when v_venue.deposit = 0 then 'pending'::event_deposit_status else 'received'::event_deposit_status end;
  else
    v_status := 'pending_deposit'::event_booking_status;
    v_dep_status := case when p_deposit_received > 0 then 'pending'::event_deposit_status else 'pending'::event_deposit_status end;
  end if;

  -- Insert booking
  insert into public.event_bookings (
    organization_id, venue_id, event_date, start_time, end_time,
    guest_count, client_name, client_document, client_phone, client_email,
    is_hotel_guest, room_number,
    rental_total, deposit_required, deposit_received, deposit_method_id,
    deposit_status, status, notes, created_by
  ) values (
    v_org_id, p_venue_id, p_event_date, p_start_time, p_end_time,
    p_guest_count, p_client_name, p_client_document, p_client_phone, p_client_email,
    p_is_hotel_guest, p_room_number,
    v_rental_total, v_venue.deposit, p_deposit_received, p_deposit_method_id,
    v_dep_status, v_status, p_notes, v_user_id
  )
  returning id, code into v_booking_id, v_booking_code;

  -- Record history
  insert into public.event_booking_history (organization_id, booking_id, actor_id, action, detail)
  values (v_org_id, v_booking_id, v_user_id, 'created',
    jsonb_build_object('status', v_status, 'rental_total', v_rental_total, 'deposit_received', p_deposit_received));

  -- Create cleaning tasks if confirmed
  if v_status = 'confirmed'::event_booking_status then
    -- Find the first "open" task status and a cleaning role
    select id into v_task_status_id from public.task_statuses
    where organization_id = v_org_id and type = 'open' order by sort_order limit 1;

    select id into v_cleaning_role_id from public.roles
    where organization_id = v_org_id and name ilike '%camarera%' limit 1;
    if v_cleaning_role_id is null then
      select id into v_cleaning_role_id from public.roles
      where organization_id = v_org_id and name ilike '%limpieza%' limit 1;
    end if;

    if v_task_status_id is not null then
      -- Prepare task (1h before)
      insert into public.tasks (
        organization_id, title, description, status_id, priority,
        due_date, assigned_role_id, source, created_by
      ) values (
        v_org_id,
        'Preparar ' || v_venue.name || ' para ' || v_booking_code,
        'Evento de ' || p_client_name || ' · ' || p_guest_count || ' personas · ' || p_start_time::text || '–' || p_end_time::text,
        v_task_status_id, 'normal'::task_priority,
        p_event_date, v_cleaning_role_id, 'automation', v_user_id
      );

      -- Cleanup task (at end time)
      insert into public.tasks (
        organization_id, title, description, status_id, priority,
        due_date, assigned_role_id, source, created_by
      ) values (
        v_org_id,
        'Limpiar e inspeccionar ' || v_venue.name || ' después de ' || v_booking_code,
        'Verificar estado del espacio después del evento',
        v_task_status_id, 'normal'::task_priority,
        p_event_date, v_cleaning_role_id, 'automation', v_user_id
      );
    end if;
  end if;

  return json_build_object(
    'booking_id', v_booking_id,
    'code', v_booking_code,
    'status', v_status,
    'rental_total', v_rental_total,
    'venue_name', v_venue.name
  );
end;
$$;

grant execute on function public.create_event_booking(uuid, date, time, time, int, text, text, text, text, boolean, text, numeric, uuid, text) to authenticated;

-- -----------------------------------------------
-- 9. Function: cancel_event_booking
-- -----------------------------------------------
create or replace function public.cancel_event_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_booking record;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_booking from public.event_bookings
  where id = p_booking_id and organization_id = v_org_id;
  if not found then raise exception 'Reserva no encontrada'; end if;

  if v_booking.status = 'finished'::event_booking_status then
    raise exception 'No se puede cancelar una reserva finalizada';
  end if;
  if v_booking.status = 'cancelled'::event_booking_status then
    raise exception 'La reserva ya está cancelada';
  end if;

  update public.event_bookings set status = 'cancelled'::event_booking_status where id = p_booking_id;

  insert into public.event_booking_history (organization_id, booking_id, actor_id, action, detail)
  values (v_org_id, p_booking_id, v_user_id, 'cancelled',
    jsonb_build_object('reason', p_reason));

  -- Cancel linked tasks
  update public.tasks set
    status_id = (select id from public.task_statuses where organization_id = v_org_id and type = 'cancelled' limit 1)
  where organization_id = v_org_id
    and source = 'automation'
    and title ilike '%' || v_booking.code || '%';

  return json_build_object('success', true);
end;
$$;

grant execute on function public.cancel_event_booking(uuid, text) to authenticated;

-- -----------------------------------------------
-- 10. Function: register_event_deposit
-- -----------------------------------------------
create or replace function public.register_event_deposit(
  p_booking_id uuid,
  p_amount numeric,
  p_method_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_booking record;
  v_new_received numeric;
  v_new_status event_booking_status;
  v_task_status_id uuid;
  v_cleaning_role_id uuid;
  v_venue record;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_booking from public.event_bookings
  where id = p_booking_id and organization_id = v_org_id;
  if not found then raise exception 'Reserva no encontrada'; end if;

  if p_amount <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;

  v_new_received := v_booking.deposit_received + p_amount;

  -- Update booking
  v_new_status := v_booking.status;
  if v_new_received >= v_booking.deposit_required and v_booking.status = 'pending_deposit'::event_booking_status then
    v_new_status := 'confirmed'::event_booking_status;
  end if;

  update public.event_bookings set
    deposit_received = v_new_received,
    deposit_method_id = p_method_id,
    deposit_status = case when v_new_received >= deposit_required then 'received'::event_deposit_status else 'pending'::event_deposit_status end,
    status = v_new_status
  where id = p_booking_id;

  insert into public.event_booking_history (organization_id, booking_id, actor_id, action, detail)
  values (v_org_id, p_booking_id, v_user_id, 'deposit_received',
    jsonb_build_object('amount', p_amount, 'total_received', v_new_received));

  -- If just confirmed, create cleaning tasks
  if v_new_status = 'confirmed'::event_booking_status and v_booking.status = 'pending_deposit'::event_booking_status then
    select * into v_venue from public.event_venues where id = v_booking.venue_id;

    select id into v_task_status_id from public.task_statuses
    where organization_id = v_org_id and type = 'open' order by sort_order limit 1;

    select id into v_cleaning_role_id from public.roles
    where organization_id = v_org_id and name ilike '%camarera%' limit 1;
    if v_cleaning_role_id is null then
      select id into v_cleaning_role_id from public.roles
      where organization_id = v_org_id and name ilike '%limpieza%' limit 1;
    end if;

    if v_task_status_id is not null and v_venue.id is not null then
      insert into public.tasks (organization_id, title, description, status_id, priority, due_date, assigned_role_id, source, created_by) values
        (v_org_id, 'Preparar ' || v_venue.name || ' para ' || v_booking.code, 'Evento de ' || v_booking.client_name, v_task_status_id, 'normal'::task_priority, v_booking.event_date, v_cleaning_role_id, 'automation', v_user_id),
        (v_org_id, 'Limpiar e inspeccionar ' || v_venue.name || ' después de ' || v_booking.code, 'Verificar estado del espacio', v_task_status_id, 'normal'::task_priority, v_booking.event_date, v_cleaning_role_id, 'automation', v_user_id);
    end if;
  end if;

  return json_build_object('success', true, 'new_status', v_new_status, 'deposit_received', v_new_received);
end;
$$;

grant execute on function public.register_event_deposit(uuid, numeric, uuid) to authenticated;

-- -----------------------------------------------
-- 11. Function: mark_event_rental_paid
-- -----------------------------------------------
create or replace function public.mark_event_rental_paid(p_booking_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid; v_org_id uuid;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  update public.event_bookings set rental_paid = true
  where id = p_booking_id and organization_id = v_org_id;

  insert into public.event_booking_history (organization_id, booking_id, actor_id, action)
  values (v_org_id, p_booking_id, v_user_id, 'rental_paid');

  return json_build_object('success', true);
end;
$$;

grant execute on function public.mark_event_rental_paid(uuid) to authenticated;

-- -----------------------------------------------
-- 12. Function: finalize_event_booking
-- -----------------------------------------------
create or replace function public.finalize_event_booking(p_booking_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid; v_org_id uuid; v_booking record;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_booking from public.event_bookings where id = p_booking_id and organization_id = v_org_id;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_booking.status != 'confirmed'::event_booking_status then
    raise exception 'Solo se pueden finalizar reservas confirmadas';
  end if;

  update public.event_bookings set status = 'finished'::event_booking_status where id = p_booking_id;

  insert into public.event_booking_history (organization_id, booking_id, actor_id, action)
  values (v_org_id, p_booking_id, v_user_id, 'finalized');

  return json_build_object('success', true);
end;
$$;

grant execute on function public.finalize_event_booking(uuid) to authenticated;

-- -----------------------------------------------
-- 13. Function: return_event_deposit
-- -----------------------------------------------
create or replace function public.return_event_deposit(p_booking_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid; v_org_id uuid;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  update public.event_bookings set deposit_status = 'returned'::event_deposit_status
  where id = p_booking_id and organization_id = v_org_id
    and deposit_received > 0
    and status in ('finished'::event_booking_status, 'cancelled'::event_booking_status);

  insert into public.event_booking_history (organization_id, booking_id, actor_id, action)
  values (v_org_id, p_booking_id, v_user_id, 'deposit_returned');

  return json_build_object('success', true);
end;
$$;

grant execute on function public.return_event_deposit(uuid) to authenticated;

-- -----------------------------------------------
-- 14. Function: retain_event_deposit
-- -----------------------------------------------
create or replace function public.retain_event_deposit(
  p_booking_id uuid,
  p_reason text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid; v_org_id uuid;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'El motivo de retención es obligatorio';
  end if;

  update public.event_bookings set
    deposit_status = 'retained'::event_deposit_status,
    deposit_retained_reason = p_reason
  where id = p_booking_id and organization_id = v_org_id
    and deposit_received > 0
    and status in ('finished'::event_booking_status, 'cancelled'::event_booking_status);

  insert into public.event_booking_history (organization_id, booking_id, actor_id, action, detail)
  values (v_org_id, p_booking_id, v_user_id, 'deposit_retained', jsonb_build_object('reason', p_reason));

  return json_build_object('success', true);
end;
$$;

grant execute on function public.retain_event_deposit(uuid, text) to authenticated;

-- -----------------------------------------------
-- 15. Function: get_event_kpis
-- -----------------------------------------------
create or replace function public.get_event_kpis()
returns json
language plpgsql security definer stable set search_path = public
as $$
declare
  v_org_id uuid;
  v_tz text;
  v_today date;
  v_week_start date;
  v_week_end date;
  v_result json;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid() limit 1;
  select timezone into v_tz from public.organizations where id = v_org_id;
  v_today := (now() at time zone coalesce(v_tz, 'America/Bogota'))::date;

  -- Monday of current week
  v_week_start := v_today - extract(isodow from v_today)::int + 1;
  v_week_end := v_week_start + 6;

  select json_build_object(
    'events_today', (
      select count(*) from public.event_bookings
      where organization_id = v_org_id and event_date = v_today and status != 'cancelled'::event_booking_status
    ),
    'bookings_this_week', (
      select count(*) from public.event_bookings
      where organization_id = v_org_id and event_date between v_week_start and v_week_end and status != 'cancelled'::event_booking_status
    ),
    'guests_this_week', (
      select coalesce(sum(guest_count), 0) from public.event_bookings
      where organization_id = v_org_id and event_date between v_week_start and v_week_end and status != 'cancelled'::event_booking_status
    ),
    'pending_deposits_count', (
      select count(*) from public.event_bookings
      where organization_id = v_org_id and status = 'pending_deposit'::event_booking_status
    ),
    'pending_deposits_amount', (
      select coalesce(sum(deposit_required - deposit_received), 0) from public.event_bookings
      where organization_id = v_org_id and status = 'pending_deposit'::event_booking_status
    ),
    'rental_income_this_week', (
      select coalesce(sum(rental_total), 0) from public.event_bookings
      where organization_id = v_org_id and event_date between v_week_start and v_week_end and status != 'cancelled'::event_booking_status
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_event_kpis() to authenticated;

-- -----------------------------------------------
-- 16. Function: get_venue_bookings_for_date
-- Returns existing bookings for a venue on a date (for conflict display)
-- -----------------------------------------------
create or replace function public.get_venue_bookings_for_date(
  p_venue_id uuid,
  p_date date
)
returns table (
  id uuid,
  code text,
  client_name text,
  start_time time,
  end_time time,
  status text
)
language sql security definer stable set search_path = public
as $$
  select b.id, b.code, b.client_name, b.start_time, b.end_time, b.status::text
  from public.event_bookings b
  where b.venue_id = p_venue_id
    and b.event_date = p_date
    and b.status != 'cancelled'::event_booking_status
    and b.organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1)
  order by b.start_time;
$$;

grant execute on function public.get_venue_bookings_for_date(uuid, date) to authenticated;

-- -----------------------------------------------
-- 17. Update seed_organization_defaults (add Eventos revenue center)
-- -----------------------------------------------
create or replace function public.seed_organization_defaults(p_org_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_gestor_role_id uuid;
begin
  insert into public.roles (organization_id, name, description, color, is_system, home_route)
  values (p_org_id, 'Gestor', 'Administrador con todos los permisos', '#4f46e5', true, '/dashboard')
  returning id into v_gestor_role_id;

  insert into public.role_permissions (role_id, permission_key)
  select v_gestor_role_id, key from public.permissions;

  insert into public.roles (organization_id, name, description, color, home_route) values
    (p_org_id, 'Recepcionista', 'Atención en recepción', '#0891b2', '/hotel'),
    (p_org_id, 'Camarera de piso', 'Limpieza de habitaciones', '#65a30d', '/tareas'),
    (p_org_id, 'Mantenimiento', 'Mantenimiento del hotel', '#d97706', '/tareas'),
    (p_org_id, 'Contador', 'Gestión financiera', '#7c3aed', '/finanzas'),
    (p_org_id, 'Jefe de A&B', 'Alimentos y bebidas', '#dc2626', '/dashboard');

  insert into public.task_statuses (organization_id, name, color, sort_order, type, is_system) values
    (p_org_id, 'Por hacer',    '#6b7280', 0, 'open',        true),
    (p_org_id, 'En progreso',  '#3b82f6', 1, 'in_progress', true),
    (p_org_id, 'En revisión',  '#f59e0b', 2, 'in_progress', true),
    (p_org_id, 'Completada',   '#22c55e', 3, 'done',        true),
    (p_org_id, 'Cancelada',    '#ef4444', 4, 'cancelled',   true);

  insert into public.room_statuses (organization_id, name, color, sort_order, counts_as_available, counts_as_out_of_order, is_system) values
    (p_org_id, 'Disponible',      '#22c55e', 0, true,  false, true),
    (p_org_id, 'Ocupada',         '#3b82f6', 1, false, false, true),
    (p_org_id, 'Sucia',           '#f59e0b', 2, false, false, true),
    (p_org_id, 'En limpieza',     '#a855f7', 3, false, false, true),
    (p_org_id, 'Mantenimiento',   '#ef4444', 4, false, true,  true),
    (p_org_id, 'Fuera de servicio','#6b7280', 5, false, true,  true),
    (p_org_id, 'Reservada',       '#0891b2', 6, false, false, true);

  insert into public.document_types (organization_id, name, code, sort_order, is_system) values
    (p_org_id, 'Cédula de ciudadanía',  'CC',  0, true),
    (p_org_id, 'Cédula de extranjería', 'CE',  1, true),
    (p_org_id, 'Pasaporte',             'PA',  2, true),
    (p_org_id, 'Tarjeta de identidad',  'TI',  3, true),
    (p_org_id, 'NIT',                   'NIT', 4, true),
    (p_org_id, 'PEP',                   'PEP', 5, true);

  insert into public.booking_channels (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Directo',  0, true),
    (p_org_id, 'Walk-in',  1, true),
    (p_org_id, 'Booking',  2, false),
    (p_org_id, 'Expedia',  3, false),
    (p_org_id, 'Airbnb',   4, false),
    (p_org_id, 'Agencia',  5, false);

  insert into public.travel_reasons (organization_id, name, sort_order) values
    (p_org_id, 'Turismo',      0),
    (p_org_id, 'Negocios',     1),
    (p_org_id, 'Educación',    2),
    (p_org_id, 'Salud',        3),
    (p_org_id, 'Eventos',      4),
    (p_org_id, 'Otro',         5);

  insert into public.payment_methods (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Efectivo',          0, true),
    (p_org_id, 'Tarjeta débito',    1, true),
    (p_org_id, 'Tarjeta crédito',   2, true),
    (p_org_id, 'Transferencia',     3, true),
    (p_org_id, 'Nequi',             4, false),
    (p_org_id, 'Daviplata',         5, false);

  insert into public.revenue_centers (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Habitaciones',          0, true),
    (p_org_id, 'Alimentos y Bebidas',   1, true),
    (p_org_id, 'Lavandería',            2, false),
    (p_org_id, 'Spa',                   3, false),
    (p_org_id, 'Parqueadero',           4, false),
    (p_org_id, 'Minibar',               5, false),
    (p_org_id, 'Larga estadía',         6, true),
    (p_org_id, 'Eventos',               7, true),
    (p_org_id, 'Otros',                 8, false);

  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Costo de habitaciones',    'departmental',  0, true),
    (p_org_id, 'Costo de A&B',            'departmental',  1, true),
    (p_org_id, 'Lavandería',              'departmental',  2, false),
    (p_org_id, 'Amenities',               'departmental',  3, false);

  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Administración',           'undistributed', 10, true),
    (p_org_id, 'Ventas y marketing',       'undistributed', 11, false),
    (p_org_id, 'Mantenimiento',            'undistributed', 12, false),
    (p_org_id, 'Servicios públicos',       'undistributed', 13, true),
    (p_org_id, 'Tecnología',              'undistributed', 14, false),
    (p_org_id, 'Comisiones OTAs',          'undistributed', 15, false);

  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Arriendo',                'fixed',         20, false),
    (p_org_id, 'Seguros',                 'fixed',         21, false),
    (p_org_id, 'Impuestos propiedad',     'fixed',         22, false),
    (p_org_id, 'Intereses',               'fixed',         23, false),
    (p_org_id, 'Depreciación',            'fixed',         24, false);

  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Nómina',                  'payroll',       30, true);

  insert into public.shift_templates (organization_id, name, start_time, end_time) values
    (p_org_id, 'Mañana',  '06:00', '14:00'),
    (p_org_id, 'Tarde',   '14:00', '22:00'),
    (p_org_id, 'Noche',   '22:00', '06:00');
end;
$$;
