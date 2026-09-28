/**
 * Maps Supabase/Postgres error codes to user-friendly Spanish messages.
 * Use in client mutations and server actions.
 */

interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
}

const PG_ERROR_MAP: Record<string, string> = {
  '23502': 'Falta un campo obligatorio',
  '23505': 'Ya existe un registro con ese valor',
  '23503': 'El registro está en uso y no se puede modificar',
  '23514': 'El valor ingresado no es válido',
  '42501': 'No tienes permiso para realizar esta acción',
  '42703': 'Error de configuración del sistema. Ya quedó registrado; intenta de nuevo en unos minutos o contacta a soporte',
  '42804': 'Error de configuración del sistema. Ya quedó registrado; intenta de nuevo en unos minutos o contacta a soporte',
  '42883': 'Error de configuración del sistema. Ya quedó registrado; intenta de nuevo en unos minutos o contacta a soporte',
  '42P01': 'Error de configuración del sistema. Ya quedó registrado; intenta de nuevo en unos minutos o contacta a soporte',
  '22P02': 'El formato del dato ingresado no es válido',
  '22003': 'El valor numérico está fuera de rango',
  '28000': 'Error de autenticación',
  '28P01': 'Error de autenticación',
  'PGRST204': 'Error de configuración del sistema',
  'PGRST301': 'Tu sesión ha expirado, por favor recarga la página',
  'PGRST116': 'Se esperaba un único resultado pero se encontraron varios',
};

/**
 * Returns a user-facing Spanish error message from a Supabase error object.
 * Also logs the full error on the client console for debugging.
 */
export function getSupabaseErrorMessage(error: unknown, context?: string): string {
  const prefix = context ? `${context}: ` : '';
  const err = error as SupabaseError;

  if (err?.code && PG_ERROR_MAP[err.code]) {
    const mapped = PG_ERROR_MAP[err.code];

    // Enrich 23502 (NOT NULL violation) with column name if available
    if (err.code === '23502' && err.message) {
      const col = err.message.match(/column "(\w+)"/)?.[1];
      if (col) return `${prefix}Falta el campo obligatorio: ${col}`;
    }

    // Enrich 23505 (unique violation) with constraint info
    if (err.code === '23505' && err.details) {
      if (err.details.includes('name')) return `${prefix}Ya existe un registro con ese nombre`;
      if (err.details.includes('code')) return `${prefix}Ya existe un registro con ese código`;
    }

    return `${prefix}${mapped}`;
  }

  if (err?.message) {
    return `${prefix}${err.message}`;
  }

  return `${prefix}Error inesperado. Intenta de nuevo.`;
}

/**
 * Logs the full Supabase error for server-side debugging.
 */
export function logSupabaseError(error: unknown, context: string): void {
  console.error(`[Supabase Error] ${context}:`, error);
}
