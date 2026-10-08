import { ResendProvider } from './resend-provider';
import { getEmailEnv, getEmailDomain } from './env';
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
 * "Hotel Name <alias@hoteles.postyassistant.com>"
 */
export function buildHotelFromAddress(hotelName: string, alias: string): string {
  const domain = getEmailDomain();
  const clean = hotelName.replace(/[<>"]/g, '').trim();
  return `${clean} <${alias}@${domain}>`;
}

/**
 * Build the Reply-To address with thread token for inbound routing:
 * "alias+token@hoteles.postyassistant.com"
 */
export function buildReplyToAddress(alias: string, threadToken: string): string {
  const domain = getEmailDomain();
  return `${alias}+${threadToken}@${domain}`;
}

/**
 * Generate a RFC-compliant Message-ID for outbound emails.
 */
export function generateMessageId(uuid: string): string {
  const domain = getEmailDomain();
  return `<${uuid}@${domain}>`;
}

// Re-export the interface for backward compatibility
export type { EmailProvider };
