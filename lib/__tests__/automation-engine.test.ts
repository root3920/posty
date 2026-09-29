import { describe, it, expect } from 'vitest';
import { evaluateConditions, resolveVariables, type ConditionGroup } from '../automation-engine';

describe('evaluateConditions', () => {
  const payload = {
    stay: { code: 'POS-000001', nights: 5, channel: 'Booking', adults: 2, children: 1 },
    guest: { first_name: 'Carlos', last_name: 'García', nationality: 'CO' },
    room: { number: '104', type: 'Twin Confort', floor: '1' },
  };

  it('returns true for null/empty conditions', () => {
    expect(evaluateConditions(null, payload)).toBe(true);
    expect(evaluateConditions(undefined, payload)).toBe(true);
    expect(evaluateConditions({ logic: 'and', conditions: [] }, payload)).toBe(true);
  });

  it('evaluates "is" operator', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [{ field: 'stay.channel', operator: 'is', value: 'Booking' }],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
  });

  it('evaluates "is_not" operator', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [{ field: 'stay.channel', operator: 'is_not', value: 'Directo' }],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
  });

  it('evaluates "contains" operator (case insensitive)', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [{ field: 'guest.last_name', operator: 'contains', value: 'garc' }],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
  });

  it('evaluates "gt" operator', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [{ field: 'stay.nights', operator: 'gt', value: 3 }],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
    expect(evaluateConditions(
      { logic: 'and', conditions: [{ field: 'stay.nights', operator: 'gt', value: 10 }] },
      payload,
    )).toBe(false);
  });

  it('evaluates "between" operator', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [{ field: 'stay.nights', operator: 'between', value: [3, 7] }],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
  });

  it('evaluates "is_empty" and "is_not_empty"', () => {
    expect(evaluateConditions(
      { logic: 'and', conditions: [{ field: 'stay.notes', operator: 'is_empty' }] },
      payload,
    )).toBe(true);
    expect(evaluateConditions(
      { logic: 'and', conditions: [{ field: 'guest.first_name', operator: 'is_not_empty' }] },
      payload,
    )).toBe(true);
  });

  it('evaluates "is_one_of" operator', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [{ field: 'stay.channel', operator: 'is_one_of', value: ['Booking', 'Expedia'] }],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
    expect(evaluateConditions(
      { logic: 'and', conditions: [{ field: 'stay.channel', operator: 'is_one_of', value: ['Directo', 'Walk-in'] }] },
      payload,
    )).toBe(false);
  });

  it('evaluates AND logic (all must be true)', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [
        { field: 'stay.channel', operator: 'is', value: 'Booking' },
        { field: 'stay.nights', operator: 'gt', value: 3 },
        { field: 'stay.children', operator: 'gt', value: 0 },
      ],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
  });

  it('evaluates OR logic (any must be true)', () => {
    const group: ConditionGroup = {
      logic: 'or',
      conditions: [
        { field: 'stay.channel', operator: 'is', value: 'Directo' },
        { field: 'stay.nights', operator: 'gt', value: 100 },
        { field: 'guest.nationality', operator: 'is', value: 'CO' },
      ],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
  });

  it('evaluates nested groups', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [
        { field: 'stay.channel', operator: 'is', value: 'Booking' },
        {
          logic: 'or',
          conditions: [
            { field: 'stay.nights', operator: 'gt', value: 7 },
            { field: 'stay.children', operator: 'gt', value: 0 },
          ],
        },
      ],
    };
    expect(evaluateConditions(group, payload)).toBe(true);
  });

  it('returns false when AND has a false condition', () => {
    const group: ConditionGroup = {
      logic: 'and',
      conditions: [
        { field: 'stay.channel', operator: 'is', value: 'Booking' },
        { field: 'stay.nights', operator: 'gt', value: 100 },
      ],
    };
    expect(evaluateConditions(group, payload)).toBe(false);
  });
});

describe('resolveVariables', () => {
  const payload = {
    stay: { code: 'POS-000001', nights: 5 },
    guest: { first_name: 'Carlos', last_name: 'García' },
    room: { number: '104', type: 'Twin Confort' },
    hotel: { name: 'POSTY Hotel' },
  };

  it('resolves simple variables', () => {
    expect(resolveVariables('Reserva {stay.code}', payload)).toBe('Reserva POS-000001');
  });

  it('resolves multiple variables', () => {
    expect(resolveVariables('{guest.first_name} {guest.last_name} · Hab. {room.number}', payload))
      .toBe('Carlos García · Hab. 104');
  });

  it('replaces missing variables with empty string', () => {
    expect(resolveVariables('Nota: {stay.notes}', payload)).toBe('Nota: ');
  });

  it('handles no variables', () => {
    expect(resolveVariables('Texto sin variables', payload)).toBe('Texto sin variables');
  });

  it('handles nested paths', () => {
    expect(resolveVariables('{hotel.name}', payload)).toBe('POSTY Hotel');
  });
});
