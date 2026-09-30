import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';

function phoneFromJid(jid: string): string | null {
  if (jid.includes('@s.whatsapp.net')) {
    const digits = jid.replace(/@.*/, '').replace(/\D/g, '');
    if (digits.length >= 10) return `+${digits}`;
  }
  return null;
}

function lidFromJid(jid: string): string | null {
  if (jid.includes('@lid')) return jid.replace(/@.*/, '');
  return null;
}

function isValidContact(jid: string): boolean {
  return !jid.includes('@g.us') && !jid.includes('@newsletter') &&
    !jid.includes('@broadcast') && !jid.includes('status@') &&
    !jid.startsWith('0@');
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
    const db = admin as any;

    const { data: conn } = await db
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
    console.log('[Import] Got', chats.length, 'chats from Evolution');

    let created = 0;
    let namesUpdated = 0;

    for (const chat of chats) {
      if (!isValidContact(chat.remoteJid)) continue;

      const phone = phoneFromJid(chat.remoteJid);
      const lid = lidFromJid(chat.remoteJid);
      const contactKey = phone ?? `lid:${lid}`;
      const name = chat.pushName || null;
      const pic = chat.profilePicUrl || null;

      // Skip contacts without name AND without real phone (unknown LID contacts)
      if (!name && !phone) continue;

      const { data: inserted } = await db
        .from('chat_conversations')
        .upsert(
          {
            organization_id: orgId,
            connection_id: conn.id,
            contact_phone_e164: contactKey,
            contact_lid: lid,
            contact_name: name,
            contact_pic_url: pic,
            is_hidden: false,
            status: 'open',
          },
          { onConflict: 'organization_id,connection_id,contact_phone_e164' },
        )
        .select('id')
        .maybeSingle();

      if (inserted) created++;

      // Always update name and pic if we have them (upsert may not update existing)
      if (name || pic) {
        const updates: Record<string, unknown> = { is_hidden: false };
        if (name) updates.contact_name = name;
        if (pic) updates.contact_pic_url = pic;

        const { count } = await db
          .from('chat_conversations')
          .update(updates)
          .eq('organization_id', orgId)
          .eq('connection_id', conn.id)
          .eq('contact_phone_e164', contactKey);

        if (count && count > 0) namesUpdated++;
      }
    }

    console.log('[Import] Created/updated:', created, 'names updated:', namesUpdated);

    return Response.json({
      success: true,
      chats: chats.length,
      namesUpdated,
    });
  } catch (error) {
    console.error('[Import] Error:', error);
    return Response.json({ error: 'Error al importar chats.' }, { status: 500 });
  }
}
