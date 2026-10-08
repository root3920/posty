import { createAdminClient } from '@/lib/supabase/admin';
import { getServerProfile } from '@/lib/auth/get-profile';
import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-explicit-any */

const SIGNED_URL_TTL = 3600; // 1 hour

const querySchema = z.object({
  path: z.string().min(1),
});

// GET — return a signed URL for downloading an email attachment
export async function GET(request: Request) {
  try {
    const profile = await getServerProfile();
    if (!profile) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const input = querySchema.safeParse({ path: url.searchParams.get('path') });
    if (!input.success) {
      return Response.json({ error: 'Ruta del archivo requerida' }, { status: 400 });
    }

    const storagePath = input.data.path;

    // Verify the attachment belongs to this org
    // Storage paths are: orgId/threadId/attachmentId-filename
    const pathOrgId = storagePath.split('/')[0];
    if (pathOrgId !== profile.organization_id) {
      return Response.json({ error: 'No autorizado' }, { status: 403 });
    }

    const adminDb = createAdminClient() as any;

    const { data: signedData, error: signedError } = await adminDb.storage
      .from('email-attachments')
      .createSignedUrl(storagePath, SIGNED_URL_TTL);

    if (signedError || !signedData?.signedUrl) {
      console.error('[Email Attachments] Signed URL error:', signedError?.message);
      return Response.json({ error: 'No se pudo generar enlace de descarga' }, { status: 500 });
    }

    return Response.json({ url: signedData.signedUrl });
  } catch (error) {
    console.error('[Email Attachments] Error:', error);
    return Response.json({ error: 'Error al obtener archivo' }, { status: 500 });
  }
}
