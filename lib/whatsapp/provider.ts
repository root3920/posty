import { EvolutionProvider } from './evolution-provider';
import { getWhatsAppEnv } from './env';
import type { WhatsAppProvider } from './types';

/**
 * Returns the WhatsApp provider, or throws with a user-friendly message
 * if the environment variables are not configured.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  const { env, error } = getWhatsAppEnv();
  if (!env) {
    throw new Error(`WhatsApp no está configurado en el servidor: ${error}`);
  }
  return new EvolutionProvider(env.EVOLUTION_API_URL, env.EVOLUTION_API_KEY);
}

/**
 * Check if WhatsApp is configured (env vars present).
 * Safe to call without throwing.
 */
export function isWhatsAppConfigured(): boolean {
  const { env } = getWhatsAppEnv();
  return env !== null;
}
