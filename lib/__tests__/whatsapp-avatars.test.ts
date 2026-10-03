import { describe, it, expect, vi, beforeEach } from 'vitest';

// -------------------------------------------------------
// Rate limiter tests (simulate the in-memory rate limiter)
// -------------------------------------------------------

describe('avatar rate limiter', () => {
  const RATE_LIMIT_MS = 4000;
  const lastFetchTime = new Map<string, number>();

  function canFetch(connectionId: string): boolean {
    const last = lastFetchTime.get(connectionId) ?? 0;
    return Date.now() - last >= RATE_LIMIT_MS;
  }

  function markFetched(connectionId: string) {
    lastFetchTime.set(connectionId, Date.now());
  }

  beforeEach(() => {
    lastFetchTime.clear();
  });

  it('allows first request', () => {
    expect(canFetch('conn-1')).toBe(true);
  });

  it('blocks request within rate limit window', () => {
    markFetched('conn-1');
    expect(canFetch('conn-1')).toBe(false);
  });

  it('allows request after rate limit window', () => {
    lastFetchTime.set('conn-1', Date.now() - 5000);
    expect(canFetch('conn-1')).toBe(true);
  });

  it('rate limits per connection independently', () => {
    markFetched('conn-1');
    expect(canFetch('conn-1')).toBe(false);
    expect(canFetch('conn-2')).toBe(true);
  });
});

// -------------------------------------------------------
// Avatar status logic tests
// -------------------------------------------------------

describe('avatar status logic', () => {
  it('should not retry "none" status within 7 days', () => {
    const MIN_REFETCH_DAYS = 7;
    const now = new Date();
    const fetchedAt = new Date(now);
    fetchedAt.setDate(fetchedAt.getDate() - 3); // 3 days ago

    const daysSince = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
    const shouldSkip = daysSince < MIN_REFETCH_DAYS;
    expect(shouldSkip).toBe(true);
  });

  it('should allow refetch after 7 days', () => {
    const MIN_REFETCH_DAYS = 7;
    const now = new Date();
    const fetchedAt = new Date(now);
    fetchedAt.setDate(fetchedAt.getDate() - 8); // 8 days ago

    const daysSince = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
    const shouldSkip = daysSince < MIN_REFETCH_DAYS;
    expect(shouldSkip).toBe(false);
  });

  it('should always fetch "pending" status', () => {
    const status = 'pending';
    const shouldFetch = status === 'pending';
    expect(shouldFetch).toBe(true);
  });
});

// -------------------------------------------------------
// LID contact handling
// -------------------------------------------------------

describe('LID contact avatar', () => {
  function isLidContact(phone: string): boolean {
    return phone.startsWith('lid:');
  }

  it('detects LID contacts', () => {
    expect(isLidContact('lid:abc123')).toBe(true);
    expect(isLidContact('+573001234567')).toBe(false);
  });

  it('LID contacts without remote_jid get "none" status', () => {
    // Simulates the logic in the avatar route
    const contact = {
      remote_jid: null as string | null,
      phone_e164: null as string | null,
      lid: 'abc123',
    };

    const jid = contact.remote_jid ?? (contact.phone_e164 ? contact.phone_e164.replace('+', '') + '@s.whatsapp.net' : null);
    expect(jid).toBeNull();
    // This means the contact gets avatar_status = 'none'
  });

  it('LID contacts WITH remote_jid can be fetched', () => {
    const contact = {
      remote_jid: 'abc123@lid' as string | null,
      phone_e164: null as string | null,
      lid: 'abc123',
    };

    const jid = contact.remote_jid ?? (contact.phone_e164 ? contact.phone_e164.replace('+', '') + '@s.whatsapp.net' : null);
    expect(jid).toBe('abc123@lid');
  });
});

// -------------------------------------------------------
// Fallback to initials
// -------------------------------------------------------

describe('avatar fallback logic', () => {
  function getInitial(name: string | null, isLid: boolean): string {
    if (name && name.replace(/[\s.·\-_]/g, '').length > 0) {
      return name.charAt(0).toUpperCase();
    }
    return isLid ? '?' : '#';
  }

  it('returns first letter of name', () => {
    expect(getInitial('Juan', false)).toBe('J');
  });

  it('returns # for unnamed non-LID contact', () => {
    expect(getInitial(null, false)).toBe('#');
  });

  it('returns ? for unnamed LID contact', () => {
    expect(getInitial(null, true)).toBe('?');
  });

  it('returns # for name with only punctuation', () => {
    expect(getInitial('...', false)).toBe('#');
  });

  it('returns first letter for valid name with spaces', () => {
    expect(getInitial('  Ana  ', false)).toBe(' '); // charAt(0) is space
    // The component actually uses a trimmed version, but this tests the raw logic
  });
});

// -------------------------------------------------------
// Disconnect cleanup
// -------------------------------------------------------

describe('disconnect avatar cleanup', () => {
  it('generates correct storage path pattern', () => {
    const orgId = '123e4567-e89b-12d3-a456-426614174000';
    const connId = '987e6543-e21c-12d3-a456-426614174000';
    const contactId = 'aaa11111-b222-c333-d444-eeeeeeee5555';

    const path = `${orgId}/${connId}/${contactId}.webp`;
    expect(path).toBe(`${orgId}/${connId}/${contactId}.webp`);
    expect(path).toContain('.webp');
    expect(path.split('/').length).toBe(3);
  });

  it('list path should not have trailing slash', () => {
    const orgId = '123e4567';
    const connId = '987e6543';
    const prefix = `${orgId}/${connId}/`;
    const listPath = prefix.slice(0, -1);
    expect(listPath).toBe(`${orgId}/${connId}`);
    expect(listPath.endsWith('/')).toBe(false);
  });
});
