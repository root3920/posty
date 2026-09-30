import { createClient } from '@/lib/supabase/server';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';

interface ConnectionRow {
  instance_name: string;
  status: string;
}

export async function GET() {
  try {
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
      .select('instance_name, status')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (connError || !conn) {
      return Response.json({ error: 'No connection' }, { status: 404 });
    }

    const typedConn = conn as ConnectionRow;

    if (typedConn.status === 'connected') {
      return Response.json({ connected: true });
    }

    const provider = getWhatsAppProvider();

    // Also check live status — if already connected, skip QR
    try {
      const liveStatus = await provider.getStatus(typedConn.instance_name);
      console.log('[QR route] Live status:', liveStatus.state);
      if (liveStatus.state === 'open') {
        return Response.json({ connected: true });
      }
    } catch {
      // Status check failed — continue to get QR
    }

    const qr = await provider.getQrCode(typedConn.instance_name);
    console.log('[QR route] QR response: base64 length=', qr.base64?.length ?? 0, 'count=', qr.count);

    return Response.json({
      base64: qr.base64,
      code: qr.code,
      count: qr.count,
      connected: false,
    });
  } catch (error) {
    console.error('QR route error:', error);
    return Response.json({
      error: 'No se pudo obtener el código QR. Verifica que Evolution esté encendido.',
      base64: null,
      connected: false,
    }, { status: 502 });
  }
}
