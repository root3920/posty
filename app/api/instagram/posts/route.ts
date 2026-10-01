import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/**
 * GET /api/instagram/posts?status=scheduled,published,failed,draft&limit=50
 * Returns posts for the current organization, optionally filtered by status.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status')?.split(',').filter(Boolean);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 200);

    const adminDb: AnyDb = createAdminClient();
    let query = adminDb
      .from('instagram_posts')
      .select('*, profiles:created_by(id, first_name, last_name, avatar_url)')
      .eq('organization_id', profile.organization_id)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ posts: data ?? [] });
  } catch (error) {
    console.error('[Instagram] Posts GET error:', error);
    return Response.json({ error: 'Error al obtener posts' }, { status: 500 });
  }
}

/**
 * POST /api/instagram/posts
 * Create or update a post (draft or scheduled).
 *
 * Body: { id?, type, caption, media, aspect_ratio, status, scheduled_at? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    const body = await request.json();
    const { id, type, caption, media, aspect_ratio, status, scheduled_at } = body as {
      id?: string;
      type?: string;
      caption?: string;
      media?: Array<{ publicUrl: string; altText?: string }>;
      aspect_ratio?: string;
      status?: string;
      scheduled_at?: string;
    };

    if (!media || media.length === 0) {
      return Response.json({ error: 'Se requiere al menos una imagen' }, { status: 400 });
    }

    const targetStatus = status ?? 'draft';
    if (!['draft', 'scheduled'].includes(targetStatus)) {
      return Response.json({ error: 'Estado no válido. Usa draft o scheduled' }, { status: 400 });
    }

    if (targetStatus === 'scheduled' && !scheduled_at) {
      return Response.json({ error: 'Se requiere fecha de programación' }, { status: 400 });
    }

    // Validate scheduled_at is in the future (at least 5 minutes)
    if (scheduled_at) {
      const scheduledDate = new Date(scheduled_at);
      const minDate = new Date(Date.now() + 4 * 60 * 1000); // 4 min buffer for network delay
      if (scheduledDate < minDate) {
        return Response.json({ error: 'La fecha debe ser al menos 5 minutos en el futuro' }, { status: 400 });
      }
      const maxDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 months
      if (scheduledDate > maxDate) {
        return Response.json({ error: 'No se puede programar a más de 6 meses' }, { status: 400 });
      }
    }

    // Validate caption
    if (caption && caption.length > 2200) {
      return Response.json({ error: 'La descripción supera los 2.200 caracteres' }, { status: 400 });
    }
    if (caption) {
      const hashtagCount = (caption.match(/#\w+/g) ?? []).length;
      if (hashtagCount > 30) {
        return Response.json({ error: 'Máximo 30 hashtags' }, { status: 400 });
      }
    }

    const adminDb: AnyDb = createAdminClient();

    // Get connection
    const { data: conn } = await adminDb
      .from('instagram_connections')
      .select('id, status, token_expires_at')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (!conn && targetStatus === 'scheduled') {
      return Response.json({ error: 'Instagram no está conectado' }, { status: 400 });
    }

    // Check token validity for scheduled posts
    if (targetStatus === 'scheduled' && conn?.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at);
      if (expiresAt < new Date()) {
        return Response.json({ error: 'El token de Instagram venció. Reconecta en Configuración → Instagram' }, { status: 400 });
      }
    }

    const postType = type ?? (media.length > 1 ? 'CAROUSEL_ALBUM' : 'IMAGE');

    if (id) {
      // Update existing post
      const { data: existing } = await adminDb
        .from('instagram_posts')
        .select('id, status')
        .eq('id', id)
        .eq('organization_id', profile.organization_id)
        .single();

      if (!existing) {
        return Response.json({ error: 'Post no encontrado' }, { status: 404 });
      }

      if (!['draft', 'scheduled', 'failed'].includes(existing.status)) {
        return Response.json({ error: 'No se puede editar un post en este estado' }, { status: 400 });
      }

      const { data: updated, error: updateErr } = await adminDb
        .from('instagram_posts')
        .update({
          type: postType,
          caption: caption ?? null,
          media,
          aspect_ratio: aspect_ratio ?? '1:1',
          status: targetStatus,
          scheduled_at: scheduled_at ?? null,
          error: null,
          last_error_code: null,
          updated_by: user.id,
        })
        .eq('id', id)
        .select('id, status, scheduled_at')
        .single();

      if (updateErr) throw updateErr;
      return Response.json({ post: updated });
    }

    // Create new post
    const { data: post, error: insertErr } = await adminDb
      .from('instagram_posts')
      .insert({
        organization_id: profile.organization_id,
        connection_id: conn?.id ?? null,
        type: postType,
        caption: caption ?? null,
        media,
        aspect_ratio: aspect_ratio ?? '1:1',
        status: targetStatus,
        scheduled_at: scheduled_at ?? null,
        created_by: user.id,
      })
      .select('id, status, scheduled_at')
      .single();

    if (insertErr) throw insertErr;
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    console.error('[Instagram] Posts POST error:', error);
    return Response.json({ error: 'Error al guardar el post' }, { status: 500 });
  }
}

/**
 * PATCH /api/instagram/posts
 * Reschedule, cancel, or move to draft.
 *
 * Body: { id, action: 'reschedule'|'cancel'|'to_draft'|'retry', scheduled_at? }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    const body = await request.json();
    const { id, action, scheduled_at } = body as {
      id: string;
      action: 'reschedule' | 'cancel' | 'to_draft' | 'retry';
      scheduled_at?: string;
    };

    if (!id || !action) {
      return Response.json({ error: 'Se requiere id y action' }, { status: 400 });
    }

    const adminDb: AnyDb = createAdminClient();
    const { data: post } = await adminDb
      .from('instagram_posts')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!post) return Response.json({ error: 'Post no encontrado' }, { status: 404 });

    const updates: Record<string, unknown> = { updated_by: user.id };

    switch (action) {
      case 'reschedule': {
        if (!['draft', 'scheduled', 'failed'].includes(post.status)) {
          return Response.json({ error: 'No se puede reprogramar en este estado' }, { status: 400 });
        }
        if (!scheduled_at) {
          return Response.json({ error: 'Se requiere scheduled_at' }, { status: 400 });
        }
        const scheduledDate = new Date(scheduled_at);
        if (scheduledDate < new Date(Date.now() + 4 * 60 * 1000)) {
          return Response.json({ error: 'La fecha debe ser al menos 5 minutos en el futuro' }, { status: 400 });
        }
        updates.status = 'scheduled';
        updates.scheduled_at = scheduled_at;
        updates.error = null;
        updates.last_error_code = null;
        updates.next_attempt_at = null;
        updates.attempts = 0;
        break;
      }
      case 'cancel': {
        if (!['draft', 'scheduled', 'failed'].includes(post.status)) {
          return Response.json({ error: 'No se puede cancelar en este estado' }, { status: 400 });
        }
        updates.status = 'canceled';
        break;
      }
      case 'to_draft': {
        if (!['scheduled', 'failed'].includes(post.status)) {
          return Response.json({ error: 'No se puede pasar a borrador en este estado' }, { status: 400 });
        }
        updates.status = 'draft';
        updates.scheduled_at = null;
        updates.error = null;
        updates.last_error_code = null;
        updates.next_attempt_at = null;
        break;
      }
      case 'retry': {
        if (post.status !== 'failed') {
          return Response.json({ error: 'Solo se pueden reintentar posts fallidos' }, { status: 400 });
        }
        updates.status = 'scheduled';
        updates.error = null;
        updates.last_error_code = null;
        updates.next_attempt_at = null;
        break;
      }
      default:
        return Response.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await adminDb
      .from('instagram_posts')
      .update(updates)
      .eq('id', id)
      .select('id, status, scheduled_at')
      .single();

    if (updateErr) throw updateErr;
    return Response.json({ post: updated });
  } catch (error) {
    console.error('[Instagram] Posts PATCH error:', error);
    return Response.json({ error: 'Error al actualizar el post' }, { status: 500 });
  }
}

/**
 * DELETE /api/instagram/posts
 * Delete a post (only draft, scheduled, failed, canceled).
 *
 * Body: { id }
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    const body = await request.json();
    const { id } = body as { id: string };
    if (!id) return Response.json({ error: 'Se requiere id' }, { status: 400 });

    const adminDb: AnyDb = createAdminClient();
    const { data: post } = await adminDb
      .from('instagram_posts')
      .select('id, status, media')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!post) return Response.json({ error: 'Post no encontrado' }, { status: 404 });

    if (!['draft', 'scheduled', 'failed', 'canceled'].includes(post.status)) {
      return Response.json({ error: 'No se puede eliminar un post publicado o en proceso' }, { status: 400 });
    }

    // Delete the post record (media files stay in storage for cleanup later)
    const { error: deleteErr } = await adminDb
      .from('instagram_posts')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;
    return Response.json({ success: true });
  } catch (error) {
    console.error('[Instagram] Posts DELETE error:', error);
    return Response.json({ error: 'Error al eliminar el post' }, { status: 500 });
  }
}
