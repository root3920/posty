import { createAdminClient } from '@/lib/supabase/admin';
import { decryptToken } from '@/lib/instagram/crypto';
import {
  createMediaContainer, createCarouselContainer,
  checkContainerStatus, publishContainer, getPublishingLimit,
  getMedia,
} from '@/lib/instagram/client';

// The admin client type doesn't include the new tables/columns from Phase 3
// until db:types is regenerated after applying the migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

export const maxDuration = 60;

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Error codes that should not be retried
const PERMANENT_ERRORS = [
  'token_expired',
  'OAuthException',
  'Invalid user id',
  'permission',
  'not_professional',
  'APPLICATION_LIMIT',
  'invalid_image',
];

function isPermanentError(errorMsg: string, errorCode?: string): boolean {
  if (errorCode && PERMANENT_ERRORS.includes(errorCode)) return true;
  return PERMANENT_ERRORS.some(pe => errorMsg.toLowerCase().includes(pe.toLowerCase()));
}

// Retry delays in minutes: attempt 1 → 2 min, 2 → 10 min, 3 → 30 min
const RETRY_DELAYS = [2, 10, 30];

export async function POST(request: Request) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[ig-publisher] CRON_SECRET not configured');
    return Response.json({ error: 'Not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminDb = createAdminClient() as unknown as AdminDb;
  let processedCount = 0;
  let errorCount = 0;

  try {
    // 1. Unstick posts stuck in processing for >10 min
    const { data: unstuckResult } = await adminDb.rpc('unstick_instagram_posts');
    const unstuck = typeof unstuckResult === 'number' ? unstuckResult : 0;
    if (unstuck > 0) {
      console.log(`[ig-publisher] Unstuck ${unstuck} posts`);
    }

    // 2. Claim due posts (max 5)
    const { data: posts, error: claimError } = await adminDb.rpc('claim_due_instagram_posts', {
      p_limit: 5,
    });

    if (claimError) {
      console.error('[ig-publisher] Claim error:', claimError);
      throw claimError;
    }

    if (!posts || posts.length === 0) {
      // Nothing to do — still write heartbeat
      await writeHeartbeat(adminDb, 0, 0);
      return Response.json({ processed: 0, errors: 0 });
    }

    console.log(`[ig-publisher] Claimed ${posts.length} posts`);

    // 3. Process each post
    for (const post of posts) {
      try {
        await processPost(adminDb, post);
        processedCount++;
      } catch (err) {
        errorCount++;
        console.error(`[ig-publisher] Post ${post.id} error:`, err);
      }
    }
  } catch (error) {
    console.error('[ig-publisher] Fatal error:', error);
    errorCount++;
  } finally {
    await writeHeartbeat(adminDb, processedCount, errorCount);
  }

  return Response.json({ processed: processedCount, errors: errorCount });
}

async function processPost(adminDb: AdminDb, post: Record<string, unknown>) {
  const postId = post.id as string;
  const connectionId = post.connection_id as string;
  const attempts = (post.attempts as number) ?? 0;

  // Idempotency: if already published, skip
  if (post.ig_media_id) {
    console.log(`[ig-publisher] Post ${postId} already has ig_media_id, marking published`);
    await adminDb.from('instagram_posts').update({
      status: 'published',
      published_at: post.published_at ?? new Date().toISOString(),
      locked_at: null,
    }).eq('id', postId);
    return;
  }

  // Get connection + token
  const { data: conn } = await adminDb
    .from('instagram_connections')
    .select('id, ig_user_id, access_token_encrypted, status, token_expires_at')
    .eq('id', connectionId)
    .single();

  if (!conn || conn.status !== 'connected') {
    await failPost(adminDb, postId, 'token_expired',
      'La conexión con Instagram venció. Reconecta en Configuración → Instagram.', attempts);
    return;
  }

  // Check token expiry
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    await failPost(adminDb, postId, 'token_expired',
      'La conexión con Instagram venció. Reconecta en Configuración → Instagram.', attempts);
    return;
  }

  let token: string;
  try {
    token = decryptToken(conn.access_token_encrypted);
  } catch {
    await failPost(adminDb, postId, 'token_expired',
      'No se pudo descifrar el token. Reconecta en Configuración → Instagram.', attempts);
    return;
  }

  const userId = conn.ig_user_id;

  // Check publishing limit
  try {
    const limit = await getPublishingLimit(token, userId);
    if (limit.used >= limit.quota) {
      // Not a permanent failure — reschedule in 1 hour
      await adminDb.from('instagram_posts').update({
        status: 'scheduled',
        locked_at: null,
        next_attempt_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        error: `Cupo agotado (${limit.used}/${limit.quota}). Se reintentará en 1 hora.`,
      }).eq('id', postId);
      return;
    }
  } catch (err) {
    console.warn(`[ig-publisher] Could not check limit for ${postId}:`, err);
    // Continue — don't block on limit check failure
  }

  const media = post.media as Array<{ publicUrl: string; altText?: string }>;
  if (!media || media.length === 0) {
    await failPost(adminDb, postId, 'invalid_media', 'El post no tiene imágenes.', attempts);
    return;
  }

  try {
    // Create container (only if we don't have one already)
    let containerId = post.container_id as string | null;

    if (!containerId) {
      if (media.length === 1) {
        containerId = await createMediaContainer(token, userId, {
          imageUrl: media[0].publicUrl,
          caption: (post.caption as string) ?? undefined,
          altText: media[0].altText,
        });
      } else {
        // Carousel
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
          caption: (post.caption as string) ?? undefined,
        });

        // Save children IDs immediately
        await adminDb.from('instagram_posts').update({
          children_container_ids: childIds,
        }).eq('id', postId);
      }

      // Save container_id immediately
      await adminDb.from('instagram_posts').update({
        container_id: containerId,
      }).eq('id', postId);
    }

    // Wait for container to be ready (~30s max)
    let containerReady = false;
    for (let i = 0; i < 15; i++) {
      await sleep(2000);
      const status = await checkContainerStatus(token, containerId);
      if (status.statusCode === 'FINISHED') {
        containerReady = true;
        break;
      }
      if (status.statusCode === 'ERROR') {
        throw new Error(status.errorMessage ?? 'El contenedor falló con error');
      }
      if (status.statusCode === 'EXPIRED') {
        // Container expired — clear it and retry next run
        await adminDb.from('instagram_posts').update({
          container_id: null,
          children_container_ids: null,
        }).eq('id', postId);
        throw new Error('El contenedor expiró');
      }
    }

    if (!containerReady) {
      // Not ready yet — leave in processing, next run will check
      console.log(`[ig-publisher] Container not ready for ${postId}, will retry`);
      return;
    }

    // Publish
    const { mediaId } = await publishContainer(token, userId, containerId);

    // Save ig_media_id IMMEDIATELY (idempotency key)
    await adminDb.from('instagram_posts').update({
      ig_media_id: mediaId,
    }).eq('id', postId);

    // Get permalink
    let permalink = `https://www.instagram.com/p/${mediaId}/`;
    try {
      // Try to get the actual permalink from recent media
      const recentMedia = await getMedia(token, userId, undefined, 5);
      const found = recentMedia.media.find(m => m.id === mediaId);
      if (found?.permalink) permalink = found.permalink;
    } catch {
      // Use constructed permalink
    }

    // Mark published
    await adminDb.from('instagram_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      permalink,
      locked_at: null,
      error: null,
      last_error_code: null,
    }).eq('id', postId);

    // Send notification to author
    const authorId = post.created_by as string;
    const orgId = post.organization_id as string;
    if (authorId) {
      await adminDb.from('notifications').insert({
        profile_id: authorId,
        organization_id: orgId,
        type: 'instagram_published',
        title: '✅ Post publicado en Instagram',
        body: 'Tu post se publicó exitosamente.',
        link: permalink,
      }).single();
    }

    console.log(`[ig-publisher] Published post ${postId} → ${mediaId}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
    console.error(`[ig-publisher] Publish error for ${postId}:`, errorMsg);

    if (isPermanentError(errorMsg)) {
      await failPost(adminDb, postId, 'publish_error', errorMsg, attempts);
    } else if (attempts >= 2) {
      // Max 3 attempts (0, 1, 2)
      await failPost(adminDb, postId, 'max_retries', errorMsg, attempts);
    } else {
      // Schedule retry
      const delayMinutes = RETRY_DELAYS[attempts] ?? 30;
      await adminDb.from('instagram_posts').update({
        status: 'scheduled',
        locked_at: null,
        attempts: attempts + 1,
        next_attempt_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
        error: `Reintento ${attempts + 1}/3 en ${delayMinutes} min: ${errorMsg}`,
      }).eq('id', postId);
    }
  }
}

async function failPost(
  adminDb: AdminDb,
  postId: string,
  errorCode: string,
  errorMsg: string,
  attempts: number,
) {
  await adminDb.from('instagram_posts').update({
    status: 'failed',
    locked_at: null,
    error: errorMsg,
    last_error_code: errorCode,
    attempts: attempts + 1,
  }).eq('id', postId);

  // Get post for notification
  const { data: post } = await adminDb
    .from('instagram_posts')
    .select('created_by, organization_id')
    .eq('id', postId)
    .single();

  if (post?.created_by) {
    await adminDb.from('notifications').insert({
      profile_id: post.created_by,
      organization_id: post.organization_id,
      type: 'instagram_failed',
      title: '❌ No se pudo publicar tu post',
      body: errorMsg,
      link: '/instagram?tab=programados',
    });
  }
}

async function writeHeartbeat(
  adminDb: AdminDb,
  processed: number,
  errors: number,
) {
  try {
    await adminDb.from('instagram_publisher_heartbeat').upsert({
      id: 1,
      last_run_at: new Date().toISOString(),
      processed,
      errors,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ig-publisher] Heartbeat write error:', err);
  }
}
