// lib/availability.ts
// Pure availability calculator — no side effects, no Supabase calls.

import type { Enums } from '@/types/database';

// -------------------------------------------------------
// Public types
// -------------------------------------------------------

export type AvailabilityStatusCode =
  | 'absent'
  | 'available'
  | 'busy'
  | 'resting'
  | 'on_shift'
  | 'off_shift';

export interface AvailabilityResult {
  status: AvailabilityStatusCode;
  label: string;
  reason?: string;
  color: string;
}

// -------------------------------------------------------
// Colors (shared with components)
// -------------------------------------------------------

export const AVAILABILITY_COLORS: Record<AvailabilityStatusCode, string> = {
  absent: '#F2555A',
  on_shift: '#2FA36B',
  available: '#2FA36B',
  busy: '#E0922F',
  resting: '#8A8082',
  off_shift: '#8A8082',
};

// -------------------------------------------------------
// Input types
// -------------------------------------------------------

export interface WorkScheduleBlock {
  weekday: number; // 0 = Monday, 6 = Sunday
  start_time: string; // "HH:MM:SS" or "HH:MM"
  end_time: string;
  is_day_off: boolean;
}

export interface TimeOffEntry {
  start_date: string; // "YYYY-MM-DD"
  end_date: string;
  type: Enums<'time_off_type'>;
  note: string | null;
}

export interface CalculateAvailabilityParams {
  /** Current UTC timestamp as Date (caller provides `new Date()`) */
  now: Date;
  /** IANA timezone string, e.g. "America/Santiago" */
  timezone: string;
  /** availability_override from profiles table */
  availability_override: Enums<'availability_status'> | null;
  /** work_schedules rows for this employee */
  schedules: WorkScheduleBlock[];
  /** time_off rows for this employee */
  timeOff: TimeOffEntry[];
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

/** Parse "HH:MM:SS" or "HH:MM" → total minutes since midnight */
function timeToMinutes(t: string): number {
  const parts = t.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Get date string "YYYY-MM-DD" in a given IANA timezone */
function localDateString(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Get current minutes since midnight in a given IANA timezone */
function localMinutesSinceMidnight(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const h = parseInt(parts['hour'] ?? '0', 10);
  const m = parseInt(parts['minute'] ?? '0', 10);
  // Intl hour12:false can return "24" for midnight — normalise
  return (h === 24 ? 0 : h) * 60 + m;
}

/** Get ISO weekday 0=Monday … 6=Sunday in a given IANA timezone */
function localWeekday(date: Date, tz: string): number {
  // getDay() in local tz: 0=Sunday … 6=Saturday
  // We need 0=Monday … 6=Sunday (same as Postgres weekday in migration)
  const jsDay = new Date(
    date.toLocaleString('en-US', { timeZone: tz }),
  ).getDay();
  // Sunday (0) → 6, Monday (1) → 0, …
  return (jsDay + 6) % 7;
}

const TIME_OFF_LABELS: Record<Enums<'time_off_type'>, string> = {
  vacation: 'Vacaciones',
  sick_leave: 'Baja por enfermedad',
  personal: 'Permiso personal',
  other: 'Ausencia',
};

const OVERRIDE_MAP: Record<
  Enums<'availability_status'>,
  { status: AvailabilityStatusCode; label: string }
> = {
  available: { status: 'available', label: 'Disponible' },
  busy: { status: 'busy', label: 'Ocupado' },
  resting: { status: 'resting', label: 'Descansando' },
};

// -------------------------------------------------------
// Main function
// -------------------------------------------------------

export function calculateAvailability(
  params: CalculateAvailabilityParams,
): AvailabilityResult {
  const { now, timezone, availability_override, schedules, timeOff } = params;

  // ----------------------------------------------------------
  // Priority 1: time_off today → "Ausente"
  // ----------------------------------------------------------
  const todayStr = localDateString(now, timezone);

  const activeTimeOff = timeOff.find(
    (t) => t.start_date <= todayStr && t.end_date >= todayStr,
  );

  if (activeTimeOff) {
    const reason = TIME_OFF_LABELS[activeTimeOff.type] ?? 'Ausencia';
    return {
      status: 'absent',
      label: 'Ausente',
      reason,
      color: AVAILABILITY_COLORS.absent,
    };
  }

  // ----------------------------------------------------------
  // Priority 2: availability_override from profile
  // ----------------------------------------------------------
  if (availability_override !== null && availability_override !== undefined) {
    const mapped = OVERRIDE_MAP[availability_override];
    if (mapped) {
      return {
        ...mapped,
        color: AVAILABILITY_COLORS[mapped.status],
      };
    }
  }

  // ----------------------------------------------------------
  // Priority 3: inside a work_schedule block → "Disponible (en turno)"
  // ----------------------------------------------------------
  const weekday = localWeekday(now, timezone);
  const currentMinutes = localMinutesSinceMidnight(now, timezone);

  const todaySchedules = schedules.filter(
    (s) => s.weekday === weekday && !s.is_day_off,
  );

  for (const block of todaySchedules) {
    const start = timeToMinutes(block.start_time);
    const end = timeToMinutes(block.end_time);

    let isWithin: boolean;

    if (end > start) {
      // Normal shift: e.g. 08:00–16:00
      isWithin = currentMinutes >= start && currentMinutes < end;
    } else {
      // Midnight-crossing shift: e.g. 22:00–06:00
      // Active when: currentMinutes >= start OR currentMinutes < end
      isWithin = currentMinutes >= start || currentMinutes < end;
    }

    if (isWithin) {
      return {
        status: 'on_shift',
        label: 'Disponible (en turno)',
        color: AVAILABILITY_COLORS.on_shift,
      };
    }
  }

  // ----------------------------------------------------------
  // Priority 4: outside schedule → "Fuera de turno"
  // ----------------------------------------------------------
  return {
    status: 'off_shift',
    label: 'Fuera de turno',
    color: AVAILABILITY_COLORS.off_shift,
  };
}
