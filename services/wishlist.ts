/**
 * Wishlist service — Phase 10.
 *
 *   ▸ Toggle (add/remove)        → SECURITY DEFINER RPC, returns new state
 *   ▸ getMy / count              → device-scoped RPC reads
 *   ▸ Module-level Set cache     → ProductCard's heart can ask "am I saved"
 *                                  in O(1) without re-querying per card.
 *   ▸ Optimistic toggle          → UI flips immediately, RPC reconciles.
 *   ▸ Realtime broadcast         → other tabs/devices update on
 *                                  postgres_changes for this device_id.
 */
import { useCallback, useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

export interface WishlistEntry {
  product_id: string;
  added_at: string;
  notes: string | null;
  name_fr: string | null;
  name_ar: string | null;
  price: number | null;
  category_id: string | null;
  is_active: boolean | null;
}

// ─── Module-level cache ────────────────────────────────────────────────

const savedSet = new Set<string>();
const subscribers = new Set<() => void>();
let primed = false;

function notify() { for (const fn of subscribers) try { fn(); } catch { /* noop */ } }

async function prime(): Promise<void> {
  if (primed) return;
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('wishlist_get_my', {
      p_device_id: deviceId,
      p_limit: 500,
    });
    if (error) throw error;
    savedSet.clear();
    for (const row of ((data ?? []) as Array<{ product_id: string }>)) savedSet.add(row.product_id);
    primed = true;
    notify();
  } catch (err) {
    console.warn('[wishlist] prime failed:', err);
  }
}

// Prime once at module load + listen to realtime per-device updates.
// We subscribe via the realtime hub so a single channel is shared
// across every Wishlist hook + button + count badge.
let realtimeReady = false;
async function ensureRealtime(): Promise<void> {
  if (realtimeReady) return;
  realtimeReady = true;
  try {
    const deviceId = await getDeviceId();
    subscribeRealtime(
      'mobile_user_wishlist',
      `device_id=eq.${deviceId}`,
      async () => {
        primed = false;
        await prime();
      },
    );
  } catch (err) {
    console.warn('[wishlist] realtime setup failed:', err);
  }
}

// ─── Public API ────────────────────────────────────────────────────────

export interface ToggleResult {
  is_saved: boolean;
  total: number;
  product_id: string;
}

export async function toggleWishlist(productId: string): Promise<ToggleResult | null> {
  // Optimistic: flip the local Set first.
  const wasSaved = savedSet.has(productId);
  if (wasSaved) savedSet.delete(productId);
  else savedSet.add(productId);
  notify();
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('wishlist_toggle', {
      p_device_id: deviceId,
      p_product_id: productId,
    });
    if (error) throw error;
    const result = (data as unknown) as ToggleResult;
    // Reconcile if server disagrees (e.g. product became inactive).
    if (result.is_saved) savedSet.add(result.product_id);
    else savedSet.delete(result.product_id);
    notify();
    return result;
  } catch (err) {
    // Rollback the optimistic flip on error.
    if (wasSaved) savedSet.add(productId);
    else savedSet.delete(productId);
    notify();
    console.warn('[wishlist] toggle failed:', err);
    return null;
  }
}

export async function getMyWishlist(): Promise<WishlistEntry[]> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('wishlist_get_my', {
      p_device_id: deviceId,
      p_limit: 500,
    });
    if (error) throw error;
    return ((data ?? []) as unknown) as WishlistEntry[];
  } catch (err) {
    console.warn('[wishlist] get_my failed:', err);
    return [];
  }
}

export async function getWishlistCount(): Promise<number> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('wishlist_count_for_me', { p_device_id: deviceId });
    if (error) throw error;
    return Number(data ?? 0);
  } catch (err) {
    console.warn('[wishlist] count failed:', err);
    return 0;
  }
}

export async function clearWishlist(): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await supabase.rpc('wishlist_clear', { p_device_id: deviceId });
    savedSet.clear();
    notify();
  } catch (err) {
    console.warn('[wishlist] clear failed:', err);
  }
}

export function isProductSaved(productId: string): boolean {
  return savedSet.has(productId);
}

// ─── React hooks ───────────────────────────────────────────────────────

/** Boolean for "is this product in my wishlist". O(1) reads via Set. */
export function useIsSaved(productId: string): boolean {
  const [saved, setSaved] = useState(() => savedSet.has(productId));
  useEffect(() => {
    void prime();
    void ensureRealtime();
    const refresh = () => setSaved(savedSet.has(productId));
    subscribers.add(refresh);
    refresh();
    return () => { subscribers.delete(refresh); };
  }, [productId]);
  return saved;
}

/** Count badge — listens to the same module Set for instant reactivity. */
export function useWishlistCount(): number {
  const [count, setCount] = useState(savedSet.size);
  useEffect(() => {
    void prime();
    void ensureRealtime();
    const refresh = () => setCount(savedSet.size);
    subscribers.add(refresh);
    refresh();
    return () => { subscribers.delete(refresh); };
  }, []);
  return count;
}

/** Full list with product detail join. Used by /wishlist screen. */
export function useWishlist(): { items: WishlistEntry[]; loading: boolean; reload: () => void } {
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const data = await getMyWishlist();
      if (cancelled) return;
      setItems(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);
  // Auto-reload on Set change (other devices/tabs).
  useEffect(() => {
    void prime();
    void ensureRealtime();
    const refresh = () => reload();
    subscribers.add(refresh);
    return () => { subscribers.delete(refresh); };
  }, [reload]);
  return { items, loading, reload };
}
