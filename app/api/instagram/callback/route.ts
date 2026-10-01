import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInstagramEnv } from '@/lib/instagram/env';
import { encryptToken } from '@/lib/instagram/crypto';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getProfile,
} from '@/lib/instagram/client';

/**
 * GET /api/instagram/callback  (PUBLIC — Instagram redirects here)
 * Exchanges the authorization code for tokens, encrypts and persists the
 * connection, then redirects the user to /instagram.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Instagram may redirect with an error (e.g. user denied permission)
  if (errorParam) {
    console.error('[Instagram] OAuth error:', errorParam, errorDescription);
    return Response.redirect('/instagram?error=access_denied', 302);
  }

  if (!code) {
    console.error('[Instagram] Callback received without code');
    return Response.redirect('/instagram?error=missing_code', 302);
  }

  try {
    const { env, error: envError } = getInstagramEnv();
    if (!env) {
      console.error('[Instagram] Env validation failed:', envError);
      return Response.redirect('/instagram?error=config_error', 302);
    }

    // Auth check — the user must be logged in
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn('[Instagram] Callback: no authenticated user, redirecting to login');
      return Response.redirect('/login?redirect=/instagram', 302);
    }

    // Get the user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[Instagram] Could not load profile:', profileError);
      return Response.redirect('/instagram?error=no_profile', 302);
    }

    const orgId = profile.organization_id;

    // Exchange code → short-lived token → long-lived token
    const shortToken = await exchangeCodeForToken(
      code,
      env.INSTAGRAM_APP_ID,
      env.INSTAGRAM_APP_SECRET,
      env.INSTAGRAM_REDIRECT_URI,
    );

    const { token: longToken, expiresIn } = await getLongLivedToken(shortToken, env.INSTAGRAM_APP_SECRET);

    // Fetch profile to cache it and get the Instagram user ID
    const igProfile = await getProfile(longToken);

    console.log('[Instagram] Connected account:', igProfile.username, 'org:', orgId);

    // Encrypt token before persisting
    const encryptedToken = encryptToken(longToken);
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const adminSupabase = createAdminClient();
    // instagram_connections was added in migration — types not yet regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = adminSupabase as any;

    // Upsert: one connection per org (replace if already exists)
    const { error: upsertError } = await adminDb
      .from('instagram_connections')
      .upsert(
        {
          organization_id: orgId,
          instagram_user_id: igProfile.id,
          username: igProfile.username,
          name: igProfile.name ?? null,
          profile_picture_url: igProfile.profile_picture_url ?? null,
          account_type: igProfile.account_type ?? null,
          media_count: igProfile.media_count ?? null,
          followers_count: igProfile.followers_count ?? null,
          follows_count: igProfile.follows_count ?? null,
          access_token_encrypted: encryptedToken,
          token_expires_at: tokenExpiresAt,
          status: 'connected',
          connected_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      );

    if (upsertError) {
      console.error('[Instagram] Failed to save connection:', upsertError);
      return Response.redirect('/instagram?error=save_failed', 302);
    }

    return Response.redirect('/instagram?connected=1', 302);
  } catch (error) {
    console.error('[Instagram] Callback route error:', error);
    return Response.redirect('/instagram?error=unexpected', 302);
  }
}
