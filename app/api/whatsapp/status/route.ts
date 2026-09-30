import { createClient } from '@/lib/supabase/server';
import { getWhatsAppProvider, isWhatsAppConfigured } from '@/lib/whatsapp/provider';

interface ConnectionRow {
  id: string;
  instance_name: string;
  status: string;
  connected_at: string | null;
  last_seen_at: string | null;
}

export async function GET() {
  try {
    if (!isWhatsAppConfigured()) {
      return Response.json({ error: 'not_configured', message: 'WhatsApp no está configurado en el servidor. Revisa EVOLUTION_API_URL, EVOLUTION_API_KEY y WHATSAPP_WEBHOOK_SECRET.' }, { status: 503 });
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

    // whatsapp_connections was added in migration — types not yet regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: conn, error: connError } = await db
      .from('whatsapp_connections')
      .select('id, instance_name, status, connected_at, last_seen_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (connError || !conn) {
      return Response.json({ error: 'No connection' }, { status: 404 });
    }

    const typedConn = conn as ConnectionRow;
    const provider = getWhatsAppProvider();
    const providerStatus = await provider.getStatus(typedConn.instance_name);

    return Response.json({
      connectionId: typedConn.id,
      dbStatus: typedConn.status,
      providerState: providerStatus.state,
      connectedAt: typedConn.connected_at,
      lastSeenAt: typedConn.last_seen_at,
    });
  } catch (error) {
    console.error('Status route error:', error);
    return Response.json({
      error: 'connection_error',
      message: 'No se pudo conectar con el servicio de WhatsApp. Verifica que esté encendido en Railway.',
    }, { status: 502 });
  }
}
