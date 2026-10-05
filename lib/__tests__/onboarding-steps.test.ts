import { describe, it, expect } from 'vitest';
import { ONBOARDING_STEPS, ESSENTIAL_STEP_IDS } from '../onboarding/steps';
import type { OnboardingCounts } from '../onboarding/types';

const EMPTY_COUNTS: OnboardingCounts = {
  room_types: 0,
  rooms: 0,
  stays: 0,
  team_members: 1, // Owner always counts as 1
  payment_methods: 0,
  event_venues: 0,
  recurring_tasks: 0,
  whatsapp_connected: 0,
  instagram_connected: 0,
  has_tax_id: false,
  has_rnt: false,
  has_logo: false,
};

const FULL_COUNTS: OnboardingCounts = {
  room_types: 3,
  rooms: 10,
  stays: 5,
  team_members: 4,
  payment_methods: 6,
  event_venues: 2,
  recurring_tasks: 3,
  whatsapp_connected: 1,
  instagram_connected: 1,
  has_tax_id: true,
  has_rnt: true,
  has_logo: true,
};

describe('Onboarding step definitions', () => {
  it('all steps have unique IDs', () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all steps have a valid stage', () => {
    const validStages = new Set(['essential', 'team', 'operations', 'optional']);
    for (const step of ONBOARDING_STEPS) {
      expect(validStages.has(step.stage)).toBe(true);
    }
  });

  it('all steps have non-empty title, why, and href', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.why.length).toBeGreaterThan(0);
      expect(step.href.startsWith('/')).toBe(true);
    }
  });

  it('essential steps are not skippable', () => {
    const essential = ONBOARDING_STEPS.filter((s) => s.stage === 'essential');
    for (const step of essential) {
      expect(step.skippable).toBe(false);
    }
  });

  it('ESSENTIAL_STEP_IDS matches essential steps', () => {
    const expected = ONBOARDING_STEPS.filter((s) => s.stage === 'essential').map((s) => s.id);
    expect(ESSENTIAL_STEP_IDS).toEqual(expected);
  });
});

describe('Step completion checks', () => {
  it('empty hotel has no steps completed', () => {
    const completed = ONBOARDING_STEPS.filter((s) => s.checkCompleted(EMPTY_COUNTS));
    // payment_methods = 0 and team = 1 (only owner), so nothing should be complete
    expect(completed.length).toBe(0);
  });

  it('fully configured hotel has most steps completed', () => {
    const completed = ONBOARDING_STEPS.filter((s) => s.checkCompleted(FULL_COUNTS));
    // Some steps always return false (schedules, housekeeping) — they're skippable
    expect(completed.length).toBeGreaterThanOrEqual(12);
  });

  it('company_data completes when tax_id is set', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'company_data')!;
    expect(step.checkCompleted({ ...EMPTY_COUNTS, has_tax_id: false })).toBe(false);
    expect(step.checkCompleted({ ...EMPTY_COUNTS, has_tax_id: true })).toBe(true);
  });

  it('room_types completes when at least 1 exists', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'room_types')!;
    expect(step.checkCompleted({ ...EMPTY_COUNTS, room_types: 0 })).toBe(false);
    expect(step.checkCompleted({ ...EMPTY_COUNTS, room_types: 1 })).toBe(true);
  });

  it('rooms completes when at least 1 active room exists', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'rooms')!;
    expect(step.checkCompleted({ ...EMPTY_COUNTS, rooms: 0 })).toBe(false);
    expect(step.checkCompleted({ ...EMPTY_COUNTS, rooms: 5 })).toBe(true);
  });

  it('first_stay completes when at least 1 stay exists', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'first_stay')!;
    expect(step.checkCompleted({ ...EMPTY_COUNTS, stays: 0 })).toBe(false);
    expect(step.checkCompleted({ ...EMPTY_COUNTS, stays: 1 })).toBe(true);
  });

  it('invite_users completes when team > 1', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'invite_users')!;
    expect(step.checkCompleted({ ...EMPTY_COUNTS, team_members: 1 })).toBe(false);
    expect(step.checkCompleted({ ...EMPTY_COUNTS, team_members: 2 })).toBe(true);
  });

  it('whatsapp completes when connected', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'whatsapp')!;
    expect(step.checkCompleted({ ...EMPTY_COUNTS, whatsapp_connected: 0 })).toBe(false);
    expect(step.checkCompleted({ ...EMPTY_COUNTS, whatsapp_connected: 1 })).toBe(true);
  });

  it('brand completes when logo is set', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'brand')!;
    expect(step.checkCompleted({ ...EMPTY_COUNTS, has_logo: false })).toBe(false);
    expect(step.checkCompleted({ ...EMPTY_COUNTS, has_logo: true })).toBe(true);
  });
});
