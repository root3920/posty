import {
  addDays,
  addMonths,
  getDay,
  lastDayOfMonth,
} from 'date-fns';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface RecurringConfig {
  frequency_type: 'daily' | 'weekly' | 'monthly_day' | 'every_n_days';
  frequency_config: Record<string, unknown>;
  at_time: string;
  start_date?: string | null;
  end_date?: string | null;
}

// -------------------------------------------------------
// ISO day helper: JS getDay() returns 0=Sun, we need 1=Mon..7=Sun
// -------------------------------------------------------

function toISODay(date: Date): number {
  const jsDay = getDay(date);
  return jsDay === 0 ? 7 : jsDay;
}

/** Parse a date string YYYY-MM-DD as local date (not UTC) */
function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// -------------------------------------------------------
// getNextOccurrences
// -------------------------------------------------------

export function getNextOccurrences(
  config: RecurringConfig,
  count: number,
  from?: Date,
): Date[] {
  const results: Date[] = [];
  const [hours, minutes] = config.at_time.split(':').map(Number);

  // All dates are local
  const startFrom = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const endDate = config.end_date ? parseLocalDate(config.end_date) : null;
  const startDate = config.start_date ? parseLocalDate(config.start_date) : null;

  const effectiveStart = startDate && startDate > startFrom ? startDate : startFrom;

  if (config.frequency_type === 'monthly_day') {
    return getMonthlyOccurrences(config, count, effectiveStart, endDate, hours, minutes);
  }

  if (config.frequency_type === 'every_n_days') {
    return getEveryNDaysOccurrences(config, count, effectiveStart, endDate, hours, minutes);
  }

  // daily or weekly: iterate day by day
  let cursor = new Date(effectiveStart);
  const maxIterations = count * 400;
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;
    if (endDate && cursor > endDate) break;

    if (matchesDayFrequency(cursor, config)) {
      const occurrence = new Date(cursor);
      occurrence.setHours(hours, minutes, 0, 0);
      results.push(occurrence);
    }

    cursor = addDays(cursor, 1);
  }

  return results;
}

function matchesDayFrequency(date: Date, config: RecurringConfig): boolean {
  if (config.frequency_type === 'daily') return true;
  if (config.frequency_type === 'weekly') {
    const daysOfWeek = (config.frequency_config.days_of_week ?? []) as number[];
    return daysOfWeek.includes(toISODay(date));
  }
  return false;
}

function getMonthlyOccurrences(
  config: RecurringConfig,
  count: number,
  effectiveStart: Date,
  endDate: Date | null,
  hours: number,
  minutes: number,
): Date[] {
  const results: Date[] = [];
  const dayOfMonth = (config.frequency_config.day_of_month ?? 1) as number;

  // Start from the month of effectiveStart
  let cursor = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
  const maxMonths = count * 24;

  for (let i = 0; i < maxMonths && results.length < count; i++) {
    const lastDay = lastDayOfMonth(cursor).getDate();
    const targetDay = Math.min(dayOfMonth, lastDay);
    const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), targetDay, hours, minutes, 0);

    if (candidate >= effectiveStart) {
      if (endDate && candidate > endDate) break;
      results.push(candidate);
    }

    cursor = addMonths(cursor, 1);
  }

  return results;
}

function getEveryNDaysOccurrences(
  config: RecurringConfig,
  count: number,
  effectiveStart: Date,
  endDate: Date | null,
  hours: number,
  minutes: number,
): Date[] {
  const results: Date[] = [];
  const n = (config.frequency_config.every_n_days ?? config.frequency_config.every_n ?? 2) as number;

  let cursor = new Date(effectiveStart);
  const maxIterations = count * 400;

  for (let i = 0; i < maxIterations && results.length < count; i++) {
    if (endDate && cursor > endDate) break;
    const occurrence = new Date(cursor);
    occurrence.setHours(hours, minutes, 0, 0);
    results.push(occurrence);
    cursor = addDays(cursor, n);
  }

  return results;
}

// -------------------------------------------------------
// formatFrequency
// -------------------------------------------------------

const DAY_NAMES: Record<number, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  7: 'domingo',
};

export function formatFrequency(
  type: string,
  config: Record<string, unknown>,
  atTime: string,
): string {
  const timeStr = `a las ${atTime}`;

  switch (type) {
    case 'daily':
      return `Todos los días ${timeStr}`;

    case 'weekly': {
      const days = (config.days_of_week ?? []) as number[];
      if (days.length === 0) return `Semanal ${timeStr}`;
      if (days.length === 1) {
        return `Cada ${DAY_NAMES[days[0]] ?? 'día'} ${timeStr}`;
      }
      const dayNames = days
        .sort((a, b) => a - b)
        .map((d) => DAY_NAMES[d] ?? `día ${d}`);
      const last = dayNames.pop();
      return `Cada ${dayNames.join(', ')} y ${last} ${timeStr}`;
    }

    case 'monthly_day': {
      const day = (config.day_of_month ?? 1) as number;
      return `Cada mes el día ${day} ${timeStr}`;
    }

    case 'every_n_days': {
      const n = (config.every_n_days ?? config.every_n ?? 2) as number;
      return `Cada ${n} días ${timeStr}`;
    }

    default:
      return `Frecuencia desconocida ${timeStr}`;
  }
}
