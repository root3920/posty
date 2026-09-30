import { z } from 'zod';

const whatsappEnvSchema = z.object({
  EVOLUTION_API_URL: z.string().min(1, 'EVOLUTION_API_URL no está configurada'),
  EVOLUTION_API_KEY: z.string().min(1, 'EVOLUTION_API_KEY no está configurada'),
  WHATSAPP_WEBHOOK_SECRET: z.string().min(1, 'WHATSAPP_WEBHOOK_SECRET no está configurada'),
});

export type WhatsAppEnv = z.infer<typeof whatsappEnvSchema>;

let _cached: WhatsAppEnv | null = null;
let _error: string | null = null;

/**
 * Validates and returns the WhatsApp environment variables.
 * Returns { env, error } — if error is set, env is null.
 */
export function getWhatsAppEnv(): { env: WhatsAppEnv | null; error: string | null } {
  if (_cached) return { env: _cached, error: null };
  if (_error) return { env: null, error: _error };

  const result = whatsappEnvSchema.safeParse({
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
    WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET,
  });

  if (!result.success) {
    _error = result.error.issues.map((i) => i.message).join('. ');
    return { env: null, error: _error };
  }

  _cached = result.data;
  return { env: _cached, error: null };
}
