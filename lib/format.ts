import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Format a number as currency.
 * COP: "$ 810.000" (no decimals). USD: "$810.00".
 */
export function formatCurrency(
  amount: number,
  currency: string = 'COP',
  locale: string = 'es-CO',
): string {
  const decimals = currency === 'COP' ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format a number with locale-aware separators.
 */
export function formatNumber(value: number, locale: string = 'es-CO'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format a percentage with comma decimal: "1,3 %" / "100,0 %".
 */
export function formatPercent(value: number, decimals: number = 1, locale: string = 'es-CO'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format a date for display: "27 sep 2026".
 */
export function formatDate(date: Date | string, pattern: string = 'd MMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, pattern, { locale: es });
}

/**
 * Format a date range: "1 – 30 sep 2026" or "28 sep – 5 oct 2026".
 */
export function formatDateRange(from: Date | string, to: Date | string): string {
  const f = typeof from === 'string' ? new Date(from) : from;
  const t = typeof to === 'string' ? new Date(to) : to;

  const sameMonth = f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();

  if (sameMonth) {
    return `${format(f, 'd', { locale: es })} – ${format(t, 'd MMM yyyy', { locale: es })}`;
  }

  const sameYear = f.getFullYear() === t.getFullYear();
  if (sameYear) {
    return `${format(f, 'd MMM', { locale: es })} – ${format(t, 'd MMM yyyy', { locale: es })}`;
  }

  return `${format(f, 'd MMM yyyy', { locale: es })} – ${format(t, 'd MMM yyyy', { locale: es })}`;
}
