/**
 * services/comingSoonConfig.ts — admin-driven placeholder + banner
 * configuration loader.
 *
 * Reads the single 'default' row from `mobile_coming_soon_config`
 * (Phase 2.1) and exposes a hook the placeholder card / banner can
 * consume directly. Realtime: the table is in the supabase_realtime
 * publication so admin edits propagate without an app restart.
 *
 * Defaults match the seed row, so callers always get a usable config
 * even on a cold network failure.
 */
import { useEffect, useState } from 'react';

import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

export interface ComingSoonConfig {
  enabled: boolean;
  banner_text_fr: string | null;
  banner_text_ar: string | null;
  banner_emoji: string;
  expected_launch_date: string | null;
  pool_titles_fr: string[];
  pool_titles_ar: string[];
  pool_emojis: string[];
  show_notify_cta: boolean;
  min_grid_slots: number;
  category_overrides: Record<string, { emoji?: string; titles?: string[] }>;
}

const DEFAULT_CONFIG: ComingSoonConfig = {
  enabled: true,
  banner_text_fr: null,
  banner_text_ar: null,
  banner_emoji: '🚀',
  expected_launch_date: null,
  pool_titles_fr: [],
  pool_titles_ar: [],
  pool_emojis: ['📦', '🚀', '🎁', '⭐', '✨', '🎉', '🆕', '💝'],
  show_notify_cta: true,
  min_grid_slots: 8,
  category_overrides: {},
};

function normalise(raw: Record<string, unknown> | null): ComingSoonConfig {
  if (!raw) return DEFAULT_CONFIG;
  return {
    enabled: raw.enabled !== false,
    banner_text_fr: typeof raw.banner_text_fr === 'string' ? raw.banner_text_fr : null,
    banner_text_ar: typeof raw.banner_text_ar === 'string' ? raw.banner_text_ar : null,
    banner_emoji: typeof raw.banner_emoji === 'string' && raw.banner_emoji ? raw.banner_emoji : '🚀',
    expected_launch_date: typeof raw.expected_launch_date === 'string' ? raw.expected_launch_date : null,
    pool_titles_fr: Array.isArray(raw.pool_titles_fr) ? (raw.pool_titles_fr as string[]) : [],
    pool_titles_ar: Array.isArray(raw.pool_titles_ar) ? (raw.pool_titles_ar as string[]) : [],
    pool_emojis: Array.isArray(raw.pool_emojis) && (raw.pool_emojis as unknown[]).length > 0
      ? (raw.pool_emojis as string[])
      : DEFAULT_CONFIG.pool_emojis,
    show_notify_cta: raw.show_notify_cta !== false,
    min_grid_slots: typeof raw.min_grid_slots === 'number' ? Math.max(0, raw.min_grid_slots) : 8,
    category_overrides:
      raw.category_overrides && typeof raw.category_overrides === 'object'
        ? (raw.category_overrides as Record<string, { emoji?: string; titles?: string[] }>)
        : {},
  };
}

export async function getComingSoonConfig(): Promise<ComingSoonConfig> {
  const { data, error } = await supabase
    .from('mobile_coming_soon_config')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  if (error) {
    console.warn('[comingSoonConfig] fetch error:', error.message);
    return DEFAULT_CONFIG;
  }
  return normalise(data as Record<string, unknown> | null);
}

export function useComingSoonConfig(): ComingSoonConfig {
  const [config, setConfig] = useState<ComingSoonConfig>(DEFAULT_CONFIG);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fresh = await getComingSoonConfig();
      if (!cancelled) setConfig(fresh);
    })();
    const unsub = subscribeRealtime('mobile_coming_soon_config', undefined, async () => {
      const fresh = await getComingSoonConfig();
      if (!cancelled) setConfig(fresh);
    });
    return () => { cancelled = true; unsub(); };
  }, [globalTick]);

  return config;
}
