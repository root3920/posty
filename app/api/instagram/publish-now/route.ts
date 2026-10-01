import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;
import { decryptToken } from '@/lib/instagram/crypto';
import {
  createMediaContainer, createCarouselContainer,
  checkContainerStatus, publishContainer, getPublishingLimit,
} from '@/lib/instagram/client';

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * POST /api/instagram/publish-now
 * Immediately publishes a draft or scheduled post.
 *
 * Body: { id }
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
    const { id } = body as { id: string };
    if (!id) return Response.json({ error: 'Se requiere id' }, { status: 400 });

    const adminDb: AnyDb = createAdminClient();

    // Get post
    const { data: post } = await adminDb
      .from('instagram_posts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!post) return Response.json({ error: 'Post no encontrado' }, { status: 404 });

    if (!['draft', 'scheduled', 'failed'].includes(post.status)) {
      return Response.json({ error: 'No se puede publicar en este estado' }, { status: 400 });
    }

    // Get connection
    const { data: conn } = await adminDb
      .from('instagram_connections')
      .select('id, ig_user_id, access_token_encrypted, status')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (!conn) return Response.json({ error: 'Instagram no está conectado' }, { status: 400 });

    const token = decryptToken(conn.access_token_encrypted);
    const userId = conn.ig_user_id;

    // Check publishing limit
    const limit = await getPublishingLimit(token, userId);
    if (limit.used >= limit.quota) {
      return Response.json({
        error: `Límite de publicaciones alcanzado (${limit.used}/${limit.quota} en 24h)`,
      }, { status: 429 });
    }

    const media = post.media as Array<{ publicUrl: string; altText?: string }>;
    if (!media || media.length === 0) {
      return Response.json({ error: 'El post no tiene imágenes' }, { status: 400 });
    }

    // Mark as processing
    await adminDb.from('instagram_posts').update({
      status: 'processing',
      locked_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq('id', id);

    try {
      let containerId: string;

      if (media.length === 1) {
        containerId = await createMediaContainer(token, userId, {
          imageUrl: media[0].publicUrl,
          caption: post.caption ?? undefined,
          altText: media[0].altText,
        });
      } else {
        const childIds: string[] = [];
        for (const item of media) {
          const childId = await createMediaContainer(token, userId, {
            imageUrl: item.publicUrl,
            altText: item.altText,
            isCarouselItem: true,
          });
          childIds.push(childId);
        }
        containerId = await createCarouselContainer(token, userId, {
          childrenIds: childIds,
          caption: post.caption ?? undefined,
        });

        await adminDb.from('instagram_posts').update({
          children_container_ids: childIds,
        }).eq('id', id);
      }

      // Save container_id immediately
      await adminDb.from('instagram_posts').update({
        container_id: containerId,
      }).eq('id', id);

      // Poll for container to be ready (max ~60s)
      for (let i = 0; i < 30; i++) {
        await sleep(2000);
        const status = await checkContainerStatus(token, containerId);
        if (status.statusCode === 'FINISHED') break;
        if (status.statusCode === 'ERROR' || status.statusCode === 'EXPIRED') {
          throw new Error(status.errorMessage ?? 'El contenedor falló');
        }
      }

      // Publish
      const { mediaId } = await publishContainer(token, userId, containerId);

      // Update post record
      await adminDb.from('instagram_posts').update({
        ig_media_id: mediaId,
        permalink: `https://www.instagram.com/p/${mediaId}/`,
        status: 'published',
        published_at: new Date().toISOString(),
        locked_at: null,
        error: null,
        last_error_code: null,
      }).eq('id', id);

      return Response.json({
        success: true,
        postId: id,
        mediaId,
        permalink: `https://www.instagram.com/p/${mediaId}/`,
      });
    } catch (publishError) {
      const errorMsg = publishError instanceof Error ? publishError.message : 'Error desconocido';
      console.error('[Instagram] Publish-now error:', errorMsg);

      await adminDb.from('instagram_posts').update({
        status: 'failed',
        error: errorMsg,
        locked_at: null,
        attempts: (post.attempts ?? 0) + 1,
      }).eq('id', id);

      return Response.json({ error: errorMsg, postId: id }, { status: 502 });
    }
  } catch (error) {
    console.error('[Instagram] Publish-now route error:', error);
    return Response.json({ error: 'Error al publicar' }, { status: 500 });
  }
}
