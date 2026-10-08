import { generateAlias, RESERVED_ALIASES } from './alias';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Get the active email alias for an organization, or create one automatically.
 * Never fails — always returns a usable alias.
 */
export async function ensureEmailAlias(
  db: any,
  orgId: string,
  orgName: string,
): Promise<string> {
  // 1. Try to find existing active alias
  const { data: existing } = await db
    .from('email_aliases')
    .select('alias')
    .eq('organization_id', orgId)
    .eq('active', true)
    .maybeSingle();

  if (existing?.alias) return existing.alias;

  // 2. Generate and create one
  let candidate = generateAlias(orgName);
  let attempts = 0;

  while (attempts < 20) {
    const { data: taken } = await db
      .from('email_aliases')
      .select('id')
      .eq('alias', candidate)
      .maybeSingle();

    if (!taken) break;
    attempts++;
    candidate = `${generateAlias(orgName)}-${attempts}`;
  }

  // Ensure it's not reserved after suffix
  if (RESERVED_ALIASES.has(candidate)) {
    candidate = `${candidate}-hotel`;
  }

  const { error } = await db
    .from('email_aliases')
    .insert({
      organization_id: orgId,
      alias: candidate,
      active: true,
    });

  if (error) {
    // If unique constraint (race condition), try to read the one that was just created
    if (error.code === '23505') {
      const { data: retry } = await db
        .from('email_aliases')
        .select('alias')
        .eq('organization_id', orgId)
        .eq('active', true)
        .maybeSingle();
      if (retry?.alias) return retry.alias;
    }
    console.error('[ensureEmailAlias] Failed to create alias:', error.message);
    // Last resort: return a functional alias even if not saved
    return candidate;
  }

  console.log(`[ensureEmailAlias] Created alias "${candidate}" for org ${orgId}`);
  return candidate;
}
