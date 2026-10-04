/**
 * Spanish labels for internal values.
 * Single source of truth — no internal enum/key should be shown raw to the user.
 */

// -------------------------------------------------------
// Task priorities
// -------------------------------------------------------

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
};

export function priorityLabel(key: string): string {
  return PRIORITY_LABELS[key] ?? key;
}

// -------------------------------------------------------
// Task sort criteria
// -------------------------------------------------------

export const TASK_SORT_LABELS: Record<string, string> = {
  created_at: 'Fecha de creación',
  due_date: 'Fecha de vencimiento',
  priority: 'Prioridad',
  title: 'Título',
  updated_at: 'Última actualización',
};

export function taskSortLabel(key: string): string {
  return TASK_SORT_LABELS[key] ?? key;
}

// -------------------------------------------------------
// Expense statuses
// -------------------------------------------------------

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  paid: 'Pagado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

export function expenseStatusLabel(key: string): string {
  return EXPENSE_STATUS_LABELS[key] ?? key;
}

// -------------------------------------------------------
// Stay statuses
// -------------------------------------------------------

export const STAY_STATUS_LABELS: Record<string, string> = {
  reserved: 'Reservado',
  checked_in: 'Hospedado',
  checked_out: 'Check-out',
  cancelled: 'Cancelado',
  no_show: 'No show',
};

export function stayStatusLabel(key: string): string {
  return STAY_STATUS_LABELS[key] ?? key;
}

// -------------------------------------------------------
// Event booking statuses
// -------------------------------------------------------

export const EVENT_STATUS_LABELS: Record<string, string> = {
  pending_deposit: 'Pendiente depósito',
  confirmed: 'Confirmado',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export function eventStatusLabel(key: string): string {
  return EVENT_STATUS_LABELS[key] ?? key;
}

// -------------------------------------------------------
// Contract statuses
// -------------------------------------------------------

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  terminated: 'Terminado',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};

export function contractStatusLabel(key: string): string {
  return CONTRACT_STATUS_LABELS[key] ?? key;
}

// -------------------------------------------------------
// Deposit statuses
// -------------------------------------------------------

export const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  received: 'Recibido',
  returned: 'Devuelto',
  retained: 'Retenido',
  paid: 'Pagado',
  partial: 'Parcial',
  applied: 'Aplicado',
};

export function depositStatusLabel(key: string): string {
  return DEPOSIT_STATUS_LABELS[key] ?? key;
}

// -------------------------------------------------------
// Housekeeping statuses
// -------------------------------------------------------

export const HOUSEKEEPING_STATUS_LABELS: Record<string, string> = {
  clean: 'Limpia',
  dirty: 'Sucia',
  inspected: 'Inspeccionada',
  out_of_service: 'Fuera de servicio',
};

export function housekeepingStatusLabel(key: string): string {
  return HOUSEKEEPING_STATUS_LABELS[key] ?? key;
}

// -------------------------------------------------------
// Installment statuses
// -------------------------------------------------------

export const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  partial: 'Parcial',
  overdue: 'Vencida',
};

export function installmentStatusLabel(key: string): string {
  return INSTALLMENT_STATUS_LABELS[key] ?? key;
}
