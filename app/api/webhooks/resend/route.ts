import { createAdminClient } from '@/lib/supabase/admin';
import { getEmailEnv } from '@/lib/email/env';
import crypto from 'crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Resend webhook event types
// https://resend.com/docs/dashboard/webhooks/event-types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.opened'
  | 'email.clicked';

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    bounce?: { message: string; type: string };
    complaint?: { type: string };
    [key: string]: unknown;
  };
}

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  // Resend signs webhooks with HMAC-SHA256
  // Format: "v1,<timestamp>.<signature>"
  const parts = signature.split(',');
  if (parts.length < 2) return false;

  const timestampAndSig = parts[1];
  if (!timestampAndSig) return false;

  const [timestamp, sig] = timestampAndSig.split('.');
  if (!timestamp || !sig) return false;

  const signedPayload = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

const STATUS_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.opened': 'opened',
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature
    const { env } = getEmailEnv();
    const secret = env?.RESEND_WEBHOOK_SECRET;

    if (secret) {
      const signature = request.headers.get('svix-signature');
      if (!verifySignature(rawBody, signature, secret)) {
        console.error('[Email Webhook] Invalid signature');
        return Response.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody) as ResendWebhookPayload;
    const { type, data } = payload;
    const providerId = data.email_id;

    if (!providerId) {
      return Response.json({ ok: true, note: 'no_email_id' });
    }

    const db = createAdminClient() as any;
    const mappedStatus = STATUS_MAP[type];

    if (!mappedStatus) {
      // Unhandled event type (clicked, delivery_delayed, etc.)
      return Response.json({ ok: true });
    }

    // Update email_messages status
    const { data: emailRow, error: updateErr } = await db
      .from('email_messages')
      .update({
        status: mappedStatus,
        error: type === 'email.bounced'
          ? data.bounce?.message ?? 'Rebote'
          : type === 'email.complained'
            ? 'Marcado como spam'
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_id', providerId)
      .select('id, organization_id, to')
      .maybeSingle();

    if (updateErr) {
      console.error('[Email Webhook] Update error:', updateErr.message);
    }

    // Add to suppression list on bounce or complaint
    if (emailRow && (type === 'email.bounced' || type === 'email.complained')) {
      const reason = type === 'email.bounced' ? 'bounce' : 'complaint';
      await db
        .from('email_suppressions')
        .upsert({
          organization_id: emailRow.organization_id,
          email: emailRow.to.toLowerCase(),
          reason,
          source_message_id: emailRow.id,
        }, {
          onConflict: 'organization_id,email',
        });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[Email Webhook] Error:', error);
    return Response.json({ ok: true });
  }
}
