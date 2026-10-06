import sharp from 'sharp';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

    // Process: resize to max 512px, fix EXIF, output as WebP (preserving transparency)
    const metadata = await sharp(buffer).metadata();
    const hasAlpha = metadata.hasAlpha;

    let pipeline = sharp(buffer).rotate(); // EXIF auto-rotation

    // Resize if larger than MAX_DIMENSION
    if ((metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Output format: WebP if no alpha or has alpha; PNG if transparency needed and WebP not preferred
    const outputFormat = hasAlpha ? 'png' : 'webp';
    const contentType = hasAlpha ? 'image/png' : 'image/webp';
    const ext = hasAlpha ? 'png' : 'webp';

    if (outputFormat === 'png') {
      pipeline = pipeline.png({ quality: 90 });
    } else {
      pipeline = pipeline.webp({ quality: 85 });
    }

    const processed = await pipeline.toBuffer();

    // Generate unique filename (hash prevents caching issues)
    const hash = randomBytes(8).toString('hex');
    const logoPath = `${orgId}/logo-${hash}.${ext}`;

    const admin = createAdminClient();

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
      console.error('[logo] Upload error:', uploadError);
      return Response.json({ error: 'Error al subir el logo' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from('hotel-logos').getPublicUrl(logoPath);
    const logoUrl = urlData.publicUrl;

    // Update organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (admin as any)
      .from('organizations')
      .update({ logo_url: logoUrl, logo_path: logoPath })
      .eq('id', orgId);

    if (updateError) {
      console.error('[logo] DB update error:', updateError);
      return Response.json({ error: 'Error al guardar el logo' }, { status: 500 });
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
