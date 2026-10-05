/**
 * Parses a string like "101-110, 205, 509, 1911" into an array of room entries.
 * Each entry has a number (string) and an auto-inferred floor (string).
 */

export interface ParsedRoom {
  number: string;
  floor: string;
  rateOverride?: number | null;
}

export interface ParseResult {
  rooms: ParsedRoom[];
  errors: string[];
}

/**
 * Infer floor from room number:
 * - 101 → floor "1" (digits before the last two)
 * - 509 → floor "5"
 * - 1911 → floor "19"
 * - 12 → floor "0" (less than 3 digits)
 */
export function inferFloor(num: number): string {
  if (num < 100) return '0';
  return Math.floor(num / 100).toString();
}

/**
 * Parse a room number input string.
 * Accepts: "101-110, 205, 509, 1911"
 * Returns parsed rooms and any validation errors.
 */
export function parseRoomNumbers(
  input: string,
  existingNumbers?: Set<string>,
): ParseResult {
  const rooms: ParsedRoom[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!input.trim()) {
    return { rooms, errors };
  }

  // Accept comma, semicolon, space, and newline as separators
  const segments = input.split(/[,;\s\n]+/).map((s) => s.trim()).filter(Boolean);

  for (const segment of segments) {
    if (segment.includes('-')) {
      // Range: "101-110"
      const parts = segment.split('-').map((p) => p.trim());
      if (parts.length !== 2) {
        errors.push(`Rango inválido: "${segment}"`);
        continue;
      }

      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);

      if (isNaN(start) || isNaN(end)) {
        errors.push(`Rango inválido: "${segment}" — usa solo números`);
        continue;
      }

      if (end < start) {
        errors.push(`Rango invertido: "${segment}" — el inicio debe ser menor que el final`);
        continue;
      }

      if (end - start + 1 > 200) {
        errors.push(`Rango demasiado grande: "${segment}" — máximo 200 habitaciones por rango`);
        continue;
      }

      for (let n = start; n <= end; n++) {
        const numStr = n.toString();
        if (seen.has(numStr)) {
          errors.push(`Número duplicado: ${numStr}`);
          continue;
        }
        if (existingNumbers?.has(numStr)) {
          errors.push(`La habitación ${numStr} ya existe`);
          continue;
        }
        seen.add(numStr);
        rooms.push({ number: numStr, floor: inferFloor(n) });
      }
    } else {
      // Single number: "205"
      const num = parseInt(segment, 10);
      if (isNaN(num)) {
        errors.push(`Número inválido: "${segment}"`);
        continue;
      }
      if (num <= 0) {
        errors.push(`El número de habitación debe ser mayor que 0: "${segment}"`);
        continue;
      }

      const numStr = num.toString();
      if (seen.has(numStr)) {
        errors.push(`Número duplicado: ${numStr}`);
        continue;
      }
      if (existingNumbers?.has(numStr)) {
        errors.push(`La habitación ${numStr} ya existe`);
        continue;
      }
      seen.add(numStr);
      rooms.push({ number: numStr, floor: inferFloor(num) });
    }
  }

  return { rooms, errors };
}
