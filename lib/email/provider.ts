import { ResendProvider } from './resend-provider';
import { getEmailEnv } from './env';
import type { EmailProvider } from './types';

export function getEmailProvider(): ResendProvider {
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
 * Build the From header for system emails:
 * "Hotel Name vía POSTY <noreply@postyassistant.com>"
 */
export function buildFromAddress(hotelName: string): string {
  const clean = hotelName.replace(/[<>"]/g, '').trim();
  return `${clean} vía POSTY <noreply@postyassistant.com>`;
}

/**
 * Build the From header for hotel-specific emails:
 * "Hotel Name <alias@mail.postyassistant.com>"
 */
export function buildHotelFromAddress(hotelName: string, alias: string): string {
  const { env } = getEmailEnv();
  const domain = env?.EMAIL_HOTEL_DOMAIN || 'mail.postyassistant.com';
  const clean = hotelName.replace(/[<>"]/g, '').trim();
  return `${clean} <${alias}@${domain}>`;
}

/**
 * Build the Reply-To address with thread token for inbound routing:
 * "alias+token@mail.postyassistant.com"
 */
export function buildReplyToAddress(alias: string, threadToken: string): string {
  const { env } = getEmailEnv();
  const domain = env?.EMAIL_HOTEL_DOMAIN || 'mail.postyassistant.com';
  return `${alias}+${threadToken}@${domain}`;
}

/**
 * Generate a RFC-compliant Message-ID for outbound emails.
 */
export function generateMessageId(uuid: string): string {
  const { env } = getEmailEnv();
  const domain = env?.EMAIL_HOTEL_DOMAIN || 'mail.postyassistant.com';
  return `<${uuid}@${domain}>`;
}

// Re-export the interface for backward compatibility
export type { EmailProvider };
