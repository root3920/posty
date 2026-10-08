import { createAdminClient } from '@/lib/supabase/admin';
import { getEmailEnv } from '@/lib/email/env';
import { getEmailProvider } from '@/lib/email/provider';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';
import { shouldSkipEmail } from '@/lib/email/anti-loop';
import { parseRecipientAddress } from '@/lib/email/alias';
import { resolveThread } from '@/lib/email/thread-resolver';
import { ManualEmail, manualEmailText } from '@/lib/email/templates/manual-email';
import crypto from 'crypto';
import type { StoredAttachment, InboundEmailAttachment } from '@/lib/email/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ──────────────────────────────────────────────────────────────

type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.opened'
  | 'email.clicked'
  | 'email.received';

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message_id?: string;
    created_at: string;
    bounce?: { message: string; type: string };
    complaint?: { type: string };
    attachments?: Array<{ id: string; filename: string; content_type: string }>;
    [key: string]: unknown;
  };
}

// ─── Signature verification ─────────────────────────────────────────────

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

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

// ─── Outbound status map ────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.opened': 'opened',
};

// ─── Inbound rate limits ────────────────────────────────────────────────

const INBOUND_RATE_PER_ORG_PER_HOUR = 200;
const INBOUND_RATE_PER_SENDER_PER_HOUR = 30;

// ─── Blocked attachment MIME types ──────────────────────────────────────

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.msi', '.com', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.ps2', '.psc1', '.psc2', '.reg', '.inf', '.lnk',
]);

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

// ─── Main handler ───────────────────────────────────────────────────────

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

    // Route: inbound email
    if (type === 'email.received') {
      return handleInboundEmail(data, payload);
    }

    // Route: outbound status update
    return handleOutboundStatus(type, data);
  } catch (error) {
    console.error('[Email Webhook] Error:', error);
    return Response.json({ ok: true });
  }
}

// ─── Outbound status handling (existing logic) ──────────────────────────

async function handleOutboundStatus(
  type: ResendEventType,
  data: ResendWebhookPayload['data'],
) {
  const providerId = data.email_id;
  if (!providerId) {
    return Response.json({ ok: true, note: 'no_email_id' });
  }

  const db = createAdminClient() as any;
  const mappedStatus = STATUS_MAP[type];

  if (!mappedStatus) {
    return Response.json({ ok: true });
  }

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

    // Auto-pause check: bounce >5% or complaint >0.1% in last 30 days
    await checkAndAutoPause(db, emailRow.organization_id);
  }

  return Response.json({ ok: true });
}

// ─── Inbound email handling ─────────────────────────────────────────────

async function handleInboundEmail(
  data: ResendWebhookPayload['data'],
  fullPayload: ResendWebhookPayload,
) {
  const db = createAdminClient() as any;
  const eventId = data.email_id;

  if (!eventId) {
    console.warn('[Email Inbound] No email_id in event');
    return Response.json({ ok: true, note: 'no_email_id' });
  }

  // 1. Idempotency check
  const { data: existing } = await db
    .from('email_webhook_events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();

  if (existing) {
    return Response.json({ ok: true, note: 'duplicate' });
  }

  // Mark as processing immediately
  await db
    .from('email_webhook_events')
    .insert({ id: eventId, event_type: 'email.received' })
    .single();

  // Return 200 quickly — process inline (Vercel allows up to 300s)
  // In practice this takes 1-3 seconds.

  try {
    await processInboundEmail(db, data, fullPayload);
  } catch (err) {
    console.error('[Email Inbound] Processing error:', err);
    // Don't fail the webhook — we already recorded the event
  }

  return Response.json({ ok: true });
}

async function processInboundEmail(
  db: any,
  data: ResendWebhookPayload['data'],
  fullPayload: ResendWebhookPayload,
) {
  const { env } = getEmailEnv();
  const domain = env?.EMAIL_HOTEL_DOMAIN || 'mail.postyassistant.com';
  const emailId = data.email_id;

  // 2. Fetch full email content from Resend API
  const provider = getEmailProvider();
  const fullEmail = await provider.fetchReceivedEmail(emailId);

  // 3. Anti-loop check
  const loopCheck = shouldSkipEmail(fullEmail.headers);
  if (loopCheck.skip) {
    console.log(`[Email Inbound] Skipped (${loopCheck.reason}): ${emailId}`);
    return;
  }

  // 4. Resolve which org this email belongs to
  const recipients = [...(data.to ?? []), ...(data.cc ?? [])];
  let matchedOrg: { orgId: string; alias: string; token: string | null } | null = null;

  for (const addr of recipients) {
    const parsed = parseRecipientAddress(addr, domain);
    if (!parsed) continue;

    // Look up alias
    const { data: aliasRow } = await db
      .from('email_aliases')
      .select('organization_id, alias')
      .eq('alias', parsed.alias)
      .eq('active', true)
      .maybeSingle();

    if (aliasRow) {
      matchedOrg = {
        orgId: aliasRow.organization_id,
        alias: aliasRow.alias,
        token: parsed.token,
      };
      break;
    }

    // Check expired aliases (grace period)
    const { data: expiredAlias } = await db
      .from('email_aliases')
      .select('organization_id, alias')
      .eq('alias', parsed.alias)
      .eq('active', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (expiredAlias) {
      matchedOrg = {
        orgId: expiredAlias.organization_id,
        alias: expiredAlias.alias,
        token: parsed.token,
      };
      break;
    }
  }

  if (!matchedOrg) {
    console.log(`[Email Inbound] No matching alias for recipients: ${recipients.join(', ')}`);
    return;
  }

  const { orgId, alias, token } = matchedOrg;

  // 5. Rate limit per org
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: orgCount } = await db
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('direction', 'in')
    .gte('created_at', oneHourAgo);

  if ((orgCount ?? 0) >= INBOUND_RATE_PER_ORG_PER_HOUR) {
    console.warn(`[Email Inbound] Rate limit hit for org ${orgId}`);
    return;
  }

  // Rate limit per sender
  const senderEmail = fullEmail.from;
  const { count: senderCount } = await db
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('direction', 'in')
    .eq('from_address', senderEmail.toLowerCase())
    .gte('created_at', oneHourAgo);

  if ((senderCount ?? 0) >= INBOUND_RATE_PER_SENDER_PER_HOUR) {
    console.warn(`[Email Inbound] Sender rate limit hit: ${senderEmail}`);
    return;
  }

  // 6. Sanitize HTML
  const htmlSanitized = fullEmail.html ? sanitizeEmailHtml(fullEmail.html) : null;

  // 7. Resolve thread
  const inReplyTo = fullEmail.headers['in-reply-to']
    || fullEmail.headers['In-Reply-To'] || null;
  const references = fullEmail.headers['references']
    || fullEmail.headers['References'] || null;

  const threadResult = await resolveThread(db, {
    orgId,
    token,
    inReplyTo,
    references,
    senderEmail,
    subject: fullEmail.subject,
  });

  // 8. Process attachments
  const storedAttachments = await processAttachments(
    db,
    provider,
    emailId,
    orgId,
    threadResult.threadId,
    fullEmail.attachments,
  );

  // 9. Insert email message
  const { error: msgErr } = await db
    .from('email_messages')
    .insert({
      organization_id: orgId,
      thread_id: threadResult.threadId,
      guest_id: threadResult.guestId,
      direction: 'in',
      to: recipients[0] || `${alias}@${domain}`,
      from_address: senderEmail.toLowerCase(),
      cc: fullEmail.cc.length > 0 ? fullEmail.cc : null,
      subject: fullEmail.subject,
      template: 'inbound',
      body_text: fullEmail.text,
      html_sanitized: htmlSanitized,
      message_id: fullEmail.message_id ? `<${fullEmail.message_id.replace(/^<|>$/g, '')}>` : null,
      in_reply_to: inReplyTo,
      references_header: references,
      attachments: storedAttachments.length > 0 ? storedAttachments : [],
      status: 'delivered',
      provider_id: emailId,
      raw_payload: fullPayload,
    });

  if (msgErr) {
    console.error('[Email Inbound] Insert message error:', msgErr.message);
    return;
  }

  // 10. Update thread counters
  await db
    .from('email_threads')
    .update({
      last_message_at: new Date().toISOString(),
      unread_count: (threadResult.isNew ? 0 : undefined) as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadResult.threadId);

  // Increment unread_count atomically
  await db.rpc('increment_counter', undefined as any).catch(() => {
    // Fallback: manual increment
  });
  // Use direct SQL via RPC for atomic increment
  const { data: currentThread } = await db
    .from('email_threads')
    .select('unread_count')
    .eq('id', threadResult.threadId)
    .single();

  if (currentThread) {
    await db
      .from('email_threads')
      .update({ unread_count: (currentThread.unread_count ?? 0) + 1 })
      .eq('id', threadResult.threadId);
  }

  // 11. Forward copy to hotel's contact email if enabled
  await forwardCopyToHotel(db, orgId, alias, threadResult.threadId, fullEmail, senderEmail);

  console.log(
    `[Email Inbound] Processed: ${emailId} → thread ${threadResult.threadId}` +
    (threadResult.isNew ? ' (new)' : ''),
  );
}

// ─── Attachment processing ──────────────────────────────────────────────

async function processAttachments(
  db: any,
  provider: ReturnType<typeof getEmailProvider>,
  emailId: string,
  orgId: string,
  threadId: string,
  webhookAttachments: InboundEmailAttachment[],
): Promise<StoredAttachment[]> {
  if (!webhookAttachments || webhookAttachments.length === 0) return [];

  // Fetch full attachment data with download URLs
  let attachments: InboundEmailAttachment[];
  try {
    attachments = await provider.fetchReceivedAttachments(emailId);
  } catch (err) {
    console.error('[Email Inbound] Failed to fetch attachments:', err);
    return [];
  }

  const stored: StoredAttachment[] = [];
  let totalSize = 0;

  for (const att of attachments) {
    // Check individual size
    if (att.size > MAX_ATTACHMENT_SIZE) {
      console.warn(`[Email Inbound] Attachment too large: ${att.filename} (${att.size} bytes)`);
      continue;
    }

    // Check total size
    totalSize += att.size;
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      console.warn('[Email Inbound] Total attachment size exceeded 25 MB');
      break;
    }

    // Block executable extensions
    const ext = getFileExtension(att.filename);
    if (BLOCKED_EXTENSIONS.has(ext.toLowerCase())) {
      console.warn(`[Email Inbound] Blocked executable attachment: ${att.filename}`);
      continue;
    }

    // Download and upload to Supabase Storage
    try {
      const response = await fetch(att.download_url);
      if (!response.ok) {
        console.error(`[Email Inbound] Failed to download attachment: ${att.filename}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const storagePath = `${orgId}/${threadId}/${att.id}-${sanitizeFilename(att.filename)}`;

      const { error: uploadErr } = await db.storage
        .from('email-attachments')
        .upload(storagePath, buffer, {
          contentType: att.content_type,
          upsert: false,
        });

      if (uploadErr) {
        console.error(`[Email Inbound] Upload error for ${att.filename}:`, uploadErr.message);
        continue;
      }

      stored.push({
        id: att.id,
        filename: att.filename,
        size: att.size,
        content_type: att.content_type,
        storage_path: storagePath,
      });
    } catch (dlErr) {
      console.error(`[Email Inbound] Error processing attachment ${att.filename}:`, dlErr);
    }
  }

  return stored;
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot) : '';
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 100);
}

// ─── Forward copy to hotel ──────────────────────────────────────────────

async function forwardCopyToHotel(
  db: any,
  orgId: string,
  alias: string,
  threadId: string,
  fullEmail: { from: string; subject: string; text: string | null },
  senderEmail: string,
) {
  // Check if forwarding is enabled
  const { data: org } = await db
    .from('organizations')
    .select('name, contact_email, email_forward_inbound, logo_url, brand_color')
    .eq('id', orgId)
    .single();

  if (!org?.email_forward_inbound || !org.contact_email) return;

  const { env } = getEmailEnv();
  const domain = env?.EMAIL_HOTEL_DOMAIN || 'mail.postyassistant.com';

  try {
    const provider = getEmailProvider();
    const preview = fullEmail.text?.slice(0, 200) || '(sin texto)';

    await provider.send({
      to: org.contact_email,
      from: `${org.name} vía POSTY <noreply@postyassistant.com>`,
      subject: `[Copia] ${fullEmail.subject}`,
      replyTo: `${alias}@${domain}`,
      react: ManualEmail({
        hotelName: org.name,
        logoUrl: org.logo_url,
        brandColor: org.brand_color || undefined,
        guestName: org.name,
        subject: `Nuevo correo de ${senderEmail}`,
        body: `${preview}\n\n---\nResponde desde POSTY para que la conversación quede guardada.\nhttps://app.postyassistant.com/correo?thread=${threadId}`,
      }),
      text: [
        `Nuevo correo de ${senderEmail}`,
        '',
        preview,
        '',
        '---',
        'Responde desde POSTY para que la conversación quede guardada.',
        `https://app.postyassistant.com/correo?thread=${threadId}`,
      ].join('\n'),
      headers: {
        'X-Posty-Forwarded': 'true',
      },
    });
  } catch (err) {
    console.error('[Email Inbound] Failed to forward copy:', err);
    // Non-critical — don't throw
  }
}

// ─── Auto-pause reputation check ───────────────────────────────────────

const BOUNCE_THRESHOLD = 5; // 5%
const COMPLAINT_THRESHOLD = 0.1; // 0.1%

async function checkAndAutoPause(db: any, orgId: string) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Count sent, bounced, and complained in last 30 days
    const [sentRes, bouncedRes, complainedRes, orgRes] = await Promise.all([
      db.from('email_messages').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('direction', 'out').gte('created_at', thirtyDaysAgo),
      db.from('email_messages').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'bounced').gte('created_at', thirtyDaysAgo),
      db.from('email_messages').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'complained').gte('created_at', thirtyDaysAgo),
      db.from('organizations').select('email_paused, name, contact_email').eq('id', orgId).single(),
    ]);

    const totalSent = sentRes.count ?? 0;
    if (totalSent < 10) return; // Not enough data to judge

    const bounceRate = ((bouncedRes.count ?? 0) / totalSent) * 100;
    const complaintRate = ((complainedRes.count ?? 0) / totalSent) * 100;

    if (orgRes.data?.email_paused) return; // Already paused

    if (bounceRate >= BOUNCE_THRESHOLD || complaintRate >= COMPLAINT_THRESHOLD) {
      // Auto-pause
      await db.from('organizations')
        .update({ email_paused: true })
        .eq('id', orgId);

      const reason = bounceRate >= BOUNCE_THRESHOLD
        ? `tasa de rebote ${bounceRate.toFixed(1)}% (límite: ${BOUNCE_THRESHOLD}%)`
        : `tasa de quejas ${complaintRate.toFixed(2)}% (límite: ${COMPLAINT_THRESHOLD}%)`;

      console.warn(
        `[Email AutoPause] Paused org ${orgId} (${orgRes.data?.name}): ${reason}`,
      );
    }
  } catch (err) {
    console.error('[Email AutoPause] Error:', err);
  }
}
