import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const SIGNED_URL_TTL = 3600; // 1 hour

/**
 * POST /api/whatsapp/avatar-urls
 *
 * Generates signed URLs for a batch of contact avatar paths.
 * The bucket is private, so signed URLs are required.
 *
 * Body: { contactIds: string[] }
 * Returns: { urls: Record<contactId, signedUrl | null> }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) {
      return Response.json({ error: 'No se encontró el perfil' }, { status: 400 });
    }

    const orgId = profile.organization_id;
    const body = await request.json() as { contactIds: string[] };
    const contactIds = (body.contactIds ?? []).slice(0, 100); // Max 100

    if (contactIds.length === 0) {
      return Response.json({ urls: {} });
    }

    const adminDb: Db = createAdminClient();

    // Get contacts with avatar_path
    const { data: contacts } = await adminDb
      .from('chat_contacts')
      .select('id,avatar_path,avatar_status')
      .eq('organization_id', orgId)
      .in('id', contactIds)
      .not('avatar_path', 'is', null)
      .eq('avatar_status', 'ok');

    const urls: Record<string, string | null> = {};

    // Initialize all to null
    for (const id of contactIds) {
      urls[id] = null;
    }

    if (!contacts || contacts.length === 0) {
      return Response.json({ urls });
    }

    // Generate signed URLs in batch
    const paths = contacts.map((c: { avatar_path: string }) => c.avatar_path);
    const { data: signedData, error: signedError } = await adminDb.storage
      .from('whatsapp-avatars')
      .createSignedUrls(paths, SIGNED_URL_TTL);

    if (signedError) {
      console.error('[avatar-urls] Signed URL error:', signedError.message);
      return Response.json({ urls });
    }

    // Map back to contact IDs
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const signed = signedData?.[i];
      if (signed?.signedUrl) {
        urls[contact.id] = signed.signedUrl;
      }
    }

    return Response.json({ urls });
  } catch (error) {
    console.error('[avatar-urls] Route error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    );
  }
}
