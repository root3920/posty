import { z } from 'zod';

const emailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY no está configurada'),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM no está configurada'),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_HOTEL_DOMAIN: z.string().min(1).default('hoteles.postyassistant.com'),
  EMAIL_FROM_SYSTEM: z.string().optional(),
});

export type EmailEnv = z.infer<typeof emailEnvSchema>;

let _cached: EmailEnv | null = null;
let _error: string | null = null;

export function getEmailEnv(): { env: EmailEnv | null; error: string | null } {
  if (_cached) return { env: _cached, error: null };
  if (_error) return { env: null, error: _error };

  const result = emailEnvSchema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    EMAIL_HOTEL_DOMAIN: process.env.EMAIL_HOTEL_DOMAIN || 'hoteles.postyassistant.com',
    EMAIL_FROM_SYSTEM: process.env.EMAIL_FROM_SYSTEM,
  });

  if (!result.success) {
    _error = result.error.issues.map((i) => i.message).join('. ');
    return { env: null, error: _error };
  }

  _cached = result.data;
  return { env: _cached, error: null };
}

/** Get the hotel email domain. Falls back to default if env not loaded. */
export function getEmailDomain(): string {
  const { env } = getEmailEnv();
  return env?.EMAIL_HOTEL_DOMAIN || 'hoteles.postyassistant.com';
}

/** Reset cache — only for tests */
export function resetEmailEnvCache() {
  _cached = null;
  _error = null;
}
