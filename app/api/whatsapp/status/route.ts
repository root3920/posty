import { createClient } from '@/lib/supabase/server';
import { isWhatsAppConfigured } from '@/lib/whatsapp/provider';
import { syncWhatsAppConnection } from '@/lib/whatsapp/sync';

export async function GET() {
  try {
    if (!isWhatsAppConfigured()) {
      return Response.json({
        error: 'not_configured',
        message: 'WhatsApp no está configurado en el servidor. Revisa EVOLUTION_API_URL, EVOLUTION_API_KEY y WHATSAPP_WEBHOOK_SECRET.',
      }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    console.log('[Status] Org:', profile.organization_id);

    // First check: does the org have a connection row at all?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connBefore, error: connErr } = await (supabase as any)
      .from('whatsapp_connections')
      .select('id, instance_name, status, phone_e164, display_name, profile_pic_url, connected_at, last_seen_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('[Status] DB connection:', connBefore ? { id: connBefore.id, status: connBefore.status, instance: connBefore.instance_name } : 'NONE', 'err:', connErr?.message);

    if (!connBefore) {
      return Response.json({ error: 'No connection', connected: false }, { status: 404 });
    }

    // Run sync — queries Evolution, updates DB, ensures webhook
    let syncResult;
    try {
      syncResult = await syncWhatsAppConnection(profile.organization_id);
      console.log('[Status] Sync result:', syncResult);
    } catch (syncErr) {
      console.error('[Status] Sync failed:', syncErr);
      // Fall back to DB data even if sync fails
    }

    // Re-read from DB after sync
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conn } = await (supabase as any)
      .from('whatsapp_connections')
      .select('id, status, connected_at, last_seen_at, phone_e164, display_name, profile_pic_url')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const finalStatus = conn?.status ?? syncResult?.status ?? connBefore.status;
    const connected = finalStatus === 'connected';

    console.log('[Status] Final:', { finalStatus, connected, phone: conn?.phone_e164 });

    return Response.json({
      connectionId: conn?.id ?? connBefore.id,
      status: finalStatus,
      connected,
      phone: conn?.phone_e164 ?? syncResult?.phone,
      displayName: conn?.display_name ?? syncResult?.displayName,
      profilePic: conn?.profile_pic_url ?? syncResult?.profilePic,
      connectedAt: conn?.connected_at,
      lastSeenAt: conn?.last_seen_at,
    });
  } catch (error) {
    console.error('Status route error:', error);
    return Response.json({
      error: 'connection_error',
      message: 'No se pudo conectar con el servicio de WhatsApp. Verifica que esté encendido en Railway.',
      connected: false,
    }, { status: 502 });
  }
}
