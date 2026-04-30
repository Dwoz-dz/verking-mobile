/**
 * Smart empty states — admin-curated copy + smart-surface flags per
 * screen.
 *
 * Each row in `mobile_empty_states` is keyed by `screen_key`
 * (cart / orders / wishlist / search / …) and carries:
 *   ▸ illustration_url          (optional override for the hero art)
 *   ▸ title_fr / title_ar       headline (bilingual)
 *   ▸ subtitle_fr / subtitle_ar friendly tagline
 *   ▸ cta_primary_*             label_fr / label_ar / link
 *   ▸ cta_secondary_*           optional second CTA (same shape)
 *   ▸ show_recently_viewed      surface the recently-viewed rail
 *   ▸ show_trending             surface the trending products rail
 *   ▸ show_recommendations      surface AI / category recommendations
 *   ▸ show_referral_cta         pin a referral CTA below the empty card
 *
 * RLS allows anon SELECT, so we read the whole table once (it stays
 * tiny — one row per screen) and resolve per-screen lookups in memory.
 * Realtime keeps the cache in sync when the admin saves a change.
 */
import { useEffect, useState } from 'react';

import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { supabase } from '@/lib/supabase/client';

export interface EmptyStateRow {
  screen_key: string;
  illustration_url: string | null;
  title_fr: string | null;
  title_ar: string | null;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  cta_primary_label_fr: string | null;
  cta_primary_label_ar: string | null;
  cta_primary_link: string | null;
  cta_secondary_label_fr: string | null;
  cta_secondary_label_ar: string | null;
  cta_secondary_link: string | null;
  show_recently_viewed: boolean;
  show_trending: boolean;
  show_recommendations: boolean;
  show_referral_cta: boolean;
  is_active: boolean;
}

const SELECT_COLS =
  'screen_key,illustration_url,' +
  'title_fr,title_ar,subtitle_fr,subtitle_ar,' +
  'cta_primary_label_fr,cta_primary_label_ar,cta_primary_link,' +
  'cta_secondary_label_fr,cta_secondary_label_ar,cta_secondary_link,' +
  'show_recently_viewed,show_trending,show_recommendations,show_referral_cta,' +
  'is_active';

let cache: EmptyStateRow[] | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const fn of subscribers) {
    try { fn(); } catch { /* noop */ }
  }
}

export async function getEmptyStates(): Promise<EmptyStateRow[]> {
  if (cache) return cache;
  try {
    const { data, error } = await supabase
      .from('mobile_empty_states')
      .select(SELECT_COLS)
      .eq('is_active', true);
    if (error) throw error;
    cache = ((data ?? []) as unknown) as EmptyStateRow[];
    return cache;
  } catch (err) {
    console.warn('[emptyStates] fetch failed:', err);
    return [];
  }
}

export function invalidateEmptyStates(): void {
  cache = null;
  notify();
}

export function useEmptyState(screenKey: string): EmptyStateRow | null {
  const [row, setRow] = useState<EmptyStateRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const list = await getEmptyStates();
      if (cancelled) return;
      const found = list.find((r) => r.screen_key === screenKey) ?? null;
      setRow(found);
    };
    void refresh();
    subscribers.add(refresh);
    // One shared channel for empty_states across all screens — hub
    // dedupes per (table, filter) so 8 mounted SmartEmptyStates open
    // exactly 1 channel rather than 8.
    const unsub = subscribeRealtime('mobile_empty_states', undefined, () => {
      cache = null;
      void refresh();
    });
    return () => {
      cancelled = true;
      subscribers.delete(refresh);
      unsub();
    };
  }, [screenKey]);

  return row;
}
