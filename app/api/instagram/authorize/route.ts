import { createClient } from '@/lib/supabase/server';
import { getInstagramEnv } from '@/lib/instagram/env';

/**
 * GET /api/instagram/authorize
 * Redirects the authenticated user to Instagram's OAuth authorization page.
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

    // Instagram API with Instagram Login (2024+)
    // Scopes: basic + publish + insights (for statistics)
    const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights';

    const params = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID,
      redirect_uri: env.INSTAGRAM_REDIRECT_URI,
      scope,
      response_type: 'code',
      enable_fb_login: '0',
    });

    const authUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;

    console.log('[Instagram] Redirecting to OAuth:', authUrl);

    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Instagram] Authorize route error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return Response.json({ error: message }, { status: 500 });
  }
}
