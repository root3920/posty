import { cookies } from 'next/headers';

const COUNTRY_COOKIE = 'posty_country';
const DEFAULT_COUNTRY = 'CO';

// -------------------------------------------------------
// Cookie-based geo detection
// -------------------------------------------------------

/**
 * Reads the `posty_country` cookie and returns the country code.
 * Falls back to 'CO' if the cookie is not set.
 * Server-side only (uses next/headers).
 */
export async function getDefaultCountryFromCookie(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get(COUNTRY_COOKIE)?.value ?? DEFAULT_COUNTRY;
}

// -------------------------------------------------------
// Org-based geo detection
// -------------------------------------------------------

/**
 * Reads `organizations.country_code` for the given org.
 * Falls back to 'CO' if not found or on error.
 * Server-side only.
 */
export async function getDefaultCountryFromOrg(orgId: string): Promise<string> {
  try {
    // Dynamic import to avoid module-level client instantiation
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data } = await supabase
      .from('organizations')
      .select('country_code')
      .eq('id', orgId)
      .single();
    // country_code column will be added via migration 20240101000016
    return (data as unknown as { country_code?: string } | null)?.country_code ?? DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}
