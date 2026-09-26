import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, pattern, { locale: es });
}

/**
 * Format time (HH:mm) for display.
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm');
}
