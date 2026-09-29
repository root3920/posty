/**
 * Tests for date-only helpers (no timezone shift).
 * Run with: TZ=America/Bogota npx vitest run lib/__tests__/date-only.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  parseDateOnly,
  formatDateOnly,
  addMonthsDateOnly,
  diffNights,
  toDateInputValue,
  formatDateRangeOnly,
} from '../dates';

describe('parseDateOnly', () => {
  it('parses YYYY-MM-DD without timezone shift', () => {
    const d = parseDateOnly('2026-10-01');
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(9); // October = 9
    expect(d.getFullYear()).toBe(2026);
  });

  it('stays on correct day in negative UTC offset', () => {
    // This is the bug: new Date('2026-10-01') in America/Bogota (UTC-5)
    // shows Sep 30. parseDateOnly must show Oct 1.
    const d = parseDateOnly('2026-10-01');
    expect(d.getDate()).toBe(1);
  });

  it('handles ISO timestamps unchanged', () => {
    const d = parseDateOnly('2026-10-01T15:30:00.000Z');
    expect(d instanceof Date).toBe(true);
  });
});

describe('formatDateOnly', () => {
  it('formats correctly without timezone shift', () => {
    const result = formatDateOnly('2026-10-01');
    expect(result).toContain('oct');
    expect(result).toContain('2026');
    // Should NOT show "30 sep" (the UTC-5 bug)
    expect(result).not.toContain('sep');
  });
});

describe('addMonthsDateOnly', () => {
  it('adds 12 months: 2026-10-01 → 2027-10-01', () => {
    expect(addMonthsDateOnly('2026-10-01', 12)).toBe('2027-10-01');
  });

  it('adds 1 month from Jan 31 → Feb 28 (non-leap year)', () => {
    // 2027 is not a leap year
    expect(addMonthsDateOnly('2027-01-31', 1)).toBe('2027-02-28');
  });

  it('adds 1 month from Jan 31 → Feb 29 (leap year)', () => {
    // 2028 is a leap year
    expect(addMonthsDateOnly('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('adds 6 months: 2026-10-01 → 2027-04-01', () => {
    expect(addMonthsDateOnly('2026-10-01', 6)).toBe('2027-04-01');
  });

  it('adds 1 month: 2026-10-15 → 2026-11-15', () => {
    expect(addMonthsDateOnly('2026-10-15', 1)).toBe('2026-11-15');
  });
});

describe('diffNights', () => {
  it('calculates nights correctly', () => {
    expect(diffNights('2026-10-01', '2026-10-04')).toBe(3);
  });

  it('12 months from Oct 1 = 365 nights (non-leap year)', () => {
    expect(diffNights('2026-10-01', '2027-10-01')).toBe(365);
  });

  it('12 months from Oct 1 in leap year span = 366 nights', () => {
    // 2028 is leap, Feb 29 is included in this range
    expect(diffNights('2027-10-01', '2028-10-01')).toBe(366);
  });

  it('handles same day = 0 nights', () => {
    expect(diffNights('2026-10-01', '2026-10-01')).toBe(0);
  });
});

describe('toDateInputValue', () => {
  it('passes through YYYY-MM-DD strings', () => {
    expect(toDateInputValue('2026-10-01')).toBe('2026-10-01');
  });

  it('converts a Date to YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 1, 12, 0, 0); // Oct 1 2026 noon
    expect(toDateInputValue(d)).toBe('2026-10-01');
  });
});

describe('formatDateRangeOnly', () => {
  it('formats same month range', () => {
    const result = formatDateRangeOnly('2026-10-01', '2026-10-15');
    expect(result).toContain('1');
    expect(result).toContain('15');
    expect(result).toContain('oct');
  });

  it('formats cross-month same year range', () => {
    const result = formatDateRangeOnly('2026-10-01', '2027-04-01');
    expect(result).toContain('oct');
    expect(result).toContain('abr');
  });

  it('formats cross-year range', () => {
    const result = formatDateRangeOnly('2026-10-01', '2027-10-01');
    expect(result).toContain('2026');
    expect(result).toContain('2027');
  });
});
