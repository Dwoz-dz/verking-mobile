/**
 * userPreferences — mobile-side wrapper around `prefs_get_my` /
 * `prefs_set_my` SECURITY DEFINER RPCs.
 *
 * Why a dedicated service:
 *   ▸ Networking helpers + AsyncStorage cache live in one place so
 *     consumers (network policy, settings screen, theme backdrop)
 *     all share a single source of truth.
 *   ▸ Cache is read-through: first call hits Supabase, subsequent
 *     calls return the cached snapshot until something writes.
 *   ▸ Optimistic write: `setPreference()` updates the cache + every
 *     subscriber synchronously, then persists in the background.
 *
 * Defaults match the RPC's "no row" branch so a cold launch doesn't
 * have to await the network before the home screen can paint.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { supabase } from '@/lib/supabase/client';

export type DarkMode = 'light' | 'dark' | 'system';
export type VideoAutoplayPref = 'always' | 'wifi_only' | 'never';
export type LanguagePref = 'fr' | 'ar' | 'en';

export interface UserPreferences {
  language: LanguagePref;
  dark_mode: DarkMode;
  notification_orders: boolean;
  notification_promos: boolean;
  notification_loyalty: boolean;
  data_saver_mode: boolean;
  video_autoplay: VideoAutoplayPref;
  default_wilaya_code: string | null;
  family_mode_enabled: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'fr',
  dark_mode: 'system',
  notification_orders: true,
  notification_promos: true,
  notification_loyalty: true,
  data_saver_mode: false,
  video_autoplay: 'wifi_only',
  default_wilaya_code: null,
  family_mode_enabled: false,
};

const CACHE_KEY = 'verking:user_preferences:v1';

let cached: UserPreferences | null = null;
const subscribers = new Set<(prefs: UserPreferences) => void>();

function notify(prefs: UserPreferences) {
  for (const fn of subscribers) {
    try { fn(prefs); } catch { /* keep loop alive */ }
  }
}

async function readCacheOrDisk(): Promise<UserPreferences | null> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    cached = { ...DEFAULT_PREFERENCES, ...parsed };
    return cached;
  } catch {
    return null;
  }
}

async function persistCache(prefs: UserPreferences): Promise<void> {
  cached = prefs;
  notify(prefs);
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(prefs));
  } catch {
    /* AsyncStorage is best-effort */
  }
}

function normalisePrefs(input: unknown): UserPreferences {
  if (!input || typeof input !== 'object') return DEFAULT_PREFERENCES;
  const r = input as Record<string, unknown>;
  return {
    language: (r.language === 'ar' || r.language === 'en' || r.language === 'fr')
      ? r.language : DEFAULT_PREFERENCES.language,
    dark_mode: (r.dark_mode === 'light' || r.dark_mode === 'dark' || r.dark_mode === 'system')
      ? r.dark_mode : DEFAULT_PREFERENCES.dark_mode,
    notification_orders: r.notification_orders === false ? false : true,
    notification_promos: r.notification_promos === false ? false : true,
    notification_loyalty: r.notification_loyalty === false ? false : true,
    data_saver_mode: r.data_saver_mode === true,
    video_autoplay: (r.video_autoplay === 'always' || r.video_autoplay === 'never' || r.video_autoplay === 'wifi_only')
      ? r.video_autoplay : DEFAULT_PREFERENCES.video_autoplay,
    default_wilaya_code: typeof r.default_wilaya_code === 'string' && r.default_wilaya_code.length > 0
      ? r.default_wilaya_code
      : null,
    family_mode_enabled: r.family_mode_enabled === true,
  };
}

export async function getUserPreferences(): Promise<UserPreferences> {
  const fromCache = await readCacheOrDisk();
  if (fromCache) {
    // Refresh in the background so the next call sees fresh data.
    void refreshFromServer();
    return fromCache;
  }
  // No local cache — synchronously hit the server, but still return
  // defaults if it fails (network down on cold launch).
  const fresh = await refreshFromServer();
  return fresh ?? DEFAULT_PREFERENCES;
}

async function refreshFromServer(): Promise<UserPreferences | null> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('prefs_get_my', { p_device_id: deviceId });
    if (error) {
      console.warn('[prefs] get rpc failed:', error.message);
      return null;
    }
    const wrapper = data as { ok?: boolean; prefs?: unknown } | null;
    if (!wrapper?.ok) return null;
    const prefs = normalisePrefs(wrapper.prefs);
    await persistCache(prefs);
    return prefs;
  } catch (err) {
    console.warn('[prefs] refresh crashed:', err);
    return null;
  }
}

export async function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): Promise<void> {
  const current = (await readCacheOrDisk()) ?? DEFAULT_PREFERENCES;
  const next: UserPreferences = { ...current, [key]: value };
  // Optimistic — push the value to subscribers + disk before the
  // server round-trip so the UI feels instant.
  await persistCache(next);
  try {
    const deviceId = await getDeviceId();
    const { error } = await supabase.rpc('prefs_set_my', {
      p_device_id: deviceId,
      p_patch: { [key]: value },
    });
    if (error) console.warn('[prefs] set rpc failed:', error.message);
  } catch (err) {
    console.warn('[prefs] set crashed:', err);
  }
}

export function subscribePreferences(fn: (prefs: UserPreferences) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/**
 * useUserPreferences — fetch the device's prefs once on mount, then
 * refresh whenever the cache changes. While the server is in flight,
 * cached/disk values are returned so the UI never stalls.
 */
export function useUserPreferences(): UserPreferences {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initial = await getUserPreferences();
      if (!cancelled) setPrefs(initial);
    })();
    const unsubscribe = subscribePreferences((next) => {
      if (!cancelled) setPrefs(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return prefs;
}
