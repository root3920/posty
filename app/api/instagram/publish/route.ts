import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInstagramEnv } from '@/lib/instagram/env';
import { decryptToken } from '@/lib/instagram/crypto';
import {
  createMediaContainer, createCarouselContainer,
  checkContainerStatus, publishContainer, getPublishingLimit,
} from '@/lib/instagram/client';

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    const orgId = profile.organization_id;
    const body = await request.json();
    const { type, caption, media, postId } = body as {
      type?: string; caption?: string;
      media?: Array<{ publicUrl: string; altText?: string }>;
      postId?: string;
    };

    // Get connection
    const adminDb = createAdminClient() as any;
    const { data: conn } = await adminDb
      .from('instagram_connections')
      .select('id, ig_user_id, access_token_encrypted, status')
      .eq('organization_id', orgId)
      .eq('status', 'connected')
      .maybeSingle();

    if (!conn) return Response.json({ error: 'Instagram no está conectado' }, { status: 400 });

    const token = decryptToken(conn.access_token_encrypted);
    const userId = conn.ig_user_id;

    // Check publishing limit
    const limit = await getPublishingLimit(token, userId);
    if (limit.used >= limit.quota) {
      return Response.json({ error: `Límite de publicaciones alcanzado (${limit.used}/${limit.quota} en 24h)` }, { status: 429 });
    }

    if (!media || media.length === 0) {
      return Response.json({ error: 'Se requiere al menos una imagen' }, { status: 400 });
    }

    // Save post record
    const { data: post, error: postErr } = await adminDb
      .from('instagram_posts')
      .insert({
        organization_id: orgId,
        connection_id: conn.id,
        type: media.length > 1 ? 'CAROUSEL_ALBUM' : 'IMAGE',
        caption,
        media,
        status: 'publishing',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (postErr) return Response.json({ error: 'Error al guardar el post' }, { status: 500 });

    let containerId: string;

    try {
      if (media.length === 1) {
        // Single image
        containerId = await createMediaContainer(token, userId, {
          imageUrl: media[0].publicUrl,
          caption: caption ?? undefined,
          altText: media[0].altText,
        });
      } else {
        // Carousel: create items first, then container
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
          caption: caption ?? undefined,
        });
      }

      // Wait for container to be ready (poll every 2s, max 2 min)
      for (let i = 0; i < 60; i++) {
        await sleep(2000);
        const status = await checkContainerStatus(token, containerId);
        if (status.statusCode === 'FINISHED') break;
        if (status.statusCode === 'ERROR' || status.statusCode === 'EXPIRED') {
          throw new Error(status.errorMessage ?? 'El contenedor falló');
        }
      }

      // Publish
      const { mediaId } = await publishContainer(token, userId, containerId);

      // Update post
      await adminDb.from('instagram_posts').update({
        container_id: containerId,
        ig_media_id: mediaId,
        permalink: `https://www.instagram.com/p/${mediaId}/`,
        status: 'published',
        published_at: new Date().toISOString(),
      }).eq('id', post.id);

      // Refresh media cache
      // (The grilla will refetch on next load)

      return Response.json({
        success: true,
        postId: post.id,
        mediaId,
        permalink: `https://www.instagram.com/p/${mediaId}/`,
      });
    } catch (publishError) {
      const errorMsg = publishError instanceof Error ? publishError.message : 'Error desconocido';
      console.error('[Instagram] Publish error:', errorMsg);

      await adminDb.from('instagram_posts').update({
        status: 'failed',
        error: errorMsg,
        attempts: 1,
      }).eq('id', post.id);

      return Response.json({ error: errorMsg, postId: post.id }, { status: 502 });
    }
  } catch (error) {
    console.error('[Instagram] Publish route error:', error);
    return Response.json({ error: 'Error al publicar' }, { status: 500 });
  }
}
