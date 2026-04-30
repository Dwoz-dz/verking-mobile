/**
 * Picks `${field}_${locale}` from a Supabase row with a French fallback.
 *
 * Today the website schema has `_fr` and `_ar` for products / categories /
 * banners / hero_slides etc. English fields (e.g. `name_en`) don't exist
 * yet — when an admin adds them later this helper picks them up
 * automatically with no code change.
 */
import type { AppLocale } from '@/i18n';

export function pickLocalized<T extends Record<string, unknown>>(
  row: T | null | undefined,
  field: string,
  locale: AppLocale,
  fallback: AppLocale = 'fr',
): string {
  if (!row) return '';
  const tryKey = (key: string): string | null => {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
    return null;
  };
  const direct = tryKey(`${field}_${locale}`);
  if (direct !== null) return direct;
  if (locale !== fallback) {
    const fb = tryKey(`${field}_${fallback}`);
    if (fb !== null) return fb;
  }
  // Final fallback: any other supported locale that has the field, then
  // the bare field (e.g. legacy `name` columns).
  for (const candidate of ['ar', 'en'] as const) {
    if (candidate === locale || candidate === fallback) continue;
    const v = tryKey(`${field}_${candidate}`);
    if (v !== null) return v;
  }
  const bare = tryKey(field);
  return bare ?? '';
}
