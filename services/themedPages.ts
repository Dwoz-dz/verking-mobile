/**
 * Themed pages service — admin-curated landing pages with hero +
 * JSONB sections.
 *
 * The `useActiveThemedPages()` hook drives the Home strip (one pill
 * per page). The `useThemedPage(slug)` hook drives the dedicated
 * `/page/[slug]` screen. RLS auto-filters expired/inactive rows so
 * the mobile never shows a stale page.
 *
 * Section types the renderer currently understands:
 *   ▸ banner       — image + title + link
 *   ▸ products     — filtered product grid (limit, category_id, …)
 *   ▸ rail         — explicit product_ids[]
 *   ▸ coupons      — claimable coupon list (filterable by ids)
 *   ▸ flash_sales  — active flash sales (uses Phase 4 service)
 *
 * Unknown section types are silently skipped.
 */
import { useEffect, useState } from 'react';

import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

// ─── Section schemas ───────────────────────────────────────────────────

export type ThemedSection =
  | { type: 'banner'; title_fr?: string | null; title_ar?: string | null; image?: string | null; link?: string | null }
  | { type: 'products'; title_fr?: string | null; title_ar?: string | null; filter?: { category_id?: string; tag?: string; level?: string; limit?: number } }
  | { type: 'rail'; title_fr?: string | null; title_ar?: string | null; product_ids?: string[] }
  | { type: 'coupons'; title_fr?: string | null; title_ar?: string | null; coupon_ids?: string[] }
  | { type: 'flash_sales'; title_fr?: string | null; title_ar?: string | null }
  | { type: string; [k: string]: unknown };

export interface ThemedPageRow {
  id: string;
  slug: string;
  title_fr: string;
  title_ar: string;
  tab_emoji: string | null;
  tab_color: string | null;
  hero_banner_image: string | null;
  hero_title_fr: string | null;
  hero_title_ar: string | null;
  hero_subtitle_fr: string | null;
  hero_subtitle_ar: string | null;
  hero_countdown_ends_at: string | null;
  hero_cta_label_fr: string | null;
  hero_cta_label_ar: string | null;
  hero_cta_link: string | null;
  sections: ThemedSection[];
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  target_wilayas: string[] | null;
}

const SELECT_COLS =
  'id,slug,title_fr,title_ar,tab_emoji,tab_color,' +
  'hero_banner_image,hero_title_fr,hero_title_ar,hero_subtitle_fr,hero_subtitle_ar,' +
  'hero_countdown_ends_at,hero_cta_label_fr,hero_cta_label_ar,hero_cta_link,' +
  'sections,sort_order,starts_at,ends_at,target_wilayas';

export async function getActiveThemedPages(): Promise<ThemedPageRow[]> {
  const { data, error } = await supabase
    .from('mobile_themed_pages')
    .select(SELECT_COLS)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[themedPages] fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as ThemedPageRow[];
}

export async function getThemedPageBySlug(slug: string): Promise<ThemedPageRow | null> {
  const { data, error } = await supabase
    .from('mobile_themed_pages')
    .select(SELECT_COLS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.warn('[themedPages] slug fetch failed:', error);
    return null;
  }
  return data ? (((data as unknown) as ThemedPageRow)) : null;
}

export function useActiveThemedPages(): { pages: ThemedPageRow[]; loading: boolean } {
  const [pages, setPages] = useState<ThemedPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await getActiveThemedPages();
      if (!cancelled) {
        setPages(list);
        setLoading(false);
      }
    })();
    // Realtime via hub — admin updates propagate without an app restart.
    const unsub = subscribeRealtime('mobile_themed_pages', undefined, async () => {
      const fresh = await getActiveThemedPages();
      if (!cancelled) setPages(fresh);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [globalTick]);

  return { pages, loading };
}

export function useThemedPage(slug: string | undefined | null): { page: ThemedPageRow | null; loading: boolean } {
  const [page, setPage] = useState<ThemedPageRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setPage(null); setLoading(false); return; }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const row = await getThemedPageBySlug(slug);
      if (!cancelled) {
        setPage(row);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return { page, loading };
}
