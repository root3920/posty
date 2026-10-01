import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';

const MIN_DELAY_PER_CHAR = 50; // ms per character
const MAX_DELAY = 3000; // ms

function calculateDelay(text: string): number {
  return Math.min(text.length * MIN_DELAY_PER_CHAR, MAX_DELAY);
}

interface ConversationRow {
  id: string;
  contact_phone_e164: string;
  connection_id: string;
}

interface ConnectionRow {
  id: string;
  instance_name: string;
  status: string;
}

interface MessageRow {
  id: string;
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

    const body = await request.json() as { conversationId?: string; phone?: string; text?: string };
    let { conversationId } = body;
    const { text, phone } = body;

    if (!text) {
      return Response.json({ error: 'El texto del mensaje es obligatorio' }, { status: 400 });
    }

    if (!conversationId && !phone) {
      return Response.json({ error: 'Se requiere conversationId o phone' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'No profile' }, { status: 400 });
    }

    const orgId = profile.organization_id;

    // New tables added in migration — types not yet regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const adminDb = createAdminClient() as typeof db;

    // If phone provided but no conversationId, find or create conversation
    if (!conversationId && phone) {

      // Get connection
      const { data: conn } = await adminDb
        .from('whatsapp_connections')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'connected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conn) {
        return Response.json({ error: 'WhatsApp no está conectado' }, { status: 400 });
      }

      // Find or create conversation
      const { data: existingConv } = await adminDb
        .from('chat_conversations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('connection_id', conn.id)
        .eq('contact_phone_e164', phone)
        .limit(1)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: newConvErr } = await adminDb
          .from('chat_conversations')
          .insert({
            organization_id: orgId,
            connection_id: conn.id,
            contact_phone_e164: phone,
            status: 'open',
            is_hidden: false,
          })
          .select('id')
          .single();

        if (newConvErr || !newConv) {
          return Response.json({ error: 'No se pudo crear la conversación' }, { status: 500 });
        }
        conversationId = newConv.id;
      }
    }

    // Get conversation details with contact's remote_jid for sending
    const { data: conversation, error: convError } = await db
      .from('chat_conversations')
      .select('id, contact_phone_e164, connection_id, contact_id')
      .eq('id', conversationId)
      .eq('organization_id', orgId)
      .single();

    if (convError || !conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const typedConv = conversation as ConversationRow;

    // Get connection
    const { data: conn, error: connError } = await db
      .from('whatsapp_connections')
      .select('id, instance_name, status')
      .eq('id', typedConv.connection_id)
      .eq('organization_id', orgId)
      .single();

    if (connError || !conn) {
      return Response.json({ error: 'Connection not found' }, { status: 404 });
    }

    const typedConn = conn as ConnectionRow;

    if (typedConn.status !== 'connected') {
      return Response.json({ error: 'WhatsApp no está conectado' }, { status: 400 });
    }

    // Rate limiting: max 20 msgs/min, 300/hour per org
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

    const { count: minCount } = await adminDb
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('direction', 'out')
      .eq('sent_from', 'posty')
      .gte('created_at', oneMinAgo);

    if ((minCount ?? 0) >= 20) {
      return Response.json({ error: 'Límite de velocidad: máximo 20 mensajes por minuto. Espera un momento.' }, { status: 429 });
    }

    const { count: hourCount } = await adminDb
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('direction', 'out')
      .eq('sent_from', 'posty')
      .gte('created_at', oneHourAgo);

    if ((hourCount ?? 0) >= 300) {
      return Response.json({ error: 'Límite de velocidad: máximo 300 mensajes por hora.' }, { status: 429 });
    }

    // First contact check: max 5 unanswered messages to a contact that never replied
    const { data: lastInbound } = await adminDb
      .from('chat_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('direction', 'in')
      .limit(1)
      .maybeSingle();

    if (!lastInbound) {
      // Contact never replied — check how many outgoing we've sent
      const { count: outCount } = await adminDb
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('direction', 'out');

      if ((outCount ?? 0) >= 5) {
        return Response.json({
          error: 'Este contacto no ha respondido. Máximo 5 mensajes sin respuesta para evitar restricciones de WhatsApp.',
        }, { status: 429 });
      }
    }

    // Resolve the destination: use remote_jid from contact, or phone
    let destination = typedConv.contact_phone_e164;
    const contactId = (conversation as Record<string, unknown>).contact_id as string | null;

    if (contactId) {
      const { data: contact } = await adminDb
        .from('chat_contacts')
        .select('remote_jid, phone_e164, lid')
        .eq('id', contactId)
        .single();

      if (contact?.remote_jid) {
        // Use the exact JID (works for both @s.whatsapp.net and @lid)
        destination = contact.remote_jid;
      } else if (contact?.phone_e164) {
        // Strip + and use as phone number
        destination = contact.phone_e164.replace(/^\+/, '');
      } else if (contact?.lid) {
        destination = contact.lid + '@lid';
      }
    }

    // Strip 'lid:' prefix if present (shouldn't be the destination format)
    if (destination.startsWith('lid:')) {
      destination = destination.slice(4) + '@lid';
    }
    // Strip '+' for Evolution (it expects digits only for phone numbers)
    if (destination.startsWith('+')) {
      destination = destination.slice(1);
    }

    console.log('[Send] Destination:', destination, 'for conversation:', conversationId);

    const provider = getWhatsAppProvider();
    const delay = calculateDelay(text);

    // Insert the message first as 'pending' so it shows in the UI immediately
    const { data: message, error: msgError } = await adminDb
      .from('chat_messages')
      .insert({
        organization_id: orgId,
        conversation_id: conversationId,
        direction: 'out',
        type: 'text',
        body: text,
        status: 'pending',
        sent_by: user.id,
        sent_from: 'posty',
      })
      .select('id')
      .single();

    const messageDbId = message?.id;

    // Try to send via Evolution
    let messageId: string | null = null;
    let sendError: string | null = null;

    try {
      const result = await provider.sendText(
        typedConn.instance_name,
        destination,
        text,
        delay,
      );
      messageId = result.messageId;
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'Error desconocido al enviar';
      console.error('[Send] Evolution error:', sendError);
    }

    if (messageId && messageDbId) {
      // Success: update with external_id
      await adminDb
        .from('chat_messages')
        .update({ external_id: messageId, status: 'sent' })
        .eq('id', messageDbId);
    } else if (messageDbId) {
      // Failed: mark as failed with error
      const userError = sendError?.includes('not found') || sendError?.includes('404')
        ? 'WhatsApp no aceptó el destino'
        : sendError?.includes('disconnect') || sendError?.includes('close')
          ? 'Sin conexión con WhatsApp'
          : sendError ?? 'Error al enviar el mensaje';

      await adminDb
        .from('chat_messages')
        .update({ status: 'failed', error: userError })
        .eq('id', messageDbId);

      return Response.json({
        error: userError,
        messageId: messageDbId,
        status: 'failed',
      }, { status: 502 });
    }

    const typedMessage = message as MessageRow;

    // Update conversation preview
    await adminDb
      .from('chat_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 100),
      })
      .eq('id', conversationId);

    return Response.json({ messageId, id: typedMessage.id });
  } catch (error) {
    console.error('Send route error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
