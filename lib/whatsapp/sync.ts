import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider, isWhatsAppConfigured } from './provider';
import { getWhatsAppEnv } from './env';

const WEBHOOK_URL = 'https://app.postyassistant.com/api/webhooks/whatsapp';
const REQUIRED_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

/**
 * Sync the state of all WhatsApp connections for an organization.
 * - Queries Evolution for live state
 * - Updates DB with current status, phone, name, profile pic
 * - Ensures webhook is configured correctly
 *
 * Safe to call frequently (polling, page load, etc.)
 */
export async function syncWhatsAppConnection(orgId: string): Promise<{
  status: string;
  phone?: string | null;
  displayName?: string | null;
  profilePic?: string | null;
} | null> {
  if (!isWhatsAppConfigured()) return null;

  const supabase = createAdminClient();
  const provider = getWhatsAppProvider();
  const { env } = getWhatsAppEnv();

  // Find the org's connection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (supabase as any)
    .from('whatsapp_connections')
    .select('id, instance_name, status, instance_token')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) return null;

  try {
    // 1. Fetch live instance info
    const info = await provider.fetchInstanceInfo(conn.instance_name);
    if (!info) {
      console.log('[Sync] Instance not found in Evolution:', conn.instance_name);
      return { status: conn.status };
    }

    // 2. Map state to our status enum
    let newStatus = conn.status;
    if (info.state === 'open') newStatus = 'connected';
    else if (info.state === 'close') newStatus = 'disconnected';
    else if (info.state === 'connecting') newStatus = 'connecting';

    // 3. Extract phone from ownerJid (format: "573001234567@s.whatsapp.net")
    let phone: string | null = null;
    if (info.ownerJid) {
      const match = info.ownerJid.match(/^(\d+)@/);
      if (match) phone = `+${match[1]}`;
    }

    // 4. Update DB
    const updates: Record<string, unknown> = {
      status: newStatus,
      last_seen_at: new Date().toISOString(),
    };
    if (phone) updates.phone_e164 = phone;
    if (info.profileName) updates.display_name = info.profileName;
    if (info.profilePicUrl) updates.profile_pic_url = info.profilePicUrl;
    if (info.token && info.token !== conn.instance_token) updates.instance_token = info.token;
    if (newStatus === 'connected' && conn.status !== 'connected') {
      updates.connected_at = new Date().toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('whatsapp_connections')
      .update(updates)
      .eq('id', conn.id);

    // 5. Ensure webhook is configured
    if (env) {
      try {
        const existingWebhook = await provider.getWebhook(conn.instance_name);
        const needsUpdate =
          !existingWebhook ||
          !existingWebhook.enabled ||
          existingWebhook.url !== WEBHOOK_URL ||
          !REQUIRED_EVENTS.every((e) => existingWebhook.events.includes(e)) ||
          existingWebhook.headers['x-webhook-secret'] !== env.WHATSAPP_WEBHOOK_SECRET;

        if (needsUpdate) {
          console.log('[Sync] Re-configuring webhook for', conn.instance_name);
          await provider.setWebhook(conn.instance_name, {
            enabled: true,
            url: WEBHOOK_URL,
            events: REQUIRED_EVENTS,
            headers: { 'x-webhook-secret': env.WHATSAPP_WEBHOOK_SECRET },
          });
        }
      } catch (err) {
        console.error('[Sync] Failed to verify/set webhook:', err);
      }
    }

    return {
      status: newStatus,
      phone,
      displayName: info.profileName,
      profilePic: info.profilePicUrl,
    };
  } catch (err) {
    console.error('[Sync] Error syncing connection:', err);
    return { status: conn.status };
  }
}
