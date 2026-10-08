import { describe, it, expect, vi, beforeEach } from 'vitest';

// -------------------------------------------------------
// buildHotelFromAddress, buildReplyToAddress, generateMessageId
// These functions depend on getEmailEnv() which reads process.env.
// We stub the env vars so the functions work in tests.
// -------------------------------------------------------

describe('hotel email address builders', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 'test_key');
    vi.stubEnv('EMAIL_FROM', 'POSTY <noreply@postyassistant.com>');
    vi.stubEnv('EMAIL_HOTEL_DOMAIN', 'mail.postyassistant.com');

    // Reset the cached env so changes take effect
    vi.resetModules();
  });

  it('buildHotelFromAddress formats correctly', async () => {
    const { buildHotelFromAddress } = await import('../email/provider');
    const { resetEmailEnvCache } = await import('../email/env');
    resetEmailEnvCache();

    const result = buildHotelFromAddress('Hotel Sol', 'hotel-sol');
    expect(result).toBe('Hotel Sol <hotel-sol@mail.postyassistant.com>');
  });

  it('buildHotelFromAddress strips special chars', async () => {
    const { buildHotelFromAddress } = await import('../email/provider');
    const { resetEmailEnvCache } = await import('../email/env');
    resetEmailEnvCache();

    const result = buildHotelFromAddress('Hotel "La <Gran>" Playa', 'hotel-playa');
    expect(result).toBe('Hotel La Gran Playa <hotel-playa@mail.postyassistant.com>');
  });

  it('buildReplyToAddress includes thread token', async () => {
    const { buildReplyToAddress } = await import('../email/provider');
    const { resetEmailEnvCache } = await import('../email/env');
    resetEmailEnvCache();

    const result = buildReplyToAddress('hotel-sol', 'abc123xyz');
    expect(result).toBe('hotel-sol+abc123xyz@mail.postyassistant.com');
  });

  it('generateMessageId creates RFC-format ID', async () => {
    const { generateMessageId } = await import('../email/provider');
    const { resetEmailEnvCache } = await import('../email/env');
    resetEmailEnvCache();

    const result = generateMessageId('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBe('<550e8400-e29b-41d4-a716-446655440000@mail.postyassistant.com>');
  });

  it('buildFromAddress still works for system emails', async () => {
    const { buildFromAddress } = await import('../email/provider');
    const result = buildFromAddress('Hotel Sol');
    expect(result).toBe('Hotel Sol vía POSTY <noreply@postyassistant.com>');
  });
});
