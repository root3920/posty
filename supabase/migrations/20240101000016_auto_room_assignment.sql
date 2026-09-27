-- =============================================================
-- POSTY — Migration: Auto room assignment RPCs
-- =============================================================

-- -----------------------------------------------
-- available_rooms_by_type: returns availability count per room type
-- for a given date range within the caller's organization
-- -----------------------------------------------
create or replace function public.available_rooms_by_type(
  p_check_in date,
  p_check_out date
)
returns table (
  id uuid,
  name text,
  base_rate numeric(14,2),
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
  available_status_ids as (
    select rs.id
    from public.room_statuses rs, org
    where rs.organization_id = org.organization_id
      and rs.counts_as_available = true
      and rs.is_active = true
  ),
  blocked_rooms as (
    select distinct s.room_id
    from public.stays s
    where s.status in ('reserved', 'checked_in')
      and s.check_in_date < p_check_out
      and s.check_out_date > p_check_in
  )
  select
    rt.id,
    rt.name,
    rt.base_rate,
    rt.max_adults,
    rt.max_children,
    count(r.id) filter (
      where r.is_active = true
        and r.status_id in (select id from available_status_ids)
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
  group by rt.id, rt.name, rt.base_rate, rt.max_adults, rt.max_children
  order by rt.name;
$$;

-- -----------------------------------------------
-- create_stay_with_auto_room: atomically picks a room
-- and creates a stay (+ guest + folio charges)
-- -----------------------------------------------
create or replace function public.create_stay_with_auto_room(
  p_room_type_id uuid,
  p_room_id uuid default null,    -- optional override for manual selection
  p_check_in date default null,
  p_check_out date default null,
  p_status text default 'reserved',
  p_adults int default 1,
  p_children int default 0,
  p_rate_per_night numeric default 0,
  p_channel_id uuid default null,
  p_travel_reason_id uuid default null,
  p_notes text default null,
  -- guest data
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_room_id uuid;
  v_room_number text;
  v_guest_id uuid;
  v_stay_id uuid;
  v_stay_code text;
  v_nights int;
  v_revenue_center_id uuid;
  v_occupied_status_id uuid;
  v_type_name text;
  v_retry int := 0;
begin
  -- Auth check
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Permission check
  if not public.has_permission('stays.create') then
    raise exception 'No tienes permiso para crear estancias'
      using errcode = '42501';
  end if;

  -- Get org
  select organization_id into v_org_id
  from public.profiles where id = v_user_id limit 1;

  if v_org_id is null then
    raise exception 'Perfil no encontrado';
  end if;

  -- Get type name for error messages
  select name into v_type_name
  from public.room_types where id = p_room_type_id;

  -- Validate dates
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'Las fechas de entrada y salida son inválidas'
      using errcode = '22023';
  end if;

  v_nights := p_check_out - p_check_in;

  -- ===== ROOM ASSIGNMENT =====
  <<room_assign>>
  loop
    if p_room_id is not null and v_retry = 0 then
      -- Manual room selection: verify it's available
      select r.id, r.number into v_room_id, v_room_number
      from public.rooms r
      inner join public.room_statuses rs on rs.id = r.status_id
      where r.id = p_room_id
        and r.organization_id = v_org_id
        and r.room_type_id = p_room_type_id
        and r.is_active = true
        and rs.counts_as_available = true
        and not exists (
          select 1 from public.stays s
          where s.room_id = r.id
            and s.status in ('reserved', 'checked_in')
            and s.check_in_date < p_check_out
            and s.check_out_date > p_check_in
        )
      for update of r skip locked;
    else
      -- Auto assignment: pick best available room
      select r.id, r.number into v_room_id, v_room_number
      from public.rooms r
      inner join public.room_statuses rs on rs.id = r.status_id
      where r.room_type_id = p_room_type_id
        and r.organization_id = v_org_id
        and r.is_active = true
        and rs.counts_as_available = true
        and not exists (
          select 1 from public.stays s
          where s.room_id = r.id
            and s.status in ('reserved', 'checked_in')
            and s.check_in_date < p_check_out
            and s.check_out_date > p_check_in
        )
      order by
        (r.housekeeping_status in ('clean', 'inspected')) desc,
        random()
      limit 1
      for update of r skip locked;
    end if;

    if v_room_id is null then
      raise exception 'No quedan habitaciones disponibles de tipo "%" para esas fechas',
        coalesce(v_type_name, 'Desconocido')
        using errcode = 'P0002';
    end if;

    exit room_assign; -- success
  end loop;

  -- ===== GUEST: find or create =====
  if p_guest_document_type_id is not null and p_guest_document_number is not null then
    select g.id into v_guest_id
    from public.guests g
    where g.organization_id = v_org_id
      and g.document_type_id = p_guest_document_type_id
      and g.document_number = p_guest_document_number
    limit 1;

    if v_guest_id is not null then
      update public.guests set
        first_name = coalesce(p_guest_first_name, first_name),
        last_name = coalesce(p_guest_last_name, last_name),
        nationality = coalesce(p_guest_nationality, nationality),
        birth_date = coalesce(p_guest_birth_date, birth_date),
        phone = coalesce(p_guest_phone, phone),
        email = coalesce(p_guest_email, email),
        address = coalesce(p_guest_address, address),
        city_of_origin = coalesce(p_guest_city_of_origin, city_of_origin),
        country_of_origin = coalesce(p_guest_country_of_origin, country_of_origin),
        notes = coalesce(p_guest_notes, notes)
      where id = v_guest_id;
    end if;
  end if;

  if v_guest_id is null then
    insert into public.guests (
      organization_id, first_name, last_name,
      document_type_id, document_number,
      nationality, birth_date, phone, email,
      address, city_of_origin, country_of_origin, notes
    ) values (
      v_org_id, p_guest_first_name, p_guest_last_name,
      p_guest_document_type_id, p_guest_document_number,
      p_guest_nationality, p_guest_birth_date, p_guest_phone, p_guest_email,
      p_guest_address, p_guest_city_of_origin, p_guest_country_of_origin, p_guest_notes
    )
    returning id into v_guest_id;
  end if;

  -- ===== CREATE STAY =====
  begin
    insert into public.stays (
      organization_id, room_id, primary_guest_id,
      check_in_date, check_out_date,
      actual_check_in_at,
      adults, children, status,
      channel_id, travel_reason_id,
      rate_per_night, notes, created_by
    ) values (
      v_org_id, v_room_id, v_guest_id,
      p_check_in, p_check_out,
      case when p_status = 'checked_in' then now() else null end,
      p_adults, p_children, p_status::stay_status,
      p_channel_id, p_travel_reason_id,
      p_rate_per_night, p_notes, v_user_id
    )
    returning id, code into v_stay_id, v_stay_code;
  exception
    when exclusion_violation then
      -- 23P01: the EXCLUDE constraint fired — someone beat us
      if v_retry < 1 and p_room_id is null then
        v_retry := v_retry + 1;
        v_room_id := null;
        -- retry with a different room (loop back)
        -- Can't use goto, so we recurse manually
        select r.id, r.number into v_room_id, v_room_number
        from public.rooms r
        inner join public.room_statuses rs on rs.id = r.status_id
        where r.room_type_id = p_room_type_id
          and r.organization_id = v_org_id
          and r.is_active = true
          and rs.counts_as_available = true
          and r.id != v_room_id  -- exclude the one that failed
          and not exists (
            select 1 from public.stays s
            where s.room_id = r.id
              and s.status in ('reserved', 'checked_in')
              and s.check_in_date < p_check_out
              and s.check_out_date > p_check_in
          )
        order by
          (r.housekeeping_status in ('clean', 'inspected')) desc,
          random()
        limit 1
        for update of r skip locked;

        if v_room_id is null then
          raise exception 'No quedan habitaciones disponibles de tipo "%" para esas fechas',
            coalesce(v_type_name, 'Desconocido')
            using errcode = 'P0002';
        end if;

        -- Try insert again
        insert into public.stays (
          organization_id, room_id, primary_guest_id,
          check_in_date, check_out_date,
          actual_check_in_at,
          adults, children, status,
          channel_id, travel_reason_id,
          rate_per_night, notes, created_by
        ) values (
          v_org_id, v_room_id, v_guest_id,
          p_check_in, p_check_out,
          case when p_status = 'checked_in' then now() else null end,
          p_adults, p_children, p_status::stay_status,
          p_channel_id, p_travel_reason_id,
          p_rate_per_night, p_notes, v_user_id
        )
        returning id, code into v_stay_id, v_stay_code;
      else
        raise exception 'No quedan habitaciones disponibles de tipo "%" para esas fechas',
          coalesce(v_type_name, 'Desconocido')
          using errcode = 'P0002';
      end if;
  end;

  -- ===== FOLIO: charge accommodation =====
  if v_nights > 0 then
    select rc.id into v_revenue_center_id
    from public.revenue_centers rc
    where rc.organization_id = v_org_id
    order by rc.sort_order
    limit 1;

    if v_revenue_center_id is not null then
      insert into public.folio_charges (
        stay_id, revenue_center_id, description,
        quantity, unit_price, tax_rate, posted_by
      ) values (
        v_stay_id, v_revenue_center_id,
        'Alojamiento — ' || v_nights || ' noche(s)',
        v_nights, p_rate_per_night, 0, v_user_id
      );
    end if;
  end if;

  -- ===== If check-in, update room to occupied =====
  if p_status = 'checked_in' then
    select rs.id into v_occupied_status_id
    from public.room_statuses rs
    where rs.organization_id = v_org_id
      and rs.counts_as_available = false
      and rs.counts_as_out_of_order = false
    order by rs.sort_order
    limit 1;

    if v_occupied_status_id is not null then
      update public.rooms
      set status_id = v_occupied_status_id
      where id = v_room_id;
    end if;
  end if;

  -- Return result
  return json_build_object(
    'stay_id', v_stay_id,
    'stay_code', v_stay_code,
    'room_id', v_room_id,
    'room_number', v_room_number,
    'guest_id', v_guest_id
  );
end;
$$;
