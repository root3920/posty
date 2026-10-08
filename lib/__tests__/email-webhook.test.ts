import { describe, it, expect } from 'vitest';
import { Webhook } from 'svix';

/**
 * Webhook signature verification tests using the svix library
 * (same library Resend uses to sign webhooks).
 */

describe('webhook signature verification (svix)', () => {
  // whsec_ prefix is required by svix — this is a test-only secret
  const secret = 'whsec_dGVzdF9zZWNyZXRfa2V5XzEyMw==';
  const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'evt_123' } });

  function signPayload(payload: string, signingSecret: string) {
    const wh = new Webhook(signingSecret);
    const msgId = 'msg_test_123';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // svix signs: base64(HMAC-SHA256(secret, "${msgId}.${timestamp}.${body}"))
    // We use the Webhook.sign method if available, otherwise build headers manually.
    // The Webhook class verifies — to create valid signatures we use the same internal algorithm.
    const crypto = require('crypto');
    const secretBytes = Buffer.from(signingSecret.split('_').slice(1).join('_'), 'base64');
    const toSign = `${msgId}.${timestamp}.${payload}`;
    const sig = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

    return {
      headers: {
        'svix-id': msgId,
        'svix-timestamp': timestamp,
        'svix-signature': `v1,${sig}`,
      },
    };
  }

  it('accepts valid svix signature', () => {
    const { headers } = signPayload(body, secret);
    const wh = new Webhook(secret);
    // Should not throw — that's the assertion
    expect(() => wh.verify(body, headers)).not.toThrow();
  });

  it('rejects tampered body', () => {
    const { headers } = signPayload(body, secret);
    const wh = new Webhook(secret);
    const tampered = JSON.stringify({ type: 'email.delivered', data: { email_id: 'hacked' } });
    expect(() => wh.verify(tampered, headers)).toThrow();
  });

  it('rejects wrong secret', () => {
    const { headers } = signPayload(body, secret);
    const wrongSecret = 'whsec_d3Jvbmdfc2VjcmV0X2tleQ==';
    const wh = new Webhook(wrongSecret);
    expect(() => wh.verify(body, headers)).toThrow();
  });

  it('rejects missing svix-id header', () => {
    const { headers } = signPayload(body, secret);
    const wh = new Webhook(secret);
    expect(() => wh.verify(body, { ...headers, 'svix-id': '' })).toThrow();
  });

  it('rejects missing svix-timestamp header', () => {
    const { headers } = signPayload(body, secret);
    const wh = new Webhook(secret);
    expect(() => wh.verify(body, { ...headers, 'svix-timestamp': '' })).toThrow();
  });

  it('rejects missing svix-signature header', () => {
    const { headers } = signPayload(body, secret);
    const wh = new Webhook(secret);
    expect(() => wh.verify(body, { ...headers, 'svix-signature': '' })).toThrow();
  });

  it('rejects tampered signature', () => {
    const { headers } = signPayload(body, secret);
    const wh = new Webhook(secret);
    expect(() => wh.verify(body, { ...headers, 'svix-signature': 'v1,invalid_sig==' })).toThrow();
  });
});

// -------------------------------------------------------
// Anti-loop integration
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
    const result = shouldSkipEmail({
      'From': 'newsletter@booking.com',
      'List-Unsubscribe': '<mailto:unsub@booking.com>',
    });
    expect(result.skip).toBe(false);
  });
});
