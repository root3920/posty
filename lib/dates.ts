import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, addMonths as dfAddMonths } from 'date-fns';
import { es } from 'date-fns/locale';

// -------------------------------------------------------
// Date-only helpers (no timezone shift)
//
// YYYY-MM-DD strings are calendar dates, NOT instants.
// new Date('2026-10-01') → UTC midnight → wrong day in UTC-5.
// These helpers always anchor at T12:00:00 to stay on the
// correct calendar day in any timezone from UTC-12 to UTC+14.
// -------------------------------------------------------

/**
 * Parse a YYYY-MM-DD string into a Date anchored at noon local time.
 * Safe in any timezone — the day never shifts.
 */
export function parseDateOnly(dateStr: string): Date {
  // dateStr may be 'YYYY-MM-DD' (10 chars) or an ISO timestamp
  if (dateStr.length === 10) {
    return new Date(dateStr + 'T12:00:00');
  }
  return new Date(dateStr);
}

/**
 * Format a YYYY-MM-DD string for display: "1 oct 2026".
 */
export function formatDateOnly(dateStr: string, pattern: string = 'd MMM yyyy'): string {
  return format(parseDateOnly(dateStr), pattern, { locale: es });
}

/**
 * Add N months to a YYYY-MM-DD string. Returns YYYY-MM-DD.
 * Example: addMonthsDateOnly('2026-10-01', 12) → '2027-10-01'
 */
export function addMonthsDateOnly(dateStr: string, months: number): string {
  const d = parseDateOnly(dateStr);
  const result = dfAddMonths(d, months);
  return format(result, 'yyyy-MM-dd');
}

/**
 * Number of nights between two YYYY-MM-DD strings.
 * diffNights('2026-10-01', '2026-10-04') → 3
 */
export function diffNights(from: string, to: string): number {
  const f = parseDateOnly(from);
  const t = parseDateOnly(to);
  return Math.round((t.getTime() - f.getTime()) / 86400000);
}

/**
 * Convert a Date or YYYY-MM-DD string to the value format for <input type="date">.
 * Always returns YYYY-MM-DD.
 */
export function toDateInputValue(date: Date | string): string {
  if (typeof date === 'string') {
    // Already YYYY-MM-DD
    if (date.length === 10) return date;
    return format(new Date(date), 'yyyy-MM-dd');
  }
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format a date range from two YYYY-MM-DD strings: "1 – 30 sep 2026".
 */
export function formatDateRangeOnly(from: string, to: string): string {
  const f = parseDateOnly(from);
  const t = parseDateOnly(to);

  const sameMonth = f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();
  if (sameMonth) {
    return `${format(f, 'd', { locale: es })} – ${format(t, 'd MMM yyyy', { locale: es })}`;
  }

  const sameYear = f.getFullYear() === t.getFullYear();
  if (sameYear) {
    return `${format(f, 'd MMM', { locale: es })} – ${format(t, 'd MMM yyyy', { locale: es })}`;
  }

  return `${format(f, 'd MMM yyyy', { locale: es })} – ${format(t, 'd MMM yyyy', { locale: es })}`;
}

/**
 * Get the current date/time in a specific timezone.
 */
export function nowInTimezone(timezone: string = 'America/Bogota'): Date {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', { timeZone: timezone });
  return new Date(formatted);
}

/**
 * Get "today" as a date string (YYYY-MM-DD) in the organization's timezone.
 */
export function todayInTimezone(timezone: string = 'America/Bogota'): string {
  const now = nowInTimezone(timezone);
  return format(now, 'yyyy-MM-dd');
}

/**
 * Get start and end of day in a timezone.
 */
export function dayBounds(date: Date): { start: Date; end: Date } {
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  };
}

/**
 * Get start and end of week (Monday-based).
 */
export function weekBounds(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

/**
 * Format a date for display in Spanish.
 */
export function formatDateEs(date: Date | string, pattern: string = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseDateOnly(date) : date;
  return format(d, pattern, { locale: es });
}

/**
 * Format time (HH:mm) for display.
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseDateOnly(date) : date;
  return format(d, 'HH:mm');
}
