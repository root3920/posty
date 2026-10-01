import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processImageForInstagram } from '@/lib/instagram/image-processor';
import { randomBytes } from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const aspectRatio = formData.get('aspectRatio') as string | null;

    if (!file) return Response.json({ error: 'No se recibió imagen' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return Response.json({ error: 'La imagen es demasiado grande (máx. 10 MB)' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return Response.json({ error: 'Formato no soportado. Usa JPG, PNG, WebP o HEIC' }, { status: 400 });

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process with sharp: convert to JPEG, resize, fix orientation
    const processed = await processImageForInstagram(buffer, aspectRatio ?? undefined);

    // Upload to Supabase Storage
    const filename = `${profile.organization_id}/${randomBytes(16).toString('hex')}.jpg`;
    const admin = createAdminClient();

    const { error: uploadError } = await admin.storage
      .from('instagram-media')
      .upload(filename, processed, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      console.error('[Instagram] Upload error:', uploadError);
      return Response.json({ error: 'Error al subir la imagen' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from('instagram-media').getPublicUrl(filename);

    console.log('[Instagram] Image uploaded:', filename);

    return Response.json({
      path: filename,
      publicUrl: urlData.publicUrl,
    });
  } catch (error) {
    console.error('[Instagram] Upload route error:', error);
    return Response.json({ error: 'Error al procesar la imagen' }, { status: 500 });
  }
}
