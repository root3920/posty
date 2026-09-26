-- =============================================================
-- POSTY — Migration: seed_organization_defaults() function
-- Seeds all default catalogs when a new organization is created.
-- =============================================================

create or replace function public.seed_organization_defaults(p_org_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_gestor_role_id uuid;
begin
  -- -----------------------------------------------
  -- System role: Gestor (owner, all permissions)
  -- -----------------------------------------------
  insert into public.roles (organization_id, name, description, color, is_system, home_route)
  values (p_org_id, 'Gestor', 'Administrador con todos los permisos', '#4f46e5', true, '/dashboard')
  returning id into v_gestor_role_id;

  -- Grant ALL permissions to Gestor
  insert into public.role_permissions (role_id, permission_key)
  select v_gestor_role_id, key from public.permissions;

  -- Default roles (not system, can be modified)
  insert into public.roles (organization_id, name, description, color, home_route) values
    (p_org_id, 'Recepcionista', 'Atención en recepción', '#0891b2', '/hotel'),
    (p_org_id, 'Camarera de piso', 'Limpieza de habitaciones', '#65a30d', '/tareas'),
    (p_org_id, 'Mantenimiento', 'Mantenimiento del hotel', '#d97706', '/tareas'),
    (p_org_id, 'Contador', 'Gestión financiera', '#7c3aed', '/finanzas'),
    (p_org_id, 'Jefe de A&B', 'Alimentos y bebidas', '#dc2626', '/dashboard');

  -- -----------------------------------------------
  -- Task statuses
  -- -----------------------------------------------
  insert into public.task_statuses (organization_id, name, color, sort_order, type, is_system) values
    (p_org_id, 'Por hacer',    '#6b7280', 0, 'open',        true),
    (p_org_id, 'En progreso',  '#3b82f6', 1, 'in_progress', true),
    (p_org_id, 'En revisión',  '#f59e0b', 2, 'in_progress', true),
    (p_org_id, 'Completada',   '#22c55e', 3, 'done',        true),
    (p_org_id, 'Cancelada',    '#ef4444', 4, 'cancelled',   true);

  -- -----------------------------------------------
  -- Room statuses
  -- -----------------------------------------------
  insert into public.room_statuses (organization_id, name, color, sort_order, counts_as_available, counts_as_out_of_order, is_system) values
    (p_org_id, 'Disponible',      '#22c55e', 0, true,  false, true),
    (p_org_id, 'Ocupada',         '#3b82f6', 1, false, false, true),
    (p_org_id, 'Sucia',           '#f59e0b', 2, false, false, true),
    (p_org_id, 'En limpieza',     '#a855f7', 3, false, false, true),
    (p_org_id, 'Mantenimiento',   '#ef4444', 4, false, true,  true),
    (p_org_id, 'Fuera de servicio','#6b7280', 5, false, true,  true),
    (p_org_id, 'Reservada',       '#0891b2', 6, false, false, true);

  -- -----------------------------------------------
  -- Document types
  -- -----------------------------------------------
  insert into public.document_types (organization_id, name, code, sort_order, is_system) values
    (p_org_id, 'Cédula de ciudadanía',  'CC',  0, true),
    (p_org_id, 'Cédula de extranjería', 'CE',  1, true),
    (p_org_id, 'Pasaporte',             'PA',  2, true),
    (p_org_id, 'Tarjeta de identidad',  'TI',  3, true),
    (p_org_id, 'NIT',                   'NIT', 4, true),
    (p_org_id, 'PEP',                   'PEP', 5, true);

  -- -----------------------------------------------
  -- Booking channels
  -- -----------------------------------------------
  insert into public.booking_channels (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Directo',  0, true),
    (p_org_id, 'Walk-in',  1, true),
    (p_org_id, 'Booking',  2, false),
    (p_org_id, 'Expedia',  3, false),
    (p_org_id, 'Airbnb',   4, false),
    (p_org_id, 'Agencia',  5, false);

  -- -----------------------------------------------
  -- Travel reasons
  -- -----------------------------------------------
  insert into public.travel_reasons (organization_id, name, sort_order) values
    (p_org_id, 'Turismo',      0),
    (p_org_id, 'Negocios',     1),
    (p_org_id, 'Educación',    2),
    (p_org_id, 'Salud',        3),
    (p_org_id, 'Eventos',      4),
    (p_org_id, 'Otro',         5);

  -- -----------------------------------------------
  -- Payment methods
  -- -----------------------------------------------
  insert into public.payment_methods (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Efectivo',          0, true),
    (p_org_id, 'Tarjeta débito',    1, true),
    (p_org_id, 'Tarjeta crédito',   2, true),
    (p_org_id, 'Transferencia',     3, true),
    (p_org_id, 'Nequi',             4, false),
    (p_org_id, 'Daviplata',         5, false);

  -- -----------------------------------------------
  -- Revenue centers
  -- -----------------------------------------------
  insert into public.revenue_centers (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Habitaciones',          0, true),
    (p_org_id, 'Alimentos y Bebidas',   1, true),
    (p_org_id, 'Lavandería',            2, false),
    (p_org_id, 'Spa',                   3, false),
    (p_org_id, 'Parqueadero',           4, false),
    (p_org_id, 'Minibar',               5, false),
    (p_org_id, 'Otros',                 6, false);

  -- -----------------------------------------------
  -- Expense categories
  -- -----------------------------------------------
  -- Departmental
  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Costo de habitaciones',    'departmental',  0, true),
    (p_org_id, 'Costo de A&B',            'departmental',  1, true),
    (p_org_id, 'Lavandería',              'departmental',  2, false),
    (p_org_id, 'Amenities',               'departmental',  3, false);

  -- Undistributed
  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Administración',           'undistributed', 10, true),
    (p_org_id, 'Ventas y marketing',       'undistributed', 11, false),
    (p_org_id, 'Mantenimiento',            'undistributed', 12, false),
    (p_org_id, 'Servicios públicos',       'undistributed', 13, true),
    (p_org_id, 'Tecnología',              'undistributed', 14, false),
    (p_org_id, 'Comisiones OTAs',          'undistributed', 15, false);

  -- Fixed
  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Arriendo',                'fixed',         20, false),
    (p_org_id, 'Seguros',                 'fixed',         21, false),
    (p_org_id, 'Impuestos propiedad',     'fixed',         22, false),
    (p_org_id, 'Intereses',               'fixed',         23, false),
    (p_org_id, 'Depreciación',            'fixed',         24, false);

  -- Payroll
  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Nómina',                  'payroll',       30, true);

  -- -----------------------------------------------
  -- Shift templates
  -- -----------------------------------------------
  insert into public.shift_templates (organization_id, name, start_time, end_time) values
    (p_org_id, 'Mañana',  '06:00', '14:00'),
    (p_org_id, 'Tarde',   '14:00', '22:00'),
    (p_org_id, 'Noche',   '22:00', '06:00');

end;
$$;
