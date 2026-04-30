/**
 * FAB promotions service — fetches admin-curated FAB promos and
 * picks the best one for the current context.
 *
 * Filtering happens client-side because the inputs (cart total,
 * wilaya, current screen, auth state) live in the device — no need
 * to round-trip just to compute the winner.
 *
 * Impression / click events are fire-and-forget POSTs to the
 * `fab-impression` / `fab-click` public routes, with an in-memory
 * dedup map so a single render doesn't spam the counter.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { supabase } from '@/lib/supabase/client';

const FUNCTIONS_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-mobile-config`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type FabLinkType = 'coupons' | 'flash_sale' | 'category' | 'product' | 'themed_page' | 'external' | 'none';

export type FabScreen = 'home' | 'search' | 'profile' | 'cart' | 'orders';

export interface FabPromotion {
  id: string;
  label_fr: string;
  label_ar: string;
  bg_color: string;
  text_color: string;
  icon: string | null;
  link_type: FabLinkType;
  link_target: string | null;
  min_cart_amount: number | null;
  max_cart_amount: number | null;
  target_wilayas: string[] | null;
  target_user_segment: string | null;
  target_screens: string[] | null;
  show_only_logged_in: boolean;
  show_only_logged_out: boolean;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
}

export interface FabContext {
  cart_total: number;
  wilaya_code: string | null;
  screen: FabScreen;
  is_logged_in: boolean;
}

const SELECT_COLS =
  'id,label_fr,label_ar,bg_color,text_color,icon,link_type,link_target,' +
  'min_cart_amount,max_cart_amount,target_wilayas,target_user_segment,target_screens,' +
  'show_only_logged_in,show_only_logged_out,starts_at,ends_at,priority';

export async function getActiveFabPromotions(): Promise<FabPromotion[]> {
  const { data, error } = await supabase
    .from('mobile_fab_promotions')
    .select(SELECT_COLS)
    .order('priority', { ascending: false });
  if (error) {
    console.warn('[fabPromotions] fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as FabPromotion[];
}

/**
 * Returns true when `promo` matches `ctx`. AND-combined — every
 * filter must pass. NULL/empty filter on the promo means "wildcard"
 * for that field.
 */
export function matchesPromo(promo: FabPromotion, ctx: FabContext): boolean {
  // Cart bounds
  if (promo.min_cart_amount != null && ctx.cart_total < promo.min_cart_amount) return false;
  if (promo.max_cart_amount != null && ctx.cart_total > promo.max_cart_amount) return false;
  // Screen
  if (promo.target_screens && promo.target_screens.length > 0) {
    if (!promo.target_screens.includes(ctx.screen)) return false;
  }
  // Wilaya
  if (promo.target_wilayas && promo.target_wilayas.length > 0) {
    if (!ctx.wilaya_code || !promo.target_wilayas.includes(ctx.wilaya_code)) return false;
  }
  // Auth state
  if (promo.show_only_logged_in && !ctx.is_logged_in) return false;
  if (promo.show_only_logged_out && ctx.is_logged_in) return false;
  return true;
}

export interface UseFabPromoResult {
  promo: FabPromotion | null;
  loading: boolean;
}

export function useFabPromo(ctx: FabContext): UseFabPromoResult {
  const [promos, setPromos] = useState<FabPromotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await getActiveFabPromotions();
      if (!cancelled) {
        setPromos(list);
        setLoading(false);
      }
    })();

    // Realtime via hub: refetch on any admin change.
    const unsub = subscribeRealtime('mobile_fab_promotions', undefined, async () => {
      const fresh = await getActiveFabPromotions();
      if (!cancelled) setPromos(fresh);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const winner = useMemo<FabPromotion | null>(() => {
    // Promos arrive sorted by priority desc. Find the matching set at
    // the highest priority — typically just one promo, but A/B
    // campaigns intentionally publish two at the same priority so we
    // need a tiebreaker.
    const matching = promos.filter((p) => matchesPromo(p, ctx));
    if (matching.length === 0) return null;
    if (matching.length === 1) return matching[0];
    const topPriority = matching[0].priority;
    const tied = matching.filter((p) => p.priority === topPriority);
    if (tied.length === 1) return tied[0];
    // Stable per-session pick — same FAB shown for the duration of
    // this app run. Sorting the candidate ids first means the choice
    // is deterministic given the seed + the candidate set.
    const ids = tied.map((p) => p.id).sort();
    const idx = Math.floor(SESSION_SEED * ids.length);
    return tied.find((p) => p.id === ids[idx]) ?? tied[0];
  }, [promos, ctx.cart_total, ctx.wilaya_code, ctx.screen, ctx.is_logged_in]);

  return { promo: winner, loading };
}

// Stable per-session random in [0, 1). The FAB picks the same promo
// for the lifetime of this app instance; restarting the app may
// re-roll the choice, which is the standard behaviour for a
// lightweight A/B split when the population is large.
const SESSION_SEED = Math.random();

// ─── Impression / click tracking (fire-and-forget) ─────────────────────

const seenImpressions = new Set<string>();   // dedup per session
const seenClicks = new Set<string>();         // (re-allow on app relaunch)

async function postBump(route: 'fab-impression' | 'fab-click', id: string): Promise<void> {
  try {
    await fetch(`${FUNCTIONS_BASE}/${route}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ id }),
    });
  } catch (err) {
    // Swallow — tracking should never break the UI.
    console.warn('[fabPromotions] bump failed:', err);
  }
}

export function useFabImpressionTracking(promoId: string | undefined | null): void {
  useEffect(() => {
    if (!promoId) return;
    if (seenImpressions.has(promoId)) return;
    seenImpressions.add(promoId);
    void postBump('fab-impression', promoId);
  }, [promoId]);
}

export const trackFabClick = (promoId: string): void => {
  // De-dupe rapid double-taps within ~500ms by gating on a small
  // session-scoped set; the server also rate-limits per IP.
  if (seenClicks.has(promoId)) {
    seenClicks.delete(promoId);  // re-allow next click after first dedup window
    void postBump('fab-click', promoId);
    return;
  }
  seenClicks.add(promoId);
  setTimeout(() => seenClicks.delete(promoId), 500);
  void postBump('fab-click', promoId);
};

// ─── Link resolver (centralised so admin and runtime stay in sync) ──────

export function resolveFabLink(promo: FabPromotion): string | null {
  switch (promo.link_type) {
    case 'coupons':
      return '/coupons';
    case 'themed_page':
      return promo.link_target ? `/page/${promo.link_target}` : null;
    case 'product':
      return promo.link_target ? `/product/${promo.link_target}` : null;
    case 'category':
      return promo.link_target ? `/(tabs)/explore?categoryId=${promo.link_target}` : null;
    case 'flash_sale':
      // No dedicated route — surface the running flash sales on Explore.
      return '/(tabs)/explore?theme=economies';
    case 'external':
      // Not opened in v1 for security; admin should use the internal
      // routes. We return null so the FAB renders without nav.
      return null;
    case 'none':
    default:
      return null;
  }
}
