/**
 * Store-settings service.
 *
 * The website/admin keeps mobile-relevant config in `store_settings` as a
 * key/value table (jsonb). The mobile app reads keys lazily and caches them
 * for the session.
 */
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/types/database';

const cache = new Map<string, Json>();

export async function getSetting<T extends Json = Json>(
  key: string,
  fallback: T | null = null,
): Promise<T | null> {
  if (cache.has(key)) return cache.get(key) as T;
  const { data, error } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.warn(`[settings] failed to read "${key}":`, error.message);
    return fallback;
  }
  const row = data as { value: Json } | null;
  const value = (row?.value ?? fallback) as T | null;
  if (value !== null && value !== undefined) cache.set(key, value as Json);
  return value;
}

export async function getSettings(keys: string[]): Promise<Record<string, Json | null>> {
  const missing = keys.filter((k) => !cache.has(k));
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from('store_settings')
      .select('key,value')
      .in('key', missing);
    if (error) {
      console.warn('[settings] failed to read keys:', error.message);
    } else {
      const rows = (data ?? []) as { key: string; value: Json }[];
      for (const row of rows) cache.set(row.key, row.value);
    }
  }
  const result: Record<string, Json | null> = {};
  for (const k of keys) result[k] = (cache.get(k) ?? null) as Json | null;
  return result;
}

export function clearSettingsCache(): void {
  cache.clear();
}

/**
 * Theme settings stored in the `theme_settings` table (single row, id = 1).
 * Used to keep the mobile app visually aligned with the website.
 */
export interface ThemeSnapshot {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  bg_color: string | null;
  card_color: string | null;
  border_color: string | null;
  logo_text: string | null;
  logo_subtitle: string | null;
}

export async function getThemeSettings(): Promise<ThemeSnapshot | null> {
  const { data, error } = await supabase
    .from('theme_settings')
    .select(
      'primary_color,secondary_color,accent_color,bg_color,card_color,border_color,logo_text,logo_subtitle',
    )
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[settings] theme_settings fetch error', error.message);
    return null;
  }
  return (data as ThemeSnapshot | null) ?? null;
}
