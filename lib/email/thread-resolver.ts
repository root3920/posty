import { nanoid } from 'nanoid';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolveThreadParams {
  orgId: string;
  /** The +token portion from the recipient address, if present */
  token: string | null;
  /** In-Reply-To header from the inbound email */
  inReplyTo: string | null;
  /** References header from the inbound email */
  references: string | null;
  /** Sender email address */
  senderEmail: string;
  /** Email subject */
  subject: string;
}

export interface ResolveThreadResult {
  threadId: string;
  guestId: string | null;
  isNew: boolean;
}

/**
 * Resolve an inbound email to an existing or new email thread.
 *
 * Priority:
 *   1. +token in recipient address → match email_threads.token
 *   2. In-Reply-To / References headers → match email_messages.message_id
 *   3. Sender email matches a guest in the org → new thread linked to guest
 *   4. Unknown sender → new thread without guest (shows in "Otros" tab)
 */
export async function resolveThread(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any>,
  params: ResolveThreadParams,
): Promise<ResolveThreadResult> {
  const { orgId, token, inReplyTo, references, senderEmail, subject } = params;

  // --- Strategy 1: Match by +token ---
  if (token) {
    const { data: thread } = await db
      .from('email_threads')
      .select('id, guest_id')
      .eq('token', token)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (thread) {
      return { threadId: thread.id, guestId: thread.guest_id, isNew: false };
    }
    // Token not found — fall through to other strategies
  }

  // --- Strategy 2: Match by In-Reply-To / References ---
  const messageIds = extractMessageIds(inReplyTo, references);
  if (messageIds.length > 0) {
    const { data: messages } = await db
      .from('email_messages')
      .select('thread_id, email_threads!inner(id, guest_id)')
      .in('message_id', messageIds)
      .eq('organization_id', orgId)
      .limit(1);

    if (messages && messages.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = messages[0] as any;
      const thread = Array.isArray(msg.email_threads)
        ? msg.email_threads[0]
        : msg.email_threads;
      if (thread) {
        return {
          threadId: msg.thread_id,
          guestId: thread.guest_id ?? null,
          isNew: false,
        };
      }
    }
  }

  // --- Strategy 3: Match sender to a guest ---
  const guestId = await findGuestByEmail(db, orgId, senderEmail);

  // --- Strategy 4 (fallback): Create a new thread ---
  const newToken = nanoid(12);
  const { data: newThread, error } = await db
    .from('email_threads')
    .insert({
      organization_id: orgId,
      guest_id: guestId,
      subject: subject || '(sin asunto)',
      token: newToken,
      sender_address: senderEmail,
      last_message_at: new Date().toISOString(),
      unread_count: 0, // will be incremented by the caller
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Error al crear hilo de correo: ${error.message}`);
  }

  return { threadId: newThread.id, guestId, isNew: true };
}

/**
 * Extract unique Message-IDs from In-Reply-To and References headers.
 * These headers contain angle-bracketed IDs: <id@domain>
 */
function extractMessageIds(
  inReplyTo: string | null,
  references: string | null,
): string[] {
  const ids = new Set<string>();
  const pattern = /<([^>]+)>/g;

  for (const header of [inReplyTo, references]) {
    if (!header) continue;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(header)) !== null) {
      ids.add(`<${match[1]}>`);
    }
  }

  return Array.from(ids);
}

/**
 * Find a guest in the organization by their email address.
 */
async function findGuestByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any>,
  orgId: string,
  email: string,
): Promise<string | null> {
  const { data } = await db
    .from('guests')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('email', email.toLowerCase())
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
