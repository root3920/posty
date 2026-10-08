import { createAdminClient } from '@/lib/supabase/admin';
import { getServerProfile } from '@/lib/auth/get-profile';
import { getEmailProvider, buildFromAddress, isEmailConfigured } from '@/lib/email/provider';
import { checkEmailPaused } from '@/lib/email/pause-check';
import { ManualEmail, manualEmailText } from '@/lib/email/templates/manual-email';
import { z } from 'zod';

// NOTE: email_messages and email_suppressions tables added in migration
// 20261007100000_email_module.sql. Types will be regenerated after db push.
/* eslint-disable @typescript-eslint/no-explicit-any */

const sendSchema = z.object({
  guestId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  guestName: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});

const RATE_LIMIT_PER_HOUR = 100;

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
      return Response.json({ error: 'Organización no encontrada en el perfil' }, { status: 403 });
    }

    // Check if email is paused for this org
    const pauseMsg = await checkEmailPaused(profile.organization_id);
    if (pauseMsg) {
      return Response.json({ error: pauseMsg }, { status: 403 });
    }

    const input = sendSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const { guestId, to, subject, body, guestName, idempotencyKey } = input.data;
    const adminDb = createAdminClient() as any;

    // Check idempotency
    if (idempotencyKey) {
      const { data: existing } = await adminDb
        .from('email_messages')
        .select('id, status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existing) {
        return Response.json({ id: existing.id, status: existing.status, deduplicated: true });
      }
    }

    // Check suppression list
    const { data: suppressed, error: suppressErr } = await adminDb
      .from('email_suppressions')
      .select('id, reason')
      .eq('organization_id', profile.organization_id)
      .eq('email', to.toLowerCase())
      .maybeSingle();

    if (suppressErr) {
      console.error('Error al consultar lista de supresión:', suppressErr.message);
      return Response.json({ error: `Error al verificar destinatario: ${suppressErr.message}` }, { status: 500 });
    }

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

    // Rate limit per organization per hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: hourCount, error: rateErr } = await adminDb
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .gte('created_at', oneHourAgo);

    if (rateErr) {
      console.error('Error al consultar rate limit:', rateErr.message);
      return Response.json({ error: `Error al verificar límite de envío: ${rateErr.message}` }, { status: 500 });
    }

    if ((hourCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return Response.json({
        error: `Límite de envío alcanzado (${RATE_LIMIT_PER_HOUR}/hora). Intenta más tarde.`,
      }, { status: 429 });
    }

    // Insert message record first (status: queued)
    const { data: emailRow, error: insertErr } = await adminDb
      .from('email_messages')
      .insert({
        organization_id: profile.organization_id,
        guest_id: guestId,
        to: to.toLowerCase(),
        subject,
        template: 'manual',
        body_text: body,
        status: 'queued',
        sent_by: profile.id,
        idempotency_key: idempotencyKey || null,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Error al registrar correo:', insertErr.message);
      return Response.json({ error: `Error al registrar correo: ${insertErr.message}` }, { status: 500 });
    }

    // Build and send email
    const provider = getEmailProvider();
    const fromAddress = buildFromAddress(org.name);

    try {
      const result = await provider.send({
        to,
        subject,
        from: fromAddress,
        replyTo: org.contact_email || undefined,
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
          'X-Entity-Ref-ID': emailRow.id,
        },
      });

      // Update to sent
      await adminDb
        .from('email_messages')
        .update({ status: 'sent', provider_id: result.id, updated_at: new Date().toISOString() })
        .eq('id', emailRow.id);

      return Response.json({ id: emailRow.id, providerId: result.id, status: 'sent' });
    } catch (sendErr) {
      const raw = sendErr instanceof Error ? sendErr.message : 'Error desconocido';
      console.error('Error al enviar correo via Resend:', raw);
      await adminDb
        .from('email_messages')
        .update({ status: 'failed', error: raw, updated_at: new Date().toISOString() })
        .eq('id', emailRow.id);

      return Response.json({ error: raw }, { status: 502 });
    }
  } catch (error) {
    console.error('Error inesperado en envío de correo:', error);
    return Response.json({ error: 'No se pudo enviar el correo. Intenta de nuevo.' }, { status: 500 });
  }
}
