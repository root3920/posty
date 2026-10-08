import { createAdminClient } from '@/lib/supabase/admin';
import { getEmailEnv } from '@/lib/email/env';
import { getEmailProvider } from '@/lib/email/provider';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';
import { shouldSkipEmail } from '@/lib/email/anti-loop';
import { parseRecipientAddress } from '@/lib/email/alias';
import { resolveThread } from '@/lib/email/thread-resolver';
import { ManualEmail, manualEmailText } from '@/lib/email/templates/manual-email';
import { Webhook } from 'svix';
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

    // Verify webhook signature using svix (Resend's signing library)
    const { env } = getEmailEnv();
    const secret = env?.RESEND_WEBHOOK_SECRET?.trim();

    if (secret) {
      const svixId = request.headers.get('svix-id');
      const svixTimestamp = request.headers.get('svix-timestamp');
      const svixSignature = request.headers.get('svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('[Email Webhook] Missing svix headers:', {
          headers: Array.from(request.headers.keys()),
          bodyLength: rawBody.length,
        });
        return Response.json({ error: 'Missing signature headers' }, { status: 401 });
      }

      try {
        const wh = new Webhook(secret);
        wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        });
      } catch (verifyErr) {
        console.error('[Email Webhook] Signature verification failed:', {
          error: verifyErr instanceof Error ? verifyErr.message : 'unknown',
          headers: Array.from(request.headers.keys()),
          bodyLength: rawBody.length,
          secretLength: secret.length,
          secretPrefix: secret.startsWith('whsec_') ? 'whsec_...' : 'no-whsec-prefix',
        });
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
    .insert({
      id: eventId,
      event_type: 'email.received',
      status: 'processed',
      raw_payload: fullPayload,
    });

  try {
    await processInboundEmail(db, data, fullPayload);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const step = (err as any)?._step ?? 'unknown';
    console.error(`[Email Inbound] FAILED at step "${step}": ${errorMsg}`, {
      eventId,
      from: data.from,
      to: data.to,
    });

    // Record failure for admin panel / retry
    await db
      .from('email_webhook_events')
      .update({
        status: 'failed',
        error: errorMsg,
        failed_step: step,
      })
      .eq('id', eventId);
  }

  return Response.json({ ok: true });
}

/** Throw with step metadata so the caller can record which step failed. */
function stepError(step: string, message: string): Error {
  const err = new Error(message);
  (err as any)._step = step;
  return err;
}

async function processInboundEmail(
  db: any,
  data: ResendWebhookPayload['data'],
  fullPayload: ResendWebhookPayload,
) {
  const { env } = getEmailEnv();
  const domain = env?.EMAIL_HOTEL_DOMAIN || 'hoteles.postyassistant.com';
  const emailId = data.email_id;

  // Step 1: Fetch full email content from Resend API
  let fullEmail;
  try {
    const provider = getEmailProvider();
    fullEmail = await provider.fetchReceivedEmail(emailId);
  } catch (err) {
    throw stepError('fetch_email', `No se pudo obtener el contenido del correo ${emailId}: ${err instanceof Error ? err.message : err}`);
  }

  // Step 2: Anti-loop check
  const loopCheck = shouldSkipEmail(fullEmail.headers);
  if (loopCheck.skip) {
    console.log(`[Email Inbound] Skipped (${loopCheck.reason}): ${emailId}`);
    return;
  }

  // Step 3: Resolve alias → organization
  const recipients = [...(data.to ?? []), ...(data.cc ?? [])];
  let matchedOrg: { orgId: string; alias: string; token: string | null } | null = null;

  for (const addr of recipients) {
    const parsed = parseRecipientAddress(addr, domain);
    if (!parsed) continue;

    const { data: aliasRow } = await db
      .from('email_aliases')
      .select('organization_id, alias')
      .eq('alias', parsed.alias)
      .eq('active', true)
      .maybeSingle();

    if (aliasRow) {
      matchedOrg = { orgId: aliasRow.organization_id, alias: aliasRow.alias, token: parsed.token };
      break;
    }

    // Grace period for old aliases
    const { data: expiredAlias } = await db
      .from('email_aliases')
      .select('organization_id, alias')
      .eq('alias', parsed.alias)
      .eq('active', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (expiredAlias) {
      matchedOrg = { orgId: expiredAlias.organization_id, alias: expiredAlias.alias, token: parsed.token };
      break;
    }
  }

  if (!matchedOrg) {
    throw stepError('resolve_alias', `Ningún alias coincide con los destinatarios: ${recipients.join(', ')}`);
  }

  const { orgId, alias, token } = matchedOrg;

  // Step 4: Rate limits
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

  // Step 5: Sanitize HTML
  const htmlSanitized = fullEmail.html ? sanitizeEmailHtml(fullEmail.html) : null;

  // Step 6: Resolve thread
  let threadResult;
  const inReplyTo = fullEmail.headers['in-reply-to']
    || fullEmail.headers['In-Reply-To'] || null;
  const references = fullEmail.headers['references']
    || fullEmail.headers['References'] || null;

  try {
    threadResult = await resolveThread(db, {
      orgId,
      token,
      inReplyTo,
      references,
      senderEmail,
      subject: fullEmail.subject,
    });
  } catch (err) {
    throw stepError('resolve_thread', `Error al resolver hilo: ${err instanceof Error ? err.message : err}`);
  }

  // Step 7: Process attachments (non-fatal — errors logged but don't stop processing)
  const provider = getEmailProvider();
  const storedAttachments = await processAttachments(
    db, provider, emailId, orgId, threadResult.threadId, fullEmail.attachments,
  );

  // Step 8: Insert email message
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
    throw stepError('insert_message', `Error al guardar mensaje: ${msgErr.message}`);
  }

  // Step 9: Update thread counters
  const { data: currentThread } = await db
    .from('email_threads')
    .select('unread_count')
    .eq('id', threadResult.threadId)
    .single();

  await db
    .from('email_threads')
    .update({
      last_message_at: new Date().toISOString(),
      unread_count: (currentThread?.unread_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadResult.threadId);

  // Step 10: Forward copy (non-fatal)
  try {
    await forwardCopyToHotel(db, orgId, alias, threadResult.threadId, fullEmail, senderEmail);
  } catch (err) {
    console.error('[Email Inbound] Forward copy failed (non-fatal):', err);
  }

  console.log(
    `[Email Inbound] OK: ${emailId} → thread ${threadResult.threadId}` +
    (threadResult.isNew ? ' (new)' : '') +
    ` from ${senderEmail} to ${alias}`,
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
  const domain = env?.EMAIL_HOTEL_DOMAIN || 'hoteles.postyassistant.com';

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
