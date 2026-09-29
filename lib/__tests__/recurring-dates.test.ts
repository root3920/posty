import { describe, it, expect } from 'vitest';
import { getNextOccurrences, formatFrequency } from '../recurring-dates';

// Fixed date for deterministic tests: Monday 2026-09-28
const MONDAY = new Date(2026, 8, 28, 0, 0, 0); // month is 0-indexed

describe('getNextOccurrences', () => {
  it('daily: returns 3 consecutive days', () => {
    const dates = getNextOccurrences(
      { frequency_type: 'daily', frequency_config: {}, at_time: '08:00' },
      3,
      MONDAY,
    );
    expect(dates).toHaveLength(3);
    expect(dates[0].getDate()).toBe(28);
    expect(dates[1].getDate()).toBe(29);
    expect(dates[2].getDate()).toBe(30);
    expect(dates[0].getHours()).toBe(8);
    expect(dates[0].getMinutes()).toBe(0);
  });

  it('weekly (Monday): returns only Mondays', () => {
    const dates = getNextOccurrences(
      { frequency_type: 'weekly', frequency_config: { days_of_week: [1] }, at_time: '08:00' },
      3,
      MONDAY,
    );
    expect(dates).toHaveLength(3);
    // All should be Mondays (getDay() = 1)
    dates.forEach((d) => expect(d.getDay()).toBe(1));
    expect(dates[0].getDate()).toBe(28); // Sep 28
    expect(dates[1].getDate()).toBe(5);  // Oct 5
    expect(dates[2].getDate()).toBe(12); // Oct 12
  });

  it('weekly (Mon, Wed, Fri): returns correct days', () => {
    const dates = getNextOccurrences(
      { frequency_type: 'weekly', frequency_config: { days_of_week: [1, 3, 5] }, at_time: '10:00' },
      5,
      MONDAY,
    );
    expect(dates).toHaveLength(5);
    // Mon 28, Wed 30, Fri 2 Oct, Mon 5 Oct, Wed 7 Oct
    expect(dates[0].getDate()).toBe(28);
    expect(dates[1].getDate()).toBe(30);
  });

  it('monthly day 15: returns the 15th of each month', () => {
    const from = new Date(2026, 8, 1, 0, 0, 0); // Sep 1 local
    const dates = getNextOccurrences(
      { frequency_type: 'monthly_day', frequency_config: { day_of_month: 15 }, at_time: '09:00' },
      3,
      from,
    );
    expect(dates).toHaveLength(3);
    expect(dates[0].getDate()).toBe(15);
    expect(dates[0].getMonth()).toBe(8); // Sep
    expect(dates[0].getHours()).toBe(9);
    expect(dates[1].getDate()).toBe(15);
    expect(dates[1].getMonth()).toBe(9); // Oct
    expect(dates[2].getDate()).toBe(15);
    expect(dates[2].getMonth()).toBe(10); // Nov
  });

  it('monthly day 31: in months with 30 days, returns last day', () => {
    const from = new Date(2026, 8, 1); // Sep 1 (Sep has 30 days)
    const dates = getNextOccurrences(
      { frequency_type: 'monthly_day', frequency_config: { day_of_month: 31 }, at_time: '09:00' },
      3,
      from,
    );
    expect(dates).toHaveLength(3);
    // Sep has 30 days → 30th
    expect(dates[0].getDate()).toBe(30);
    expect(dates[0].getMonth()).toBe(8);
    // Oct has 31 days → 31st
    expect(dates[1].getDate()).toBe(31);
    expect(dates[1].getMonth()).toBe(9);
    // Nov has 30 days → 30th
    expect(dates[2].getDate()).toBe(30);
    expect(dates[2].getMonth()).toBe(10);
  });

  it('monthly day 31: February returns 28th (non-leap year)', () => {
    const from = new Date(2027, 1, 1); // Feb 1, 2027 (not leap year)
    const dates = getNextOccurrences(
      { frequency_type: 'monthly_day', frequency_config: { day_of_month: 31 }, at_time: '09:00' },
      1,
      from,
    );
    expect(dates).toHaveLength(1);
    expect(dates[0].getDate()).toBe(28);
    expect(dates[0].getMonth()).toBe(1); // Feb
  });

  it('every 3 days: returns dates spaced 3 days apart', () => {
    const dates = getNextOccurrences(
      { frequency_type: 'every_n_days', frequency_config: { every_n_days: 3 }, at_time: '08:00' },
      3,
      MONDAY,
    );
    expect(dates).toHaveLength(3);
    expect(dates[0].getDate()).toBe(28);
    expect(dates[1].getDate()).toBe(1); // Oct 1
    expect(dates[2].getDate()).toBe(4); // Oct 4
  });

  it('respects end_date', () => {
    const dates = getNextOccurrences(
      {
        frequency_type: 'daily',
        frequency_config: {},
        at_time: '08:00',
        end_date: '2026-09-30',
      },
      10,
      MONDAY,
    );
    // Should stop at Sep 30 even though we asked for 10
    expect(dates).toHaveLength(3); // 28, 29, 30
  });

  it('respects start_date in the future', () => {
    const dates = getNextOccurrences(
      {
        frequency_type: 'daily',
        frequency_config: {},
        at_time: '08:00',
        start_date: '2026-10-01',
      },
      3,
      MONDAY,
    );
    expect(dates).toHaveLength(3);
    expect(dates[0].getMonth()).toBe(9); // Oct
    expect(dates[0].getDate()).toBe(1);
  });
});

describe('formatFrequency', () => {
  it('daily', () => {
    expect(formatFrequency('daily', {}, '08:00')).toBe('Todos los días a las 08:00');
  });

  it('weekly single day', () => {
    expect(formatFrequency('weekly', { days_of_week: [1] }, '08:00')).toBe(
      'Cada lunes a las 08:00',
    );
  });

  it('weekly multiple days', () => {
    const result = formatFrequency('weekly', { days_of_week: [1, 3, 5] }, '10:00');
    expect(result).toBe('Cada lunes, miércoles y viernes a las 10:00');
  });

  it('monthly', () => {
    expect(formatFrequency('monthly_day', { day_of_month: 15 }, '09:00')).toBe(
      'Cada mes el día 15 a las 09:00',
    );
  });

  it('every N days', () => {
    expect(formatFrequency('every_n_days', { every_n_days: 3 }, '08:00')).toBe(
      'Cada 3 días a las 08:00',
    );
  });
});
