-- =============================================================
-- POSTY — Seed missing templates for all organizations
-- Idempotent: checks by title_template before inserting
-- =============================================================

-- Seed walk-in/same-day templates for orgs that don't have them
do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    -- R0: Same-day express (only if not exists)
    if not exists (
      select 1 from public.task_templates
      where organization_id = v_org.id
        and title_template = 'Llegada de hoy: preparación exprés · {guest}'
    ) then
      insert into public.task_templates (
        organization_id, workflow, role_system_key, title_template, description, subtasks,
        scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order, phase
      ) values (
        v_org.id, 'stay_created', 'front_desk',
        'Llegada de hoy: preparación exprés · {guest}',
        'Reserva del mismo día — preparar todo rápidamente.',
        '[{"text":"Confirmar la hora estimada de llegada"},
          {"text":"Asignar la habitación según preferencias"},
          {"text":"Avisar a Ama de llaves, Cocina y Mantenimiento de la llegada de hoy"},
          {"text":"Programar el traslado, si lo pidió"}]',
        'per_stay', 'created_at', 0, 15, 'high', '["same_day_arrival"]', false, 5, 4
      );
    end if;

    -- A0: Same-day housekeeping express
    if not exists (
      select 1 from public.task_templates
      where organization_id = v_org.id
        and title_template = 'Llegada no programada hoy · Hab. {room}'
    ) then
      insert into public.task_templates (
        organization_id, workflow, role_system_key, title_template, description, subtasks,
        scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order, phase
      ) values (
        v_org.id, 'stay_created', 'housekeeping_supervisor',
        'Llegada no programada hoy · Hab. {room}',
        'Priorizar la limpieza e inspección de esta habitación para llegada inmediata.',
        '[{"text":"Priorizar la limpieza de esta habitación"},
          {"text":"Inspeccionar con el checklist estándar"},
          {"text":"Avisar a Recepción cuando esté lista"}]',
        'per_stay', 'created_at', 0, 30, 'urgent', '["same_day_arrival","room_not_inspected"]', false, 6, 4
      );
    end if;

    -- W1: Walk-in registration
    if not exists (
      select 1 from public.task_templates
      where organization_id = v_org.id
        and title_template = 'Registro de walk-in · {guest}'
    ) then
      insert into public.task_templates (
        organization_id, workflow, role_system_key, title_template, description, subtasks,
        scope, anchor, offset_days, offset_minutes, priority, conditions, skip_if_past, sort_order, phase
      ) values (
        v_org.id, 'walk_in'::workflow_type, 'front_desk',
        'Registro de walk-in · {guest}',
        'Completar el registro del huésped que llegó sin reserva.',
        '[{"text":"Verificar el documento de identidad"},
          {"text":"Confirmar la garantía o el pago"},
          {"text":"Entregar la llave e información clave: wifi, desayuno, contacto"},
          {"text":"Reportar la entrada en SIRE hoy","conditions":["is_foreign_guest"]}]',
        'per_stay', 'created_at', 0, 10, 'high', '["always"]', false, 1, 4
      );
    end if;
  end loop;
end;
$$;
