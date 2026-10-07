import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmailProvider, buildFromAddress } from '@/lib/email/provider';
import { isEmailConfigured } from '@/lib/email/provider';
import { ManualEmail, manualEmailText } from '@/lib/email/templates/manual-email';
import { z } from 'zod';

// NOTE: email_messages and email_suppressions tables added in migration
// 20261007100000_email_module.sql. Types will be regenerated after db push.
// Using `any` cast until then.

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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    // Get profile + org
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.organization_id) {
      return Response.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    const adminDb = createAdminClient() as any;

    // Fetch org data (using admin to read contact_email which is a new column)
    const { data: org } = await adminDb
      .from('organizations')
      .select('id, name, logo_url, brand_color, contact_email')
      .eq('id', profile.organization_id)
      .single();

    if (!org) {
      return Response.json({ error: 'Organización no encontrada' }, { status: 403 });
    }

    const input = sendSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const { guestId, to, subject, body, guestName, idempotencyKey } = input.data;

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

    // Rate limit per organization per hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: hourCount } = await adminDb
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .gte('created_at', oneHourAgo);

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

    if (insertErr) throw insertErr;

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
      // Update to failed
      const errorMsg = sendErr instanceof Error ? sendErr.message : 'Error desconocido';
      await adminDb
        .from('email_messages')
        .update({ status: 'failed', error: errorMsg, updated_at: new Date().toISOString() })
        .eq('id', emailRow.id);

      return Response.json({ error: `Error al enviar: ${errorMsg}` }, { status: 502 });
    }
  } catch (error) {
    console.error('Email send error:', error);
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
