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

    // Run sync — this queries Evolution, updates DB, and ensures webhook
    const syncResult = await syncWhatsAppConnection(profile.organization_id);

    if (!syncResult) {
      return Response.json({ error: 'No connection', connected: false }, { status: 404 });
    }

    const connected = syncResult.status === 'connected';

    // Re-read from DB to get the latest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conn } = await (supabase as any)
      .from('whatsapp_connections')
      .select('id, status, connected_at, last_seen_at, phone_e164, display_name, profile_pic_url')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return Response.json({
      connectionId: conn?.id,
      status: conn?.status ?? syncResult.status,
      connected,
      phone: conn?.phone_e164 ?? syncResult.phone,
      displayName: conn?.display_name ?? syncResult.displayName,
      profilePic: conn?.profile_pic_url ?? syncResult.profilePic,
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
