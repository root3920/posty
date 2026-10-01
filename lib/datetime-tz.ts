/**
 * Timezone-aware date/time conversion for scheduling.
 *
 * All scheduling in POSTY uses the hotel's timezone (organizations.timezone).
 * The user picks a local date + time (e.g. "2026-10-04 18:00 America/Bogota")
 * and we store it as UTC timestamptz in the database.
 *
 * These helpers are the ONLY place that does this conversion.
 * Components must never do manual timezone math.
 */

/**
 * Convert a hotel-local date + time string to a UTC ISO string.
 *
 * @param date  - YYYY-MM-DD in the hotel's timezone
 * @param time  - HH:mm in the hotel's timezone
 * @param timezone - IANA timezone (e.g. 'America/Bogota')
 * @returns ISO 8601 UTC string (e.g. '2026-10-04T23:00:00.000Z')
 */
export function hotelLocalToUtc(date: string, time: string, timezone: string): string {
  // Build a locale string for the target date/time
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // We need to find the UTC offset for this specific date/time in the timezone.
  // Strategy: create a rough UTC date, then use Intl to find the real offset.
  const roughUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  // Get the offset by formatting in the target timezone and comparing
  const offset = getTimezoneOffsetMinutes(roughUtc, timezone);

  // The local time = UTC + offset, so UTC = local - offset
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0) - offset * 60_000;
  const result = new Date(utcMs);

  // Verify: the result formatted in the target timezone should match input
  // (handles DST edge cases by checking and adjusting once)
  const checkOffset = getTimezoneOffsetMinutes(result, timezone);
  if (checkOffset !== offset) {
    const adjustedMs = Date.UTC(year, month - 1, day, hours, minutes, 0) - checkOffset * 60_000;
    return new Date(adjustedMs).toISOString();
  }

  return result.toISOString();
}

/**
 * Convert a UTC ISO string to hotel-local date and time strings.
 *
 * @param utcIso  - ISO 8601 UTC string
 * @param timezone - IANA timezone
 * @returns { date: 'YYYY-MM-DD', time: 'HH:mm' }
 */
export function utcToHotelLocal(utcIso: string, timezone: string): { date: string; time: string } {
  const d = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  const date = `${get('year')}-${get('month')}-${get('day')}`;
  // Intl may return '24' for midnight — normalize to '00'
  const hourStr = get('hour') === '24' ? '00' : get('hour');
  const time = `${hourStr}:${get('minute')}`;

  return { date, time };
}

/**
 * Format a UTC ISO string as a human-readable hotel-local string.
 *
 * Example: "sáb 4 oct a las 18:00"
 */
export function formatScheduledAt(utcIso: string, timezone: string): string {
  const d = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const weekday = get('weekday');
  const day = get('day');
  const month = get('month');
  const hourStr = get('hour') === '24' ? '00' : get('hour');
  const minute = get('minute');

  return `${weekday} ${day} ${month} a las ${hourStr}:${minute}`;
}

/**
 * Get the timezone display name (e.g. "Bogotá").
 */
export function getTimezoneCity(timezone: string): string {
  const map: Record<string, string> = {
    'America/Bogota': 'Bogotá',
    'America/Mexico_City': 'Ciudad de México',
    'America/Lima': 'Lima',
    'America/Santiago': 'Santiago',
    'America/Buenos_Aires': 'Buenos Aires',
    'America/New_York': 'Nueva York',
    'Europe/Madrid': 'Madrid',
    'UTC': 'UTC',
  };
  return map[timezone] ?? timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone;
}

/**
 * Get "now" in a timezone as { date, time } strings.
 */
export function nowInTz(timezone: string): { date: string; time: string } {
  return utcToHotelLocal(new Date().toISOString(), timezone);
}

// -------------------------------------------------------
// Internal helper
// -------------------------------------------------------

/**
 * Returns the UTC offset in minutes for a given instant in a timezone.
 * Positive = east of UTC (e.g. +60 for Europe/Madrid in winter).
 * Negative = west of UTC (e.g. -300 for America/Bogota).
 */
function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  // Format in UTC and in target timezone, then compute diff
  const utcParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const toMs = (parts: Intl.DateTimeFormatPart[]) => {
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
    const h = get('hour') === 24 ? 0 : get('hour');
    return Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'));
  };

  return (toMs(tzParts) - toMs(utcParts)) / 60_000;
}
