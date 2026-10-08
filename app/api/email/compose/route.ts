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
import { nanoid } from 'nanoid';

/* eslint-disable @typescript-eslint/no-explicit-any */

const composeSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  guestId: z.string().uuid().optional(),
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

    const input = composeSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const { to, subject, body, guestId } = input.data;
    const adminDb = createAdminClient() as any;

    // Check suppression list
    const { data: suppressed } = await adminDb
      .from('email_suppressions')
      .select('id, reason')
      .eq('organization_id', profile.organization_id)
      .eq('email', to.toLowerCase())
      .maybeSingle();

    if (suppressed) {
      const reasonMap: Record<string, string> = {
        bounce: 'El correo rebotó previamente',
        complaint: 'El destinatario marcó un correo anterior como spam',
        unsubscribe: 'El destinatario se dio de baja',
      };
      return Response.json({
        error: reasonMap[suppressed.reason] || 'Correo suprimido',
      }, { status: 422 });
    }

    // Get or create alias (never fails)
    const alias = await ensureEmailAlias(adminDb, profile.organization_id, org.name);

    // Create new thread
    const threadToken = nanoid(12);
    const { data: thread, error: threadErr } = await adminDb
      .from('email_threads')
      .insert({
        organization_id: profile.organization_id,
        guest_id: guestId || null,
        subject,
        token: threadToken,
        sender_address: to.toLowerCase(),
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .select('id')
      .single();

    if (threadErr) {
      return Response.json({ error: `Error al crear hilo: ${threadErr.message}` }, { status: 500 });
    }

    // Build headers
    const msgUuid = randomUUID();
    const messageId = generateMessageId(msgUuid);
    const fromAddress = buildHotelFromAddress(org.name, alias);
    const replyToAddress = buildReplyToAddress(alias, threadToken);

    // Determine guest name
    let guestName = 'estimado/a';
    if (guestId) {
      const { data: guest } = await adminDb
        .from('guests')
        .select('first_name')
        .eq('id', guestId)
        .maybeSingle();
      if (guest?.first_name) guestName = guest.first_name;
    }

    // Insert message
    const { data: emailRow, error: insertErr } = await adminDb
      .from('email_messages')
      .insert({
        organization_id: profile.organization_id,
        thread_id: thread.id,
        guest_id: guestId || null,
        direction: 'out',
        to: to.toLowerCase(),
        from_address: fromAddress,
        subject,
        template: 'manual',
        body_text: body,
        message_id: messageId,
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
        to,
        from: fromAddress,
        subject,
        replyTo: replyToAddress,
        react: ManualEmail({
          hotelName: org.name,
          logoUrl: org.logo_url,
          brandColor: org.brand_color || undefined,
          guestName,
          subject,
          body,
        }),
        text: manualEmailText({
          hotelName: org.name,
          guestName,
          subject,
          body,
        }),
        headers: {
          'Message-ID': messageId,
          'X-Posty-Processed': 'true',
          'X-Entity-Ref-ID': emailRow.id,
        },
      });

      await adminDb
        .from('email_messages')
        .update({ status: 'sent', provider_id: result.id, updated_at: new Date().toISOString() })
        .eq('id', emailRow.id);

      return Response.json({
        id: emailRow.id,
        threadId: thread.id,
        providerId: result.id,
        status: 'sent',
      });
    } catch (sendErr) {
      const raw = sendErr instanceof Error ? sendErr.message : 'Error desconocido';
      console.error('[Email Compose] Send error:', raw);
      await adminDb
        .from('email_messages')
        .update({ status: 'failed', error: raw, updated_at: new Date().toISOString() })
        .eq('id', emailRow.id);

      return Response.json({ error: raw }, { status: 502 });
    }
  } catch (error) {
    console.error('[Email Compose] Error:', error);
    return Response.json({ error: 'No se pudo enviar el correo.' }, { status: 500 });
  }
}
