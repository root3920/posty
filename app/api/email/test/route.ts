import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmailProvider, buildFromAddress, isEmailConfigured } from '@/lib/email/provider';
import { TestEmail, testEmailText } from '@/lib/email/templates/test-email';
import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-explicit-any */

const testSchema = z.object({
  to: z.string().email('Correo inválido'),
});

export async function POST(request: Request) {
  try {
    if (!isEmailConfigured()) {
      return Response.json({ error: 'Email no está configurado en el servidor' }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return Response.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    // Use admin client for new column contact_email
    const adminDb = createAdminClient() as any;
    const { data: org } = await adminDb
      .from('organizations')
      .select('id, name, logo_url, brand_color, contact_email')
      .eq('id', profile.organization_id)
      .single();

    if (!org) {
      return Response.json({ error: 'Organización no encontrada' }, { status: 403 });
    }

    const input = testSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const provider = getEmailProvider();
    const fromAddress = buildFromAddress(org.name);

    const result = await provider.send({
      to: input.data.to,
      subject: `Correo de prueba — ${org.name}`,
      from: fromAddress,
      replyTo: org.contact_email || undefined,
      react: TestEmail({
        hotelName: org.name,
        logoUrl: org.logo_url,
        brandColor: org.brand_color || undefined,
      }),
      text: testEmailText(org.name),
    });

    return Response.json({ ok: true, id: result.id });
  } catch (error) {
    console.error('Test email error:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}
