/**
 * Sanitizes form values before submitting to the database.
 *
 * - Empty strings → null for date, number, and UUID fields
 * - Trims string fields
 * - Use before every Supabase insert/update to avoid
 *   "invalid input syntax for type date: ''" errors.
 */

/** Convert empty string to null. */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Convert empty string to null for numeric fields. */
export function emptyToNullNumber(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return isNaN(n) ? null : n;
}

/**
 * Sanitizes a record: empty string values become null.
 * Useful as a pre-submit transform for form data.
 */
export function sanitizeFormData<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === 'string' && val.trim() === '') {
      (result as Record<string, unknown>)[key] = null;
    }
  }
  return result;
}
