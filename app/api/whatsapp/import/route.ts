import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';
import { getWhatsAppEnv } from '@/lib/whatsapp/env';

interface ContactInfo {
  remoteJid: string;
  pushName: string | null;
  profilePicUrl?: string;
}

async function fetchContacts(instanceName: string): Promise<ContactInfo[]> {
  try {
    const { env } = getWhatsAppEnv();
    if (!env) return [];
    let baseUrl = env.EVOLUTION_API_URL.trim();
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    baseUrl = baseUrl.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/chat/findContacts/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.EVOLUTION_API_KEY },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      console.log('[Import] findContacts failed:', response.status);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any[];
    console.log('[Import] findContacts returned', (data ?? []).length, 'contacts');
    return (data ?? []).map((c) => ({
      remoteJid: c.remoteJid ?? c.id ?? '',
      pushName: c.pushName ?? c.name ?? null,
      profilePicUrl: c.profilePicUrl,
    }));
  } catch (err) {
    console.error('[Import] findContacts error:', err);
    return [];
  }
}

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

    // Fetch chats and contacts in parallel
    const [chats, contactsRaw] = await Promise.all([
      provider.findChats(conn.instance_name),
      fetchContacts(conn.instance_name),
    ]);

    // Build a lookup: remoteJid → name
    const contactNames = new Map<string, { name: string; pic?: string }>();
    for (const c of contactsRaw) {
      if (c.pushName) contactNames.set(c.remoteJid, { name: c.pushName, pic: c.profilePicUrl });
    }

    let created = 0;

    for (const chat of chats) {
      const contactKey = contactFromJid(chat.remoteJid);
      // Name priority: chat.pushName > contacts lookup > null
      const contact = contactNames.get(chat.remoteJid);
      const name = chat.pushName || contact?.name || null;
      const pic = chat.profilePicUrl || contact?.pic || null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: convo } = await (admin as any)
        .from('chat_conversations')
        .upsert(
          {
            organization_id: orgId,
            connection_id: conn.id,
            contact_phone_e164: contactKey,
            contact_name: name,
            contact_pic_url: pic,
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
    await (admin as any)
      .from('chat_conversations')
      .update({ is_hidden: false })
      .eq('organization_id', orgId)
      .eq('is_hidden', true);

    return Response.json({ success: true, chats: created, contacts: contactsRaw.length });
  } catch (error) {
    console.error('[Import] Error:', error);
    return Response.json({ error: 'Error al importar chats.' }, { status: 500 });
  }
}
