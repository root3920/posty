import { getServerProfile } from '@/lib/auth/get-profile';
import { isEmailConfigured } from '@/lib/email/provider';
import { sendHotelEmail } from '@/lib/email/send';
import { z } from 'zod';

const sendSchema = z.object({
  guestId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  guestName: z.string().min(1),
  source: z
    .enum(['manual', 'guest_profile', 'automation', 'contract', 'reservation', 'event'])
    .default('guest_profile'),
  idempotencyKey: z.string().min(1).optional(),
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
      return Response.json({ error: 'Organización no encontrada en el perfil' }, { status: 403 });
    }

    const input = sendSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const { guestId, to, subject, body, guestName, source, idempotencyKey } = input.data;

    const result = await sendHotelEmail({
      orgId: profile.organization_id,
      org,
      sentBy: profile.id,
      to,
      subject,
      body,
      guestId,
      guestName,
      source,
      idempotencyKey: idempotencyKey || null,
    });

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo enviar el correo. Intenta de nuevo.';
    console.error('[Email Send] Error:', msg);
    // Distinguish between validation/business errors and server errors
    const status = msg.includes('Límite') ? 429
      : msg.includes('rebotó') || msg.includes('spam') || msg.includes('baja') || msg.includes('suprimido') ? 422
      : msg.includes('pausado') ? 403
      : 500;
    return Response.json({ error: msg }, { status });
  }
}
