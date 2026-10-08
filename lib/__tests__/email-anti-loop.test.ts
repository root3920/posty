import { describe, it, expect } from 'vitest';
import { shouldSkipEmail } from '../email/anti-loop';

describe('shouldSkipEmail', () => {
  it('skips auto-replied emails', () => {
    const result = shouldSkipEmail({ 'Auto-Submitted': 'auto-replied' });
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('Auto-Submitted');
  });

  it('skips auto-generated emails', () => {
    const result = shouldSkipEmail({ 'Auto-Submitted': 'auto-generated' });
    expect(result.skip).toBe(true);
  });

  it('allows Auto-Submitted: no', () => {
    const result = shouldSkipEmail({ 'Auto-Submitted': 'no' });
    expect(result.skip).toBe(false);
  });

  it('skips Precedence: bulk', () => {
    const result = shouldSkipEmail({ Precedence: 'bulk' });
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('Precedence');
  });

  it('skips Precedence: junk', () => {
    const result = shouldSkipEmail({ Precedence: 'junk' });
    expect(result.skip).toBe(true);
  });

  it('skips Precedence: list', () => {
    const result = shouldSkipEmail({ Precedence: 'list' });
    expect(result.skip).toBe(true);
  });

  it('skips X-Auto-Response-Suppress (Microsoft)', () => {
    const result = shouldSkipEmail({
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN',
    });
    expect(result.skip).toBe(true);
  });

  it('skips emails with X-Posty-Processed header', () => {
    const result = shouldSkipEmail({ 'X-Posty-Processed': 'true' });
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('X-Posty-Processed');
  });

  it('skips emails with X-Posty-Forwarded header', () => {
    const result = shouldSkipEmail({ 'X-Posty-Forwarded': 'true' });
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('X-Posty-Forwarded');
  });

  it('allows normal human emails', () => {
    const result = shouldSkipEmail({
      From: 'user@example.com',
      To: 'hotel@hoteles.postyassistant.com',
      Subject: 'Reserva',
    });
    expect(result.skip).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('handles case-insensitive header keys', () => {
    const result = shouldSkipEmail({ 'auto-submitted': 'auto-replied' });
    expect(result.skip).toBe(true);
  });

  it('handles empty headers', () => {
    const result = shouldSkipEmail({});
    expect(result.skip).toBe(false);
  });
});
