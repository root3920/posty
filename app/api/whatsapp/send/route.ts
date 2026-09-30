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

    const body = await request.json() as { conversationId?: string; text?: string };
    const { conversationId, text } = body;

    if (!conversationId || !text) {
      return Response.json({ error: 'conversationId and text are required' }, { status: 400 });
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

    // Get conversation details — RLS ensures it belongs to this org
    const { data: conversation, error: convError } = await db
      .from('whatsapp_conversations')
      .select('id, contact_phone_e164, connection_id')
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
      return Response.json({ error: 'WhatsApp connection is not active' }, { status: 400 });
    }

    const provider = getWhatsAppProvider();
    const delay = calculateDelay(text);

    const { messageId } = await provider.sendText(
      typedConn.instance_name,
      typedConv.contact_phone_e164,
      text,
      delay,
    );

    // Insert the outgoing message — admin client for bypassing RLS on insert
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = adminSupabase as any;

    const { data: message, error: msgError } = await adminDb
      .from('chat_messages')
      .insert({
        organization_id: orgId,
        conversation_id: conversationId,
        external_id: messageId,
        direction: 'out',
        message_type: 'text',
        body: text,
        status: 'pending',
        sent_by: user.id,
        sent_from: 'posty',
      })
      .select('id')
      .single();

    if (msgError || !message) {
      console.error('Failed to insert sent message:', msgError);
      // Don't fail — message was already sent to WhatsApp
      return Response.json({ messageId, dbError: msgError?.message });
    }

    const typedMessage = message as MessageRow;

    // Update conversation preview
    await adminDb
      .from('whatsapp_conversations')
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
