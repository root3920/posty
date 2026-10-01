import { describe, it, expect } from 'vitest';
import { hotelLocalToUtc, utcToHotelLocal, formatScheduledAt, getTimezoneCity } from '../datetime-tz';

describe('hotelLocalToUtc', () => {
  it('converts Bogota local time to UTC (UTC-5)', () => {
    // 2026-10-04 18:00 in Bogota = 2026-10-04 23:00 UTC
    const utc = hotelLocalToUtc('2026-10-04', '18:00', 'America/Bogota');
    expect(utc).toBe('2026-10-04T23:00:00.000Z');
  });

  it('converts midnight correctly', () => {
    // 2026-10-05 00:00 in Bogota = 2026-10-05 05:00 UTC
    const utc = hotelLocalToUtc('2026-10-05', '00:00', 'America/Bogota');
    expect(utc).toBe('2026-10-05T05:00:00.000Z');
  });

  it('handles 23:30 crossing midnight into next day in UTC', () => {
    // 2026-10-04 23:30 in Bogota = 2026-10-05 04:30 UTC
    const utc = hotelLocalToUtc('2026-10-04', '23:30', 'America/Bogota');
    expect(utc).toBe('2026-10-05T04:30:00.000Z');
  });

  it('handles end of month crossing', () => {
    // 2026-10-31 23:30 in Bogota = 2026-11-01 04:30 UTC
    const utc = hotelLocalToUtc('2026-10-31', '23:30', 'America/Bogota');
    expect(utc).toBe('2026-11-01T04:30:00.000Z');
  });

  it('handles end of year crossing', () => {
    // 2026-12-31 23:00 in Bogota = 2027-01-01 04:00 UTC
    const utc = hotelLocalToUtc('2026-12-31', '23:00', 'America/Bogota');
    expect(utc).toBe('2027-01-01T04:00:00.000Z');
  });

  it('converts Madrid time (UTC+1 in winter, UTC+2 in summer)', () => {
    // 2026-12-15 18:00 in Madrid = 2026-12-15 17:00 UTC (winter, UTC+1)
    const utcWinter = hotelLocalToUtc('2026-12-15', '18:00', 'Europe/Madrid');
    expect(utcWinter).toBe('2026-12-15T17:00:00.000Z');

    // 2026-07-15 18:00 in Madrid = 2026-07-15 16:00 UTC (summer, UTC+2)
    const utcSummer = hotelLocalToUtc('2026-07-15', '18:00', 'Europe/Madrid');
    expect(utcSummer).toBe('2026-07-15T16:00:00.000Z');
  });

  it('handles Buenos Aires (UTC-3, no DST)', () => {
    const utc = hotelLocalToUtc('2026-10-04', '18:00', 'America/Buenos_Aires');
    expect(utc).toBe('2026-10-04T21:00:00.000Z');
  });

  it('handles 5-minute intervals', () => {
    const utc = hotelLocalToUtc('2026-10-04', '18:05', 'America/Bogota');
    expect(utc).toBe('2026-10-04T23:05:00.000Z');
  });
});

describe('utcToHotelLocal', () => {
  it('converts UTC to Bogota local time', () => {
    const local = utcToHotelLocal('2026-10-04T23:00:00.000Z', 'America/Bogota');
    expect(local.date).toBe('2026-10-04');
    expect(local.time).toBe('18:00');
  });

  it('handles midnight UTC -> previous day in west timezone', () => {
    // 2026-10-05 00:00 UTC = 2026-10-04 19:00 in Bogota
    const local = utcToHotelLocal('2026-10-05T00:00:00.000Z', 'America/Bogota');
    expect(local.date).toBe('2026-10-04');
    expect(local.time).toBe('19:00');
  });

  it('roundtrips correctly', () => {
    const original = { date: '2026-10-04', time: '18:00' };
    const tz = 'America/Bogota';
    const utc = hotelLocalToUtc(original.date, original.time, tz);
    const back = utcToHotelLocal(utc, tz);
    expect(back.date).toBe(original.date);
    expect(back.time).toBe(original.time);
  });

  it('roundtrips 23:30 correctly', () => {
    const original = { date: '2026-10-31', time: '23:30' };
    const tz = 'America/Bogota';
    const utc = hotelLocalToUtc(original.date, original.time, tz);
    const back = utcToHotelLocal(utc, tz);
    expect(back.date).toBe(original.date);
    expect(back.time).toBe(original.time);
  });

  it('roundtrips midnight correctly', () => {
    const original = { date: '2026-10-05', time: '00:00' };
    const tz = 'America/Lima';
    const utc = hotelLocalToUtc(original.date, original.time, tz);
    const back = utcToHotelLocal(utc, tz);
    expect(back.date).toBe(original.date);
    expect(back.time).toBe(original.time);
  });
});

describe('formatScheduledAt', () => {
  it('formats a scheduled date in Spanish', () => {
    // 2026-10-04 23:00 UTC = 18:00 in Bogota
    const formatted = formatScheduledAt('2026-10-04T23:00:00.000Z', 'America/Bogota');
    // Should contain day, month, and time
    expect(formatted).toMatch(/18:00/);
    expect(formatted).toMatch(/oct/i);
  });
});

describe('getTimezoneCity', () => {
  it('returns known cities', () => {
    expect(getTimezoneCity('America/Bogota')).toBe('Bogotá');
    expect(getTimezoneCity('America/Mexico_City')).toBe('Ciudad de México');
    expect(getTimezoneCity('UTC')).toBe('UTC');
  });

  it('falls back to extracting from timezone string', () => {
    expect(getTimezoneCity('America/Sao_Paulo')).toBe('Sao Paulo');
  });
});
