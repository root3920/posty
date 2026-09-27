-- =============================================================
-- POSTY — Migration: Workflow functions
-- All security definer, set search_path = public
-- =============================================================

-- -----------------------------------------------
-- ensure_workflow_roles: creates missing roles by system_key
-- -----------------------------------------------
create or replace function public.ensure_workflow_roles(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role record;
  v_role_id uuid;
  v_perm text;
  v_role_defs jsonb := '[
    {"key":"front_desk","name":"Recepción","color":"#0891b2","home":"/hotel",
     "perms":["tasks.view.own","tasks.edit.own","stays.view","stays.create","stays.edit","guests.view","guests.create","guests.edit","rooms.view","dashboard.view"]},
    {"key":"housekeeping_supervisor","name":"Ama de llaves","color":"#7c3aed","home":"/tareas",
     "perms":["tasks.view.own","tasks.edit.own","tasks.create","rooms.view","rooms.edit","stays.view","dashboard.view"]},
    {"key":"room_attendant","name":"Camarera de pisos","color":"#65a30d","home":"/tareas",
     "perms":["tasks.view.own","tasks.edit.own","rooms.view","dashboard.view"]},
    {"key":"maintenance","name":"Mantenimiento","color":"#d97706","home":"/tareas",
     "perms":["tasks.view.own","tasks.edit.own","rooms.view","rooms.edit","dashboard.view"]},
    {"key":"kitchen","name":"Cocina / Restaurante","color":"#dc2626","home":"/tareas",
     "perms":["tasks.view.own","tasks.edit.own","stays.view","dashboard.view"]},
    {"key":"bell_security","name":"Botones / Seguridad","color":"#0d9488","home":"/tareas",
     "perms":["tasks.view.own","tasks.edit.own","stays.view","dashboard.view"]},
    {"key":"night_auditor","name":"Auditor nocturno","color":"#4338ca","home":"/finanzas",
     "perms":["tasks.view.own","tasks.edit.own","stays.view","finance.view","dashboard.view"]}
  ]';
begin
  for v_role in select * from jsonb_array_elements(v_role_defs) loop
    -- Skip if role already exists
    if exists (select 1 from public.roles where organization_id = p_org_id and system_key = v_role.value->>'key') then
      continue;
    end if;

    insert into public.roles (organization_id, system_key, name, description, color, home_route, is_system)
    values (
      p_org_id,
      v_role.value->>'key',
      v_role.value->>'name',
      'Rol del flujo operativo',
      v_role.value->>'color',
      v_role.value->>'home',
      false
    )
    returning id into v_role_id;

    -- Assign permissions
    for v_perm in select jsonb_array_elements_text(v_role.value->'perms') loop
      insert into public.role_permissions (role_id, permission_key)
      values (v_role_id, v_perm)
      on conflict do nothing;
    end loop;
  end loop;
end;
$$;

-- -----------------------------------------------
-- seed_default_task_templates: creates the ~15 templates from spec section 5
-- -----------------------------------------------
create or replace function public.seed_default_task_templates(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip if templates already exist for this org
  if exists (select 1 from public.task_templates where organization_id = p_org_id limit 1) then
    return;
  end if;

  -- R1: Revisar nueva reserva
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'front_desk',
    'Revisar nueva reserva {code} · {guest}',
    'Revisar y confirmar todos los datos de la reserva.',
    '[{"text":"Revisar la reserva: nombre, fechas, tipo de habitación, número de personas, tarifa y total"},
      {"text":"Confirmar que el pago o la garantía quedaron aprobados"},
      {"text":"Verificar que el correo y el WhatsApp de confirmación se enviaron"},
      {"text":"Leer las observaciones: ocasión especial, niños, cuna, mascota, accesibilidad, hora de llegada"},
      {"text":"Revisar si es huésped recurrente o VIP y marcarlo en el perfil"},
      {"text":"Revisar que no haya sobreventa en ese tipo de habitación"},
      {"text":"Conseguir el correo o celular real del huésped para enviarle el pre-check-in","conditions":["is_ota_channel"]}]',
    'per_stay', 'created_at', 0, 120, 'high', '["always"]', false, 10);

  -- R2: Pre-check-in y ofertas
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'front_desk',
    'Enviar pre-check-in y ofertas · {guest}',
    'Enviar enlace de pre-check-in con ofertas de upgrade, desayuno y traslado.',
    '[{"text":"Confirmar que se envió el enlace de pre-check-in con las ofertas"}]',
    'per_stay', 'check_in', -5, '10:00', 'normal', '["lead_time_days_gte:3"]', true, 20);

  -- R3: Confirmación 48h
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'front_desk',
    'Confirmación 48 h · {guest}',
    'Confirmar la llegada del huésped y revisar pendientes.',
    '[{"text":"Revisar si el huésped ya hizo el pre-check-in"},
      {"text":"Enviar recordatorio; si no responde, llamar o escribir por WhatsApp"},
      {"text":"Confirmar hora de llegada y si necesita traslado"},
      {"text":"Revisar saldos pendientes y documentos incompletos"}]',
    'per_stay', 'check_in', -2, '10:00', 'normal', '["always"]', true, 30);

  -- R4: Preparar llegada de mañana
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'front_desk',
    'Preparar llegada de mañana · {guest}',
    'Preparar todo para la llegada del huésped.',
    '[{"text":"Pre-asignar la habitación según preferencias"},
      {"text":"Incluir la llegada en el reporte para las áreas operativas"},
      {"text":"Programar el traslado, si lo pidió"}]',
    'per_stay', 'check_in', -1, '16:00', 'normal', '["always"]', false, 40);

  -- R5: Día de llegada
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'front_desk',
    'Día de llegada · {guest}',
    'Coordinar la llegada del huésped el día de hoy.',
    '[{"text":"Revisar con Ama de llaves a qué hora estará lista la habitación"},
      {"text":"Enviar el mensaje de bienvenida con indicaciones de llegada"},
      {"text":"Cuando la habitación esté lista: avisar al huésped"}]',
    'per_stay', 'check_in', 0, '08:00', 'normal', '["always"]', false, 50);

  -- R6: Check-in
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'front_desk',
    'Check-in de {guest} · Hab. {room}',
    'Realizar el check-in del huésped.',
    '[{"text":"Saludar al huésped por su nombre"},
      {"text":"Verificar el documento contra lo cargado en el pre-check-in"},
      {"text":"Confirmar la tarjeta de garantía y los cobros pendientes"},
      {"text":"Entregar la llave y la información clave: wifi, horario de desayuno, contacto por WhatsApp"},
      {"text":"Marcar el check-in en el sistema"},
      {"text":"Reportar al huésped extranjero en SIRE hoy mismo","conditions":["is_foreign_guest"]}]',
    'per_stay', 'check_in', 0, null, 'high', '["always"]', false, 60);

  -- R7: Mensaje de cortesía (guest_arrived workflow)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'guest_arrived', 'front_desk',
    'Mensaje de cortesía · {guest}',
    'Verificar satisfacción del huésped después de instalarse.',
    '[{"text":"Enviar mensaje: ¿Todo bien con tu habitación?"},
      {"text":"Si reporta un problema, crear tarea para Mantenimiento o Ama de llaves"}]',
    'per_stay', 'arrival_confirmed', 0, 45, 'normal', '["always"]', false, 70);

  -- C1: Preparar habitación (room_attendant)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'room_attendant',
    'Preparar Hab. {room} para {guest}',
    'Limpieza y preparación completa de la habitación para la llegada.',
    '[{"text":"Ventilar la habitación"},
      {"text":"Retirar lencería, toallas usadas y basura"},
      {"text":"Revisar objetos olvidados y entregarlos a Ama de llaves"},
      {"text":"Limpiar y desinfectar el baño"},
      {"text":"Tender la cama con lencería limpia y poner toallas nuevas"},
      {"text":"Limpiar superficies, polvo, piso, debajo de la cama y armario"},
      {"text":"Reponer amenities: jabón, champú, papel higiénico, vasos, agua, café/té"},
      {"text":"Revisar y reponer el minibar"},
      {"text":"Revisar funcionamiento: luces, TV, aire, agua caliente, caja fuerte, wifi"},
      {"text":"Reportar fallas a Mantenimiento y Ama de llaves"},
      {"text":"Colocar lo pedido por el huésped: cuna, cama extra, almohadas, detalle"},
      {"text":"Marcar la habitación como limpia en el sistema"}]',
    'per_stay', 'check_in', 0, '13:00', 'high', '["always"]', false, 80);

  -- B1: Recibir huésped (bell_security)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'bell_security',
    'Recibir a {guest} · Hab. {room}',
    'Recibir al huésped en su llegada.',
    '[{"text":"Conocer la hora estimada de llegada"},
      {"text":"Recibir al huésped y ayudar con el equipaje y el parqueadero"},
      {"text":"Coordinar con el conductor, si hay traslado programado"}]',
    'per_stay', 'check_in', 0, null, 'normal', '["always"]', false, 90);

  -- A1: Ama de llaves daily digest
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'housekeeping_supervisor',
    'Plan de limpieza · llegadas del {date}',
    'Asignar camareras, coordinar pedidos especiales, inspeccionar habitaciones.',
    '[]',
    'daily_digest', 'check_in', -1, '16:00', 'high', '["always"]', false, 100);

  -- M1: Mantenimiento daily digest
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'maintenance',
    'Revisión de habitaciones · llegadas del {date}',
    'Atender primero las habitaciones de las llegadas del día. Arreglar fallas reportadas por limpieza.',
    '[]',
    'daily_digest', 'check_in', 0, '09:00', 'normal', '["always"]', false, 110);

  -- K1: Cocina daily digest
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'kitchen',
    'Llegadas del {date}: desayunos, dietas y detalles',
    'Número de desayunos, dietas especiales, alergias y detalles de ocasión especial.',
    '[]',
    'daily_digest', 'check_in', -1, '15:00', 'normal', '["always"]', false, 120);

  -- N1: Auditor nocturno daily digest
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order)
  values (p_org_id, 'stay_created', 'night_auditor',
    'Cierre nocturno del {date}',
    'Cuadre de cierre del día.',
    '[{"text":"Cuadrar pagos y garantías del día"},
      {"text":"Verificar que todos los check-ins quedaron registrados"},
      {"text":"Verificar que los reportes TRA y SIRE se enviaron sin errores"},
      {"text":"Revisar las llegadas del día siguiente y anotar pendientes"}]',
    'daily_digest', 'check_in', 0, '23:00', 'normal', '["always"]', false, 130);
end;
$$;

-- -----------------------------------------------
-- Update seed_organization_defaults to call workflow functions
-- -----------------------------------------------
create or replace function public.seed_organization_defaults(p_org_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_gestor_role_id uuid;
begin
  -- System role: Gestor
  insert into public.roles (organization_id, name, description, color, is_system, home_route, system_key)
  values (p_org_id, 'Gestor', 'Administrador con todos los permisos', '#4f46e5', true, '/dashboard', 'manager')
  returning id into v_gestor_role_id;

  insert into public.role_permissions (role_id, permission_key)
  select v_gestor_role_id, key from public.permissions;

  -- Default catalogs (same as before, abbreviated for readability)
  -- Task statuses
  insert into public.task_statuses (organization_id, name, color, sort_order, type, is_system) values
    (p_org_id, 'Por hacer',    '#6b7280', 0, 'open',        true),
    (p_org_id, 'En progreso',  '#3b82f6', 1, 'in_progress', true),
    (p_org_id, 'En revisión',  '#f59e0b', 2, 'in_progress', true),
    (p_org_id, 'Completada',   '#22c55e', 3, 'done',        true),
    (p_org_id, 'Cancelada',    '#ef4444', 4, 'cancelled',   true);

  -- Room statuses
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

  insert into public.booking_channels (organization_id, name, sort_order, is_system, is_ota) values
    (p_org_id, 'Directo',  0, true, false),
    (p_org_id, 'Walk-in',  1, true, false),
    (p_org_id, 'Booking',  2, false, true),
    (p_org_id, 'Expedia',  3, false, true),
    (p_org_id, 'Airbnb',   4, false, true),
    (p_org_id, 'Agencia',  5, false, false);

  insert into public.travel_reasons (organization_id, name, sort_order) values
    (p_org_id, 'Turismo', 0), (p_org_id, 'Negocios', 1), (p_org_id, 'Educación', 2),
    (p_org_id, 'Salud', 3), (p_org_id, 'Eventos', 4), (p_org_id, 'Otro', 5);

  insert into public.payment_methods (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Efectivo', 0, true), (p_org_id, 'Tarjeta débito', 1, true),
    (p_org_id, 'Tarjeta crédito', 2, true), (p_org_id, 'Transferencia', 3, true),
    (p_org_id, 'Nequi', 4, false), (p_org_id, 'Daviplata', 5, false);

  insert into public.revenue_centers (organization_id, name, sort_order, is_system) values
    (p_org_id, 'Habitaciones', 0, true), (p_org_id, 'Alimentos y Bebidas', 1, true),
    (p_org_id, 'Lavandería', 2, false), (p_org_id, 'Spa', 3, false),
    (p_org_id, 'Parqueadero', 4, false), (p_org_id, 'Minibar', 5, false),
    (p_org_id, 'Otros', 6, false);

  insert into public.expense_categories (organization_id, name, category_group, sort_order, is_system) values
    (p_org_id, 'Costo de habitaciones', 'departmental', 0, true),
    (p_org_id, 'Costo de A&B', 'departmental', 1, true),
    (p_org_id, 'Lavandería', 'departmental', 2, false),
    (p_org_id, 'Amenities', 'departmental', 3, false),
    (p_org_id, 'Administración', 'undistributed', 10, true),
    (p_org_id, 'Ventas y marketing', 'undistributed', 11, false),
    (p_org_id, 'Mantenimiento', 'undistributed', 12, false),
    (p_org_id, 'Servicios públicos', 'undistributed', 13, true),
    (p_org_id, 'Tecnología', 'undistributed', 14, false),
    (p_org_id, 'Comisiones OTAs', 'undistributed', 15, false),
    (p_org_id, 'Arriendo', 'fixed', 20, false),
    (p_org_id, 'Seguros', 'fixed', 21, false),
    (p_org_id, 'Impuestos propiedad', 'fixed', 22, false),
    (p_org_id, 'Intereses', 'fixed', 23, false),
    (p_org_id, 'Depreciación', 'fixed', 24, false),
    (p_org_id, 'Nómina', 'payroll', 30, true);

  insert into public.shift_templates (organization_id, name, start_time, end_time) values
    (p_org_id, 'Mañana', '06:00', '14:00'),
    (p_org_id, 'Tarde', '14:00', '22:00'),
    (p_org_id, 'Noche', '22:00', '06:00');

  -- Workflow roles and templates
  perform public.ensure_workflow_roles(p_org_id);
  perform public.seed_default_task_templates(p_org_id);
end;
$$;

-- -----------------------------------------------
-- generate_stay_tasks: core workflow engine
-- -----------------------------------------------
create or replace function public.generate_stay_tasks(p_stay_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stay record;
  v_org record;
  v_tpl record;
  v_role_id uuid;
  v_status_id uuid;
  v_due_at timestamptz;
  v_anchor_dt timestamptz;
  v_title text;
  v_task_id uuid;
  v_digest_date date;
  v_digest_task_id uuid;
  v_subtask_title text;
  v_subtask record;
  v_guest record;
  v_room record;
  v_channel record;
  v_count int := 0;
  v_condition text;
  v_condition_met boolean;
  v_checkin_time time;
  v_assignee_id uuid;
begin
  -- Load stay with relations
  select s.*, o.timezone, o.country_code,
    o.default_check_in_time, o.default_check_out_time
  into v_stay
  from public.stays s
  join public.organizations o on o.id = s.organization_id
  where s.id = p_stay_id;

  if v_stay is null then return 0; end if;

  -- Check if workflow is enabled (future: organizations.stay_workflow_enabled)
  -- For now, always enabled

  -- Load guest
  select * into v_guest from public.guests where id = v_stay.primary_guest_id;

  -- Load room
  select r.*, rt.name as type_name
  into v_room
  from public.rooms r
  left join public.room_types rt on rt.id = r.room_type_id
  where r.id = v_stay.room_id;

  -- Load channel
  select * into v_channel from public.booking_channels where id = v_stay.channel_id;

  -- Ensure workflow roles exist
  perform public.ensure_workflow_roles(v_stay.organization_id);

  -- Get default "open" task status
  select id into v_status_id
  from public.task_statuses
  where organization_id = v_stay.organization_id and type = 'open'
  order by sort_order limit 1;

  v_checkin_time := v_stay.default_check_in_time;

  -- Process each active template for 'stay_created' workflow
  for v_tpl in
    select * from public.task_templates
    where organization_id = v_stay.organization_id
      and workflow = 'stay_created'
      and is_active = true
    order by sort_order
  loop
    -- Evaluate conditions
    v_condition_met := true;
    for v_condition in select jsonb_array_elements_text(v_tpl.conditions) loop
      case
        when v_condition = 'always' then null; -- always true
        when v_condition = 'is_ota_channel' then
          v_condition_met := v_condition_met and coalesce(v_channel.is_ota, false);
        when v_condition = 'is_foreign_guest' then
          v_condition_met := v_condition_met and (
            v_guest.nationality is not null
            and v_guest.nationality != ''
            and lower(v_guest.nationality) != lower(v_stay.country_code)
          );
        when v_condition = 'has_children' then
          v_condition_met := v_condition_met and v_stay.children > 0;
        when v_condition = 'has_notes' then
          v_condition_met := v_condition_met and v_stay.notes is not null and v_stay.notes != '';
        when v_condition like 'lead_time_days_gte:%' then
          v_condition_met := v_condition_met and (
            v_stay.check_in_date - current_date >= split_part(v_condition, ':', 2)::int
          );
        else null;
      end case;
    end loop;

    if not v_condition_met then continue; end if;

    -- Calculate anchor datetime
    case v_tpl.anchor
      when 'created_at' then
        v_anchor_dt := v_stay.created_at;
      when 'check_in' then
        v_anchor_dt := (v_stay.check_in_date::timestamp + coalesce(v_checkin_time, '15:00'::time))
          at time zone v_stay.timezone;
      when 'check_out' then
        v_anchor_dt := (v_stay.check_out_date::timestamp + coalesce(v_stay.default_check_out_time, '12:00'::time))
          at time zone v_stay.timezone;
      else
        v_anchor_dt := now();
    end case;

    -- Calculate due_at
    if v_tpl.at_time is not null then
      v_due_at := ((v_stay.check_in_date + v_tpl.offset_days)::timestamp + v_tpl.at_time)
        at time zone v_stay.timezone;
    else
      v_due_at := v_anchor_dt + (v_tpl.offset_days || ' days')::interval
        + (v_tpl.offset_minutes || ' minutes')::interval;
    end if;

    -- Skip if past and skip_if_past = true
    if v_tpl.skip_if_past and v_due_at < now() then
      continue;
    end if;

    -- If past and not skipping, set to now + 1 hour
    if v_due_at < now() then
      v_due_at := now() + interval '1 hour';
    end if;

    -- Resolve role
    select id into v_role_id
    from public.roles
    where organization_id = v_stay.organization_id
      and system_key = v_tpl.role_system_key;

    -- Build title with placeholders
    v_title := v_tpl.title_template;
    v_title := replace(v_title, '{guest}', coalesce(v_guest.first_name || ' ' || v_guest.last_name, ''));
    v_title := replace(v_title, '{room}', coalesce(v_room.number, ''));
    v_title := replace(v_title, '{code}', coalesce(v_stay.code, ''));
    v_title := replace(v_title, '{room_type}', coalesce(v_room.type_name, ''));

    if v_tpl.scope = 'per_stay' then
      -- Per-stay task: one task per stay per template (idempotent via unique index)
      insert into public.tasks (
        organization_id, title, description, status_id, priority,
        created_by, due_date, room_id, assigned_role_id,
        source, stay_id, template_id, sort_order
      )
      values (
        v_stay.organization_id, v_title, v_tpl.description, v_status_id,
        v_tpl.priority::task_priority, v_stay.created_by,
        v_due_at::date, v_stay.room_id, v_role_id,
        'stay_workflow', v_stay.id, v_tpl.id, v_tpl.sort_order
      )
      on conflict (stay_id, template_id) where stay_id is not null and template_id is not null and source = 'stay_workflow' and digest_date is null
      do nothing
      returning id into v_task_id;

      if v_task_id is null then continue; end if; -- already existed

      -- Create subtasks
      for v_subtask in select * from jsonb_array_elements(v_tpl.subtasks) loop
        -- Check subtask conditions
        v_condition_met := true;
        if v_subtask.value ? 'conditions' then
          for v_condition in select jsonb_array_elements_text(v_subtask.value->'conditions') loop
            case
              when v_condition = 'is_ota_channel' then
                v_condition_met := v_condition_met and coalesce(v_channel.is_ota, false);
              when v_condition = 'is_foreign_guest' then
                v_condition_met := v_condition_met and (
                  v_guest.nationality is not null and lower(v_guest.nationality) != lower(v_stay.country_code)
                );
              else null;
            end case;
          end loop;
        end if;

        if v_condition_met then
          insert into public.tasks (
            organization_id, parent_task_id, title, status_id, priority,
            created_by, due_date, assigned_role_id, source, stay_id, sort_order
          )
          values (
            v_stay.organization_id, v_task_id,
            v_subtask.value->>'text', v_status_id,
            'normal'::task_priority, v_stay.created_by,
            v_due_at::date, v_role_id, 'stay_workflow', v_stay.id, 0
          );
        end if;
      end loop;

      -- Assign to person
      perform public.assign_task_to_best_person(v_task_id, v_role_id, v_due_at);

      v_count := v_count + 1;

    elsif v_tpl.scope = 'daily_digest' then
      -- Daily digest: one task per day per template per org
      v_digest_date := (v_stay.check_in_date + v_tpl.offset_days)::date;
      v_title := replace(v_tpl.title_template, '{date}', to_char(v_digest_date, 'DD/MM/YYYY'));

      -- Get or create digest task
      select id into v_digest_task_id
      from public.tasks
      where organization_id = v_stay.organization_id
        and template_id = v_tpl.id
        and digest_date = v_digest_date
        and source = 'stay_workflow'
      limit 1;

      if v_digest_task_id is null then
        insert into public.tasks (
          organization_id, title, description, status_id, priority,
          created_by, due_date, assigned_role_id,
          source, template_id, digest_date, sort_order
        )
        values (
          v_stay.organization_id, v_title, v_tpl.description, v_status_id,
          v_tpl.priority::task_priority, v_stay.created_by,
          v_due_at::date, v_role_id,
          'stay_workflow', v_tpl.id, v_digest_date, v_tpl.sort_order
        )
        returning id into v_digest_task_id;

        -- Create fixed subtasks from template
        for v_subtask in select * from jsonb_array_elements(v_tpl.subtasks) loop
          insert into public.tasks (
            organization_id, parent_task_id, title, status_id, priority,
            created_by, due_date, assigned_role_id, source, sort_order
          )
          values (
            v_stay.organization_id, v_digest_task_id,
            v_subtask.value->>'text', v_status_id,
            'normal'::task_priority, v_stay.created_by,
            v_due_at::date, v_role_id, 'stay_workflow', 0
          );
        end loop;

        -- Assign to person
        perform public.assign_task_to_best_person(v_digest_task_id, v_role_id, v_due_at);

        v_count := v_count + 1;
      end if;

      -- Add subtask for this specific stay
      v_subtask_title := 'Hab. ' || coalesce(v_room.number, '?')
        || ' · ' || coalesce(v_guest.first_name || ' ' || v_guest.last_name, '?')
        || ' · ' || v_stay.adults || ' adulto' || case when v_stay.adults != 1 then 's' else '' end
        || case when v_stay.children > 0 then ' + ' || v_stay.children || ' niño' || case when v_stay.children != 1 then 's' else '' end else '' end;

      if v_stay.notes is not null and v_stay.notes != '' then
        v_subtask_title := v_subtask_title || ' · Nota: ' || left(v_stay.notes, 60);
      end if;

      -- Check if subtask for this stay already exists (idempotent)
      if not exists (
        select 1 from public.tasks
        where parent_task_id = v_digest_task_id and stay_id = v_stay.id
      ) then
        insert into public.tasks (
          organization_id, parent_task_id, title, status_id, priority,
          created_by, due_date, assigned_role_id, source, stay_id, room_id, sort_order
        )
        values (
          v_stay.organization_id, v_digest_task_id,
          v_subtask_title, v_status_id,
          'normal'::task_priority, v_stay.created_by,
          v_due_at::date, v_role_id, 'stay_workflow', v_stay.id, v_stay.room_id, 0
        );
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------
-- assign_task_to_best_person: load-balanced assignment
-- -----------------------------------------------
create or replace function public.assign_task_to_best_person(
  p_task_id uuid,
  p_role_id uuid,
  p_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignee_id uuid;
  v_org_id uuid;
  v_due_date date;
begin
  if p_role_id is null then return null; end if;

  select organization_id into v_org_id from public.tasks where id = p_task_id;
  v_due_date := p_due_at::date;

  -- Find best candidate: active, has the role, not on time_off, has shift covering due time
  -- Tie-break by fewest open tasks that day
  select p.id into v_assignee_id
  from public.profiles p
  where p.organization_id = v_org_id
    and p.role_id = p_role_id
    and p.is_active = true
    -- Not on time off
    and not exists (
      select 1 from public.time_off t
      where t.profile_id = p.id
        and v_due_date between t.start_date and t.end_date
    )
  order by
    -- Prefer those with shift covering the time
    (exists (
      select 1 from public.work_schedules ws
      where ws.profile_id = p.id
        and ws.weekday = extract(isodow from v_due_date)::int - 1
        and not ws.is_day_off
    )) desc,
    -- Fewest open tasks that day
    (select count(*) from public.task_assignees ta
      join public.tasks t on t.id = ta.task_id
      where ta.profile_id = p.id
        and t.due_date = v_due_date
        and t.archived_at is null
        and exists (select 1 from public.task_statuses ts where ts.id = t.status_id and ts.type in ('open','in_progress'))
    ) asc,
    random()
  limit 1;

  if v_assignee_id is not null then
    insert into public.task_assignees (task_id, profile_id)
    values (p_task_id, v_assignee_id)
    on conflict (task_id, profile_id) do nothing;
  end if;

  return v_assignee_id;
end;
$$;

-- -----------------------------------------------
-- reassign_workflow_tasks_for_role: when a user gets/loses a role
-- -----------------------------------------------
create or replace function public.reassign_workflow_tasks_for_role(
  p_org_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
begin
  -- Find all open workflow tasks for this role with no person assigned
  for v_task in
    select t.id, t.due_date
    from public.tasks t
    where t.organization_id = p_org_id
      and t.assigned_role_id = p_role_id
      and t.source = 'stay_workflow'
      and t.parent_task_id is null
      and t.archived_at is null
      and not exists (select 1 from public.task_assignees ta where ta.task_id = t.id)
      and exists (select 1 from public.task_statuses ts where ts.id = t.status_id and ts.type in ('open','in_progress'))
  loop
    perform public.assign_task_to_best_person(v_task.id, p_role_id, v_task.due_date::timestamptz);
  end loop;
end;
$$;

-- -----------------------------------------------
-- on_stay_cancelled_fn: cancel workflow tasks
-- -----------------------------------------------
create or replace function public.on_stay_cancelled_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled_status_id uuid;
  v_digest record;
begin
  -- Get cancelled status
  select id into v_cancelled_status_id
  from public.task_statuses
  where organization_id = new.organization_id and type = 'cancelled'
  order by sort_order limit 1;

  if v_cancelled_status_id is null then return new; end if;

  -- Cancel per-stay tasks
  update public.tasks
  set status_id = v_cancelled_status_id, archived_at = now()
  where stay_id = new.id
    and source = 'stay_workflow'
    and digest_date is null
    and exists (select 1 from public.task_statuses ts where ts.id = status_id and ts.type in ('open','in_progress'));

  -- Remove subtasks from digests
  delete from public.tasks
  where stay_id = new.id
    and source = 'stay_workflow'
    and parent_task_id is not null
    and digest_date is null;

  -- Cancel empty digests
  for v_digest in
    select t.id from public.tasks t
    where t.organization_id = new.organization_id
      and t.source = 'stay_workflow'
      and t.digest_date is not null
      and t.parent_task_id is null
      and exists (select 1 from public.task_statuses ts where ts.id = t.status_id and ts.type in ('open','in_progress'))
      and not exists (select 1 from public.tasks sub where sub.parent_task_id = t.id)
  loop
    update public.tasks
    set status_id = v_cancelled_status_id, archived_at = now()
    where id = v_digest.id;
  end loop;

  return new;
end;
$$;

-- -----------------------------------------------
-- on_stay_dates_changed_fn: recalculate due dates
-- -----------------------------------------------
create or replace function public.on_stay_dates_changed_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_tpl record;
  v_new_due timestamptz;
  v_org record;
begin
  select o.timezone, o.default_check_in_time, o.default_check_out_time
  into v_org
  from public.organizations o where o.id = new.organization_id;

  for v_task in
    select t.*, ts.type as status_type
    from public.tasks t
    join public.task_statuses ts on ts.id = t.status_id
    where t.stay_id = new.id
      and t.source = 'stay_workflow'
      and t.template_id is not null
      and ts.type in ('open','in_progress')
  loop
    select * into v_tpl from public.task_templates where id = v_task.template_id;
    if v_tpl is null then continue; end if;

    -- Recalculate due_at
    if v_tpl.at_time is not null then
      v_new_due := ((new.check_in_date + v_tpl.offset_days)::timestamp + v_tpl.at_time)
        at time zone v_org.timezone;
    else
      case v_tpl.anchor
        when 'check_in' then
          v_new_due := ((new.check_in_date::timestamp + coalesce(v_org.default_check_in_time, '15:00'::time))
            at time zone v_org.timezone)
            + (v_tpl.offset_days || ' days')::interval
            + (v_tpl.offset_minutes || ' minutes')::interval;
        when 'check_out' then
          v_new_due := ((new.check_out_date::timestamp + coalesce(v_org.default_check_out_time, '12:00'::time))
            at time zone v_org.timezone)
            + (v_tpl.offset_days || ' days')::interval
            + (v_tpl.offset_minutes || ' minutes')::interval;
        else
          continue; -- created_at doesn't change
      end case;
    end if;

    update public.tasks
    set due_date = v_new_due::date
    where id = v_task.id;

    -- Update subtasks too
    update public.tasks
    set due_date = v_new_due::date
    where parent_task_id = v_task.id;
  end loop;

  -- Update room_id in tasks if room changed
  if old.room_id is distinct from new.room_id then
    update public.tasks
    set room_id = new.room_id
    where stay_id = new.id
      and source = 'stay_workflow';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------
-- confirm_guest_arrival: RPC
-- -----------------------------------------------
create or replace function public.confirm_guest_arrival(
  p_stay_id uuid,
  p_document_verified boolean default false,
  p_payment_confirmed boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stay record;
  v_occupied_status_id uuid;
  v_done_status_id uuid;
  v_task_count int;
  v_room_number text;
begin
  -- Load stay
  select s.*, r.number as room_number
  into v_stay
  from public.stays s
  left join public.rooms r on r.id = s.room_id
  where s.id = p_stay_id;

  if v_stay is null then
    raise exception 'Estancia no encontrada';
  end if;

  -- Idempotent: if already checked in, return success
  if v_stay.status = 'checked_in' then
    return json_build_object('success', true, 'already_confirmed', true, 'room_number', v_stay.room_number);
  end if;

  if v_stay.status != 'reserved' then
    raise exception 'Solo se puede confirmar la llegada de una reserva activa (estado actual: %)', v_stay.status;
  end if;

  -- Update stay
  update public.stays
  set status = 'checked_in', actual_check_in_at = now()
  where id = p_stay_id;

  -- Room → Occupied
  select id into v_occupied_status_id
  from public.room_statuses
  where organization_id = v_stay.organization_id
    and counts_as_available = false
    and counts_as_out_of_order = false
  order by sort_order limit 1;

  if v_occupied_status_id is not null then
    update public.rooms
    set status_id = v_occupied_status_id
    where id = v_stay.room_id;
  end if;

  -- Mark check-in subtasks as done in R6
  select id into v_done_status_id
  from public.task_statuses
  where organization_id = v_stay.organization_id and type = 'done'
  order by sort_order limit 1;

  if v_done_status_id is not null then
    -- Mark "Marcar el check-in en el sistema" subtask as done
    update public.tasks
    set status_id = v_done_status_id
    where stay_id = p_stay_id
      and source = 'stay_workflow'
      and parent_task_id is not null
      and title like '%check-in en el sistema%'
      and exists (select 1 from public.task_statuses ts where ts.id = status_id and ts.type != 'done');

    -- Mark document verification subtask if verified
    if p_document_verified then
      update public.tasks
      set status_id = v_done_status_id
      where stay_id = p_stay_id
        and source = 'stay_workflow'
        and parent_task_id is not null
        and title like '%Verificar el documento%'
        and exists (select 1 from public.task_statuses ts where ts.id = status_id and ts.type != 'done');
    end if;

    -- Check if all subtasks of R6 are done → complete parent
    update public.tasks parent_task
    set status_id = v_done_status_id
    where parent_task.stay_id = p_stay_id
      and parent_task.source = 'stay_workflow'
      and parent_task.parent_task_id is null
      and parent_task.title like '%Check-in de%'
      and not exists (
        select 1 from public.tasks sub
        join public.task_statuses sts on sts.id = sub.status_id
        where sub.parent_task_id = parent_task.id
          and sts.type != 'done'
      );
  end if;

  -- Generate guest_arrived workflow tasks
  v_task_count := public.generate_arrived_tasks(p_stay_id);

  return json_build_object(
    'success', true,
    'room_number', v_stay.room_number,
    'tasks_generated', v_task_count
  );
end;
$$;

-- -----------------------------------------------
-- generate_arrived_tasks: separate from generate_stay_tasks
-- -----------------------------------------------
create or replace function public.generate_arrived_tasks(p_stay_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stay record;
  v_guest record;
  v_room record;
  v_tpl record;
  v_role_id uuid;
  v_status_id uuid;
  v_title text;
  v_task_id uuid;
  v_due_at timestamptz;
  v_count int := 0;
  v_subtask record;
begin
  select s.*, o.timezone into v_stay
  from public.stays s join public.organizations o on o.id = s.organization_id
  where s.id = p_stay_id;

  select * into v_guest from public.guests where id = v_stay.primary_guest_id;
  select r.*, rt.name as type_name into v_room
  from public.rooms r left join public.room_types rt on rt.id = r.room_type_id
  where r.id = v_stay.room_id;

  select id into v_status_id
  from public.task_statuses
  where organization_id = v_stay.organization_id and type = 'open'
  order by sort_order limit 1;

  for v_tpl in
    select * from public.task_templates
    where organization_id = v_stay.organization_id
      and workflow = 'guest_arrived' and is_active = true
    order by sort_order
  loop
    select id into v_role_id from public.roles
    where organization_id = v_stay.organization_id and system_key = v_tpl.role_system_key;

    v_due_at := now() + (v_tpl.offset_minutes || ' minutes')::interval;

    v_title := v_tpl.title_template;
    v_title := replace(v_title, '{guest}', coalesce(v_guest.first_name || ' ' || v_guest.last_name, ''));
    v_title := replace(v_title, '{room}', coalesce(v_room.number, ''));
    v_title := replace(v_title, '{code}', coalesce(v_stay.code, ''));

    insert into public.tasks (
      organization_id, title, description, status_id, priority,
      created_by, due_date, room_id, assigned_role_id,
      source, stay_id, template_id, sort_order
    ) values (
      v_stay.organization_id, v_title, v_tpl.description, v_status_id,
      v_tpl.priority::task_priority, v_stay.created_by,
      v_due_at::date, v_stay.room_id, v_role_id,
      'stay_workflow', v_stay.id, v_tpl.id, v_tpl.sort_order
    )
    on conflict (stay_id, template_id) where stay_id is not null and template_id is not null and source = 'stay_workflow' and digest_date is null
    do nothing
    returning id into v_task_id;

    if v_task_id is null then continue; end if;

    for v_subtask in select * from jsonb_array_elements(v_tpl.subtasks) loop
      insert into public.tasks (
        organization_id, parent_task_id, title, status_id, priority,
        created_by, due_date, assigned_role_id, source, stay_id, sort_order
      ) values (
        v_stay.organization_id, v_task_id,
        v_subtask.value->>'text', v_status_id,
        'normal'::task_priority, v_stay.created_by,
        v_due_at::date, v_role_id, 'stay_workflow', v_stay.id, 0
      );
    end loop;

    perform public.assign_task_to_best_person(v_task_id, v_role_id, v_due_at);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Grant execute to authenticated
grant execute on function public.ensure_workflow_roles(uuid) to authenticated;
grant execute on function public.seed_default_task_templates(uuid) to authenticated;
grant execute on function public.generate_stay_tasks(uuid) to authenticated;
grant execute on function public.assign_task_to_best_person(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.reassign_workflow_tasks_for_role(uuid, uuid) to authenticated;
grant execute on function public.confirm_guest_arrival(uuid, boolean, boolean) to authenticated;
grant execute on function public.generate_arrived_tasks(uuid) to authenticated;
