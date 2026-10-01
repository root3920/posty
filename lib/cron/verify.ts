import { createHash, timingSafeEqual } from 'crypto';

/**
 * Verifies that an incoming cron request carries a valid CRON_SECRET.
 *
 * - Reads `process.env.CRON_SECRET`
 * - Accepts `Authorization: Bearer <secret>` header
 * - Trims both sides
 * - Compares with timingSafeEqual (constant-time)
 * - Logs a safe diagnostic on failure (lengths + first 8 chars of sha256, never the value)
 *
 * @returns `null` if valid, or a `Response` to return immediately on failure.
 */
export function verifyCronRequest(request: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error('[cron-auth] CRON_SECRET env var is not set');
    return Response.json({ error: 'Not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization')?.trim() ?? '';

  // Extract the token from "Bearer <token>"
  let received = '';
  if (authHeader.startsWith('Bearer ')) {
    received = authHeader.slice(7).trim();
  } else if (authHeader.startsWith('bearer ')) {
    received = authHeader.slice(7).trim();
  }

  if (!received) {
    const sha = shortSha(cronSecret);
    console.error(
      `[cron-auth] fail: no Bearer token in Authorization header. expected_len=${cronSecret.length} expected_sha=${sha}`,
    );
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Constant-time comparison
  const expectedBuf = Buffer.from(cronSecret, 'utf-8');
  const receivedBuf = Buffer.from(received, 'utf-8');

  // timingSafeEqual requires equal lengths; if different, it's already a mismatch
  if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
    const expectedSha = shortSha(cronSecret);
    const receivedSha = shortSha(received);
    console.error(
      `[cron-auth] fail expected_len=${cronSecret.length} received_len=${received.length} expected_sha=${expectedSha} received_sha=${receivedSha}`,
    );
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // valid
}

/** First 8 hex chars of SHA-256. Safe to log — not reversible. */
function shortSha(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}
