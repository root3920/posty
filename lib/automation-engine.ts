/**
 * POSTY Automation Engine — Condition evaluator & variable resolver
 * Shared between client (simulation) and server (execution).
 */

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface Condition {
  field: string;
  operator: 'is' | 'is_not' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'is_empty' | 'is_not_empty' | 'is_one_of';
  value?: unknown;
}

export interface ConditionGroup {
  logic: 'and' | 'or';
  conditions: (Condition | ConditionGroup)[];
}

// -------------------------------------------------------
// Condition evaluation
// -------------------------------------------------------

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateSingleCondition(condition: Condition, payload: Record<string, unknown>): boolean {
  const fieldValue = getNestedValue(payload, condition.field);

  switch (condition.operator) {
    case 'is':
      return String(fieldValue) === String(condition.value);
    case 'is_not':
      return String(fieldValue) !== String(condition.value);
    case 'contains':
      return String(fieldValue ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase());
    case 'not_contains':
      return !String(fieldValue ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase());
    case 'gt':
      return Number(fieldValue) > Number(condition.value);
    case 'lt':
      return Number(fieldValue) < Number(condition.value);
    case 'gte':
      return Number(fieldValue) >= Number(condition.value);
    case 'lte':
      return Number(fieldValue) <= Number(condition.value);
    case 'between': {
      const [min, max] = Array.isArray(condition.value) ? condition.value : [0, 0];
      const num = Number(fieldValue);
      return num >= Number(min) && num <= Number(max);
    }
    case 'is_empty':
      return fieldValue == null || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_not_empty':
      return fieldValue != null && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_one_of':
      return Array.isArray(condition.value) && condition.value.map(String).includes(String(fieldValue));
    default:
      return false;
  }
}

function isConditionGroup(item: Condition | ConditionGroup): item is ConditionGroup {
  return 'logic' in item && 'conditions' in item;
}

/**
 * Evaluates a condition group (and/or with nesting) against a payload.
 */
export function evaluateConditions(
  group: ConditionGroup | null | undefined,
  payload: Record<string, unknown>,
): boolean {
  if (!group || !group.conditions || group.conditions.length === 0) return true;

  const results = group.conditions.map((item) => {
    if (isConditionGroup(item)) {
      return evaluateConditions(item, payload);
    }
    return evaluateSingleCondition(item, payload);
  });

  return group.logic === 'and'
    ? results.every(Boolean)
    : results.some(Boolean);
}

// -------------------------------------------------------
// Variable resolution
// -------------------------------------------------------

const VARIABLE_REGEX = /\{([a-zA-Z0-9_.]+)\}/g;

/**
 * Resolves variables like {stay.code}, {guest.first_name} in a template string.
 * Falls back to empty string for missing variables.
 */
export function resolveVariables(
  template: string,
  payload: Record<string, unknown>,
): string {
  return template.replace(VARIABLE_REGEX, (match, path) => {
    const value = getNestedValue(payload, path);
    if (value == null) return '';
    return String(value);
  });
}

// -------------------------------------------------------
// Available triggers catalog
// -------------------------------------------------------

export interface TriggerDef {
  type: string;
  label: string;
  category: string;
  icon: string;
  variables: { key: string; label: string }[];
}

export const TRIGGER_CATALOG: TriggerDef[] = [
  // Stays
  { type: 'stay.created', label: 'Reserva creada', category: 'Reservas', icon: 'calendar-plus',
    variables: [
      { key: 'stay.code', label: 'Código de reserva' },
      { key: 'stay.check_in_date', label: 'Fecha de entrada' },
      { key: 'stay.check_out_date', label: 'Fecha de salida' },
      { key: 'stay.nights', label: 'Noches' },
      { key: 'stay.adults', label: 'Adultos' },
      { key: 'stay.children', label: 'Niños' },
      { key: 'guest.first_name', label: 'Nombre del huésped' },
      { key: 'guest.last_name', label: 'Apellido del huésped' },
      { key: 'room.number', label: 'Número de habitación' },
      { key: 'room.type', label: 'Tipo de habitación' },
      { key: 'channel.name', label: 'Canal de reserva' },
    ] },
  { type: 'stay.checked_in', label: 'Llegada confirmada', category: 'Reservas', icon: 'log-in',
    variables: [
      { key: 'stay.code', label: 'Código' },
      { key: 'guest.first_name', label: 'Nombre' },
      { key: 'room.number', label: 'Habitación' },
    ] },
  { type: 'stay.checked_out', label: 'Salida registrada', category: 'Reservas', icon: 'log-out',
    variables: [
      { key: 'stay.code', label: 'Código' },
      { key: 'guest.first_name', label: 'Nombre' },
      { key: 'room.number', label: 'Habitación' },
    ] },
  { type: 'stay.cancelled', label: 'Reserva cancelada', category: 'Reservas', icon: 'x-circle',
    variables: [{ key: 'stay.code', label: 'Código' }] },
  // Rooms
  { type: 'room.status_changed', label: 'Estado de habitación cambiado', category: 'Habitaciones', icon: 'bed-double',
    variables: [
      { key: 'room.number', label: 'Número' },
      { key: 'payload.old_status_id', label: 'Estado anterior' },
      { key: 'payload.new_status_id', label: 'Estado nuevo' },
    ] },
  { type: 'room.housekeeping_changed', label: 'Limpieza de habitación cambiada', category: 'Habitaciones', icon: 'sparkles',
    variables: [
      { key: 'room.number', label: 'Número' },
      { key: 'payload.old_housekeeping', label: 'Limpieza anterior' },
      { key: 'payload.new_housekeeping', label: 'Limpieza nueva' },
    ] },
  // Tasks
  { type: 'task.created', label: 'Tarea creada', category: 'Tareas', icon: 'check-square',
    variables: [{ key: 'task.title', label: 'Título' }] },
  { type: 'task.completed', label: 'Tarea completada', category: 'Tareas', icon: 'check-circle',
    variables: [{ key: 'task.title', label: 'Título' }] },
  { type: 'task.status_changed', label: 'Estado de tarea cambiado', category: 'Tareas', icon: 'refresh-cw',
    variables: [{ key: 'task.title', label: 'Título' }] },
  // Manual
  { type: 'manual', label: 'Ejecución manual', category: 'Manual', icon: 'play',
    variables: [] },
];

// -------------------------------------------------------
// Available actions catalog
// -------------------------------------------------------

export interface ActionDef {
  type: string;
  label: string;
  icon: string;
  configFields: { key: string; label: string; type: 'text' | 'textarea' | 'select' | 'number' | 'boolean'; options?: { value: string; label: string }[] }[];
}

export const ACTION_CATALOG: ActionDef[] = [
  {
    type: 'create_task',
    label: 'Crear tarea',
    icon: 'plus-circle',
    configFields: [
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'role_system_key', label: 'Rol responsable', type: 'select', options: [
        { value: 'front_desk', label: 'Recepción' },
        { value: 'housekeeping_supervisor', label: 'Ama de llaves' },
        { value: 'room_attendant', label: 'Camarera de pisos' },
        { value: 'maintenance', label: 'Mantenimiento' },
        { value: 'kitchen', label: 'Cocina' },
        { value: 'night_auditor', label: 'Auditor nocturno' },
      ] },
      { key: 'priority', label: 'Prioridad', type: 'select', options: [
        { value: 'urgent', label: 'Urgente' },
        { value: 'high', label: 'Alta' },
        { value: 'normal', label: 'Normal' },
        { value: 'low', label: 'Baja' },
      ] },
      { key: 'link_stay', label: 'Vincular a la estancia', type: 'boolean' },
    ],
  },
  {
    type: 'notify',
    label: 'Enviar notificación',
    icon: 'bell',
    configFields: [
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'body', label: 'Mensaje', type: 'textarea' },
      { key: 'role_system_key', label: 'Notificar a', type: 'select', options: [
        { value: 'front_desk', label: 'Recepción' },
        { value: 'housekeeping_supervisor', label: 'Ama de llaves' },
        { value: 'maintenance', label: 'Mantenimiento' },
        { value: 'manager', label: 'Gestor' },
      ] },
    ],
  },
  {
    type: 'stop',
    label: 'Detener automatización',
    icon: 'square',
    configFields: [],
  },
];
