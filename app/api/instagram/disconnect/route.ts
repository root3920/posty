import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInstagramEnv } from '@/lib/instagram/env';

/**
 * POST /api/instagram/disconnect
 * Marks the organization's Instagram connection as disconnected and clears
 * the stored access token.
 */
export async function POST() {
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
      .select('id,username')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (connError) {
      console.error('[Instagram] Error fetching connection:', connError);
      return Response.json({ error: 'Error al obtener la conexión de Instagram' }, { status: 500 });
    }

    if (!conn) {
      return Response.json({ error: 'No hay una conexión activa para desconectar' }, { status: 404 });
    }

    const { error: updateError } = await adminDb
      .from('instagram_connections')
      .update({
        status: 'disconnected',
        access_token_encrypted: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    if (updateError) {
      console.error('[Instagram] Failed to update connection status:', updateError);
      return Response.json({ error: 'No se pudo desconectar la cuenta de Instagram' }, { status: 500 });
    }

    console.log('[Instagram] Account disconnected:', conn.username, 'org:', profile.organization_id);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[Instagram] Disconnect route error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return Response.json({ error: message }, { status: 500 });
  }
}
