import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/hooks/use-profile';

/**
 * Server-side: get the current user's profile + organization via the same
 * `get_my_profile()` RPC that the client uses.  Returns null only when
 * there is no authenticated session.  Throws on unexpected DB errors so
 * callers never silently swallow failures.
 */
export async function getServerProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase.rpc('get_my_profile');

  if (error) {
    throw new Error(`Error al obtener el perfil del usuario: ${error.message}`);
  }

  return data as UserProfile | null;
}
