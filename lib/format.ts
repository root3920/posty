/**
 * Format a number as currency using Intl.NumberFormat.
 * Uses the organization's currency and locale.
 */
export function formatCurrency(
  amount: number,
  currency: string = 'COP',
  locale: string = 'es-CO',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number with locale-aware separators.
 */
export function formatNumber(value: number, locale: string = 'es-CO'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format a percentage value.
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
