import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInstagramEnv } from '@/lib/instagram/env';
import { decryptToken } from '@/lib/instagram/crypto';
import { getMedia } from '@/lib/instagram/client';

interface InstagramConnectionRow {
  id: string;
  ig_user_id: string;
  access_token_encrypted: string;
  status: string;
}

/**
 * GET /api/instagram/media?cursor=<cursor>&limit=<limit>
 * Returns a page of media from the connected Instagram account.
 * Accepts optional `cursor` for pagination and `limit` (default 30, max 100).
 */
export async function GET(request: Request) {
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
      .select('id,ig_user_id,access_token_encrypted,status')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (connError) {
      console.error('[Instagram] Error fetching connection:', connError);
      return Response.json({ error: 'Error al obtener la conexión de Instagram' }, { status: 500 });
    }

    if (!conn) {
      return Response.json({ error: 'No hay una conexión de Instagram activa' }, { status: 404 });
    }

    const typedConn = conn as InstagramConnectionRow;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 30, 1), 100) : 30;

    const token = decryptToken(typedConn.access_token_encrypted);
    const { media, nextCursor } = await getMedia(token, typedConn.ig_user_id, cursor, limit);

    console.log('[Instagram] Media fetched:', media.length, 'items, nextCursor:', nextCursor ?? 'none');

    return Response.json({ media, nextCursor: nextCursor ?? null });
  } catch (error) {
    console.error('[Instagram] Media route error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return Response.json({ error: message }, { status: 500 });
  }
}
