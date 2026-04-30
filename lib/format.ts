/**
 * Display helpers — currency, numbers, etc.
 */
const numberFormatter = new Intl.NumberFormat('fr-FR');

export const CURRENCY = 'DA';

export function formatPrice(amount: number | null | undefined, currency = CURRENCY): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `${numberFormatter.format(Math.round(amount))} ${currency}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return numberFormatter.format(value);
}
