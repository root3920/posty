import { createAdminClient } from '@/lib/supabase/admin';

// This route is intentionally PUBLIC — no auth middleware.
// The payload is always captured first; secret validation happens after.
//
// NOTE: whatsapp_* and chat_messages tables were added in migration
// 20260930175548_chat_phase0.sql. Types will be regenerated after db push.
// Using `any` cast until then.

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ConnectionRow {
  id: string;
  organization_id: string;
}

// ─── Message type helpers ───────────────────────────────────────────────────

function extractMessageType(messageType: string | undefined): string {
  if (!messageType) return 'text';
  if (messageType === 'conversation' || messageType === 'extendedTextMessage') return 'text';
  if (messageType === 'imageMessage') return 'image';
  if (messageType === 'videoMessage') return 'video';
  if (messageType === 'audioMessage' || messageType === 'pttMessage') return 'audio';
  if (messageType === 'documentMessage') return 'document';
  if (messageType === 'stickerMessage') return 'sticker';
  return 'text';
}

function extractBodyText(data: Record<string, unknown>): string | null {
  const msg = data.message as Record<string, unknown> | undefined;
  if (!msg) return null;
  if (typeof msg.conversation === 'string') return msg.conversation;
  const ext = msg.extendedTextMessage as Record<string, unknown> | undefined;
  if (ext && typeof ext.text === 'string') return ext.text;
  return null;
}

function contactFromJid(jid: string): string {
  // Classic: 573001234567@s.whatsapp.net → +573001234567
  if (jid.includes('@s.whatsapp.net')) {
    const digits = jid.replace(/@.*/, '').replace(/\D/g, '');
    return `+${digits}`;
  }
  // LID format: 268938084675807@lid → use as-is (not a phone number)
  return jid.replace(/@.*/, '');
}

// ─── Event handlers ─────────────────────────────────────────────────────────

async function handleMessageUpsert(
  db: any,
  conn: ConnectionRow,
  data: Record<string, unknown>,
): Promise<void> {
  // MESSAGES_UPSERT sends an array of messages
  const messages: Record<string, unknown>[] = Array.isArray(data) ? data : [data];

  for (const msg of messages) {
    const key = msg.key as Record<string, unknown> | undefined;
    if (!key) continue;

    const remoteJid = key.remoteJid as string | undefined;
    if (!remoteJid) continue;

    // Skip group messages
    // Skip groups, newsletters, broadcasts, status
    if (remoteJid.includes('@g.us') || remoteJid.includes('@newsletter') || remoteJid.includes('@broadcast') || remoteJid.includes('status@')) continue;

    const fromMe = key.fromMe as boolean | undefined;
    const messageId = key.id as string | undefined;
    if (!messageId) continue;

    const pushName = msg.pushName as string | undefined;
    const messageType = msg.messageType as string | undefined;

    console.log('[Webhook] Message:', { remoteJid, fromMe, messageId: messageId?.slice(0, 10), pushName, messageType });
    const bodyText = extractBodyText(msg);
    const msgType = extractMessageType(messageType);
    const phone = contactFromJid(remoteJid);

    // Find or create conversation
    const { data: existingConv } = await db
      .from('chat_conversations')
      .select('id')
      .eq('organization_id', conn.organization_id)
      .eq('connection_id', conn.id)
      .eq('contact_phone_e164', phone)
      .limit(1)
      .maybeSingle();

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id as string;
      // Update name if we got a pushName and conversation doesn't have one
      if (pushName) {
        await db
          .from('chat_conversations')
          .update({ contact_name: pushName })
          .eq('id', conversationId)
          .is('contact_name', null);
      }
    } else {
      // Try to auto-link to guest by phone
      const { data: guest } = await db
        .from('guests')
        .select('id')
        .eq('organization_id', conn.organization_id)
        .eq('phone_e164', phone)
        .limit(1)
        .maybeSingle();

      const { data: newConv, error: convError } = await db
        .from('chat_conversations')
        .insert({
          organization_id: conn.organization_id,
          connection_id: conn.id,
          contact_phone_e164: phone,
          contact_name: pushName ?? null,
          guest_id: guest?.id ?? null,
        })
        .select('id')
        .single();

      if (convError || !newConv) {
        console.error('Failed to create conversation:', convError);
        continue;
      }
      conversationId = newConv.id as string;
    }

    // Insert message — idempotent via unique constraint on (organization_id, external_id)
    const { error: msgError } = await db.from('chat_messages').insert({
      organization_id: conn.organization_id,
      conversation_id: conversationId,
      external_id: messageId,
      direction: fromMe ? 'out' : 'in',
      message_type: msgType,
      body: bodyText,
      status: fromMe ? 'sent' : null,
      sent_from: fromMe ? 'whatsapp' : null,
    });

    if (msgError && msgError.code !== '23505') {
      // 23505 = unique_violation (already exists, idempotent)
      console.error('Failed to insert message:', msgError);
      continue;
    }

    // If incoming: increment unread count + update preview
    if (!fromMe) {
      const { data: cv } = await db
        .from('chat_conversations')
        .select('unread_count')
        .eq('id', conversationId)
        .single();

      await db
        .from('chat_conversations')
        .update({
          unread_count: ((cv?.unread_count as number) ?? 0) + 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: bodyText ? bodyText.slice(0, 100) : null,
        })
        .eq('id', conversationId);
    }
  }
}

async function handleMessageUpdate(
  db: any,
  _conn: ConnectionRow,
  data: Record<string, unknown>,
): Promise<void> {
  const updates: Record<string, unknown>[] = Array.isArray(data) ? data : [data];

  for (const update of updates) {
    const key = update.key as Record<string, unknown> | undefined;
    if (!key) continue;

    const messageId = key.id as string | undefined;
    if (!messageId) continue;

    const ack = update.update as Record<string, unknown> | undefined;
    const status = ack?.status as string | undefined;

    let mappedStatus: string | null = null;
    if (status === 'SERVER_ACK') mappedStatus = 'sent';
    else if (status === 'DELIVERY_ACK') mappedStatus = 'delivered';
    else if (status === 'READ' || status === 'PLAYED') mappedStatus = 'read';

    if (!mappedStatus) continue;

    await db
      .from('chat_messages')
      .update({ status: mappedStatus })
      .eq('external_id', messageId);
  }
}

async function handleConnectionUpdate(
  db: any,
  conn: ConnectionRow,
  data: Record<string, unknown>,
): Promise<void> {
  const state = data.state as string | undefined;

  let mappedStatus: string | null = null;
  if (state === 'open') mappedStatus = 'connected';
  else if (state === 'close') mappedStatus = 'disconnected';
  else if (state === 'connecting') mappedStatus = 'connecting';

  if (!mappedStatus) return;

  const updatePayload: Record<string, unknown> = {
    status: mappedStatus,
    last_seen_at: new Date().toISOString(),
  };

  if (state === 'open') {
    updatePayload.connected_at = new Date().toISOString();
  }

  await db
    .from('whatsapp_connections')
    .update(updatePayload)
    .eq('id', conn.id);
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      event?: string;
      instance?: string;
      data?: Record<string, unknown>;
      [key: string]: unknown;
    };

    // Cast to any: new tables not yet in generated types
    const db = createAdminClient() as any;
    const instanceName = body.instance;

    // Find connection
    const { data: conn } = await db
      .from('whatsapp_connections')
      .select('id, organization_id')
      .eq('instance_name', instanceName ?? '')
      .limit(1)
      .maybeSingle();

    const typedConn = conn as ConnectionRow | null;

    // Always capture raw payload first
    await db.from('whatsapp_webhook_logs').insert({
      organization_id: typedConn?.organization_id ?? null,
      connection_id: typedConn?.id ?? null,
      event_type: body.event ?? 'unknown',
      payload: body,
      status: 'pending',
    });

    // Validate webhook secret
    const secret = request.headers.get('x-webhook-secret');
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    console.log('[Webhook] Event:', body.event, 'Instance:', instanceName, 'Secret match:', secret === expected, 'Has secret:', !!secret, 'Has expected:', !!expected);
    if (!expected || (secret !== expected)) {
      console.log('[Webhook] Secret mismatch — secret length:', secret?.length, 'expected length:', expected?.length);
      // Still 200 — payload is captured. But skip processing.
      return Response.json({ ok: true, note: 'secret_mismatch' });
    }

    if (!typedConn) return Response.json({ ok: true });

    // Process event
    const event = body.event as string | undefined;
    const data = (body.data ?? {}) as Record<string, unknown>;

    console.log('[Webhook] Processing event:', event, 'data keys:', Object.keys(data));

    try {
      if (event === 'MESSAGES_UPSERT') {
        console.log('[Webhook] MESSAGES_UPSERT — key:', JSON.stringify((data as Record<string, unknown>).key));
        await handleMessageUpsert(db, typedConn, data);
      } else if (event === 'MESSAGES_UPDATE') {
        await handleMessageUpdate(db, typedConn, data);
      } else if (event === 'CONNECTION_UPDATE') {
        await handleConnectionUpdate(db, typedConn, data);
      }

      // Mark the most recent log as processed
      await db
        .from('whatsapp_webhook_logs')
        .update({ status: 'processed' })
        .eq('connection_id', typedConn.id)
        .eq('event_type', event ?? 'unknown')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
    } catch (processingError) {
      console.error('Webhook processing error:', processingError);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    // Always return 200 to prevent Evolution from retrying
    return Response.json({ ok: true });
  }
}
