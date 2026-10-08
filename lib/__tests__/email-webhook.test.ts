import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

/**
 * Webhook signature verification tests.
 *
 * We test the verifySignature logic directly since the webhook handler
 * depends on the full Resend + Supabase infrastructure.
 */

// Replicate the verify function from the route
function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  const parts = signature.split(',');
  if (parts.length < 2) return false;

  const timestampAndSig = parts[1];
  if (!timestampAndSig) return false;

  const [timestamp, sig] = timestampAndSig.split('.');
  if (!timestamp || !sig) return false;

  const signedPayload = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Helper to create a valid signature
function createValidSignature(body: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${body}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('base64');
  return `v1,${timestamp}.${sig}`;
}

describe('webhook signature verification', () => {
  const secret = 'whsec_test_secret_key_123';
  const body = JSON.stringify({ type: 'email.received', data: { email_id: 'test-123' } });

  it('accepts valid signature', () => {
    const signature = createValidSignature(body, secret);
    expect(verifySignature(body, signature, secret)).toBe(true);
  });

  it('rejects null signature', () => {
    expect(verifySignature(body, null, secret)).toBe(false);
  });

  it('rejects empty signature', () => {
    expect(verifySignature(body, '', secret)).toBe(false);
  });

  it('rejects malformed signature (no comma)', () => {
    expect(verifySignature(body, 'v1.wrong', secret)).toBe(false);
  });

  it('rejects malformed signature (no dot)', () => {
    expect(verifySignature(body, 'v1,nodot', secret)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const signature = createValidSignature(body, secret);
    expect(verifySignature(body, signature, 'wrong_secret')).toBe(false);
  });

  it('rejects tampered body', () => {
    const signature = createValidSignature(body, secret);
    const tamperedBody = JSON.stringify({ type: 'email.received', data: { email_id: 'hacked' } });
    expect(verifySignature(tamperedBody, signature, secret)).toBe(false);
  });

  it('rejects signature with different timestamp', () => {
    // Create signature with one timestamp, then replace it
    const signature = createValidSignature(body, secret);
    const parts = signature.split(',');
    const [, sig] = parts[1].split('.');
    const fakeSignature = `v1,9999999999.${sig}`;
    expect(verifySignature(body, fakeSignature, secret)).toBe(false);
  });
});

// -------------------------------------------------------
// Anti-loop integration (tested in email-anti-loop.test.ts)
// Here we verify the exact header values that the webhook
// handler would encounter from real email providers.
// -------------------------------------------------------

import { shouldSkipEmail } from '../email/anti-loop';

describe('anti-loop with real-world headers', () => {
  it('skips Gmail vacation auto-reply', () => {
    const result = shouldSkipEmail({
      'Auto-Submitted': 'auto-replied',
      'X-Google-Smtp-Source': 'abc123',
      'Precedence': 'bulk',
    });
    expect(result.skip).toBe(true);
  });

  it('skips Outlook out-of-office', () => {
    const result = shouldSkipEmail({
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
      'Auto-Submitted': 'auto-generated',
    });
    expect(result.skip).toBe(true);
  });

  it('skips our own forwarded copies', () => {
    const result = shouldSkipEmail({
      'X-Posty-Forwarded': 'true',
      'From': 'Hotel vía POSTY <noreply@postyassistant.com>',
    });
    expect(result.skip).toBe(true);
  });

  it('allows a normal reply from a guest', () => {
    const result = shouldSkipEmail({
      'From': 'guest@gmail.com',
      'To': 'hotel-sol+abc123@hoteles.postyassistant.com',
      'Subject': 'Re: Confirmación de reserva',
      'In-Reply-To': '<msg-123@hoteles.postyassistant.com>',
    });
    expect(result.skip).toBe(false);
  });

  it('allows newsletters (hotel may want to see them)', () => {
    // We allow List-Unsubscribe emails through — they go to "Otros" tab
    const result = shouldSkipEmail({
      'From': 'newsletter@booking.com',
      'List-Unsubscribe': '<mailto:unsub@booking.com>',
    });
    expect(result.skip).toBe(false);
  });
});
