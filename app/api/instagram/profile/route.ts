import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInstagramEnv } from '@/lib/instagram/env';
import { decryptToken } from '@/lib/instagram/crypto';
import { getProfile } from '@/lib/instagram/client';

interface InstagramConnectionRow {
  id: string;
  ig_user_id: string;
  username: string;
  name: string | null;
  profile_picture_url: string | null;
  account_type: string | null;
  media_count: number | null;
  followers_count: number | null;
  follows_count: number | null;
  access_token_encrypted: string;
  token_expires_at: string | null;
  status: string;
  granted_scopes: string[] | null;
}

/**
 * GET /api/instagram/profile
 * Returns the connected Instagram profile for the authenticated user's org.
 * Decrypts the stored token, fetches fresh data from Instagram, and updates
 * the cached values in the DB.
 */
export async function GET() {
  try {
    const { env, error: envError } = getInstagramEnv();
    if (!env) {
      console.error('[Instagram] Env validation failed:', envError);
      return Response.json(
        { error: `Configuración de Instagram incompleta: ${envError}` },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'No se encontró el perfil del usuario' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = adminSupabase as any;

    const { data: conn, error: connError } = await adminDb
      .from('instagram_connections')
      .select(
        'id,ig_user_id,username,name,profile_picture_url,account_type,media_count,followers_count,follows_count,access_token_encrypted,token_expires_at,status,granted_scopes',
      )
      .eq('organization_id', profile.organization_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (connError) {
      console.error('[Instagram] Error fetching connection:', connError);
      return Response.json({ error: 'Error al obtener la conexión de Instagram' }, { status: 500 });
    }

    if (!conn) {
      return Response.json({ connected: false });
    }

    const typedConn = conn as InstagramConnectionRow;

    // Decrypt token and fetch fresh profile from Instagram
    let igProfile;
    try {
      const token = decryptToken(typedConn.access_token_encrypted);
      igProfile = await getProfile(token);

      // Update cached values
      await adminDb
        .from('instagram_connections')
        .update({
          username: igProfile.username,
          name: igProfile.name ?? typedConn.name,
          profile_picture_url: igProfile.profile_picture_url ?? typedConn.profile_picture_url,
          account_type: igProfile.account_type ?? typedConn.account_type,
          media_count: igProfile.media_count ?? typedConn.media_count,
          followers_count: igProfile.followers_count ?? typedConn.followers_count,
          follows_count: igProfile.follows_count ?? typedConn.follows_count,
          updated_at: new Date().toISOString(),
        })
        .eq('id', typedConn.id);

      console.log('[Instagram] Profile refreshed for:', igProfile.username);
    } catch (fetchErr) {
      console.error('[Instagram] Could not refresh profile from API, returning cached:', fetchErr);
      // Fall back to cached data
      igProfile = {
        id: typedConn.ig_user_id,
        username: typedConn.username,
        name: typedConn.name ?? undefined,
        profile_picture_url: typedConn.profile_picture_url ?? undefined,
        account_type: typedConn.account_type ?? undefined,
        media_count: typedConn.media_count ?? undefined,
        followers_count: typedConn.followers_count ?? undefined,
        follows_count: typedConn.follows_count ?? undefined,
      };
    }

    return Response.json({
      profile: igProfile,
      tokenExpiresAt: typedConn.token_expires_at,
      grantedScopes: typedConn.granted_scopes ?? [],
    });
  } catch (error) {
    console.error('[Instagram] Profile route error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return Response.json({ error: message }, { status: 500 });
  }
}
