-- =============================================================
-- POSTY — Phase 1: Guest journey infrastructure
-- stay_status_history, phase field, new roles, updated views
-- =============================================================

-- -----------------------------------------------
-- 1. phase field on task_templates and tasks
-- -----------------------------------------------
alter table public.task_templates
  add column if not exists phase smallint check (phase between 1 and 7);

comment on column public.task_templates.phase is
  '1=Reserva, 2=Confirmación, 3=Pre-llegada, 4=Llegada, 5=Estadía, 6=Salida, 7=Post-estadía';

alter table public.tasks
  add column if not exists phase smallint check (phase between 1 and 7);

-- Backfill existing templates with correct phases
update public.task_templates set phase = 1 where title_template like 'Revisar nueva reserva%';
update public.task_templates set phase = 2 where title_template like 'Enviar pre-check-in%';
update public.task_templates set phase = 3 where title_template like 'Confirmación 48%';
update public.task_templates set phase = 3 where title_template like 'Preparar llegada de mañana%';
update public.task_templates set phase = 3 where title_template like 'Plan de limpieza%';
update public.task_templates set phase = 3 where title_template like 'Revisión de habitaciones%';
update public.task_templates set phase = 3 where title_template like 'Llegadas del%';
update public.task_templates set phase = 4 where title_template like 'Día de llegada%';
update public.task_templates set phase = 4 where title_template like 'Check-in de%';
update public.task_templates set phase = 4 where title_template like 'Preparar Hab.%';
update public.task_templates set phase = 4 where title_template like 'Recibir a%';
update public.task_templates set phase = 5 where title_template like 'Mensaje de cortesía%';
update public.task_templates set phase = 5 where title_template like 'Cierre nocturno%';

-- Backfill existing tasks from their template's phase
update public.tasks t
set phase = tt.phase
from public.task_templates tt
where t.template_id = tt.id
  and t.phase is null
  and tt.phase is not null;

-- -----------------------------------------------
-- 2. Auto-populate phase from template on task INSERT
-- -----------------------------------------------
create or replace function public.trg_task_phase_from_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.template_id is not null and new.phase is null then
    select phase into new.phase
    from public.task_templates
    where id = new.template_id;
  end if;
  return new;
end;
$$;

create trigger set_task_phase_from_template
  before insert on public.tasks
  for each row
  when (new.template_id is not null and new.phase is null)
  execute function public.trg_task_phase_from_template();

-- -----------------------------------------------
-- 3. stay_status_history
-- -----------------------------------------------
create table public.stay_status_history (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  old_status stay_status,
  new_status stay_status not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now(),
  note text
);

create index idx_stay_status_history_stay on public.stay_status_history(stay_id);
create index idx_stay_status_history_org on public.stay_status_history(organization_id);

alter table public.stay_status_history enable row level security;

create policy "Users can view status history of own org"
  on public.stay_status_history for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage status history"
  on public.stay_status_history for all
  using (organization_id = public.current_org_id());

-- Trigger: log status changes on UPDATE
create or replace function public.trg_stay_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.stay_status_history (stay_id, organization_id, old_status, new_status, changed_by)
    values (new.id, new.organization_id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger on_stay_status_changed
  after update on public.stays
  for each row
  when (old.status is distinct from new.status)
  execute function public.trg_stay_status_history();

-- Trigger: log initial status on INSERT
create or replace function public.trg_stay_status_history_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stay_status_history (stay_id, organization_id, old_status, new_status, changed_by)
  values (new.id, new.organization_id, null, new.status, auth.uid());
  return new;
end;
$$;

create trigger on_stay_created_history
  after insert on public.stays
  for each row
  execute function public.trg_stay_status_history_insert();

-- Backfill history for existing stays
insert into public.stay_status_history (stay_id, organization_id, old_status, new_status, changed_by, changed_at)
select s.id, s.organization_id, null, s.status, s.created_by, s.created_at
from public.stays s
where not exists (
  select 1 from public.stay_status_history h where h.stay_id = s.id
);

-- -----------------------------------------------
-- 4. New workflow roles
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
     "perms":["tasks.view.own","tasks.edit.own","stays.view","finance.view","dashboard.view"]},
    {"key":"reservations","name":"Reservas","color":"#2563eb","home":"/hotel",
     "perms":["tasks.view.own","tasks.edit.own","stays.view","stays.create","stays.edit","guests.view","guests.create","guests.edit","rooms.view","dashboard.view"]},
    {"key":"front_desk_manager","name":"Jefe de Recepción","color":"#1d4ed8","home":"/hotel",
     "perms":["tasks.view.own","tasks.edit.own","tasks.create","stays.view","stays.create","stays.edit","guests.view","guests.create","guests.edit","rooms.view","rooms.edit","dashboard.view"]},
    {"key":"marketing","name":"Mercadeo","color":"#db2777","home":"/dashboard",
     "perms":["stays.view","guests.view","dashboard.view","tasks.view.own","tasks.edit.own"]},
    {"key":"it_systems","name":"Sistemas / TI","color":"#6366f1","home":"/configuracion",
     "perms":["dashboard.view","tasks.view.own","tasks.edit.own"]}
  ]';
begin
  for v_role in select * from jsonb_array_elements(v_role_defs) loop
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

    for v_perm in select jsonb_array_elements_text(v_role.value->'perms') loop
      insert into public.role_permissions (role_id, permission_key)
      values (v_role_id, v_perm)
      on conflict do nothing;
    end loop;
  end loop;
end;
$$;

-- Create new roles for all existing organizations
do $$
declare v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.ensure_workflow_roles(v_org.id);
  end loop;
end;
$$;

-- -----------------------------------------------
-- 5. Update seed_default_task_templates with phase
-- -----------------------------------------------
create or replace function public.seed_default_task_templates(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.task_templates where organization_id = p_org_id limit 1) then
    return;
  end if;

  -- R1: Revisar nueva reserva (phase 1 = Reserva)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order, phase)
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
    'per_stay', 'created_at', 0, 120, 'high', '["always"]', false, 10, 1);

  -- R2: Pre-check-in y ofertas (phase 2 = Confirmación)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'front_desk',
    'Enviar pre-check-in y ofertas · {guest}',
    'Enviar enlace de pre-check-in con ofertas de upgrade, desayuno y traslado.',
    '[{"text":"Confirmar que se envió el enlace de pre-check-in con las ofertas"}]',
    'per_stay', 'check_in', -5, '10:00', 'normal', '["lead_time_days_gte:3"]', true, 20, 2);

  -- R3: Confirmación 48h (phase 3 = Pre-llegada)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'front_desk',
    'Confirmación 48 h · {guest}',
    'Confirmar la llegada del huésped y revisar pendientes.',
    '[{"text":"Revisar si el huésped ya hizo el pre-check-in"},
      {"text":"Enviar recordatorio; si no responde, llamar o escribir por WhatsApp"},
      {"text":"Confirmar hora de llegada y si necesita traslado"},
      {"text":"Revisar saldos pendientes y documentos incompletos"}]',
    'per_stay', 'check_in', -2, '10:00', 'normal', '["always"]', true, 30, 3);

  -- R4: Preparar llegada de mañana (phase 3)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'front_desk',
    'Preparar llegada de mañana · {guest}',
    'Preparar todo para la llegada del huésped.',
    '[{"text":"Pre-asignar la habitación según preferencias"},
      {"text":"Incluir la llegada en el reporte para las áreas operativas"},
      {"text":"Programar el traslado, si lo pidió"}]',
    'per_stay', 'check_in', -1, '16:00', 'normal', '["always"]', false, 40, 3);

  -- R5: Día de llegada (phase 4 = Llegada)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'front_desk',
    'Día de llegada · {guest}',
    'Coordinar la llegada del huésped el día de hoy.',
    '[{"text":"Revisar con Ama de llaves a qué hora estará lista la habitación"},
      {"text":"Enviar el mensaje de bienvenida con indicaciones de llegada"},
      {"text":"Cuando la habitación esté lista: avisar al huésped"}]',
    'per_stay', 'check_in', 0, '08:00', 'normal', '["always"]', false, 50, 4);

  -- R6: Check-in (phase 4)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'front_desk',
    'Check-in de {guest} · Hab. {room}',
    'Realizar el check-in del huésped.',
    '[{"text":"Saludar al huésped por su nombre"},
      {"text":"Verificar el documento contra lo cargado en el pre-check-in"},
      {"text":"Confirmar la tarjeta de garantía y los cobros pendientes"},
      {"text":"Entregar la llave y la información clave: wifi, horario de desayuno, contacto por WhatsApp"},
      {"text":"Marcar el check-in en el sistema"},
      {"text":"Reportar al huésped extranjero en SIRE hoy mismo","conditions":["is_foreign_guest"]}]',
    'per_stay', 'check_in', 0, null, 'high', '["always"]', false, 60, 4);

  -- R7: Mensaje de cortesía (phase 5 = Estadía)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'guest_arrived', 'front_desk',
    'Mensaje de cortesía · {guest}',
    'Verificar satisfacción del huésped después de instalarse.',
    '[{"text":"Enviar mensaje: ¿Todo bien con tu habitación?"},
      {"text":"Si reporta un problema, crear tarea para Mantenimiento o Ama de llaves"}]',
    'per_stay', 'arrival_confirmed', 0, 45, 'normal', '["always"]', false, 70, 5);

  -- C1: Preparar habitación (phase 4)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
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
    'per_stay', 'check_in', 0, '13:00', 'high', '["always"]', false, 80, 4);

  -- B1: Recibir huésped (phase 4)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'bell_security',
    'Recibir a {guest} · Hab. {room}',
    'Recibir al huésped en su llegada.',
    '[{"text":"Conocer la hora estimada de llegada"},
      {"text":"Recibir al huésped y ayudar con el equipaje y el parqueadero"},
      {"text":"Coordinar con el conductor, si hay traslado programado"}]',
    'per_stay', 'check_in', 0, null, 'normal', '["always"]', false, 90, 4);

  -- A1: Ama de llaves daily digest (phase 3)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'housekeeping_supervisor',
    'Plan de limpieza · llegadas del {date}',
    'Asignar camareras, coordinar pedidos especiales, inspeccionar habitaciones.',
    '[]',
    'daily_digest', 'check_in', -1, '16:00', 'high', '["always"]', false, 100, 3);

  -- M1: Mantenimiento daily digest (phase 3)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'maintenance',
    'Revisión de habitaciones · llegadas del {date}',
    'Atender primero las habitaciones de las llegadas del día. Arreglar fallas reportadas por limpieza.',
    '[]',
    'daily_digest', 'check_in', 0, '09:00', 'normal', '["always"]', false, 110, 3);

  -- K1: Cocina daily digest (phase 3)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'kitchen',
    'Llegadas del {date}: desayunos, dietas y detalles',
    'Número de desayunos, dietas especiales, alergias y detalles de ocasión especial.',
    '[]',
    'daily_digest', 'check_in', -1, '15:00', 'normal', '["always"]', false, 120, 3);

  -- N1: Auditor nocturno daily digest (phase 5)
  insert into public.task_templates (organization_id, workflow, role_system_key, title_template, description, subtasks, scope, anchor, offset_days, at_time, priority, conditions, skip_if_past, sort_order, phase)
  values (p_org_id, 'stay_created', 'night_auditor',
    'Cierre nocturno del {date}',
    'Cuadre de cierre del día.',
    '[{"text":"Cuadrar pagos y garantías del día"},
      {"text":"Verificar que todos los check-ins quedaron registrados"},
      {"text":"Verificar que los reportes TRA y SIRE se enviaron sin errores"},
      {"text":"Revisar las llegadas del día siguiente y anotar pendientes"}]',
    'daily_digest', 'check_in', 0, '23:00', 'normal', '["always"]', false, 130, 5);
end;
$$;

-- -----------------------------------------------
-- 6. Update views
-- -----------------------------------------------

-- tasks_view: drop and recreate (column order changed due to new tasks columns)
drop view if exists public.tasks_view;
create view public.tasks_view
  with (security_invoker = true)
as
select
  t.*,
  ts.name    as status_name,
  ts.color   as status_color,
  ts.type    as status_type,
  p_creator.full_name as created_by_name,
  rm.number  as room_number,
  rm.floor   as room_floor,
  rl.name    as assigned_role_name,
  rl.system_key as assigned_role_key,
  rl.color   as assigned_role_color
from public.tasks t
left join public.task_statuses ts on ts.id = t.status_id
left join public.profiles p_creator on p_creator.id = t.created_by
left join public.rooms rm on rm.id = t.room_id
left join public.roles rl on rl.id = t.assigned_role_id;

-- stays_view: drop and recreate to add guest_nationality
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
