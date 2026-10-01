import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInstagramEnv } from '@/lib/instagram/env';
import { encryptToken } from '@/lib/instagram/crypto';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getProfile,
} from '@/lib/instagram/client';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.postyassistant.com';

function redirectWithError(code: string): Response {
  return Response.redirect(`${BASE_URL}/configuracion/instagram?ig_error=${code}`, 302);
}

function redirectSuccess(username: string): Response {
  return Response.redirect(`${BASE_URL}/instagram?connected=1&username=${encodeURIComponent(username)}`, 302);
}

/**
 * GET /api/instagram/callback (PUBLIC — Instagram redirects here after OAuth)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 1. Check if Instagram returned an error (user denied, etc.)
  const errorParam = searchParams.get('error');
  if (errorParam) {
    const reason = searchParams.get('error_reason') ?? errorParam;
    console.log('[ig-callback] step=error_from_instagram reason=' + reason);
    return redirectWithError('denied');
  }

  // 2. Must have a code
  const code = searchParams.get('code');
  if (!code) {
    console.log('[ig-callback] step=no_code');
    return redirectWithError('code_used');
  }

  // 3. Validate env
  const { env, error: envError } = getInstagramEnv();
  if (!env) {
    console.error('[ig-callback] step=env_invalid error=' + envError);
    // Log which vars are present (without values)
    console.error('[ig-callback] env_check:', {
      INSTAGRAM_APP_ID: !!process.env.INSTAGRAM_APP_ID,
      INSTAGRAM_APP_SECRET: !!process.env.INSTAGRAM_APP_SECRET,
      INSTAGRAM_REDIRECT_URI: !!process.env.INSTAGRAM_REDIRECT_URI,
      TOKEN_ENCRYPTION_KEY: !!process.env.TOKEN_ENCRYPTION_KEY,
    });
    return redirectWithError('config');
  }

  try {
    // 4. Check user session
    console.log('[ig-callback] step=auth_check');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('[ig-callback] step=no_session');
      return Response.redirect(`${BASE_URL}/login?redirect=/configuracion/instagram`, 302);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      console.error('[ig-callback] step=no_profile');
      return redirectWithError('save_failed');
    }

    const orgId = profile.organization_id;
    console.log('[ig-callback] step=auth_ok org=' + orgId.slice(0, 8));

    // 5. Exchange code for short-lived token
    console.log('[ig-callback] step=exchange_short');
    const { accessToken: shortToken } = await exchangeCodeForToken(
      code,
      env.INSTAGRAM_APP_ID,
      env.INSTAGRAM_APP_SECRET,
      env.INSTAGRAM_REDIRECT_URI,
    );
    console.log('[ig-callback] step=exchange_short_ok');

    // 6. Exchange for long-lived token
    console.log('[ig-callback] step=exchange_long');
    const { token: longToken, expiresIn } = await getLongLivedToken(shortToken, env.INSTAGRAM_APP_SECRET);
    console.log('[ig-callback] step=exchange_long_ok expires_in=' + expiresIn);

    // 7. Fetch profile (gets user_id as string from /me endpoint)
    console.log('[ig-callback] step=profile');
    const igProfile = await getProfile(longToken);
    console.log('[ig-callback] step=profile_ok user=' + igProfile.username + ' id=' + igProfile.id);

    // 8. Encrypt token
    const encryptedToken = encryptToken(longToken);
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 9. Save to DB using admin client (bypasses RLS)
    console.log('[ig-callback] step=save');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = createAdminClient() as any;

    // Check if connection already exists for this org
    const { data: existing } = await adminDb
      .from('instagram_connections')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();

    const connectionData = {
      organization_id: orgId,
      ig_user_id: igProfile.id, // string, no precision loss
      username: igProfile.username,
      name: igProfile.name ?? null,
      profile_picture_url: igProfile.profile_picture_url ?? null,
      account_type: igProfile.account_type ?? null,
      media_count: igProfile.media_count ?? 0,
      followers_count: igProfile.followers_count ?? 0,
      follows_count: igProfile.follows_count ?? 0,
      access_token_encrypted: encryptedToken,
      token_expires_at: tokenExpiresAt,
      status: 'connected',
      connected_at: new Date().toISOString(),
      connected_by: user.id,
    };

    let saveError;
    if (existing) {
      const { error } = await adminDb
        .from('instagram_connections')
        .update(connectionData)
        .eq('id', existing.id);
      saveError = error;
    } else {
      const { error } = await adminDb
        .from('instagram_connections')
        .insert(connectionData);
      saveError = error;
    }

    if (saveError) {
      console.error('[ig-callback] step=save_failed error=' + saveError.message);
      return redirectWithError('save_failed');
    }

    console.log('[ig-callback] step=saved user=' + igProfile.username);
    return redirectSuccess(igProfile.username ?? '');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    console.error('[ig-callback] step=error msg=' + msg);

    // Map known errors to user-friendly codes
    if (msg === 'code_used') return redirectWithError('code_used');
    if (msg === 'not_professional') return redirectWithError('not_professional');
    if (msg === 'not_tester') return redirectWithError('not_tester');
    if (msg === 'config') return redirectWithError('config');
    if (msg === 'exchange_failed') return redirectWithError('code_used');
    if (msg === 'exchange_long_failed') return redirectWithError('code_used');

    return redirectWithError('save_failed');
  }
}
