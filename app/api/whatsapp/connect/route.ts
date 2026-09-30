import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider, isWhatsAppConfigured } from '@/lib/whatsapp/provider';

interface ConnectionInsertRow {
  id: string;
}

export async function POST(request: Request) {
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

    const body = await request.json() as { accountType?: 'personal' | 'business' };
    const { accountType } = body;

    // Get org from profile
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

    // whatsapp_connections was added in migration — types not yet regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = adminSupabase as any;

    // Check if there is already an active connection for this org
    const { data: existing } = await adminDb
      .from('whatsapp_connections')
      .select('id')
      .eq('organization_id', orgId)
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();

    if (existing) {
      return Response.json({ error: 'Ya hay una conexión activa' }, { status: 400 });
    }

    const instanceName = `posty-${orgId.slice(0, 8)}`;
    const provider = getWhatsAppProvider();
    const webhookUrl = `https://app.postyassistant.com/api/webhooks/whatsapp`;

    const result = await provider.createInstance({
      instanceName,
      webhookUrl,
      webhookHeaders: {
        'x-webhook-secret': process.env.WHATSAPP_WEBHOOK_SECRET!,
      },
      events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
    });

    console.log('[Connect] Instance created:', result.instanceName, 'hasQR:', !!result.qrBase64);

    const { data: conn, error: connError } = await adminDb
      .from('whatsapp_connections')
      .insert({
        organization_id: orgId,
        provider: 'evolution_qr',
        instance_name: result.instanceName,
        instance_token: result.token,
        account_type: accountType ?? 'personal',
        status: 'pending_qr',
        connected_by: user.id,
      })
      .select('id')
      .single();

    if (connError || !conn) {
      console.error('Failed to insert connection:', connError);
      return Response.json({ error: connError?.message ?? 'Failed to create connection' }, { status: 500 });
    }

    const typedConn = conn as ConnectionInsertRow;

    return Response.json({
      connectionId: typedConn.id,
      instanceName: result.instanceName,
      qrBase64: result.qrBase64 ?? null,
    });
  } catch (error) {
    console.error('Connect route error:', error);
    return Response.json({
      error: 'No se pudo conectar con el servicio de WhatsApp. Verifica que esté encendido en Railway.',
    }, { status: 502 });
  }
}
