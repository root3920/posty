/**
 * Email alias utilities: generation, validation, reserved words.
 */

export const RESERVED_ALIASES = new Set([
  'admin',
  'postmaster',
  'abuse',
  'noreply',
  'no-reply',
  'soporte',
  'support',
  'info',
  'posty',
  'security',
  'billing',
  'help',
  'webmaster',
  'hostmaster',
  'mailer-daemon',
  'root',
  'system',
  'test',
  'mail',
  'email',
  'contact',
  'contacto',
  'ventas',
  'sales',
]);

/** Alias format: 3-40 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens */
const ALIAS_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Validate an alias string.
 * Returns `null` if valid, or an error message in Spanish if invalid.
 */
export function validateAlias(alias: string): string | null {
  if (!alias) {
    return 'El alias no puede estar vacío';
  }

  if (alias.length < 3) {
    return 'El alias debe tener al menos 3 caracteres';
  }

  if (alias.length > 40) {
    return 'El alias no puede tener más de 40 caracteres';
  }

  if (!ALIAS_REGEX.test(alias)) {
    return 'Solo se permiten letras minúsculas, números y guiones. No puede empezar ni terminar con guión';
  }

  if (alias.includes('--')) {
    return 'No se permiten dos guiones seguidos';
  }

  if (RESERVED_ALIASES.has(alias)) {
    return `"${alias}" es una palabra reservada y no se puede usar como alias`;
  }

  return null;
}

/**
 * Generate an alias from a hotel/organization name.
 *
 * Examples:
 *   "Hotel La Gran Playa" → "hotel-la-gran-playa"
 *   "POSTY HOTEL & SPA"  → "posty-hotel-spa"
 *   "Café Montaña 123"   → "cafe-montana-123"
 */
export function generateAlias(orgName: string): string {
  let slug = orgName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')    // remove non-alphanumeric except space/hyphen
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '');          // trim hyphens

  // Ensure minimum length
  if (slug.length < 3) {
    slug = slug.padEnd(3, '0');
  }

  // Truncate to max length
  if (slug.length > 40) {
    slug = slug.slice(0, 40).replace(/-$/, '');
  }

  // If it ends up being reserved, append a number
  if (RESERVED_ALIASES.has(slug)) {
    slug = `${slug}-1`;
  }

  return slug;
}

/**
 * Parse an incoming email address to extract the alias and optional token.
 *
 * Examples:
 *   "hotel-sol@mail.postyassistant.com"       → { alias: "hotel-sol", token: null }
 *   "hotel-sol+abc123@mail.postyassistant.com" → { alias: "hotel-sol", token: "abc123" }
 *   "other@gmail.com"                          → null
 */
export function parseRecipientAddress(
  address: string,
  domain: string,
): { alias: string; token: string | null } | null {
  const atIdx = address.lastIndexOf('@');
  if (atIdx === -1) return null;

  const recipientDomain = address.slice(atIdx + 1).toLowerCase();
  if (recipientDomain !== domain.toLowerCase()) return null;

  const localPart = address.slice(0, atIdx).toLowerCase();
  const plusIdx = localPart.indexOf('+');

  if (plusIdx === -1) {
    return { alias: localPart, token: null };
  }

  return {
    alias: localPart.slice(0, plusIdx),
    token: localPart.slice(plusIdx + 1) || null,
  };
}
