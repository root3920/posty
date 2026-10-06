import sharp from 'sharp';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 30;

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_DIMENSION = 512;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * POST /api/settings/logo — Upload hotel logo
 * Processes with sharp: max 512px, WEBP output, EXIF rotation fix.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return Response.json({ error: 'Perfil no encontrado' }, { status: 400 });

    const orgId = profile.organization_id;
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) return Response.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: 'Formato no permitido. Usa PNG, JPG o WEBP' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'El archivo es muy grande. Máximo 2 MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Process: resize to max 512px, fix EXIF, always output as WebP
    // WebP supports transparency and is smaller than PNG
    let processed: Buffer;
    try {
      processed = await sharp(buffer)
        .rotate() // EXIF auto-rotation
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (sharpErr) {
      console.error('[logo] sharp processing error:', sharpErr);
      return Response.json({ error: 'No se pudo procesar la imagen. Verifica que sea un archivo válido.' }, { status: 400 });
    }

    const contentType = 'image/webp';
    const ext = 'webp';

    // Generate unique filename (hash prevents caching issues)
    const hash = randomBytes(8).toString('hex');
    const logoPath = `${orgId}/logo-${hash}.${ext}`;

    const admin = createAdminClient();

    // Ensure bucket exists (may not have been created by migration)
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.find((b) => b.id === 'hotel-logos')) {
      const { error: createBucketError } = await admin.storage.createBucket('hotel-logos', {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      });
      if (createBucketError && !createBucketError.message?.includes('already exists')) {
        console.error('[logo] Bucket creation error:', createBucketError);
        return Response.json({ error: 'No se pudo crear el almacenamiento. Contacta a soporte.' }, { status: 500 });
      }
    }

    // Delete old logo if exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (admin as any)
      .from('organizations')
      .select('logo_path')
      .eq('id', orgId)
      .single();

    if (org?.logo_path) {
      await admin.storage.from('hotel-logos').remove([org.logo_path]);
    }

    // Upload new logo
    const { error: uploadError } = await admin.storage
      .from('hotel-logos')
      .upload(logoPath, processed, { contentType, upsert: true });

    if (uploadError) {
      console.error('[logo] Upload error:', JSON.stringify(uploadError));
      const detail = uploadError.message ?? '';
      if (detail.includes('not found') || detail.includes('Bucket')) {
        return Response.json({ error: 'El almacenamiento no está configurado. Contacta a soporte.' }, { status: 500 });
      }
      if (detail.includes('Payload too large') || detail.includes('too large')) {
        return Response.json({ error: 'El archivo es muy grande para el servidor.' }, { status: 413 });
      }
      if (detail.includes('policy') || detail.includes('denied') || detail.includes('RLS')) {
        return Response.json({ error: 'No tienes permiso para subir archivos.' }, { status: 403 });
      }
      return Response.json({ error: `No se pudo guardar el logo: ${detail || 'intenta de nuevo'}` }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from('hotel-logos').getPublicUrl(logoPath);
    const logoUrl = urlData.publicUrl;

    // Update organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { error: updateError } = await (admin as any)
      .from('organizations')
      .update({ logo_url: logoUrl, logo_path: logoPath })
      .eq('id', orgId);

    // If logo_path column doesn't exist yet, fall back to logo_url only
    if (updateError?.message?.includes('logo_path')) {
      console.warn('[logo] logo_path column not found, using logo_url only');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ error: updateError } = await (admin as any)
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('id', orgId));
    }

    if (updateError) {
      console.error('[logo] DB update error:', JSON.stringify(updateError));
      return Response.json({ error: `No se pudo guardar: ${updateError.message ?? 'intenta de nuevo'}` }, { status: 500 });
    }

    return Response.json({ logoUrl, logoPath });
  } catch (error) {
    console.error('[logo] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/settings/logo — Remove hotel logo
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return Response.json({ error: 'Perfil no encontrado' }, { status: 400 });

    const orgId = profile.organization_id;
    const admin = createAdminClient();

    // Get current logo path
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (admin as any)
      .from('organizations')
      .select('logo_path')
      .eq('id', orgId)
      .single();

    // Delete from storage
    if (org?.logo_path) {
      await admin.storage.from('hotel-logos').remove([org.logo_path]);
    }

    // Clear from DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('organizations')
      .update({ logo_url: null, logo_path: null })
      .eq('id', orgId);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[logo] Delete error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    );
  }
}
