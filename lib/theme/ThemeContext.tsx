/**
 * ThemeContext — runtime theme controller.
 *
 * Holds the chosen mode ('light' | 'dark' | 'amoled' | 'system'),
 * persists it to AsyncStorage AND mirrors it onto
 * `user_preferences.theme_mode` via the existing `prefs_set_my` RPC,
 * so the same device sees the same theme on the web admin's preview
 * pane and across reinstalls.
 *
 * Resolution rules:
 *   • mode = 'system' → resolve to 'light' or 'dark' based on OS
 *     `useColorScheme()` (RN). AMOLED is opt-in only.
 *   • Any other mode wins over the OS choice.
 *
 * Consumers: `useThemedBrand()` returns the active palette object.
 * Anything that already imports `Brand` from `@/constants/theme`
 * keeps the LIGHT palette as a fallback for non-themed code paths.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { getDeviceId } from '@/lib/deviceId';
import { safeStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';

import { paletteFor, type BrandPalette, type ThemeMode } from './palettes';

const STORAGE_KEY = 'vk:theme:mode';

export type ThemePreference = ThemeMode | 'system';

interface ThemeContextValue {
  /** What the user picked, including 'system'. */
  preference: ThemePreference;
  /** Resolved mode after applying 'system' → OS lookup. */
  effective: ThemeMode;
  /** Active palette for the resolved mode. */
  palette: BrandPalette;
  /** Convenience flags. */
  isDark: boolean;
  isAmoled: boolean;
  /** Set + persist the user's choice. Returns immediately. */
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const osScheme = useRNColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from local storage first (instant), then reconcile with
  // the server (last-write-wins on the user's device).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cached = await safeStorage.getItem(STORAGE_KEY);
        if (cached && !cancelled && isThemePreference(cached)) {
          setPreferenceState(cached);
        }
      } catch { /* noop */ }
      try {
        const deviceId = await getDeviceId();
        const { data } = await supabase
          .from('user_preferences')
          .select('theme_mode')
          .eq('device_id', deviceId)
          .maybeSingle();
        const remote = (data?.theme_mode as string | undefined) ?? null;
        if (remote && isThemePreference(remote) && !cancelled) {
          setPreferenceState(remote);
          await safeStorage.setItem(STORAGE_KEY, remote);
        }
      } catch { /* offline / first launch — ignore */ }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void (async () => {
      try {
        await safeStorage.setItem(STORAGE_KEY, next);
        const deviceId = await getDeviceId();
        await supabase
          .from('user_preferences')
          .upsert({ device_id: deviceId, theme_mode: next, updated_at: new Date().toISOString() })
          .eq('device_id', deviceId);
      } catch (err) {
        console.warn('[theme] persist failed:', err);
      }
    })();
  }, []);

  const effective: ThemeMode = useMemo(() => {
    if (preference === 'system') {
      return osScheme === 'dark' ? 'dark' : 'light';
    }
    return preference;
  }, [preference, osScheme]);

  const palette = useMemo(() => paletteFor(effective), [effective]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      effective,
      palette,
      isDark: effective !== 'light',
      isAmoled: effective === 'amoled',
      setPreference,
    }),
    [preference, effective, palette, setPreference],
  );

  // Don't gate render on hydration — first paint uses 'system' default
  // which matches OS, then settles onto the user's saved choice. This
  // avoids a flash of blank content during the AsyncStorage round-trip.
  void hydrated;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used inside <ThemeProvider>.');
  }
  return ctx;
}

/**
 * Convenience hook — most components only need the colour palette.
 * Falls back to the LIGHT_PALETTE if called outside the provider, so
 * legacy screens that haven't been migrated still render correctly.
 */
export function useThemedBrand(): BrandPalette {
  const ctx = useContext(ThemeContext);
  return ctx?.palette ?? paletteFor('light');
}

function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'amoled' || v === 'system';
}
