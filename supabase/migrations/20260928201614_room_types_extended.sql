-- =============================================================
-- POSTY — Room types extended: code, bed_config, size, photos, rate_override
-- =============================================================

-- -----------------------------------------------
-- 1. room_types: new columns
-- -----------------------------------------------
alter table public.room_types
  add column if not exists code text,
  add column if not exists bed_config jsonb default '[]',
  add column if not exists size_sqm numeric(6,1);

-- -----------------------------------------------
-- 2. rooms: rate override
-- -----------------------------------------------
alter table public.rooms
  add column if not exists rate_override numeric(14,2);

-- -----------------------------------------------
-- 3. room_type_photos
-- -----------------------------------------------
create table if not exists public.room_type_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_room_type_photos_path
  on public.room_type_photos (room_type_id, storage_path);

create index if not exists idx_room_type_photos_type
  on public.room_type_photos (room_type_id);

alter table public.room_type_photos enable row level security;

create policy "Users can view room_type_photos of own org"
  on public.room_type_photos for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage room_type_photos"
  on public.room_type_photos for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 4. RPC: create_room_type_with_rooms
-- -----------------------------------------------
create or replace function public.create_room_type_with_rooms(
  p_name text,
  p_code text default null,
  p_description text default null,
  p_base_rate numeric default 0,
  p_max_adults int default 2,
  p_max_children int default 0,
  p_amenities text[] default '{}',
  p_bed_config jsonb default '[]',
  p_size_sqm numeric default null,
  p_photo_paths text[] default '{}',
  p_rooms jsonb default '[]'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_type_id uuid;
  v_room record;
  v_photo_path text;
  v_room_count int := 0;
  v_status_id uuid;
  v_i int := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'No autenticado'; end if;

  select organization_id into v_org_id
  from public.profiles where id = v_user_id limit 1;
  if v_org_id is null then raise exception 'Perfil no encontrado'; end if;

  -- Get the available room status
  select rs.id into v_status_id
  from public.room_statuses rs
  where rs.organization_id = v_org_id and rs.counts_as_available = true
  order by rs.sort_order limit 1;

  if v_status_id is null then
    select rs.id into v_status_id
    from public.room_statuses rs
    where rs.organization_id = v_org_id
    order by rs.sort_order limit 1;
  end if;

  -- 1. Create room type
  insert into public.room_types (
    organization_id, name, code, description,
    base_rate, max_adults, max_children,
    amenities, bed_config, size_sqm
  ) values (
    v_org_id, p_name, p_code, p_description,
    p_base_rate, p_max_adults, p_max_children,
    p_amenities, p_bed_config, p_size_sqm
  )
  returning id into v_type_id;

  -- 2. Insert photos
  foreach v_photo_path in array p_photo_paths loop
    v_i := v_i + 1;
    insert into public.room_type_photos (
      organization_id, room_type_id, storage_path, sort_order, is_cover
    ) values (
      v_org_id, v_type_id, v_photo_path, v_i, v_i = 1
    );
  end loop;

  -- 3. Insert rooms
  for v_room in select * from jsonb_array_elements(p_rooms) loop
    insert into public.rooms (
      organization_id, number, floor, room_type_id,
      status_id, housekeeping_status, rate_override
    ) values (
      v_org_id,
      v_room.value->>'number',
      v_room.value->>'floor',
      v_type_id,
      v_status_id,
      'clean'::housekeeping_status,
      case when v_room.value->>'rate_override' is not null
        then (v_room.value->>'rate_override')::numeric
        else null
      end
    );
    v_room_count := v_room_count + 1;
  end loop;

  return json_build_object(
    'room_type_id', v_type_id,
    'room_count', v_room_count,
    'photo_count', array_length(p_photo_paths, 1)
  );
end;
$$;

-- -----------------------------------------------
-- 5. Update rooms_view to include rate_override
-- -----------------------------------------------
drop view if exists public.rooms_view;
create view public.rooms_view
  with (security_invoker = true)
as
select
  r.*,
  rt.name    as room_type_name,
  rt.base_rate as room_type_rate,
  rt.code    as room_type_code,
  rt.max_adults,
  rt.max_children,
  rs.name    as status_name,
  rs.color   as status_color,
  rs.counts_as_available,
  rs.counts_as_out_of_order
from public.rooms r
left join public.room_types rt on rt.id = r.room_type_id
left join public.room_statuses rs on rs.id = r.status_id;
