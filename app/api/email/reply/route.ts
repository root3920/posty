import { createAdminClient } from '@/lib/supabase/admin';
import { getServerProfile } from '@/lib/auth/get-profile';
import {
  getEmailProvider,
  buildHotelFromAddress,
  buildReplyToAddress,
  generateMessageId,
  isEmailConfigured,
} from '@/lib/email/provider';
import { ManualEmail, manualEmailText } from '@/lib/email/templates/manual-email';
import { checkEmailPaused } from '@/lib/email/pause-check';
import { ensureEmailAlias } from '@/lib/email/ensure-alias';
import { z } from 'zod';
import { randomUUID } from 'crypto';

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

    // Check if email is paused for this org
    const pauseMsg = await checkEmailPaused(profile.organization_id);
    if (pauseMsg) {
      return Response.json({ error: pauseMsg }, { status: 403 });
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
      .select('id, organization_id, guest_id, subject, token, sender_address')
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

    // Get or create alias (never fails)
    const alias = await ensureEmailAlias(adminDb, profile.organization_id, org.name);

    // Build threading headers
    const msgUuid = randomUUID();
    const messageId = generateMessageId(msgUuid);
    const inReplyTo = lastMessage?.message_id || null;
    const referencesHeader = buildReferences(
      lastMessage?.references_header,
      lastMessage?.message_id,
    );

    // Build From and Reply-To
    const fromAddress = buildHotelFromAddress(org.name, alias);
    const replyToAddress = buildReplyToAddress(alias, thread.token);

    // Determine guest name for the template
    let guestName = 'estimado/a';
    if (thread.guest_id) {
      const { data: guest } = await adminDb
        .from('guests')
        .select('first_name')
        .eq('id', thread.guest_id)
        .maybeSingle();
      if (guest?.first_name) guestName = guest.first_name;
    }

    // Insert message record first (status: queued)
    const { data: emailRow, error: insertErr } = await adminDb
      .from('email_messages')
      .insert({
        organization_id: profile.organization_id,
        thread_id: threadId,
        guest_id: thread.guest_id,
        direction: 'out',
        to: recipient,
        from_address: fromAddress,
        subject: `Re: ${thread.subject}`,
        template: 'manual',
        body_text: body,
        message_id: messageId,
        in_reply_to: inReplyTo,
        references_header: referencesHeader,
        status: 'queued',
        sent_by: profile.id,
      })
      .select('id')
      .single();

    if (insertErr) {
      return Response.json({ error: `Error al registrar correo: ${insertErr.message}` }, { status: 500 });
    }

    // Send via Resend
    const provider = getEmailProvider();
    try {
      const result = await provider.send({
        to: recipient,
        from: fromAddress,
        subject: `Re: ${thread.subject}`,
        replyTo: replyToAddress,
        react: ManualEmail({
          hotelName: org.name,
          logoUrl: org.logo_url,
          brandColor: org.brand_color || undefined,
          guestName,
          subject: `Re: ${thread.subject}`,
          body,
        }),
        text: manualEmailText({
          hotelName: org.name,
          guestName,
          subject: `Re: ${thread.subject}`,
          body,
        }),
        headers: {
          'Message-ID': messageId,
          ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}),
          ...(referencesHeader ? { References: referencesHeader } : {}),
          'X-Posty-Processed': 'true',
          'X-Entity-Ref-ID': emailRow.id,
        },
      });

      // Update to sent
      await adminDb
        .from('email_messages')
        .update({ status: 'sent', provider_id: result.id, updated_at: new Date().toISOString() })
        .eq('id', emailRow.id);

      // Update thread: reset unread, update last_message_at, reopen if closed
      await adminDb
        .from('email_threads')
        .update({
          unread_count: 0,
          last_message_at: new Date().toISOString(),
          status: 'open',
          updated_at: new Date().toISOString(),
        })
        .eq('id', threadId);

      return Response.json({ id: emailRow.id, providerId: result.id, status: 'sent' });
    } catch (sendErr) {
      const raw = sendErr instanceof Error ? sendErr.message : 'Error desconocido';
      console.error('[Email Reply] Send error:', raw);
      await adminDb
        .from('email_messages')
        .update({ status: 'failed', error: raw, updated_at: new Date().toISOString() })
        .eq('id', emailRow.id);

      const userMsg = raw.startsWith('No se pudo') || raw.startsWith('Resend')
        ? raw
        : 'No se pudo enviar el correo. Intenta de nuevo.';
      return Response.json({ error: userMsg }, { status: 502 });
    }
  } catch (error) {
    console.error('[Email Reply] Error:', error);
    return Response.json({ error: 'No se pudo enviar la respuesta.' }, { status: 500 });
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
