import { createAdminClient } from '@/lib/supabase/admin';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Check if email sending is paused for an organization.
 * Returns null if OK, or an error message if paused.
 */
export async function checkEmailPaused(orgId: string): Promise<string | null> {
  const db = createAdminClient() as any;
  const { data } = await db
    .from('organizations')
    .select('email_paused')
    .eq('id', orgId)
    .single();

  if (data?.email_paused) {
    return 'El envío de correos está pausado para este hotel. Contacta al administrador.';
  }

  return null;
}
