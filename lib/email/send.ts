/**
 * sendHotelEmail — single entry point for ALL outbound hotel emails.
 *
 * Every email sent from POSTY (guest profile, Correo compose/reply,
 * automations, contracts, test) MUST go through this function.
 *
 * It handles: suppression check, thread find-or-create, hotel alias,
 * Reply-To token, RFC Message-ID headers, Resend send, DB record,
 * guest linking, and source tracking.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  getEmailProvider,
  buildHotelFromAddress,
  buildReplyToAddress,
  generateMessageId,
} from './provider';
import { ensureEmailAlias } from './ensure-alias';
import { checkEmailPaused } from './pause-check';
import { ManualEmail, manualEmailText } from './templates/manual-email';
import { randomUUID } from 'crypto';
import { nanoid } from 'nanoid';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types ──────────────────────────────────────────────────

export type EmailSource =
  | 'manual'
  | 'guest_profile'
  | 'automation'
  | 'contract'
  | 'reservation'
  | 'event'
  | 'test';

export interface SendHotelEmailInput {
  /** Organization ID */
  orgId: string;
  /** Organization object with name, logo, brand_color, contact_email */
  org: {
    name: string;
    logo_url?: string | null;
    brand_color?: string | null;
    contact_email?: string | null;
  };
  /** Profile ID of the sender (staff member) */
  sentBy: string;
  /** Recipient email address */
  to: string;
  /** Email subject */
  subject: string;
  /** Plain text body */
  body: string;
  /** Guest ID to link (optional) */
  guestId?: string | null;
  /** Guest first name for greeting (optional, defaults to "estimado/a") */
  guestName?: string;
  /** Where this email originates from */
  source: EmailSource;
  /** Existing thread ID for replies (optional) */
  threadId?: string | null;
  /** In-Reply-To header for threading (optional) */
  inReplyTo?: string | null;
  /** References header for threading (optional) */
  referencesHeader?: string | null;
  /** Idempotency key (optional) */
  idempotencyKey?: string | null;
  /** Custom React template (optional — defaults to ManualEmail) */
  react?: React.ReactElement;
  /** Custom plain text (optional — defaults to manualEmailText) */
  text?: string;
  /** Custom template name stored in DB (optional — defaults to 'manual') */
  template?: string;
  /** Skip pause/suppression checks (for test emails only) */
  skipChecks?: boolean;
}

export interface SendHotelEmailResult {
  /** Email message row ID */
  id: string;
  /** Email thread ID */
  threadId: string;
  /** Resend provider message ID */
  providerId: string;
  /** Send status */
  status: 'sent';
}

// ── Rate limit ─────────────────────────────────────────────

const RATE_LIMIT_PER_HOUR = 100;

// ── Main function ──────────────────────────────────────────

export async function sendHotelEmail(
  input: SendHotelEmailInput,
): Promise<SendHotelEmailResult> {
  const adminDb = createAdminClient() as any;

  // 1. Check email pause (unless skipping)
  if (!input.skipChecks) {
    const pauseMsg = await checkEmailPaused(input.orgId);
    if (pauseMsg) {
      throw new Error(pauseMsg);
    }
  }

  // 2. Normalize recipient
  const to = input.to.toLowerCase().trim();

  // 3. Check suppression list (unless skipping)
  if (!input.skipChecks) {
    const { data: suppressed, error: suppressErr } = await adminDb
      .from('email_suppressions')
      .select('id, reason')
      .eq('organization_id', input.orgId)
      .eq('email', to)
      .maybeSingle();

    if (suppressErr) {
      throw new Error(`Error al verificar destinatario: ${suppressErr.message}`);
    }

    if (suppressed) {
      const reasonMap: Record<string, string> = {
        bounce: 'El correo rebotó previamente',
        complaint: 'El destinatario marcó un correo anterior como spam',
        unsubscribe: 'El destinatario se dio de baja',
      };
      throw new Error(reasonMap[suppressed.reason] || 'Correo suprimido');
    }
  }

  // 4. Rate limit (unless skipping)
  if (!input.skipChecks) {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: hourCount, error: rateErr } = await adminDb
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', input.orgId)
      .gte('created_at', oneHourAgo);

    if (rateErr) {
      throw new Error(`Error al verificar límite de envío: ${rateErr.message}`);
    }

    if ((hourCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
      throw new Error(
        `Límite de envío alcanzado (${RATE_LIMIT_PER_HOUR}/hora). Intenta más tarde.`,
      );
    }
  }

  // 5. Idempotency check
  if (input.idempotencyKey) {
    const { data: existing } = await adminDb
      .from('email_messages')
      .select('id, thread_id, provider_id, status')
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();

    if (existing?.provider_id) {
      return {
        id: existing.id,
        threadId: existing.thread_id,
        providerId: existing.provider_id,
        status: 'sent',
      };
    }
  }

  // 6. Get or create hotel alias
  const alias = await ensureEmailAlias(adminDb, input.orgId, input.org.name);

  // 7. Find or create thread
  let threadId = input.threadId || null;
  let threadToken: string;

  if (threadId) {
    // Existing thread — fetch its token
    const { data: thread, error: threadErr } = await adminDb
      .from('email_threads')
      .select('token')
      .eq('id', threadId)
      .single();

    if (threadErr || !thread) {
      throw new Error('Hilo no encontrado');
    }
    threadToken = thread.token;
  } else {
    // Find an existing open thread for this email + guest, or create one
    const existingThread = await findExistingThread(
      adminDb,
      input.orgId,
      to,
      input.guestId || null,
    );

    if (existingThread) {
      threadId = existingThread.id;
      threadToken = existingThread.token;
    } else {
      // Create new thread
      threadToken = nanoid(12);
      const { data: newThread, error: newThreadErr } = await adminDb
        .from('email_threads')
        .insert({
          organization_id: input.orgId,
          guest_id: input.guestId || null,
          subject: input.subject,
          token: threadToken,
          sender_address: to,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .select('id')
        .single();

      if (newThreadErr) {
        throw new Error(`Error al crear hilo: ${newThreadErr.message}`);
      }
      threadId = newThread.id;
    }
  }

  // 8. Build RFC headers
  const msgUuid = randomUUID();
  const messageId = generateMessageId(msgUuid);
  const fromAddress = buildHotelFromAddress(input.org.name, alias);
  const replyToAddress = buildReplyToAddress(alias, threadToken);

  // 9. Build subject (add Re: for replies if not already present)
  let subject = input.subject;
  if (input.threadId && input.inReplyTo && !subject.startsWith('Re: ')) {
    subject = `Re: ${subject}`;
  }

  // 10. Resolve guest name
  const guestName = input.guestName || await resolveGuestName(adminDb, input.guestId);

  // 11. Build email content
  const reactTemplate =
    input.react ??
    ManualEmail({
      hotelName: input.org.name,
      logoUrl: input.org.logo_url,
      brandColor: input.org.brand_color || undefined,
      guestName,
      subject,
      body: input.body,
    });

  const textContent =
    input.text ??
    manualEmailText({
      hotelName: input.org.name,
      guestName,
      subject,
      body: input.body,
    });

  // 12. Insert message record (status: queued)
  const { data: emailRow, error: insertErr } = await adminDb
    .from('email_messages')
    .insert({
      organization_id: input.orgId,
      thread_id: threadId,
      guest_id: input.guestId || null,
      direction: 'out',
      to,
      from_address: fromAddress,
      subject,
      template: input.template || 'manual',
      body_text: input.body,
      message_id: messageId,
      in_reply_to: input.inReplyTo || null,
      references_header: input.referencesHeader || null,
      status: 'queued',
      sent_by: input.sentBy,
      source: input.source,
      idempotency_key: input.idempotencyKey || null,
    })
    .select('id')
    .single();

  if (insertErr) {
    throw new Error(`Error al registrar correo: ${insertErr.message}`);
  }

  // 13. Send via Resend
  const provider = getEmailProvider();
  try {
    const result = await provider.send({
      to,
      from: fromAddress,
      subject,
      replyTo: replyToAddress,
      react: reactTemplate,
      text: textContent,
      headers: {
        'Message-ID': messageId,
        ...(input.inReplyTo ? { 'In-Reply-To': input.inReplyTo } : {}),
        ...(input.referencesHeader ? { References: input.referencesHeader } : {}),
        'X-Posty-Processed': 'true',
        'X-Entity-Ref-ID': emailRow.id,
      },
    });

    // 14. Update message to sent
    await adminDb
      .from('email_messages')
      .update({
        status: 'sent',
        provider_id: result.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailRow.id);

    // 15. Update thread
    await adminDb
      .from('email_threads')
      .update({
        unread_count: 0,
        last_message_at: new Date().toISOString(),
        last_message_preview: input.body.slice(0, 200),
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId);

    return {
      id: emailRow.id,
      threadId: threadId!,
      providerId: result.id,
      status: 'sent',
    };
  } catch (sendErr) {
    const raw = sendErr instanceof Error ? sendErr.message : 'Error desconocido';
    console.error('[sendHotelEmail] Send error:', raw);

    await adminDb
      .from('email_messages')
      .update({
        status: 'failed',
        error: raw,
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailRow.id);

    throw new Error(raw);
  }
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Find an existing open thread for the same org + email address + guest.
 * Prefers threads linked to the same guest.
 */
async function findExistingThread(
  db: any,
  orgId: string,
  email: string,
  guestId: string | null,
): Promise<{ id: string; token: string } | null> {
  // If we have a guest, try to find their most recent open thread first
  if (guestId) {
    const { data: guestThread } = await db
      .from('email_threads')
      .select('id, token')
      .eq('organization_id', orgId)
      .eq('guest_id', guestId)
      .eq('sender_address', email)
      .eq('status', 'open')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (guestThread) return guestThread;
  }

  return null;
}

async function resolveGuestName(
  db: any,
  guestId: string | null | undefined,
): Promise<string> {
  if (!guestId) return 'estimado/a';

  const { data: guest } = await db
    .from('guests')
    .select('first_name')
    .eq('id', guestId)
    .maybeSingle();

  return guest?.first_name || 'estimado/a';
}
