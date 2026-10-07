/**
 * Single source of truth for public routes.
 * Used by proxy.ts (middleware) to skip auth checks.
 * Add any new cron/webhook endpoint here.
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/auth/callback',
  '/auth/setup',
  '/api/cron',
  '/api/webhooks/whatsapp',
  '/api/webhooks/resend',
  '/api/instagram/callback',
  '/contrato',
] as const;

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
