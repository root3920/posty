import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';

function contactFromJid(jid: string): string {
  if (jid.includes('@s.whatsapp.net')) {
    const digits = jid.replace(/@.*/, '').replace(/\D/g, '');
    return `+${digits}`;
  }
  return jid.replace(/@.*/, '');
}

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

    const orgId = profile.organization_id;
    const admin = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conn } = await (admin as any)
      .from('whatsapp_connections')
      .select('id, instance_name, status')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conn || conn.status !== 'connected') {
      return Response.json({ error: 'WhatsApp no está conectado' }, { status: 400 });
    }

    const provider = getWhatsAppProvider();
    const chats = await provider.findChats(conn.instance_name);

    let created = 0;
    let updated = 0;

    for (const chat of chats) {
      const contactKey = contactFromJid(chat.remoteJid);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: convo } = await (admin as any)
        .from('chat_conversations')
        .upsert(
          {
            organization_id: orgId,
            connection_id: conn.id,
            contact_phone_e164: contactKey,
            contact_name: chat.pushName ?? null,
            contact_pic_url: chat.profilePicUrl ?? null,
            is_hidden: false,
            status: 'open',
          },
          { onConflict: 'organization_id,connection_id,contact_phone_e164' },
        )
        .select('id')
        .maybeSingle();

      if (convo) created++;
    }

    // Also make any previously hidden conversations visible
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (admin as any)
      .from('chat_conversations')
      .update({ is_hidden: false })
      .eq('organization_id', orgId)
      .eq('is_hidden', true)
      .select('*', { count: 'exact', head: true });

    updated = count ?? 0;

    return Response.json({
      success: true,
      chats: created,
      unhidden: updated,
    });
  } catch (error) {
    console.error('[Import] Error:', error);
    return Response.json({ error: 'Error al importar chats.' }, { status: 500 });
  }
}
