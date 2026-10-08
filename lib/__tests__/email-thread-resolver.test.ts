import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Thread resolver tests.
 *
 * The resolveThread function talks to Supabase, so we mock the DB calls.
 * We test the 4-strategy priority:
 *   1. +token in recipient → match email_threads.token
 *   2. In-Reply-To / References → match email_messages.message_id
 *   3. Sender email → match guests.email
 *   4. Fallback → create new thread
 */

// Mock Supabase client
function createMockDb(overrides: {
  threadByToken?: { id: string; guest_id: string | null } | null;
  messageByMessageId?: { thread_id: string; email_threads: { id: string; guest_id: string | null } } | null;
  guestByEmail?: { id: string } | null;
  insertedThread?: { id: string };
} = {}) {
  const {
    threadByToken = null,
    messageByMessageId = null,
    guestByEmail = null,
    insertedThread = { id: 'new-thread-id' },
  } = overrides;

  return {
    from: vi.fn((table: string) => {
      if (table === 'email_threads') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: threadByToken }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: insertedThread,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'email_messages') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: messageByMessageId ? [messageByMessageId] : [],
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'guests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: guestByEmail }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  };
}

describe('resolveThread', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('strategy 1: resolves by +token', async () => {
    const { resolveThread } = await import('../email/thread-resolver');
    const db = createMockDb({
      threadByToken: { id: 'thread-123', guest_id: 'guest-456' },
    });

    const result = await resolveThread(db as any, {
      orgId: 'org-1',
      token: 'abc123',
      inReplyTo: null,
      references: null,
      senderEmail: 'user@example.com',
      subject: 'Test',
    });

    expect(result.threadId).toBe('thread-123');
    expect(result.guestId).toBe('guest-456');
    expect(result.isNew).toBe(false);
  });

  it('strategy 2: resolves by In-Reply-To header', async () => {
    const { resolveThread } = await import('../email/thread-resolver');
    const db = createMockDb({
      threadByToken: null, // token not found
      messageByMessageId: {
        thread_id: 'thread-789',
        email_threads: { id: 'thread-789', guest_id: 'guest-012' },
      },
    });

    const result = await resolveThread(db as any, {
      orgId: 'org-1',
      token: null,
      inReplyTo: '<msg-id-1@hoteles.postyassistant.com>',
      references: null,
      senderEmail: 'user@example.com',
      subject: 'Re: Test',
    });

    expect(result.threadId).toBe('thread-789');
    expect(result.guestId).toBe('guest-012');
    expect(result.isNew).toBe(false);
  });

  it('strategy 3: resolves by sender email matching guest', async () => {
    const { resolveThread } = await import('../email/thread-resolver');
    const db = createMockDb({
      guestByEmail: { id: 'guest-found' },
    });

    const result = await resolveThread(db as any, {
      orgId: 'org-1',
      token: null,
      inReplyTo: null,
      references: null,
      senderEmail: 'known-guest@example.com',
      subject: 'New inquiry',
    });

    expect(result.guestId).toBe('guest-found');
    expect(result.isNew).toBe(true);
  });

  it('strategy 4: creates new thread for unknown sender', async () => {
    const { resolveThread } = await import('../email/thread-resolver');
    const db = createMockDb({
      // all lookups return null → new thread
    });

    const result = await resolveThread(db as any, {
      orgId: 'org-1',
      token: null,
      inReplyTo: null,
      references: null,
      senderEmail: 'stranger@example.com',
      subject: 'Hello',
    });

    expect(result.threadId).toBe('new-thread-id');
    expect(result.guestId).toBeNull();
    expect(result.isNew).toBe(true);
  });

  it('falls through from token to headers when token not found', async () => {
    const { resolveThread } = await import('../email/thread-resolver');
    const db = createMockDb({
      threadByToken: null, // token lookup fails
      messageByMessageId: {
        thread_id: 'thread-fallback',
        email_threads: { id: 'thread-fallback', guest_id: null },
      },
    });

    const result = await resolveThread(db as any, {
      orgId: 'org-1',
      token: 'nonexistent-token',
      inReplyTo: '<some-msg@example.com>',
      references: null,
      senderEmail: 'user@example.com',
      subject: 'Re: Something',
    });

    expect(result.threadId).toBe('thread-fallback');
    expect(result.isNew).toBe(false);
  });
});
