/**
 * Central stay badge logic based on STATUS + DATES.
 * Used everywhere stays are displayed: reservas table, dashboard,
 * hotel map, guest detail, occupancy table.
 */

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export type StayStatus = 'reserved' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export interface StayBadgeInput {
  status: StayStatus;
  check_in_date: string;   // YYYY-MM-DD
  check_out_date: string;  // YYYY-MM-DD
  actual_check_in_at?: string | null;   // ISO timestamp
  actual_check_out_at?: string | null;  // ISO timestamp
  stay_type?: string | null;   // 'short_stay' | 'long_stay'
}

export type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'muted' | 'neutral';

export interface StayBadge {
  label: string;
  variant: BadgeVariant;
  tooltip?: string;
  /** Suggested action button */
  action?: 'confirm_arrival' | 'mark_no_show' | 'register_checkout';
}

export interface StayBadges {
  /** Badge next to the check-in date */
  arrival: StayBadge | null;
  /** Badge next to the check-out date */
  departure: StayBadge | null;
  /** Status column label + color */
  status: {
    label: string;
    variant: BadgeVariant;
    dimmed: boolean; // true for cancelled stays
  };
}

// -------------------------------------------------------
// Status labels
// -------------------------------------------------------

const STATUS_LABELS: Record<StayStatus, { label: string; variant: BadgeVariant }> = {
  reserved:    { label: 'Reservada',  variant: 'info' },
  checked_in:  { label: 'Hospedado',  variant: 'success' },
  checked_out: { label: 'Salió',      variant: 'muted' },
  cancelled:   { label: 'Cancelada',  variant: 'neutral' },
  no_show:     { label: 'No-show',    variant: 'danger' },
};

// -------------------------------------------------------
// Badge variant → Tailwind classes
// -------------------------------------------------------

export const BADGE_STYLES: Record<BadgeVariant, string> = {
  info:    'border-info/30 bg-info/10 text-info',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger:  'border-danger/30 bg-danger/10 text-danger',
  muted:   'border-border bg-muted/50 text-muted-foreground',
  neutral: 'border-border bg-muted/30 text-muted-foreground',
};

// -------------------------------------------------------
// Core function
// -------------------------------------------------------

/**
 * Calculate all badges for a stay.
 * @param stay - The stay data
 * @param today - Today's date as YYYY-MM-DD (in the org's timezone)
 */
export function getStayBadges(stay: StayBadgeInput, today: string): StayBadges {
  const { status, check_in_date, check_out_date, actual_check_in_at, actual_check_out_at } = stay;

  const isCheckInToday = check_in_date === today;
  const isCheckInPast = check_in_date < today;
  const isCheckInFuture = check_in_date > today;

  const isCheckOutToday = check_out_date === today;
  const isCheckOutPast = check_out_date < today;

  // Days until check-in (anchored at noon to avoid TZ shift)
  const daysUntilCheckIn = isCheckInFuture
    ? Math.ceil((new Date(check_in_date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
    : 0;

  // ---- ARRIVAL BADGE ----
  let arrival: StayBadge | null = null;

  switch (status) {
    case 'reserved':
      if (isCheckInToday) {
        arrival = { label: 'Llega hoy', variant: 'info', action: 'confirm_arrival' };
      } else if (isCheckInPast) {
        arrival = {
          label: 'Llegada pendiente',
          variant: 'warning',
          action: 'confirm_arrival',
        };
      } else if (daysUntilCheckIn > 0 && daysUntilCheckIn <= 3) {
        arrival = { label: `En ${daysUntilCheckIn} día${daysUntilCheckIn !== 1 ? 's' : ''}`, variant: 'info' };
      }
      break;

    case 'checked_in':
    case 'checked_out':
      arrival = {
        label: 'Check-in hecho',
        variant: 'success',
        tooltip: actual_check_in_at
          ? `Check-in: ${formatDateTime(actual_check_in_at)}`
          : undefined,
      };
      break;

    case 'no_show':
      arrival = { label: 'No-show', variant: 'danger' };
      break;

    case 'cancelled':
      arrival = null;
      break;
  }

  // ---- DEPARTURE BADGE ----
  let departure: StayBadge | null = null;

  switch (status) {
    case 'checked_in':
      if (isCheckOutToday) {
        departure = { label: 'Sale hoy', variant: 'info', action: 'register_checkout' };
      } else if (isCheckOutPast) {
        departure = {
          label: 'Salida pendiente',
          variant: 'danger',
          action: 'register_checkout',
        };
      }
      break;

    case 'checked_out':
      departure = {
        label: 'Check-out hecho',
        variant: 'success',
        tooltip: actual_check_out_at
          ? `Check-out: ${formatDateTime(actual_check_out_at)}`
          : undefined,
      };
      break;

    default:
      departure = null;
  }

  // ---- STATUS ----
  const statusConfig = STATUS_LABELS[status];

  return {
    arrival,
    departure,
    status: {
      label: statusConfig.label,
      variant: statusConfig.variant,
      dimmed: status === 'cancelled',
    },
  };
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// -------------------------------------------------------
// Quick filter chips
// -------------------------------------------------------

export type StayFilterKey = 'all' | 'arriving_today' | 'checked_in' | 'departing_today' | 'arrival_pending' | 'departure_pending' | 'long_stay';

export interface StayFilterChip {
  key: StayFilterKey;
  label: string;
}

export const STAY_FILTER_CHIPS: StayFilterChip[] = [
  { key: 'all', label: 'Todas' },
  { key: 'arriving_today', label: 'Llegan hoy' },
  { key: 'checked_in', label: 'Hospedados' },
  { key: 'departing_today', label: 'Salen hoy' },
  { key: 'arrival_pending', label: 'Llegadas pendientes' },
  { key: 'departure_pending', label: 'Salidas pendientes' },
  { key: 'long_stay', label: 'Larga estadía' },
];

export function filterStaysByChip(
  stays: StayBadgeInput[],
  chip: StayFilterKey,
  today: string,
): StayBadgeInput[] {
  if (chip === 'all') return stays;

  return stays.filter((stay) => {
    const badges = getStayBadges(stay, today);
    switch (chip) {
      case 'arriving_today':
        return stay.status === 'reserved' && stay.check_in_date === today;
      case 'checked_in':
        return stay.status === 'checked_in';
      case 'departing_today':
        return stay.status === 'checked_in' && stay.check_out_date === today;
      case 'arrival_pending':
        return stay.status === 'reserved' && stay.check_in_date < today;
      case 'departure_pending':
        return stay.status === 'checked_in' && stay.check_out_date < today;
      case 'long_stay':
        return stay.stay_type === 'long_stay';
      default:
        return true;
    }
  });
}
