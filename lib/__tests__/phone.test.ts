import { describe, it, expect } from 'vitest';
import { normalizeToE164 } from '../validations/phone';
import { isValidPhoneNumber } from 'libphonenumber-js';

describe('Phone validation', () => {
  it('validates Colombian numbers', () => {
    expect(isValidPhoneNumber('+573248239884')).toBe(true);
    expect(isValidPhoneNumber('+5732482398')).toBe(false); // too short
  });
  it('validates US numbers', () => {
    expect(isValidPhoneNumber('+12025551234')).toBe(true);
  });
  it('validates Mexican numbers', () => {
    expect(isValidPhoneNumber('+525512345678')).toBe(true);
  });
  it('validates Spanish numbers', () => {
    expect(isValidPhoneNumber('+34612345678')).toBe(true);
  });
  it('rejects invalid numbers', () => {
    expect(isValidPhoneNumber('+1234')).toBe(false);
    expect(isValidPhoneNumber('abc')).toBe(false);
  });
});

describe('normalizeToE164', () => {
  it('normalizes CO number', () => {
    expect(normalizeToE164('3248239884', 'CO')).toBe('+573248239884');
  });
  it('normalizes US number', () => {
    expect(normalizeToE164('2025551234', 'US')).toBe('+12025551234');
  });
  it('passes through E.164', () => {
    expect(normalizeToE164('+573248239884', 'CO')).toBe('+573248239884');
  });
  it('returns null for invalid', () => {
    expect(normalizeToE164('abc', 'CO')).toBeNull();
  });
  it('normalizes MX number', () => {
    expect(normalizeToE164('5512345678', 'MX')).toBe('+525512345678');
  });
});
