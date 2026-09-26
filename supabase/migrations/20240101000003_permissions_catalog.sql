-- =============================================================
-- POSTY — Migration: Permissions catalog (system-wide)
-- =============================================================

create table public.permissions (
  key text primary key,                 -- e.g. 'tasks.view.all'
  module text not null,                 -- e.g. 'tasks'
  action text not null,                 -- e.g. 'view'
  scope text,                           -- 'own' | 'all' | null
  description text not null
);

-- Seed all permission keys
insert into public.permissions (key, module, action, scope, description) values
  -- Dashboard
  ('dashboard.view', 'dashboard', 'view', null, 'Ver el dashboard principal'),

  -- Team
  ('team.view', 'team', 'view', null, 'Ver el módulo de equipo'),
  ('team.create', 'team', 'create', null, 'Invitar miembros al equipo'),
  ('team.edit', 'team', 'edit', null, 'Editar perfiles y horarios del equipo'),
  ('team.delete', 'team', 'delete', null, 'Desactivar miembros del equipo'),

  -- Tasks
  ('tasks.view.own', 'tasks', 'view', 'own', 'Ver solo mis tareas'),
  ('tasks.view.all', 'tasks', 'view', 'all', 'Ver todas las tareas'),
  ('tasks.create', 'tasks', 'create', null, 'Crear tareas'),
  ('tasks.edit.own', 'tasks', 'edit', 'own', 'Editar mis tareas (cambiar estado)'),
  ('tasks.edit.all', 'tasks', 'edit', 'all', 'Editar cualquier tarea'),
  ('tasks.delete', 'tasks', 'delete', null, 'Eliminar tareas'),

  -- Rooms
  ('rooms.view', 'rooms', 'view', null, 'Ver habitaciones'),
  ('rooms.create', 'rooms', 'create', null, 'Crear habitaciones'),
  ('rooms.edit', 'rooms', 'edit', null, 'Editar habitaciones y estados'),
  ('rooms.delete', 'rooms', 'delete', null, 'Eliminar habitaciones'),

  -- Guests
  ('guests.view', 'guests', 'view', null, 'Ver huéspedes'),
  ('guests.create', 'guests', 'create', null, 'Registrar huéspedes'),
  ('guests.edit', 'guests', 'edit', null, 'Editar huéspedes'),
  ('guests.delete', 'guests', 'delete', null, 'Eliminar huéspedes'),

  -- Stays
  ('stays.view', 'stays', 'view', null, 'Ver estancias y reservas'),
  ('stays.create', 'stays', 'create', null, 'Crear estancias (check-in, reservas)'),
  ('stays.edit', 'stays', 'edit', null, 'Editar estancias'),
  ('stays.delete', 'stays', 'delete', null, 'Cancelar estancias'),

  -- Finance
  ('finance.view', 'finance', 'view', null, 'Ver módulo financiero'),
  ('finance.create', 'finance', 'create', null, 'Registrar ingresos y gastos'),
  ('finance.edit', 'finance', 'edit', null, 'Editar registros financieros'),
  ('finance.delete', 'finance', 'delete', null, 'Eliminar registros financieros'),

  -- Settings
  ('settings.view', 'settings', 'view', null, 'Ver configuración'),
  ('settings.edit', 'settings', 'edit', null, 'Editar configuración de la empresa'),

  -- Roles
  ('roles.view', 'roles', 'view', null, 'Ver roles y permisos'),
  ('roles.create', 'roles', 'create', null, 'Crear roles'),
  ('roles.edit', 'roles', 'edit', null, 'Editar roles y permisos'),
  ('roles.delete', 'roles', 'delete', null, 'Eliminar roles');

-- No RLS on permissions — it's a system-wide read-only catalog
