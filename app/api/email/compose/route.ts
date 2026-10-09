import { getServerProfile } from '@/lib/auth/get-profile';
import { isEmailConfigured } from '@/lib/email/provider';
import { sendHotelEmail } from '@/lib/email/send';
import { z } from 'zod';

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

    const input = composeSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const { to, subject, body, guestId } = input.data;

    const result = await sendHotelEmail({
      orgId: profile.organization_id,
      org,
      sentBy: profile.id,
      to,
      subject,
      body,
      guestId: guestId || null,
      source: 'manual',
    });

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo enviar el correo.';
    console.error('[Email Compose] Error:', msg);
    const status = msg.includes('Límite') ? 429
      : msg.includes('rebotó') || msg.includes('spam') || msg.includes('baja') || msg.includes('suprimido') ? 422
      : msg.includes('pausado') ? 403
      : 500;
    return Response.json({ error: msg }, { status });
  }
}
