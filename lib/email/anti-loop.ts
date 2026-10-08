/**
 * Anti-loop protection for inbound emails.
 *
 * Detects auto-replies, bulk/list emails, and our own forwarded copies
 * to prevent infinite email loops.
 */

/** Headers that indicate an auto-generated or auto-replied email. */
const AUTO_SUBMITTED_VALUES = ['auto-replied', 'auto-generated', 'auto-notified'];

/** Precedence values that indicate bulk/list/junk emails. */
const BULK_PRECEDENCE_VALUES = ['bulk', 'junk', 'list'];

/**
 * Check if an inbound email should be skipped to prevent loops.
 *
 * Returns `true` if the email is an auto-reply, bulk/list email,
 * or a copy we ourselves forwarded (X-Posty-* header).
 */
export function shouldSkipEmail(
  headers: Record<string, string>,
): { skip: boolean; reason: string | null } {
  const normalized = normalizeHeaders(headers);

  // 1. Auto-Submitted header (RFC 3834)
  const autoSubmitted = normalized['auto-submitted'];
  if (autoSubmitted && autoSubmitted !== 'no') {
    const matchedValue = AUTO_SUBMITTED_VALUES.find((v) =>
      autoSubmitted.toLowerCase().includes(v),
    );
    if (matchedValue || autoSubmitted.toLowerCase() !== 'no') {
      return { skip: true, reason: `Auto-Submitted: ${autoSubmitted}` };
    }
  }

  // 2. Precedence: bulk/junk/list
  const precedence = normalized['precedence'];
  if (
    precedence &&
    BULK_PRECEDENCE_VALUES.includes(precedence.toLowerCase().trim())
  ) {
    return { skip: true, reason: `Precedence: ${precedence}` };
  }

  // 3. X-Auto-Response-Suppress (Microsoft)
  const autoResponseSuppress = normalized['x-auto-response-suppress'];
  if (autoResponseSuppress) {
    return {
      skip: true,
      reason: `X-Auto-Response-Suppress: ${autoResponseSuppress}`,
    };
  }

  // 4. Our own headers — prevent re-processing forwarded copies
  if (normalized['x-posty-processed']) {
    return { skip: true, reason: 'X-Posty-Processed (our own forward)' };
  }
  if (normalized['x-posty-forwarded']) {
    return { skip: true, reason: 'X-Posty-Forwarded (our own forward)' };
  }

  // 5. List-Unsubscribe without a human sender (likely automated marketing)
  // We still accept these — the hotel may want to see them.

  return { skip: false, reason: null };
}

/**
 * Normalize header keys to lowercase for case-insensitive comparison.
 */
function normalizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}
