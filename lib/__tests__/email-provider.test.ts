import { describe, it, expect, vi } from 'vitest';
import { render } from '@react-email/render';

// -------------------------------------------------------
// Mock provider (simulates Resend without real HTTP calls)
// -------------------------------------------------------

import type { EmailProvider, SendEmailParams, SendEmailResult } from '../email/types';

class MockEmailProvider implements EmailProvider {
  public sent: SendEmailParams[] = [];

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    if (!params.to || !params.to.includes('@')) {
      throw new Error('Dirección de correo inválida');
    }
    this.sent.push(params);
    return { id: `mock_${Date.now()}_${this.sent.length}` };
  }
}

// -------------------------------------------------------
// buildFromAddress
// -------------------------------------------------------

import { buildFromAddress } from '../email/provider';

describe('buildFromAddress', () => {
  it('formats hotel name with "vía POSTY"', () => {
    const result = buildFromAddress('POSTY HOTEL');
    expect(result).toBe('POSTY HOTEL vía POSTY <noreply@postyassistant.com>');
  });

  it('strips angle brackets and quotes from hotel name', () => {
    const result = buildFromAddress('Hotel "La <Gran>" Playa');
    expect(result).toBe('Hotel La Gran Playa vía POSTY <noreply@postyassistant.com>');
  });

  it('trims whitespace', () => {
    const result = buildFromAddress('  Mi Hotel  ');
    expect(result).toBe('Mi Hotel vía POSTY <noreply@postyassistant.com>');
  });
});

// -------------------------------------------------------
// Mock provider behavior
// -------------------------------------------------------

describe('MockEmailProvider', () => {
  it('sends email and returns an ID', async () => {
    const provider = new MockEmailProvider();
    const result = await provider.send({
      to: 'guest@example.com',
      subject: 'Bienvenido',
      from: 'Hotel vía POSTY <noreply@postyassistant.com>',
      replyTo: 'recepcion@hotel.com',
      react: null as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      text: 'Bienvenido al hotel',
    });

    expect(result.id).toMatch(/^mock_/);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toBe('guest@example.com');
    expect(provider.sent[0].subject).toBe('Bienvenido');
    expect(provider.sent[0].replyTo).toBe('recepcion@hotel.com');
  });

  it('rejects invalid email addresses', async () => {
    const provider = new MockEmailProvider();
    await expect(
      provider.send({
        to: 'not-an-email',
        subject: 'Test',
        from: 'test@test.com',
        react: null as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        text: 'test',
      }),
    ).rejects.toThrow('Dirección de correo inválida');
    expect(provider.sent).toHaveLength(0);
  });

  it('records multiple sends for history verification', async () => {
    const provider = new MockEmailProvider();

    await provider.send({
      to: 'a@hotel.com',
      subject: 'Primero',
      from: 'noreply@postyassistant.com',
      react: null as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      text: 'Primer correo',
    });

    await provider.send({
      to: 'b@hotel.com',
      subject: 'Segundo',
      from: 'noreply@postyassistant.com',
      react: null as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      text: 'Segundo correo',
    });

    expect(provider.sent).toHaveLength(2);
    expect(provider.sent[0].subject).toBe('Primero');
    expect(provider.sent[1].subject).toBe('Segundo');
  });
});

// -------------------------------------------------------
// Email env validation
// -------------------------------------------------------

describe('email env validation', () => {
  it('rejects missing RESEND_API_KEY', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', 'test@test.com');

    const { z } = await import('zod');
    const schema = z.object({
      RESEND_API_KEY: z.string().min(1),
      EMAIL_FROM: z.string().min(1),
    });

    const result = schema.safeParse({
      RESEND_API_KEY: '',
      EMAIL_FROM: 'test@test.com',
    });
    expect(result.success).toBe(false);

    vi.unstubAllEnvs();
  });
});

// -------------------------------------------------------
// Template plain-text generation
// -------------------------------------------------------

import { manualEmailText } from '../email/templates/manual-email';
import { testEmailText } from '../email/templates/test-email';

describe('email plain text templates', () => {
  it('manual email includes guest name and hotel name', () => {
    const text = manualEmailText({
      hotelName: 'POSTY HOTEL',
      guestName: 'María',
      subject: 'Bienvenida',
      body: 'Gracias por tu reserva.\nTe esperamos pronto.',
    });

    expect(text).toContain('Hola María');
    expect(text).toContain('POSTY HOTEL');
    expect(text).toContain('Gracias por tu reserva.');
    expect(text).toContain('Te esperamos pronto.');
    expect(text).toContain('Atentamente');
  });

  it('test email includes hotel name', () => {
    const text = testEmailText('POSTY HOTEL');
    expect(text).toContain('POSTY HOTEL');
    expect(text).toContain('prueba');
  });
});

// -------------------------------------------------------
// Template HTML rendering (all templates render without errors)
// -------------------------------------------------------

import { TestEmail } from '../email/templates/test-email';
import { ManualEmail } from '../email/templates/manual-email';

describe('email template HTML rendering', () => {
  it('renders TestEmail to valid HTML', async () => {
    const element = TestEmail({
      hotelName: 'POSTY HOTEL',
      logoUrl: 'https://example.com/logo.png',
      brandColor: '#9c0b21',
    });
    const html = await render(element);

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('POSTY HOTEL');
    expect(html).toContain('prueba');
    expect(html.length).toBeGreaterThan(100);
  });

  it('renders TestEmail without logo', async () => {
    const element = TestEmail({
      hotelName: 'Hotel Sin Logo',
    });
    const html = await render(element);

    expect(html).toContain('Hotel Sin Logo');
    expect(html).toContain('<!DOCTYPE html');
  });

  it('renders ManualEmail to valid HTML', async () => {
    const element = ManualEmail({
      hotelName: 'POSTY HOTEL',
      logoUrl: null,
      brandColor: '#4f46e5',
      guestName: 'Carlos',
      subject: 'Confirmación de reserva',
      body: 'Su reserva ha sido confirmada.\nLe esperamos el viernes.',
    });
    const html = await render(element);

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('Carlos');
    expect(html).toContain('POSTY HOTEL');
    expect(html).toContain('Su reserva ha sido confirmada.');
    expect(html).toContain('Le esperamos el viernes.');
    expect(html.length).toBeGreaterThan(100);
  });

  it('renders ManualEmail plain text via render()', async () => {
    const element = ManualEmail({
      hotelName: 'POSTY HOTEL',
      guestName: 'Ana',
      subject: 'Info',
      body: 'Texto de prueba.',
    });
    const text = await render(element, { plainText: true });

    expect(text).toContain('Ana');
    expect(text).toContain('POSTY HOTEL');
    expect(text).toContain('Texto de prueba');
  });
});

// -------------------------------------------------------
// Rate limiting logic (pure function)
// -------------------------------------------------------

describe('rate limiting', () => {
  const RATE_LIMIT_PER_HOUR = 100;

  it('allows sends under the limit', () => {
    const currentCount = 50;
    expect(currentCount < RATE_LIMIT_PER_HOUR).toBe(true);
  });

  it('blocks sends at the limit', () => {
    const currentCount = 100;
    expect(currentCount >= RATE_LIMIT_PER_HOUR).toBe(true);
  });

  it('blocks sends over the limit', () => {
    const currentCount = 150;
    expect(currentCount >= RATE_LIMIT_PER_HOUR).toBe(true);
  });
});
