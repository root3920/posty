import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider, isWhatsAppConfigured } from '@/lib/whatsapp/provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const AVATAR_SIZE = 96;
const AVATAR_QUALITY = 80;
const MIN_REFETCH_DAYS = 7;
const RATE_LIMIT_MS = 4000; // 4 seconds between requests (3-5s range)
const RATE_JITTER_MS = 2000; // random 0-2s added

// Per-connection rate limiter (in-memory, per serverless instance)
const lastFetchTime = new Map<string, number>();

function canFetch(connectionId: string): boolean {
  const last = lastFetchTime.get(connectionId) ?? 0;
  const jitter = Math.random() * RATE_JITTER_MS;
  return Date.now() - last >= RATE_LIMIT_MS + jitter;
}

function markFetched(connectionId: string) {
  lastFetchTime.set(connectionId, Date.now());
}

/**
 * POST /api/whatsapp/avatar
 *
 * Fetches a contact's profile picture from Evolution API, processes it
 * to 96x96 WebP, and uploads to the private whatsapp-avatars bucket.
 *
 * Body: { contactId: string } or { contactIds: string[] }
 * - Single contact: fetches immediately (for open conversation)
 * - Multiple contacts: queues with rate limiting (for visible list)
 *
 * Rate limiting: max 1 request per 3-5 seconds per WhatsApp connection.
 * Respects MIN_REFETCH_DAYS for contacts already fetched.
 */
export async function POST(request: Request) {
  try {
    if (!isWhatsAppConfigured()) {
      return Response.json({ error: 'WhatsApp no configurado' }, { status: 503 });
    }

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
    const body = await request.json() as { contactId?: string; contactIds?: string[] };

    const contactIds = body.contactIds ?? (body.contactId ? [body.contactId] : []);
    if (contactIds.length === 0) {
      return Response.json({ error: 'contactId o contactIds requerido' }, { status: 400 });
    }

    // Limit batch size
    const batch = contactIds.slice(0, 20);

    const adminDb: Db = createAdminClient();

    // Get the WhatsApp connection for this org
    const { data: conn } = await adminDb
      .from('whatsapp_connections')
      .select('id,instance_name,status')
      .eq('organization_id', orgId)
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conn) {
      return Response.json({ error: 'No hay conexión de WhatsApp activa' }, { status: 404 });
    }

    // Get contacts that need avatar fetch
    const { data: contacts } = await adminDb
      .from('chat_contacts')
      .select('id,remote_jid,phone_e164,lid,avatar_status,avatar_fetched_at')
      .eq('organization_id', orgId)
      .in('id', batch);

    if (!contacts || contacts.length === 0) {
      return Response.json({ fetched: 0, skipped: 0 });
    }

    const provider = getWhatsAppProvider();
    const now = new Date();
    let fetched = 0;
    let skipped = 0;
    const results: Array<{ contactId: string; status: string }> = [];

    for (const contact of contacts) {
      // Skip if recently fetched (unless forced)
      if (contact.avatar_fetched_at) {
        const fetchedAt = new Date(contact.avatar_fetched_at);
        const daysSince = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < MIN_REFETCH_DAYS && contact.avatar_status !== 'pending') {
          skipped++;
          results.push({ contactId: contact.id, status: 'skip_recent' });
          continue;
        }
      }

      // Skip contacts with no phone/JID (can't fetch)
      const jid = contact.remote_jid ?? (contact.phone_e164 ? contact.phone_e164.replace('+', '') + '@s.whatsapp.net' : null);
      if (!jid) {
        // LID contacts without remote_jid — mark as 'none'
        await adminDb
          .from('chat_contacts')
          .update({ avatar_status: 'none', avatar_fetched_at: now.toISOString() })
          .eq('id', contact.id);
        skipped++;
        results.push({ contactId: contact.id, status: 'no_jid' });
        continue;
      }

      // Rate limit check
      if (!canFetch(conn.id)) {
        skipped++;
        results.push({ contactId: contact.id, status: 'rate_limited' });
        continue;
      }

      try {
        markFetched(conn.id);

        // Fetch profile picture URL from Evolution API
        const { profilePictureUrl } = await provider.getProfilePicture(conn.instance_name, jid);

        if (!profilePictureUrl) {
          // Contact has no picture or it's hidden
          await adminDb
            .from('chat_contacts')
            .update({ avatar_status: 'none', avatar_fetched_at: now.toISOString(), avatar_path: null })
            .eq('id', contact.id);
          fetched++;
          results.push({ contactId: contact.id, status: 'none' });
          continue;
        }

        // Download the image (WhatsApp URLs expire quickly)
        const imgRes = await fetch(profilePictureUrl);
        if (!imgRes.ok) {
          await adminDb
            .from('chat_contacts')
            .update({ avatar_status: 'error', avatar_fetched_at: now.toISOString() })
            .eq('id', contact.id);
          results.push({ contactId: contact.id, status: 'download_error' });
          continue;
        }

        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

        // Process with sharp: 96x96 WebP
        const processed = await sharp(imgBuffer)
          .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
          .webp({ quality: AVATAR_QUALITY })
          .toBuffer();

        // Upload to private bucket
        const avatarPath = `${orgId}/${conn.id}/${contact.id}.webp`;
        const { error: uploadError } = await adminDb.storage
          .from('whatsapp-avatars')
          .upload(avatarPath, processed, {
            contentType: 'image/webp',
            upsert: true,
          });

        if (uploadError) {
          console.error('[avatar] Upload error:', uploadError.message);
          await adminDb
            .from('chat_contacts')
            .update({ avatar_status: 'error', avatar_fetched_at: now.toISOString() })
            .eq('id', contact.id);
          results.push({ contactId: contact.id, status: 'upload_error' });
          continue;
        }

        // Update contact
        await adminDb
          .from('chat_contacts')
          .update({
            avatar_path: avatarPath,
            avatar_status: 'ok',
            avatar_fetched_at: now.toISOString(),
          })
          .eq('id', contact.id);

        fetched++;
        results.push({ contactId: contact.id, status: 'ok' });
      } catch (err) {
        console.error(`[avatar] Fetch error for contact ${contact.id}:`, err);
        await adminDb
          .from('chat_contacts')
          .update({ avatar_status: 'error', avatar_fetched_at: now.toISOString() })
          .eq('id', contact.id);
        results.push({ contactId: contact.id, status: 'error' });
      }

      // Wait between requests (rate limiting within the batch)
      if (contacts.indexOf(contact) < contacts.length - 1) {
        const delay = RATE_LIMIT_MS + Math.random() * RATE_JITTER_MS;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return Response.json({ fetched, skipped, results });
  } catch (error) {
    console.error('[avatar] Route error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    );
  }
}
