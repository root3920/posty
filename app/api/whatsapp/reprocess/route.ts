import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Reprocess pending/error webhook logs.
 * This replays the MESSAGES_UPSERT events through the webhook handler logic.
 */
export async function POST() {
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

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;

    // Get pending/error webhook logs for message events
    const { data: logs } = await db
      .from('whatsapp_webhook_logs')
      .select('id, payload, event_type, connection_id, organization_id')
      .eq('organization_id', profile.organization_id)
      .in('event_type', ['messages.upsert', 'MESSAGES_UPSERT'])
      .in('status', ['pending', 'error'])
      .order('created_at', { ascending: true })
      .limit(200);

    if (!logs || logs.length === 0) {
      return Response.json({ reprocessed: 0, message: 'No hay eventos pendientes' });
    }

    let processed = 0;
    let errors = 0;

    for (const log of logs) {
      try {
        // Re-send the payload to our own webhook
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.postyassistant.com';
        await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': process.env.WHATSAPP_WEBHOOK_SECRET ?? '',
          },
          body: JSON.stringify(log.payload),
        });

        await db
          .from('whatsapp_webhook_logs')
          .update({ status: 'processed' })
          .eq('id', log.id);

        processed++;
      } catch {
        errors++;
        await db
          .from('whatsapp_webhook_logs')
          .update({ status: 'error', error_message: 'Reprocess failed' })
          .eq('id', log.id);
      }
    }

    return Response.json({ reprocessed: processed, errors, total: logs.length });
  } catch (error) {
    console.error('[Reprocess]', error);
    return Response.json({ error: 'Error' }, { status: 500 });
  }
}
