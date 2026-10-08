import { describe, it, expect } from 'vitest';
import {
  validateAlias,
  generateAlias,
  parseRecipientAddress,
  RESERVED_ALIASES,
} from '../email/alias';

describe('validateAlias', () => {
  it('accepts valid aliases', () => {
    expect(validateAlias('hotel-sol')).toBeNull();
    expect(validateAlias('mi-hotel-123')).toBeNull();
    expect(validateAlias('abc')).toBeNull();
    expect(validateAlias('a'.repeat(40))).toBeNull();
  });

  it('rejects empty alias', () => {
    expect(validateAlias('')).toBeTruthy();
  });

  it('rejects alias shorter than 3 chars', () => {
    expect(validateAlias('ab')).toContain('3 caracteres');
  });

  it('rejects alias longer than 40 chars', () => {
    expect(validateAlias('a'.repeat(41))).toContain('40 caracteres');
  });

  it('rejects alias starting with hyphen', () => {
    expect(validateAlias('-hotel')).toBeTruthy();
  });

  it('rejects alias ending with hyphen', () => {
    expect(validateAlias('hotel-')).toBeTruthy();
  });

  it('rejects uppercase characters', () => {
    expect(validateAlias('Hotel')).toBeTruthy();
  });

  it('rejects double hyphens', () => {
    expect(validateAlias('hotel--sol')).toContain('dos guiones');
  });

  it('rejects reserved words', () => {
    for (const word of ['admin', 'postmaster', 'abuse', 'noreply', 'posty']) {
      expect(validateAlias(word)).toContain('reservada');
    }
  });
});

describe('generateAlias', () => {
  it('converts hotel name to slug', () => {
    expect(generateAlias('Hotel La Gran Playa')).toBe('hotel-la-gran-playa');
  });

  it('strips diacritics', () => {
    expect(generateAlias('Café Montaña')).toBe('cafe-montana');
  });

  it('removes special characters', () => {
    expect(generateAlias('POSTY HOTEL & SPA')).toBe('posty-hotel-spa');
  });

  it('handles very short names', () => {
    const result = generateAlias('AB');
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('truncates very long names', () => {
    const longName = 'Hotel ' + 'Supercalifragilisticexpialidocious'.repeat(3);
    const result = generateAlias(longName);
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it('avoids reserved words', () => {
    const result = generateAlias('Admin');
    expect(RESERVED_ALIASES.has(result)).toBe(false);
  });

  it('handles numbers', () => {
    expect(generateAlias('Hotel 123')).toBe('hotel-123');
  });
});

describe('parseRecipientAddress', () => {
  const domain = 'mail.postyassistant.com';

  it('parses alias without token', () => {
    const result = parseRecipientAddress('hotel-sol@mail.postyassistant.com', domain);
    expect(result).toEqual({ alias: 'hotel-sol', token: null });
  });

  it('parses alias with token', () => {
    const result = parseRecipientAddress(
      'hotel-sol+abc123xyz@mail.postyassistant.com',
      domain,
    );
    expect(result).toEqual({ alias: 'hotel-sol', token: 'abc123xyz' });
  });

  it('returns null for wrong domain', () => {
    const result = parseRecipientAddress('user@gmail.com', domain);
    expect(result).toBeNull();
  });

  it('returns null for missing @', () => {
    const result = parseRecipientAddress('nodomain', domain);
    expect(result).toBeNull();
  });

  it('handles case-insensitive domain', () => {
    const result = parseRecipientAddress(
      'hotel@MAIL.POSTYASSISTANT.COM',
      domain,
    );
    expect(result).toEqual({ alias: 'hotel', token: null });
  });

  it('handles empty token after +', () => {
    const result = parseRecipientAddress('hotel+@mail.postyassistant.com', domain);
    expect(result).toEqual({ alias: 'hotel', token: null });
  });
});
