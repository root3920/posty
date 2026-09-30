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
    const qr = await provider.getQrCode(typedConn.instance_name);
    return Response.json(qr);
  } catch (error) {
    console.error('QR route error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
