import { ResendProvider } from './resend-provider';
import { getEmailEnv } from './env';
import type { EmailProvider } from './types';

export function getEmailProvider(): EmailProvider {
  const { env, error } = getEmailEnv();
  if (!env) {
    throw new Error(`Email no está configurado en el servidor: ${error}`);
  }
  return new ResendProvider(env.RESEND_API_KEY);
}

export function isEmailConfigured(): boolean {
  const { env } = getEmailEnv();
  return env !== null;
}

/**
 * Build the From header: "Hotel Name vía POSTY <noreply@postyassistant.com>"
 */
export function buildFromAddress(hotelName: string): string {
  const clean = hotelName.replace(/[<>"]/g, '').trim();
  return `${clean} vía POSTY <noreply@postyassistant.com>`;
}
