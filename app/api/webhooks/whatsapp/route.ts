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
  connected_at: string | null;
}

// History-sync events that arrive on initial connect — skip them entirely
const HISTORY_SYNC_EVENTS = new Set([
  'messages.set',
  'chats.set',
  'contacts.set',
  'chats.upsert',
  'chats.update',
  'contacts.upsert',
  'contacts.update',
]);

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

function phoneFromJid(jid: string): string | null {
  if (jid.includes('@s.whatsapp.net')) {
    const digits = jid.replace(/@.*/, '').replace(/\D/g, '');
    if (digits.length >= 10) return `+${digits}`;
  }
  return null; // LID or invalid — not a phone
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

// ─── Event handlers ─────────────────────────────────────────────────────────

async function handleMessageUpsert(
  db: any,
  conn: ConnectionRow,
  data: Record<string, unknown>,
): Promise<void> {
  // MESSAGES_UPSERT sends an array of messages
  const messages: Record<string, unknown>[] = Array.isArray(data) ? data : [data];

  // connected_at as epoch ms for timestamp comparison
  const connectedAtMs = conn.connected_at ? new Date(conn.connected_at).getTime() : null;

  for (const msg of messages) {
    const key = msg.key as Record<string, unknown> | undefined;
    if (!key) continue;

    const remoteJid = key.remoteJid as string | undefined;
    if (!remoteJid || !isValidContact(remoteJid)) continue;

    const fromMe = key.fromMe as boolean | undefined;
    const messageId = key.id as string | undefined;
    if (!messageId) continue;

    // Skip protocol messages, reactions, and deleted messages
    const messageType = msg.messageType as string | undefined;
    if (messageType === 'protocolMessage' || messageType === 'reactionMessage' || messageType === 'senderKeyDistributionMessage') continue;

    // Skip messages that predate this session's connection (history sync residuals)
    const msgTimestamp = msg.messageTimestamp as number | string | undefined;
    if (msgTimestamp && connectedAtMs !== null) {
      const msgMs = typeof msgTimestamp === 'string' ? parseInt(msgTimestamp, 10) * 1000 : msgTimestamp * 1000;
      if (msgMs < connectedAtMs) {
        console.log('[Webhook] Skipping pre-connection message ts:', msgTimestamp);
        continue;
      }
    }

    const pushName = msg.pushName as string | undefined;

    // Resolve phone: try participant field (real phone for LID contacts), then remoteJid
    const participant = key.participant as string | undefined;
    const senderPn = (msg as Record<string, unknown>).senderPn as string | undefined;
    const phone = phoneFromJid(senderPn ?? participant ?? remoteJid ?? '') ?? phoneFromJid(remoteJid ?? '');
    const lid = lidFromJid(remoteJid ?? '');

    // Must have either a real phone or a LID
    if (!phone && !lid) continue;

    // Use phone as the conversation key, falling back to "lid:{lid}"
    const contactKey = phone ?? `lid:${lid}`;

    console.log('[Webhook] Message:', { remoteJid: remoteJid?.slice(0, 15), phone, lid: lid?.slice(0, 10), fromMe, messageType });
    const bodyText = extractBodyText(msg);
    const msgType = extractMessageType(messageType);

    // Atomic: upsert contact then upsert conversation (no race conditions)
    const { data: contactId, error: contactErr } = await db.rpc('upsert_chat_contact', {
      p_org_id: conn.organization_id,
      p_phone: phone,
      p_lid: lid,
      p_whatsapp_name: fromMe ? null : (pushName ?? null),
      p_profile_pic: null,
    });

    console.log('[Webhook] upsert_chat_contact result:', { contactId, err: contactErr?.message });
    if (contactErr || !contactId) {
      console.error('[Webhook] Failed to upsert contact:', contactErr?.message ?? 'null returned', 'phone:', phone, 'lid:', lid);
      continue;
    }

    const { data: conversationId, error: convErr } = await db.rpc('upsert_chat_conversation', {
      p_org_id: conn.organization_id,
      p_connection_id: conn.id,
      p_contact_id: contactId,
      p_contact_phone: phone ?? (lid ? `lid:${lid}` : null),
      p_contact_name: fromMe ? null : (pushName ?? null),
      p_is_inbound: !fromMe,
    });

    console.log('[Webhook] upsert_chat_conversation result:', { conversationId, err: convErr?.message });
    if (convErr || !conversationId) {
      console.error('[Webhook] Failed to upsert conversation:', convErr?.message ?? 'null returned');
      continue;
    }

    // Insert message — idempotent via unique constraint on (organization_id, external_id)
    const { error: msgError } = await db.from('chat_messages').insert({
      organization_id: conn.organization_id,
      conversation_id: conversationId,
      external_id: messageId,
      direction: fromMe ? 'out' : 'in',
      type: msgType,
      body: bodyText,
      status: fromMe ? 'sent' : 'delivered',
      sent_from: fromMe ? 'phone' : null,
    });
    console.log('[Webhook] Insert message result:', msgError ? msgError.message : 'OK', 'id:', messageId?.slice(0, 10));

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

  if (state === 'open') {
    await db
      .from('whatsapp_connections')
      .update({
        status: 'connected',
        connected_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        disconnect_reason: null,
      })
      .eq('id', conn.id);
    return;
  }

  if (state === 'connecting') {
    await db
      .from('whatsapp_connections')
      .update({ status: 'connecting', last_seen_at: new Date().toISOString() })
      .eq('id', conn.id);
    return;
  }

  if (state === 'close') {
    // Map Evolution statusReason codes to human-readable disconnect reasons
    const statusReason = data.statusReason as number | string | undefined;
    let disconnectReason = 'phone_logout';
    if (statusReason === 401 || statusReason === '401') disconnectReason = 'phone_logout';
    else if (statusReason === 408 || statusReason === '408') disconnectReason = 'inactivity';
    else if (statusReason === 440 || statusReason === '440') disconnectReason = 'banned';

    console.log('[Webhook] Connection closed — statusReason:', statusReason, '→ reason:', disconnectReason);

    await db
      .from('whatsapp_connections')
      .update({
        status: 'disconnected_pending',
        disconnect_reason: disconnectReason,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', conn.id);
  }
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

    // Skip history-sync bulk events immediately — before any DB work
    const eventLower = (body.event ?? '').toLowerCase();
    if (HISTORY_SYNC_EVENTS.has(eventLower)) {
      console.log('[Webhook] Skipping history-sync event:', body.event);
      return Response.json({ ok: true });
    }

    // Find connection
    const { data: conn } = await db
      .from('whatsapp_connections')
      .select('id, organization_id, connected_at')
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
      const ev = eventLower;
      if (ev === 'messages.upsert' || ev === 'messages_upsert') {
        console.log('[Webhook] Message upsert — key:', JSON.stringify((data as Record<string, unknown>).key));
        await handleMessageUpsert(db, typedConn, data);
      } else if (ev === 'messages.update' || ev === 'messages_update') {
        await handleMessageUpdate(db, typedConn, data);
      } else if (ev === 'connection.update' || ev === 'connection_update') {
        await handleConnectionUpdate(db, typedConn, data);
      } else {
        console.log('[Webhook] Unhandled event:', event);
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
      console.error('[Webhook] PROCESSING ERROR:', processingError instanceof Error ? processingError.message : processingError);
      console.error('[Webhook] Stack:', processingError instanceof Error ? processingError.stack : '');
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    // Always return 200 to prevent Evolution from retrying
    return Response.json({ ok: true });
  }
}
