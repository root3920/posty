-- =============================================================
-- POSTY — Migration: audit_log, visits, guest_snapshot, stay actions
-- =============================================================

-- -----------------------------------------------
-- 1. audit_log table
-- -----------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  actor_id uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create index idx_audit_log_org on public.audit_log(organization_id);
create index idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index idx_audit_log_created on public.audit_log(created_at);

alter table public.audit_log enable row level security;

create policy "Users can view audit_log of own org"
  on public.audit_log for select
  using (organization_id = public.current_org_id());

create policy "Org members can insert audit_log"
  on public.audit_log for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 2. Extend stays: visit_id, guest_snapshot, converted_from_stay_id
-- -----------------------------------------------
alter table public.stays
  add column if not exists visit_id uuid,
  add column if not exists guest_snapshot jsonb,
  add column if not exists converted_from_stay_id uuid references public.stays(id);

create index idx_stays_visit on public.stays(visit_id);

-- -----------------------------------------------
-- 3. Extend contracts: guest_snapshot, origin_stay_id
-- -----------------------------------------------
alter table public.contracts
  add column if not exists guest_snapshot jsonb,
  add column if not exists origin_stay_id uuid references public.stays(id);

-- -----------------------------------------------
-- 4. Extend guests: archived_at for soft delete
-- -----------------------------------------------
alter table public.guests
  add column if not exists archived_at timestamptz;

-- -----------------------------------------------
-- 5. Function: snapshot_guest_data
-- -----------------------------------------------
create or replace function public.snapshot_guest_data(p_guest_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'guest_id', g.id,
    'first_name', g.first_name,
    'last_name', g.last_name,
    'document_type_code', dt.code,
    'document_type_name', dt.name,
    'document_number', g.document_number,
    'nationality', g.nationality,
    'phone', g.phone,
    'email', g.email,
    'address', g.address,
    'city_of_origin', g.city_of_origin,
    'country_of_origin', g.country_of_origin,
    'snapshot_at', now()
  )
  from public.guests g
  left join public.document_types dt on dt.id = g.document_type_id
  where g.id = p_guest_id;
$$;

-- -----------------------------------------------
-- 6. Audit triggers
-- -----------------------------------------------

-- 6a. stays audit trigger
create or replace function public.trg_audit_stay()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_action text;
  v_before jsonb;
  v_after jsonb;
begin
  if TG_OP = 'DELETE' then
    v_org_id := old.organization_id;
    v_action := 'delete';
    v_before := to_jsonb(old);
    v_after := null;
  elsif TG_OP = 'INSERT' then
    v_org_id := new.organization_id;
    v_action := 'create';
    v_before := null;
    v_after := to_jsonb(new);
  else -- UPDATE
    v_org_id := new.organization_id;
    v_action := 'update';
    -- Only store changed fields
    v_before := jsonb_build_object(
      'status', old.status,
      'room_id', old.room_id,
      'check_in_date', old.check_in_date,
      'check_out_date', old.check_out_date,
      'rate_per_night', old.rate_per_night,
      'adults', old.adults,
      'children', old.children,
      'stay_type', old.stay_type,
      'primary_guest_id', old.primary_guest_id,
      'notes', old.notes
    );
    v_after := jsonb_build_object(
      'status', new.status,
      'room_id', new.room_id,
      'check_in_date', new.check_in_date,
      'check_out_date', new.check_out_date,
      'rate_per_night', new.rate_per_night,
      'adults', new.adults,
      'children', new.children,
      'stay_type', new.stay_type,
      'primary_guest_id', new.primary_guest_id,
      'notes', new.notes
    );
    -- Skip if nothing meaningful changed
    if v_before = v_after then
      return new;
    end if;
  end if;

  insert into public.audit_log (organization_id, entity_type, entity_id, action, before, after, actor_id)
  values (v_org_id, 'stay', coalesce(new.id, old.id), v_action, v_before, v_after, auth.uid());

  return coalesce(new, old);
end;
$$;

create trigger trg_audit_stays
  after insert or update or delete on public.stays
  for each row execute function public.trg_audit_stay();

-- 6b. guests audit trigger
create or replace function public.trg_audit_guest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  v_before := jsonb_build_object(
    'first_name', old.first_name, 'last_name', old.last_name,
    'document_number', old.document_number, 'phone', old.phone,
    'email', old.email, 'address', old.address,
    'nationality', old.nationality
  );
  v_after := jsonb_build_object(
    'first_name', new.first_name, 'last_name', new.last_name,
    'document_number', new.document_number, 'phone', new.phone,
    'email', new.email, 'address', new.address,
    'nationality', new.nationality
  );
  if v_before = v_after then
    return new;
  end if;

  insert into public.audit_log (organization_id, entity_type, entity_id, action, before, after, actor_id)
  values (new.organization_id, 'guest', new.id, 'update', v_before, v_after, auth.uid());

  return new;
end;
$$;

create trigger trg_audit_guests
  after update on public.guests
  for each row execute function public.trg_audit_guest();

-- 6c. contracts audit trigger
create or replace function public.trg_audit_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_before jsonb;
  v_after jsonb;
begin
  if TG_OP = 'INSERT' then
    v_action := 'create';
    v_before := null;
    v_after := jsonb_build_object('code', new.code, 'status', new.status, 'monthly_rate', new.monthly_rate);
  else
    v_action := 'update';
    v_before := jsonb_build_object('status', old.status, 'monthly_rate', old.monthly_rate, 'end_date', old.end_date);
    v_after := jsonb_build_object('status', new.status, 'monthly_rate', new.monthly_rate, 'end_date', new.end_date);
    if v_before = v_after then return new; end if;
  end if;

  insert into public.audit_log (organization_id, entity_type, entity_id, action, before, after, actor_id)
  values (new.organization_id, 'contract', new.id, v_action, v_before, v_after, auth.uid());

  return new;
end;
$$;

create trigger trg_audit_contracts
  after insert or update on public.contracts
  for each row execute function public.trg_audit_contract();

-- -----------------------------------------------
-- 7. Function: update_stay
-- -----------------------------------------------
create or replace function public.update_stay(
  p_stay_id uuid,
  p_check_in_date date default null,
  p_check_out_date date default null,
  p_adults int default null,
  p_children int default null,
  p_rate_per_night numeric default null,
  p_channel_id uuid default null,
  p_travel_reason_id uuid default null,
  p_notes text default null,
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
  v_stay record;
  v_new_check_in date;
  v_new_check_out date;
  v_conflict_count int;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_stay from public.stays where id = p_stay_id and organization_id = v_org_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  if v_stay.status not in ('reserved', 'checked_in') then
    raise exception 'Solo se pueden editar estancias activas';
  end if;

  v_new_check_in := coalesce(p_check_in_date, v_stay.check_in_date);
  v_new_check_out := coalesce(p_check_out_date, v_stay.check_out_date);

  if v_new_check_out <= v_new_check_in then
    raise exception 'La fecha de salida debe ser posterior a la de entrada';
  end if;

  -- Validate room availability if dates changed
  if v_new_check_in != v_stay.check_in_date or v_new_check_out != v_stay.check_out_date then
    select count(*) into v_conflict_count
    from public.stays s
    where s.room_id = v_stay.room_id
      and s.id != p_stay_id
      and s.status in ('reserved', 'checked_in')
      and s.check_in_date < v_new_check_out
      and s.check_out_date > v_new_check_in;

    if v_conflict_count > 0 then
      raise exception 'La habitación no está disponible para las nuevas fechas';
    end if;
  end if;

  update public.stays set
    check_in_date = v_new_check_in,
    check_out_date = v_new_check_out,
    adults = coalesce(p_adults, adults),
    children = coalesce(p_children, children),
    rate_per_night = coalesce(p_rate_per_night, rate_per_night),
    channel_id = case when p_channel_id is not null then p_channel_id else channel_id end,
    travel_reason_id = case when p_travel_reason_id is not null then p_travel_reason_id else travel_reason_id end,
    notes = case when p_notes is not null then p_notes else notes end
  where id = p_stay_id;

  -- Store reason on the audit entry created by the trigger
  if p_reason is not null then
    update public.audit_log set reason = p_reason
    where id = (
      select id from public.audit_log
      where entity_id = p_stay_id and entity_type = 'stay'
      order by created_at desc limit 1
    );
  end if;

  return json_build_object('success', true, 'stay_id', p_stay_id);
end;
$$;

grant execute on function public.update_stay(uuid, date, date, int, int, numeric, uuid, uuid, text, text) to authenticated;

-- -----------------------------------------------
-- 8. Function: cancel_stay
-- -----------------------------------------------
create or replace function public.cancel_stay(
  p_stay_id uuid,
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
  v_stay record;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_stay from public.stays where id = p_stay_id and organization_id = v_org_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  if v_stay.status != 'reserved' then
    raise exception 'Solo se pueden cancelar reservas (estado "reserved")';
  end if;

  update public.stays set status = 'cancelled'::stay_status where id = p_stay_id;

  -- Cancel linked contract if any
  if v_stay.contract_id is not null then
    update public.contracts set status = 'cancelled'::contract_status
    where id = v_stay.contract_id;
  end if;

  -- Record reason
  if p_reason is not null then
    update public.audit_log set reason = p_reason
    where id = (
      select id from public.audit_log
      where entity_id = p_stay_id and entity_type = 'stay'
      order by created_at desc limit 1
    );
  end if;

  return json_build_object('success', true, 'stay_id', p_stay_id);
end;
$$;

grant execute on function public.cancel_stay(uuid, text) to authenticated;

-- -----------------------------------------------
-- 9. Function: change_stay_room
-- -----------------------------------------------
create or replace function public.change_stay_room(
  p_stay_id uuid,
  p_new_room_id uuid,
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
  v_stay record;
  v_new_room record;
  v_conflict_count int;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_stay from public.stays where id = p_stay_id and organization_id = v_org_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  if v_stay.status not in ('reserved', 'checked_in') then
    raise exception 'Solo se pueden cambiar habitaciones de estancias activas';
  end if;

  select * into v_new_room from public.rooms where id = p_new_room_id and organization_id = v_org_id;
  if not found then raise exception 'Habitación no encontrada'; end if;

  -- Check availability
  select count(*) into v_conflict_count
  from public.stays s
  where s.room_id = p_new_room_id
    and s.id != p_stay_id
    and s.status in ('reserved', 'checked_in')
    and s.check_in_date < v_stay.check_out_date
    and s.check_out_date > v_stay.check_in_date;

  if v_conflict_count > 0 then
    raise exception 'La habitación no está disponible para el período de la estancia';
  end if;

  update public.stays set room_id = p_new_room_id where id = p_stay_id;

  -- Update contract if linked
  if v_stay.contract_id is not null then
    update public.contracts set room_id = p_new_room_id, room_type_id = v_new_room.room_type_id
    where id = v_stay.contract_id;
  end if;

  -- Record reason
  if p_reason is not null then
    update public.audit_log set reason = p_reason
    where id = (
      select id from public.audit_log
      where entity_id = p_stay_id and entity_type = 'stay'
      order by created_at desc limit 1
    );
  end if;

  return json_build_object('success', true, 'stay_id', p_stay_id, 'new_room_number', v_new_room.number);
end;
$$;

grant execute on function public.change_stay_room(uuid, uuid, text) to authenticated;

-- -----------------------------------------------
-- 10. Function: extend_shorten_stay
-- -----------------------------------------------
create or replace function public.extend_shorten_stay(
  p_stay_id uuid,
  p_new_check_out date,
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
  v_stay record;
  v_conflict_count int;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_stay from public.stays where id = p_stay_id and organization_id = v_org_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  if v_stay.status not in ('reserved', 'checked_in') then
    raise exception 'Solo se pueden modificar estancias activas';
  end if;

  if p_new_check_out <= v_stay.check_in_date then
    raise exception 'La nueva fecha de salida debe ser posterior a la entrada';
  end if;

  -- If extending, check availability
  if p_new_check_out > v_stay.check_out_date then
    select count(*) into v_conflict_count
    from public.stays s
    where s.room_id = v_stay.room_id
      and s.id != p_stay_id
      and s.status in ('reserved', 'checked_in')
      and s.check_in_date < p_new_check_out
      and s.check_out_date > v_stay.check_out_date;

    if v_conflict_count > 0 then
      raise exception 'La habitación no está disponible para la extensión';
    end if;
  end if;

  update public.stays set check_out_date = p_new_check_out where id = p_stay_id;

  if p_reason is not null then
    update public.audit_log set reason = p_reason
    where id = (
      select id from public.audit_log
      where entity_id = p_stay_id and entity_type = 'stay'
      order by created_at desc limit 1
    );
  end if;

  return json_build_object('success', true, 'stay_id', p_stay_id, 'new_check_out', p_new_check_out);
end;
$$;

grant execute on function public.extend_shorten_stay(uuid, date, text) to authenticated;

-- -----------------------------------------------
-- 11. Function: get_audit_log
-- -----------------------------------------------
create or replace function public.get_audit_log(
  p_entity_type text,
  p_entity_id uuid
)
returns table (
  id uuid,
  action text,
  before jsonb,
  after jsonb,
  actor_name text,
  reason text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.action, a.before, a.after,
    p.full_name as actor_name,
    a.reason, a.created_at
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  where a.entity_type = p_entity_type
    and a.entity_id = p_entity_id
    and a.organization_id = (
      select organization_id from public.profiles where id = auth.uid() limit 1
    )
  order by a.created_at desc;
$$;

grant execute on function public.get_audit_log(text, uuid) to authenticated;

-- -----------------------------------------------
-- 12. Update stays_view to include new columns
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
