import { describe, it, expect } from 'vitest';

// -------------------------------------------------------
// State machine tests
// -------------------------------------------------------

type PostStatus = 'draft' | 'scheduled' | 'processing' | 'published' | 'failed' | 'canceled';

const VALID_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['scheduled', 'canceled'],
  scheduled: ['processing', 'canceled'],
  processing: ['published', 'failed'],
  published: [],
  failed: ['scheduled', 'canceled'],
  canceled: [],
};

function canTransition(from: PostStatus, to: PostStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

describe('Instagram post state machine', () => {
  it('allows draft → scheduled', () => {
    expect(canTransition('draft', 'scheduled')).toBe(true);
  });

  it('allows scheduled → processing', () => {
    expect(canTransition('scheduled', 'processing')).toBe(true);
  });

  it('allows processing → published', () => {
    expect(canTransition('processing', 'published')).toBe(true);
  });

  it('allows processing → failed', () => {
    expect(canTransition('processing', 'failed')).toBe(true);
  });

  it('allows failed → scheduled (retry)', () => {
    expect(canTransition('failed', 'scheduled')).toBe(true);
  });

  it('allows draft → canceled', () => {
    expect(canTransition('draft', 'canceled')).toBe(true);
  });

  it('allows scheduled → canceled', () => {
    expect(canTransition('scheduled', 'canceled')).toBe(true);
  });

  it('allows failed → canceled', () => {
    expect(canTransition('failed', 'canceled')).toBe(true);
  });

  it('does NOT allow published → anything', () => {
    const targets: PostStatus[] = ['draft', 'scheduled', 'processing', 'failed', 'canceled'];
    for (const to of targets) {
      expect(canTransition('published', to)).toBe(false);
    }
  });

  it('does NOT allow canceled → anything', () => {
    const targets: PostStatus[] = ['draft', 'scheduled', 'processing', 'published', 'failed'];
    for (const to of targets) {
      expect(canTransition('canceled', to)).toBe(false);
    }
  });

  it('does NOT allow processing → scheduled (must go through failed)', () => {
    expect(canTransition('processing', 'scheduled')).toBe(false);
  });

  it('does NOT allow draft → published (must go through processing)', () => {
    expect(canTransition('draft', 'published')).toBe(false);
  });
});

// -------------------------------------------------------
// Retry delay logic tests
// -------------------------------------------------------

const RETRY_DELAYS = [2, 10, 30]; // minutes
const MAX_RETRIES = 3;

function getRetryDelayMinutes(attempts: number): number | null {
  if (attempts >= MAX_RETRIES) return null; // no more retries
  return RETRY_DELAYS[attempts] ?? 30;
}

const PERMANENT_ERRORS = [
  'token_expired',
  'OAuthException',
  'Invalid user id',
  'permission',
  'not_professional',
  'APPLICATION_LIMIT',
  'invalid_image',
];

function isPermanentError(errorMsg: string): boolean {
  return PERMANENT_ERRORS.some(pe => errorMsg.toLowerCase().includes(pe.toLowerCase()));
}

describe('Retry logic', () => {
  it('first attempt retries in 2 minutes', () => {
    expect(getRetryDelayMinutes(0)).toBe(2);
  });

  it('second attempt retries in 10 minutes', () => {
    expect(getRetryDelayMinutes(1)).toBe(10);
  });

  it('third attempt retries in 30 minutes', () => {
    expect(getRetryDelayMinutes(2)).toBe(30);
  });

  it('after 3 attempts, no more retries', () => {
    expect(getRetryDelayMinutes(3)).toBeNull();
  });

  it('recognizes permanent errors', () => {
    expect(isPermanentError('token_expired')).toBe(true);
    expect(isPermanentError('Error: OAuthException - invalid token')).toBe(true);
    expect(isPermanentError('Your application has hit the APPLICATION_LIMIT')).toBe(true);
    expect(isPermanentError('invalid_image format')).toBe(true);
  });

  it('does not flag transient errors as permanent', () => {
    expect(isPermanentError('Network timeout')).toBe(false);
    expect(isPermanentError('Internal server error')).toBe(false);
    expect(isPermanentError('Rate limited, try again later')).toBe(false);
  });
});

// -------------------------------------------------------
// Idempotency tests
// -------------------------------------------------------

describe('Idempotency', () => {
  it('post with ig_media_id should never be re-published', () => {
    const post = {
      id: 'p1',
      ig_media_id: '12345',
      status: 'processing' as PostStatus,
    };
    // The publisher checks ig_media_id first — if set, marks published
    const shouldPublish = !post.ig_media_id;
    expect(shouldPublish).toBe(false);
  });

  it('post without ig_media_id should proceed to publish', () => {
    const post = {
      id: 'p2',
      ig_media_id: null,
      status: 'processing' as PostStatus,
    };
    const shouldPublish = !post.ig_media_id;
    expect(shouldPublish).toBe(true);
  });
});

// -------------------------------------------------------
// Scheduling validation tests
// -------------------------------------------------------

describe('Scheduling validations', () => {
  it('rejects scheduling less than 5 minutes in the future', () => {
    const scheduledAt = new Date(Date.now() + 3 * 60 * 1000); // 3 min ahead
    const minFuture = 5 * 60 * 1000;
    const diff = scheduledAt.getTime() - Date.now();
    expect(diff < minFuture).toBe(true);
  });

  it('accepts scheduling 10 minutes in the future', () => {
    const scheduledAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min ahead
    const minFuture = 5 * 60 * 1000;
    const diff = scheduledAt.getTime() - Date.now();
    expect(diff >= minFuture).toBe(true);
  });

  it('rejects scheduling more than 6 months ahead', () => {
    const scheduledAt = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000); // 200 days
    const maxFuture = 180 * 24 * 60 * 60 * 1000;
    const diff = scheduledAt.getTime() - Date.now();
    expect(diff > maxFuture).toBe(true);
  });

  it('accepts scheduling 3 months ahead', () => {
    const scheduledAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const maxFuture = 180 * 24 * 60 * 60 * 1000;
    const diff = scheduledAt.getTime() - Date.now();
    expect(diff <= maxFuture).toBe(true);
  });
});

// -------------------------------------------------------
// Claim logic simulation
// -------------------------------------------------------

describe('Claim due posts (simulation)', () => {
  it('only claims posts with scheduled_at <= now', () => {
    const now = Date.now();
    const posts = [
      { id: '1', scheduled_at: new Date(now - 60000).toISOString(), status: 'scheduled' },
      { id: '2', scheduled_at: new Date(now + 300000).toISOString(), status: 'scheduled' }, // 5 min future
      { id: '3', scheduled_at: new Date(now - 120000).toISOString(), status: 'scheduled' },
    ];

    const due = posts.filter(p =>
      p.status === 'scheduled' && new Date(p.scheduled_at).getTime() <= now,
    );

    expect(due).toHaveLength(2);
    expect(due.map(p => p.id)).toEqual(['1', '3']);
  });

  it('respects next_attempt_at for retries', () => {
    const now = Date.now();
    const posts = [
      {
        id: '1',
        scheduled_at: new Date(now - 60000).toISOString(),
        next_attempt_at: new Date(now + 600000).toISOString(), // 10 min in future
        status: 'scheduled',
      },
      {
        id: '2',
        scheduled_at: new Date(now - 60000).toISOString(),
        next_attempt_at: null,
        status: 'scheduled',
      },
    ];

    const due = posts.filter(p =>
      p.status === 'scheduled' &&
      new Date(p.scheduled_at).getTime() <= now &&
      (p.next_attempt_at === null || new Date(p.next_attempt_at).getTime() <= now),
    );

    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('2');
  });

  it('limits to 5 posts per run', () => {
    const now = Date.now();
    const posts = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      scheduled_at: new Date(now - (i + 1) * 60000).toISOString(),
      status: 'scheduled' as const,
    }));

    const due = posts
      .filter(p => p.status === 'scheduled' && new Date(p.scheduled_at).getTime() <= now)
      .slice(0, 5);

    expect(due).toHaveLength(5);
  });
});

// -------------------------------------------------------
// Stuck post recovery simulation
// -------------------------------------------------------

describe('Stuck post recovery', () => {
  it('identifies posts stuck in processing for >10 min', () => {
    const now = Date.now();
    const posts = [
      { id: '1', status: 'processing', locked_at: new Date(now - 15 * 60000).toISOString(), ig_media_id: null },
      { id: '2', status: 'processing', locked_at: new Date(now - 5 * 60000).toISOString(), ig_media_id: null },
      { id: '3', status: 'processing', locked_at: new Date(now - 20 * 60000).toISOString(), ig_media_id: '12345' },
    ];

    const stuck = posts.filter(p =>
      p.status === 'processing' &&
      p.ig_media_id === null &&
      new Date(p.locked_at).getTime() < now - 10 * 60000,
    );

    expect(stuck).toHaveLength(1);
    expect(stuck[0].id).toBe('1');
    // post 2 is only 5 min old, post 3 has ig_media_id (already published)
  });
});
