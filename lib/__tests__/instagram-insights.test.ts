import { describe, it, expect } from 'vitest';
import {
  splitInto30DayWindows,
  calcVariation,
  calcEngagementRate,
} from '../instagram/insights-metrics';

describe('splitInto30DayWindows', () => {
  it('returns a single window for ranges <= 30 days', () => {
    const since = new Date('2026-09-01');
    const until = new Date('2026-09-30');
    const windows = splitInto30DayWindows(since, until);

    expect(windows).toHaveLength(1);
    expect(windows[0].since.toISOString().split('T')[0]).toBe('2026-09-01');
    expect(windows[0].until.toISOString().split('T')[0]).toBe('2026-09-30');
  });

  it('splits a 60-day range into 2 windows', () => {
    const since = new Date('2026-08-01');
    const until = new Date('2026-09-30');
    const windows = splitInto30DayWindows(since, until);

    expect(windows).toHaveLength(2);
    expect(windows[0].since.toISOString().split('T')[0]).toBe('2026-08-01');
    expect(windows[0].until.toISOString().split('T')[0]).toBe('2026-08-31');
    expect(windows[1].since.toISOString().split('T')[0]).toBe('2026-08-31');
    expect(windows[1].until.toISOString().split('T')[0]).toBe('2026-09-30');
  });

  it('handles a 7-day range as a single window', () => {
    const since = new Date('2026-09-24');
    const until = new Date('2026-10-01');
    const windows = splitInto30DayWindows(since, until);

    expect(windows).toHaveLength(1);
  });

  it('handles a 90-day range in 3 windows', () => {
    const since = new Date('2026-07-01');
    const until = new Date('2026-09-28');
    const windows = splitInto30DayWindows(since, until);

    expect(windows).toHaveLength(3);
  });
});

describe('calcVariation', () => {
  it('returns positive variation for increase', () => {
    expect(calcVariation(120, 100)).toBeCloseTo(20);
  });

  it('returns negative variation for decrease', () => {
    expect(calcVariation(80, 100)).toBeCloseTo(-20);
  });

  it('returns 0 for no change', () => {
    expect(calcVariation(100, 100)).toBeCloseTo(0);
  });

  it('returns null when previous is 0', () => {
    expect(calcVariation(100, 0)).toBeNull();
  });

  it('returns null when previous is null', () => {
    expect(calcVariation(100, null)).toBeNull();
  });

  it('returns null when current is null', () => {
    expect(calcVariation(null, 100)).toBeNull();
  });
});

describe('calcEngagementRate', () => {
  it('calculates correctly', () => {
    expect(calcEngagementRate(50, 1000)).toBeCloseTo(5);
  });

  it('returns null when reach is 0', () => {
    expect(calcEngagementRate(50, 0)).toBeNull();
  });

  it('returns null when reach is null', () => {
    expect(calcEngagementRate(50, null)).toBeNull();
  });

  it('returns null when interactions is null', () => {
    expect(calcEngagementRate(null, 1000)).toBeNull();
  });

  it('handles high engagement rates', () => {
    expect(calcEngagementRate(500, 100)).toBeCloseTo(500);
  });
});
