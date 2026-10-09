import { createAdminClient } from '@/lib/supabase/admin';
import { getServerProfile } from '@/lib/auth/get-profile';
import { isEmailConfigured } from '@/lib/email/provider';
import { sendHotelEmail } from '@/lib/email/send';
import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-explicit-any */

const replySchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(10000),
});

export async function POST(request: Request) {
  try {
    if (!isEmailConfigured()) {
      return Response.json({ error: 'Email no está configurado en el servidor' }, { status: 503 });
    }

    const profile = await getServerProfile();
    if (!profile) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const org = profile.organization;
    if (!org) {
      return Response.json({ error: 'Organización no encontrada' }, { status: 403 });
    }

    const input = replySchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const { threadId, body } = input.data;
    const adminDb = createAdminClient() as any;

    // Load thread
    const { data: thread, error: threadErr } = await adminDb
      .from('email_threads')
      .select('id, organization_id, guest_id, subject, sender_address')
      .eq('id', threadId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (threadErr || !thread) {
      return Response.json({ error: 'Hilo no encontrado' }, { status: 404 });
    }

    // Determine recipient — reply to the last inbound message sender, or the thread sender
    const { data: lastInbound } = await adminDb
      .from('email_messages')
      .select('from_address')
      .eq('thread_id', threadId)
      .eq('direction', 'in')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const recipient = lastInbound?.from_address || thread.sender_address;
    if (!recipient) {
      return Response.json({ error: 'No se encontró destinatario para responder' }, { status: 400 });
    }

    // Get the last message's Message-ID for In-Reply-To/References
    const { data: lastMessage } = await adminDb
      .from('email_messages')
      .select('message_id, references_header')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const inReplyTo = lastMessage?.message_id || null;
    const referencesHeader = buildReferences(
      lastMessage?.references_header,
      lastMessage?.message_id,
    );

    const result = await sendHotelEmail({
      orgId: profile.organization_id,
      org,
      sentBy: profile.id,
      to: recipient,
      subject: thread.subject,
      body,
      guestId: thread.guest_id,
      source: 'manual',
      threadId,
      inReplyTo,
      referencesHeader,
    });

    return Response.json({ id: result.id, providerId: result.providerId, status: result.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo enviar la respuesta.';
    console.error('[Email Reply] Error:', msg);
    const status = msg.includes('Hilo no encontrado') ? 404 : 500;
    return Response.json({ error: msg }, { status });
  }
}

function buildReferences(
  existingRefs: string | null,
  lastMessageId: string | null,
): string | null {
  const parts: string[] = [];
  if (existingRefs) parts.push(existingRefs);
  if (lastMessageId && !existingRefs?.includes(lastMessageId)) {
    parts.push(lastMessageId);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}
