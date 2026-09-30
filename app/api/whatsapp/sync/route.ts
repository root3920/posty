import { createClient } from '@/lib/supabase/server';
import { syncWhatsAppConnection } from '@/lib/whatsapp/sync';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    const result = await syncWhatsAppConnection(profile.organization_id);
    return Response.json(result ?? { status: 'no_connection' });
  } catch (error) {
    console.error('[Sync route]', error);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
