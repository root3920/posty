import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

// -------------------------------------------------------
// Phone schemas
// -------------------------------------------------------

/**
 * Optional phone field. Accepts empty/null/undefined. Validates if a value is present.
 */
export const phoneSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true;
      try {
        return isValidPhoneNumber(val);
      } catch {
        return false;
      }
    },
    { message: 'Número de teléfono inválido' },
  );

/**
 * Required phone field. Must be a valid E.164 phone number.
 */
export const phoneRequiredSchema = z
  .string()
  .min(1, 'El teléfono es obligatorio')
  .refine(
    (val) => {
      try {
        return isValidPhoneNumber(val);
      } catch {
        return false;
      }
    },
    { message: 'Número de teléfono inválido' },
  );

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export type PhoneSchemaType = z.infer<typeof phoneSchema>;
export type PhoneRequiredSchemaType = z.infer<typeof phoneRequiredSchema>;

// -------------------------------------------------------
// Utilities
// -------------------------------------------------------

/**
 * Tries to parse a phone number string and return it in E.164 format.
 * If the input is already E.164, it is returned as-is.
 * Returns null if parsing fails or the number is invalid.
 */
export function normalizeToE164(phone: string, defaultCountry: string): string | null {
  if (!phone || phone.trim() === '') return null;

  try {
    const parsed = parsePhoneNumber(phone, defaultCountry as CountryCode);
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164');
    }
    return null;
  } catch {
    return null;
  }
}
