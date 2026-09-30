import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';

interface ConnectionRow {
  id: string;
  instance_name: string;
  status: string;
}

export async function POST() {
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
      .select('id, instance_name, status')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (connError || !conn) {
      return Response.json({ error: 'No connection found' }, { status: 404 });
    }

    const typedConn = conn as ConnectionRow;
    const provider = getWhatsAppProvider();

    try {
      await provider.disconnect(typedConn.instance_name);
    } catch (providerError) {
      // Log but don't block — we still mark as disconnected in DB
      console.error('Provider disconnect error (continuing):', providerError);
    }

    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = adminSupabase as any;

    await adminDb
      .from('whatsapp_connections')
      .update({
        status: 'disconnected',
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', typedConn.id);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Disconnect route error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
