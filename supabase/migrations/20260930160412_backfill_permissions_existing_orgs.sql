-- =============================================================
-- POSTY — Backfill: assign module permissions to existing roles
--
-- Modules added after initial org creation that need backfilling:
--   - housekeeping (from 20260928172217)
--   - contracts (from 20260929212517)
--   - events (from 20260930154033)
--
-- Rule: Gestor gets ALL permissions. Other roles get a subset.
-- Idempotent: uses ON CONFLICT DO NOTHING.
-- =============================================================

do $$
declare
  v_role record;
begin
  -- -----------------------------------------------
  -- 1. GESTOR (system_key = 'manager' OR is_system + name = 'Gestor')
  --    Gets ALL permissions from the permissions table
  -- -----------------------------------------------
  for v_role in
    select id from public.roles
    where system_key = 'manager'
       or (is_system = true and name = 'Gestor')
  loop
    insert into public.role_permissions (role_id, permission_key)
    select v_role.id, p.key
    from public.permissions p
    where not exists (
      select 1 from public.role_permissions rp
      where rp.role_id = v_role.id and rp.permission_key = p.key
    )
    on conflict do nothing;
  end loop;

  -- -----------------------------------------------
  -- 2. RECEPCIONISTA (system_key = 'front_desk')
  --    Contracts: view, create, payments
  --    Events: view, create, edit (no delete, no manage_deposits)
  --    Housekeeping: view, request
  -- -----------------------------------------------
  for v_role in
    select id from public.roles where system_key = 'front_desk'
  loop
    insert into public.role_permissions (role_id, permission_key) values
      -- Contracts
      (v_role.id, 'contracts.view'),
      (v_role.id, 'contracts.create'),
      (v_role.id, 'contracts.payments'),
      -- Events
      (v_role.id, 'events.view'),
      (v_role.id, 'events.create'),
      (v_role.id, 'events.edit'),
      -- Housekeeping
      (v_role.id, 'housekeeping.view'),
      (v_role.id, 'housekeeping.request')
    on conflict do nothing;
  end loop;

  -- -----------------------------------------------
  -- 3. CAMARERA DE PISO (system_key = 'room_attendant')
  --    Events: view only (see calendar)
  --    Housekeeping: view, execute
  --    Contracts: view
  -- -----------------------------------------------
  for v_role in
    select id from public.roles where system_key = 'room_attendant'
  loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'events.view'),
      (v_role.id, 'housekeeping.view'),
      (v_role.id, 'housekeeping.execute'),
      (v_role.id, 'contracts.view')
    on conflict do nothing;
  end loop;

  -- -----------------------------------------------
  -- 4. MANTENIMIENTO (system_key = 'maintenance')
  --    Events: view only
  --    Housekeeping: view
  --    Contracts: view
  -- -----------------------------------------------
  for v_role in
    select id from public.roles where system_key = 'maintenance'
  loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'events.view'),
      (v_role.id, 'housekeeping.view'),
      (v_role.id, 'contracts.view')
    on conflict do nothing;
  end loop;

  -- -----------------------------------------------
  -- 5. ALL OTHER ROLES (no system_key match)
  --    Get at least events.view so they can see the calendar
  -- -----------------------------------------------
  for v_role in
    select id from public.roles
    where system_key is null
       or system_key not in ('manager', 'front_desk', 'room_attendant', 'maintenance')
  loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'events.view'),
      (v_role.id, 'housekeeping.view'),
      (v_role.id, 'contracts.view')
    on conflict do nothing;
  end loop;

  raise notice 'Permissions backfilled for all existing roles';
end;
$$;
