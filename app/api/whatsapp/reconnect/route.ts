import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider, isWhatsAppConfigured } from '@/lib/whatsapp/provider';

interface ConnectionRow {
  id: string;
  instance_name: string;
  instance_token: string | null;
  account_type: string;
  status: string;
}

export async function POST() {
  try {
    if (!isWhatsAppConfigured()) {
      return Response.json({ error: 'WhatsApp no está configurado en el servidor. Revisa EVOLUTION_API_URL.' }, { status: 503 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'No auth' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'No profile' }, { status: 400 });
    }

    const orgId = profile.organization_id;
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = adminSupabase as any;

    // Find the disconnected_pending session
    const { data: conn, error: connError } = await adminDb
      .from('whatsapp_connections')
      .select('id, instance_name, instance_token, account_type, status')
      .eq('organization_id', orgId)
      .eq('status', 'disconnected_pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connError || !conn) {
      return Response.json({ error: 'No hay sesión pendiente de reconexión' }, { status: 404 });
    }

    const typedConn = conn as ConnectionRow;
    const provider = getWhatsAppProvider();

    // Evolution instances may have been removed on disconnect — recreate with a new unique name
    const newInstanceName = `posty-${orgId.slice(0, 8)}-${Date.now()}`;
    const webhookUrl = `https://app.postyassistant.com/api/webhooks/whatsapp`;

    let qrBase64: string | null = null;
    let newToken: string | null = null;

    try {
      // First, try to clean up any stale instance under the old name
      try {
        await provider.deleteInstance(typedConn.instance_name);
      } catch {
        // Stale instance may not exist — ignore
      }

      const result = await provider.createInstance({
        instanceName: newInstanceName,
        webhookUrl,
        webhookHeaders: {
          'x-webhook-secret': process.env.WHATSAPP_WEBHOOK_SECRET!,
        },
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        // @ts-expect-error — Evolution-specific extra fields
        reject_call: true,
      });

      qrBase64 = result.qrBase64 ?? null;
      newToken = result.token ?? null;

      console.log('[Reconnect] New instance created:', newInstanceName, 'hasQR:', !!qrBase64);
    } catch (err) {
      console.error('[Reconnect] Failed to create new instance:', err);
      return Response.json({ error: 'No se pudo crear la nueva instancia de WhatsApp' }, { status: 502 });
    }

    // Update connection record: new instance name, new token, reset to pending_qr
    const { error: updateError } = await adminDb
      .from('whatsapp_connections')
      .update({
        instance_name: newInstanceName,
        instance_token: newToken,
        status: 'pending_qr',
        disconnect_reason: null,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', typedConn.id);

    if (updateError) {
      console.error('[Reconnect] Failed to update connection:', updateError);
      return Response.json({ error: 'Error al actualizar la conexión' }, { status: 500 });
    }

    return Response.json({
      connectionId: typedConn.id,
      instanceName: newInstanceName,
      qrBase64,
    });
  } catch (error) {
    console.error('[Reconnect] Route error:', error);
    return Response.json({
      error: 'No se pudo reconectar con el servicio de WhatsApp.',
    }, { status: 502 });
  }
}
