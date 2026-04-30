/**
 * Search service — Phase 10.
 *
 *   ▸ search_products(q)        → multilingual ranked product results via RPC
 *   ▸ trending hooks            → admin-curated chips (anon SELECT, realtime)
 *   ▸ recents (per-device)      → SECURITY DEFINER RPCs scope reads/writes
 *
 * The mobile client logs every meaningful search (manual / chip / recent
 * tap) so future analytics can spot the most-typed queries — and so the
 * "Récents" rail under the search bar stays personal to the device.
 */
import { useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { supabase } from '@/lib/supabase/client';
import { listProductsByIds } from '@/services/products';
import type { ProductWithImages } from '@/types/database';

export type SearchSource = 'manual' | 'trending' | 'recent' | 'voice' | 'barcode';

export interface SearchTrending {
  id: string;
  query: string;
  label_fr: string;
  label_ar: string;
  emoji: string | null;
  icon: string | null;
  accent_color: string;
  sort_order: number;
}

export interface SearchRecent {
  query: string;
  normalised_query: string;
  results_count: number | null;
  source: SearchSource | null;
  created_at: string;
}

export interface SearchResultRow {
  id: string;
  match_rank: number;
  name_fr: string;
  name_ar: string | null;
  price: number;
  category_id: string | null;
}

// ─── Public RPCs ───────────────────────────────────────────────────────

export async function searchProductsRanked(
  query: string,
  limit = 30,
): Promise<ProductWithImages[]> {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return [];
  const { data, error } = await supabase.rpc('search_products', {
    p_query: trimmed,
    p_limit: limit,
  });
  if (error) {
    console.warn('[search] rpc failed:', error);
    return [];
  }
  const rows = ((data ?? []) as unknown) as SearchResultRow[];
  if (rows.length === 0) return [];
  // Hydrate images / full ProductWithImages by re-fetching by id.
  const ids = rows.map((r) => r.id);
  const products = await listProductsByIds(ids);
  // Preserve RPC ranking order.
  const order = new Map(rows.map((r, i) => [r.id, i]));
  return products.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
}

export async function logSearch(
  query: string,
  resultsCount: number | null,
  source: SearchSource = 'manual',
): Promise<void> {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return;
  try {
    const deviceId = await getDeviceId();
    await supabase.rpc('search_log', {
      p_device_id: deviceId,
      p_query: trimmed,
      p_results_count: resultsCount,
      p_source: source,
    });
  } catch (err) {
    console.warn('[search] log failed (non-fatal):', err);
  }
}

export async function getRecentSearches(limit = 8): Promise<SearchRecent[]> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('search_recent_for_me', {
      p_device_id: deviceId,
      p_limit: limit,
    });
    if (error) throw error;
    return ((data ?? []) as unknown) as SearchRecent[];
  } catch (err) {
    console.warn('[search] recents fetch failed:', err);
    return [];
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await supabase.rpc('search_clear_recent', { p_device_id: deviceId });
  } catch (err) {
    console.warn('[search] clear recents failed:', err);
  }
}

// ─── Trending (anon SELECT + realtime) ─────────────────────────────────

export async function getTrendingSearches(): Promise<SearchTrending[]> {
  const { data, error } = await supabase
    .from('mobile_search_trending')
    .select('id,query,label_fr,label_ar,emoji,icon,accent_color,sort_order')
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('[search] trending fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as SearchTrending[];
}

export function useTrendingSearches(): SearchTrending[] {
  const [list, setList] = useState<SearchTrending[]>([]);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const data = await getTrendingSearches();
      if (!cancelled) setList(data);
    };
    void refresh();
    const unsub = subscribeRealtime('mobile_search_trending', undefined, () => { void refresh(); });
    return () => { cancelled = true; unsub(); };
  }, []);
  return list;
}

export function useRecentSearches(): { recents: SearchRecent[]; reload: () => void } {
  const [recents, setRecents] = useState<SearchRecent[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await getRecentSearches(8);
      if (!cancelled) setRecents(data);
    })();
    return () => { cancelled = true; };
  }, [tick]);
  return { recents, reload: () => setTick((t) => t + 1) };
}
