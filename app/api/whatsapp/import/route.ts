import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';

function phoneFromJid(jid: string): string | null {
  // Classic format: 573001234567@s.whatsapp.net → +573001234567
  if (jid.includes('@s.whatsapp.net')) {
    const digits = jid.replace(/@.*/, '').replace(/\D/g, '');
    return digits.length >= 10 ? `+${digits}` : null;
  }
  // LID format: 268938084675807@lid → not a phone number
  // Use the raw JID as identifier
  return null;
}

function contactIdFromJid(jid: string): string {
  // For @s.whatsapp.net: use E.164 phone
  if (jid.includes('@s.whatsapp.net')) {
    const digits = jid.replace(/@.*/, '').replace(/\D/g, '');
    return `+${digits}`;
  }
  // For @lid: use the JID itself as identifier
  return jid.replace(/@.*/, '');
}

function extractMessageBody(msg: Record<string, unknown> | undefined): string | null {
  if (!msg) return null;
  return (
    (msg.conversation as string) ??
    (msg.extendedTextMessage as Record<string, unknown>)?.text ??
    null
  ) as string | null;
}

function mapMessageType(mt: string | undefined): string {
  if (!mt) return 'text';
  if (mt === 'conversation' || mt === 'extendedTextMessage') return 'text';
  if (mt === 'imageMessage') return 'image';
  if (mt === 'audioMessage') return 'audio';
  if (mt === 'videoMessage') return 'video';
  if (mt === 'documentMessage' || mt === 'documentWithCaptionMessage') return 'document';
  if (mt === 'stickerMessage') return 'sticker';
  if (mt === 'locationMessage' || mt === 'liveLocationMessage') return 'location';
  if (mt === 'contactMessage' || mt === 'contactsArrayMessage') return 'contact';
  return 'unsupported';
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

    // Get connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conn } = await (admin as any)
      .from('whatsapp_connections')
      .select('id, instance_name, status, account_type')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conn || conn.status !== 'connected') {
      return Response.json({ error: 'WhatsApp no está conectado' }, { status: 400 });
    }

    const provider = getWhatsAppProvider();

    // 1. Find all 1:1 chats
    console.log('[Import] Fetching chats for', conn.instance_name);
    const chats = await provider.findChats(conn.instance_name);
    console.log('[Import] Found', chats.length, '1:1 chats');

    // 2. Get registered guests/contacts for hiding logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: guests } = await (admin as any)
      .from('guests')
      .select('phone')
      .eq('organization_id', orgId)
      .not('phone', 'is', null);

    const knownPhones = new Set((guests ?? []).map((g: { phone: string }) => g.phone));

    let imported = 0;
    let skipped = 0;

    // Limit to first 50 chats to avoid timeout (Evolution API is slow per-chat)
    const chatsToImport = chats.slice(0, 50);
    console.log('[Import] Processing', chatsToImport.length, 'of', chats.length, 'chats');

    for (const chat of chatsToImport) {
      const phone = phoneFromJid(chat.remoteJid);
      const contactId = contactIdFromJid(chat.remoteJid);

      // Use phone if available, otherwise use the contactId (for @lid JIDs)
      const contactKey = phone ?? contactId;

      // For Phase 0: show all imported chats. Hidden logic will be refined in Phase 1.
      const isHidden = false;

      // Upsert conversation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: convo, error: convoErr } = await (admin as any)
        .from('chat_conversations')
        .upsert(
          {
            organization_id: orgId,
            connection_id: conn.id,
            contact_phone_e164: contactKey,
            contact_name: chat.pushName ?? null,
            contact_pic_url: chat.profilePicUrl ?? null,
            is_hidden: isHidden,
            status: 'open',
          },
          { onConflict: 'organization_id,connection_id,contact_phone_e164' },
        )
        .select('id')
        .single();

      if (!convo) {
        if (convoErr) console.error('[Import] Upsert conversation failed:', convoErr.message, 'for', contactKey);
        skipped++;
        continue;
      }

      // Auto-link to guest by phone (only for real phone numbers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: matchedGuest } = phone ? await (admin as any)
        .from('guests')
        .select('id')
        .eq('organization_id', orgId)
        .eq('phone', phone)
        .limit(1)
        .maybeSingle() : { data: null };

      if (matchedGuest) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from('chat_conversations')
          .update({ guest_id: matchedGuest.id })
          .eq('id', convo.id);
      }

      // 3. Fetch recent messages for this chat (only first 5 chats to test)
      if (imported + skipped > 5) {
        // Skip message fetching for the rest — just create conversations
        continue;
      }
      console.log('[Import] Fetching messages for', chat.remoteJid, 'name:', chat.pushName);
      const messages = await provider.findMessages(conn.instance_name, chat.remoteJid, 20);
      console.log('[Import] Got', messages.length, 'messages for', chat.pushName);

      let lastMsgAt: string | null = null;
      let lastPreview: string | null = null;
      let unread = 0;

      for (const msg of messages) {
        const externalId = msg.key.id;
        const direction = msg.key.fromMe ? 'out' : 'in';
        const msgType = mapMessageType(msg.messageType);
        const body = extractMessageBody(msg.message);
        const createdAt = msg.messageTimestamp
          ? new Date(msg.messageTimestamp * 1000).toISOString()
          : new Date().toISOString();

        // Insert with ON CONFLICT DO NOTHING (idempotent by external_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted } = await (admin as any)
          .from('chat_messages')
          .upsert(
            {
              organization_id: orgId,
              conversation_id: convo.id,
              external_id: externalId,
              direction,
              type: msgType,
              body,
              status: direction === 'out' ? 'read' : 'delivered',
              sent_from: direction === 'out' ? 'phone' : null,
              created_at: createdAt,
            },
            { onConflict: 'organization_id,external_id', ignoreDuplicates: true },
          )
          .select('id')
          .maybeSingle();

        if (inserted) {
          imported++;
          if (!lastMsgAt || createdAt > lastMsgAt) {
            lastMsgAt = createdAt;
            lastPreview = body?.slice(0, 100) ?? `[${msgType}]`;
          }
          if (direction === 'in') unread++;
        } else {
          skipped++;
        }
      }

      // Update conversation with last message info
      if (lastMsgAt) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from('chat_conversations')
          .update({
            last_message_at: lastMsgAt,
            last_message_preview: lastPreview,
            unread_count: unread,
          })
          .eq('id', convo.id);
      }
    }

    console.log('[Import] Done:', imported, 'messages imported,', skipped, 'skipped');

    return Response.json({
      success: true,
      chats: chats.length,
      messagesImported: imported,
      messagesSkipped: skipped,
    });
  } catch (error) {
    console.error('[Import] Error:', error);
    return Response.json({
      error: 'Error al importar chats. Intenta de nuevo.',
    }, { status: 500 });
  }
}
