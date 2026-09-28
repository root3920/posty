-- =============================================================
-- POSTY — Housekeeping module: tables, types, seeds, view, RLS
-- =============================================================

-- -----------------------------------------------
-- 1. New enums
-- -----------------------------------------------
create type public.cleaning_status as enum ('scheduled','in_progress','completed','skipped','cancelled');
create type public.cleaning_origin as enum ('auto_weekly','pre_arrival','checkout','guest_request','manual');
create type public.inspection_status as enum ('not_required','pending','approved','rejected');

-- -----------------------------------------------
-- 2. Permissions
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('housekeeping.view', 'housekeeping', 'view', null, 'Ver el módulo de limpieza'),
  ('housekeeping.execute', 'housekeeping', 'execute', null, 'Iniciar y finalizar limpiezas propias'),
  ('housekeeping.manage', 'housekeeping', 'manage', null, 'Asignar, reprogramar, inspeccionar y corregir horas'),
  ('housekeeping.request', 'housekeeping', 'request', null, 'Solicitar limpieza de una habitación')
on conflict (key) do nothing;

-- -----------------------------------------------
-- 3. cleaning_types
-- -----------------------------------------------
create table public.cleaning_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  system_key text,
  estimated_minutes int not null default 30,
  default_checklist jsonb default '[]',
  requires_inspection boolean not null default true,
  is_active boolean not null default true,
  archived_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_cleaning_types_system_key
  on public.cleaning_types (organization_id, system_key)
  where system_key is not null;

create trigger on_cleaning_types_updated
  before update on public.cleaning_types
  for each row execute function public.handle_updated_at();

alter table public.cleaning_types enable row level security;

create policy "Users can view cleaning_types of own org"
  on public.cleaning_types for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage cleaning_types"
  on public.cleaning_types for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 4. housekeeping_config (one row per org)
-- -----------------------------------------------
create table public.housekeeping_config (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  frequency_days int not null default 7,
  default_time time not null default '10:00',
  require_inspection boolean not null default true,
  skip_pre_arrival_hours int not null default 0,
  vacant_refresh_days int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_housekeeping_config_updated
  before update on public.housekeeping_config
  for each row execute function public.handle_updated_at();

alter table public.housekeeping_config enable row level security;

create policy "Users can view housekeeping_config of own org"
  on public.housekeeping_config for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage housekeeping_config"
  on public.housekeeping_config for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 5. room_cleanings
-- -----------------------------------------------
create table public.room_cleanings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  stay_id uuid references public.stays(id) on delete set null,
  cleaning_type_id uuid not null references public.cleaning_types(id),
  status cleaning_status not null default 'scheduled',
  scheduled_for timestamptz not null,
  origin cleaning_origin not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_role_id uuid references public.roles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  duration_minutes numeric generated always as (
    case when completed_at is not null and started_at is not null
      then round(extract(epoch from completed_at - started_at) / 60.0, 1)
      else null end
  ) stored,
  checklist jsonb default '[]',
  notes text,
  issues_found boolean not null default false,
  issue_description text,
  minibar_charged boolean not null default false,
  skipped_reason text,
  skipped_note text,
  inspection_status inspection_status not null default 'not_required',
  inspected_by uuid references public.profiles(id),
  inspected_at timestamptz,
  inspection_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Only one scheduled auto_weekly per room
create unique index idx_room_cleanings_weekly_unique
  on public.room_cleanings (room_id)
  where status = 'scheduled' and origin = 'auto_weekly';

-- Only one active pre_arrival or checkout per stay+origin
create unique index idx_room_cleanings_stay_origin_unique
  on public.room_cleanings (stay_id, origin)
  where status in ('scheduled', 'in_progress') and origin in ('pre_arrival', 'checkout');

create index idx_room_cleanings_org on public.room_cleanings(organization_id);
create index idx_room_cleanings_room on public.room_cleanings(room_id);
create index idx_room_cleanings_scheduled on public.room_cleanings(scheduled_for);
create index idx_room_cleanings_status on public.room_cleanings(status);
create index idx_room_cleanings_stay on public.room_cleanings(stay_id);

alter table public.room_cleanings enable row level security;

create policy "Users can view room_cleanings of own org"
  on public.room_cleanings for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage room_cleanings"
  on public.room_cleanings for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 6. rooms: add last_cleaned columns
-- -----------------------------------------------
alter table public.rooms
  add column if not exists last_cleaned_at timestamptz,
  add column if not exists last_cleaned_by uuid references public.profiles(id);

-- -----------------------------------------------
-- 7. Seed functions
-- -----------------------------------------------
create or replace function public.seed_cleaning_types(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.cleaning_types where organization_id = p_org_id limit 1) then
    return;
  end if;

  insert into public.cleaning_types (organization_id, system_key, name, color, estimated_minutes, requires_inspection, default_checklist, sort_order) values
    (p_org_id, 'pre_arrival', 'Antes de la llegada', '#3b82f6', 60, true,
     '[{"text":"Ventilar la habitación"},{"text":"Cambiar lencería y toallas"},{"text":"Limpiar y desinfectar el baño"},{"text":"Limpiar superficies, polvo, piso"},{"text":"Reponer amenities"},{"text":"Revisar y reponer minibar"},{"text":"Revisar funcionamiento: luces, TV, aire, agua, wifi"},{"text":"Colocar pedidos especiales del huésped"},{"text":"Marcar como limpia"}]', 10),
    (p_org_id, 'checkout', 'Salida', '#ef4444', 45, true,
     '[{"text":"Retirar lencería, toallas y basura"},{"text":"Revisar objetos olvidados"},{"text":"Limpiar y desinfectar el baño"},{"text":"Limpiar superficies y piso"},{"text":"Revisar funcionamiento"},{"text":"Reponer amenities"},{"text":"Marcar como limpia"}]', 20),
    (p_org_id, 'weekly_occupied', 'Semanal (ocupada)', '#22c55e', 30, false,
     '[{"text":"Cambiar lencería y toallas"},{"text":"Limpiar baño"},{"text":"Limpiar superficies y piso"},{"text":"Vaciar basura"},{"text":"Reponer amenities"},{"text":"Revisar minibar"}]', 30),
    (p_org_id, 'on_request', 'A pedido', '#f59e0b', 20, false,
     '[{"text":"Atender lo solicitado por el huésped"}]', 40),
    (p_org_id, 'deep', 'Profunda', '#7c3aed', 90, true,
     '[{"text":"Cortinas y tapicería"},{"text":"Colchón"},{"text":"Detrás de muebles"},{"text":"Vidrios y espejos"},{"text":"Aire acondicionado"},{"text":"Limpieza completa estándar"}]', 50),
    (p_org_id, 'vacant_refresh', 'Repaso (vacía)', '#6b7280', 20, false,
     '[{"text":"Quitar polvo"},{"text":"Ventilar"},{"text":"Revisar baño"},{"text":"Revisar funcionamiento"}]', 60);
end;
$$;

create or replace function public.seed_housekeeping_config(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.housekeeping_config (organization_id)
  values (p_org_id)
  on conflict (organization_id) do nothing;
end;
$$;

-- Seed for all existing organizations
do $$
declare v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.seed_cleaning_types(v_org.id);
    perform public.seed_housekeeping_config(v_org.id);
  end loop;
end;
$$;

-- Add housekeeping permissions to existing roles
do $$
declare
  v_role record;
begin
  -- Ama de llaves: all 4
  for v_role in
    select id from public.roles where system_key = 'housekeeping_supervisor'
  loop
    insert into public.role_permissions (role_id, permission_key)
    values (v_role.id, 'housekeeping.view'), (v_role.id, 'housekeeping.execute'),
           (v_role.id, 'housekeeping.manage'), (v_role.id, 'housekeeping.request')
    on conflict do nothing;
  end loop;

  -- Camarera: view + execute
  for v_role in
    select id from public.roles where system_key = 'room_attendant'
  loop
    insert into public.role_permissions (role_id, permission_key)
    values (v_role.id, 'housekeeping.view'), (v_role.id, 'housekeeping.execute')
    on conflict do nothing;
  end loop;

  -- Recepción: view + request
  for v_role in
    select id from public.roles where system_key = 'front_desk'
  loop
    insert into public.role_permissions (role_id, permission_key)
    values (v_role.id, 'housekeeping.view'), (v_role.id, 'housekeeping.request')
    on conflict do nothing;
  end loop;

  -- Gestor: all 4
  for v_role in
    select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor')
  loop
    insert into public.role_permissions (role_id, permission_key)
    values (v_role.id, 'housekeeping.view'), (v_role.id, 'housekeeping.execute'),
           (v_role.id, 'housekeeping.manage'), (v_role.id, 'housekeeping.request')
    on conflict do nothing;
  end loop;
end;
$$;

-- -----------------------------------------------
-- 8. View: room_cleaning_status_view
-- -----------------------------------------------
create or replace view public.room_cleaning_status_view
  with (security_invoker = true)
as
select
  r.id as room_id,
  r.number as room_number,
  r.floor,
  r.room_type_id,
  rt.name as room_type_name,
  r.housekeeping_status,
  r.last_cleaned_at,
  r.is_active,
  -- current occupancy
  cs.id as current_stay_id,
  cs.primary_guest_id,
  cg.first_name as guest_first_name,
  cg.last_name as guest_last_name,
  cs.check_in_date,
  cs.check_out_date,
  -- last completed cleaning
  lc.id as last_cleaning_id,
  lc.completed_at as last_cleaning_at,
  lc.cleaning_type_id as last_cleaning_type_id,
  lct.name as last_cleaning_type_name,
  lcp.full_name as last_cleaning_by_name,
  -- next scheduled cleaning
  nc.id as next_cleaning_id,
  nc.scheduled_for as next_cleaning_at,
  nc.cleaning_type_id as next_cleaning_type_id,
  nct.name as next_cleaning_type_name,
  nc.status as next_cleaning_status,
  nc.origin as next_cleaning_origin,
  -- computed
  extract(day from now() - coalesce(r.last_cleaned_at, r.created_at))::int as days_since_last,
  case
    when cs.id is not null
      and r.last_cleaned_at is not null
      and extract(day from now() - r.last_cleaned_at) > coalesce(hc.frequency_days, 7)
    then true
    else false
  end as is_overdue
from public.rooms r
left join public.room_types rt on rt.id = r.room_type_id
left join lateral (
  select s.* from public.stays s
  where s.room_id = r.id and s.status = 'checked_in'
  limit 1
) cs on true
left join public.guests cg on cg.id = cs.primary_guest_id
left join lateral (
  select rc.* from public.room_cleanings rc
  where rc.room_id = r.id and rc.status = 'completed'
  order by rc.completed_at desc limit 1
) lc on true
left join public.cleaning_types lct on lct.id = lc.cleaning_type_id
left join public.profiles lcp on lcp.id = lc.completed_by
left join lateral (
  select rc.* from public.room_cleanings rc
  where rc.room_id = r.id and rc.status in ('scheduled', 'in_progress')
  order by rc.scheduled_for asc limit 1
) nc on true
left join public.cleaning_types nct on nct.id = nc.cleaning_type_id
left join public.housekeeping_config hc on hc.organization_id = r.organization_id
where r.is_active = true;
