import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';

interface ConnectionRow {
  id: string;
  instance_name: string;
  status: string;
}

export async function POST(request: Request) {
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

    let archiveGuests = true;
    try {
      const body = await request.json() as { archiveGuests?: boolean };
      if (typeof body.archiveGuests === 'boolean') archiveGuests = body.archiveGuests;
    } catch {
      // Body is optional — defaults to true
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
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = adminSupabase as any;

    // Call DB procedure to close session and clean up conversations
    const { data: closeResult, error: closeError } = await adminDb.rpc('close_whatsapp_session', {
      p_connection_id: typedConn.id,
      p_reason: 'user',
      p_archive_guests: archiveGuests,
    });

    if (closeError) {
      console.error('[Disconnect] close_whatsapp_session error:', closeError);
      // Proceed anyway — still clean up the provider and update status
    }

    const provider = getWhatsAppProvider();

    // Tolerate provider errors — both steps are best-effort
    try {
      await provider.disconnect(typedConn.instance_name);
    } catch (err) {
      console.error('[Disconnect] provider.disconnect error (continuing):', err);
    }

    try {
      await provider.deleteInstance(typedConn.instance_name);
    } catch (err) {
      console.error('[Disconnect] provider.deleteInstance error (continuing):', err);
    }

    return Response.json({
      ok: true,
      ...(closeResult ?? {}),
    });
  } catch (error) {
    console.error('Disconnect route error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
