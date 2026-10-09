import { getServerProfile } from '@/lib/auth/get-profile';
import { isEmailConfigured } from '@/lib/email/provider';
import { sendHotelEmail } from '@/lib/email/send';
import { z } from 'zod';

const testSchema = z.object({
  to: z.string().email('Correo inválido'),
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

    const input = testSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const result = await sendHotelEmail({
      orgId: profile.organization_id,
      org,
      sentBy: profile.id,
      to: input.data.to,
      subject: `Correo de prueba — ${org.name}`,
      body: 'Este es un correo de prueba enviado desde POSTY para verificar la configuración.',
      source: 'test',
      template: 'test',
      skipChecks: true,
    });

    return Response.json({ ok: true, id: result.id, threadId: result.threadId });
  } catch (error) {
    console.error('Error al enviar correo de prueba:', error);
    const msg = error instanceof Error ? error.message : 'No se pudo enviar el correo de prueba. Intenta de nuevo.';
    return Response.json({ error: msg }, { status: 500 });
  }
}
