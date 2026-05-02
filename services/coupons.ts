/**
 * Coupons service — wraps the public routes of `admin-mobile-config`.
 *
 * Three flows:
 *   1. Public catalogue       — read directly via supabase-js + RLS
 *      (anon SELECT on mobile_coupons is filtered to active+claimable
 *      rows whose validity window is open).
 *   2. Wallet (claim / list)  — round-trip through the edge function so
 *      the device_id ownership is enforced server-side with the
 *      service-role key.
 *   3. Best-coupon engine     — server-side selection used at checkout.
 *
 * Cache: claimable list is cached for 60s in mobileConfig's scoped
 * cache (key: 'coupons_claimable'). Wallet is fetched on-demand
 * because it's small and tied to the device id.
 */
import { useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

const FUNCTIONS_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-mobile-config`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ─── Types ─────────────────────────────────────────────────────────────

export type CouponDiscountType = 'percent' | 'fixed' | 'free_shipping';

export interface CouponRow {
  id: string;
  code: string;
  title_fr: string;
  title_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  discount_type: CouponDiscountType;
  value: number;
  max_discount: number | null;
  min_cart_amount: number;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_user: number;
  target_wilayas: string[] | null;
  banner_image: string | null;
  display_priority: number;
  is_claimable: boolean;
  is_auto_applicable: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface UserCouponRow {
  id: string;
  coupon_id: string;
  claimed_at: string;
  used_at: string | null;
  used_in_order_id: string | null;
  coupon: CouponRow;
}

export interface BestCouponResult {
  coupon_id: string;
  code: string;
  discount: number;
  type: CouponDiscountType;
}

export interface BestCouponResponse {
  best: BestCouponResult | null;
  alternatives: BestCouponResult[];
}

interface OkBody { ok: true; [k: string]: unknown }
interface ErrBody { ok: false; code: string; error: string }

// Soft error class so callers can decide whether the 401/4xx is
// actually worth surfacing. Cold-start blips on the gateway and missing
// device records both produce noisy logs that aren't actionable.
class TransientApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'TransientApiError';
  }
}

async function callPublic<T extends OkBody>(route: string, body: unknown): Promise<T> {
  // Audit fix: explicit env-var guard. If the bundle was built
  // without EXPO_PUBLIC_SUPABASE_ANON_KEY (broken CI, missing .env),
  // the previous code sent `Bearer ` (empty) which 401s at the
  // gateway with a confusing log. Fail fast with a clear message.
  if (!ANON_KEY || !process.env.EXPO_PUBLIC_SUPABASE_URL) {
    throw new Error('Supabase env not configured (anon key missing).');
  }
  const res = await fetch(`${FUNCTIONS_BASE}/${route}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  let parsed: T | ErrBody | null = null;
  try {
    parsed = (await res.json()) as T | ErrBody;
  } catch {
    // Body wasn't JSON — likely a gateway-level 4xx/5xx with HTML/text body.
    throw new TransientApiError(`Réponse invalide (HTTP ${res.status}).`, res.status);
  }
  if (!res.ok || !parsed || !('ok' in parsed) || !parsed.ok) {
    const e = parsed as ErrBody | null;
    throw new TransientApiError(e?.error ?? `Échec (HTTP ${res.status}).`, res.status);
  }
  return parsed;
}

// ─── Public catalogue ───────────────────────────────────────────────────

export const COUPON_COLUMNS =
  'id,code,title_fr,title_ar,description_fr,description_ar,' +
  'discount_type,value,max_discount,min_cart_amount,' +
  'max_uses,uses_count,max_uses_per_user,target_wilayas,' +
  'banner_image,display_priority,is_claimable,is_auto_applicable,' +
  'starts_at,ends_at';

export async function getClaimableCoupons(): Promise<CouponRow[]> {
  const { data, error } = await supabase
    .from('mobile_coupons')
    .select(COUPON_COLUMNS)
    .order('display_priority', { ascending: false });
  if (error) {
    console.warn('[coupons] catalogue fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as CouponRow[];
}

export function useClaimableCoupons(): { coupons: CouponRow[]; loading: boolean; reload: () => void } {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await getClaimableCoupons();
      if (!cancelled) {
        setCoupons(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);

  return { coupons, loading, reload: () => setTick((t) => t + 1) };
}

// ─── Wallet ─────────────────────────────────────────────────────────────

export async function claimCoupon(code: string): Promise<{ already_claimed: boolean; coupon_id: string }> {
  const deviceId = await getDeviceId();
  const res = await callPublic<OkBody & { already_claimed: boolean; coupon_id: string }>(
    'coupon-claim',
    { code: code.trim().toUpperCase(), device_id: deviceId },
  );
  return { already_claimed: !!res.already_claimed, coupon_id: String(res.coupon_id ?? '') };
}

export async function listMyCoupons(): Promise<UserCouponRow[]> {
  const deviceId = await getDeviceId();
  try {
    const res = await callPublic<OkBody & { coupons: UserCouponRow[] }>(
      'coupon-list-mine',
      { device_id: deviceId },
    );
    return res.coupons ?? [];
  } catch (err) {
    // Audit fix: 401/transient errors are expected for guest devices
    // before they've claimed any coupon (the route is rate-limited at
    // the gateway level and may briefly cold-start). Don't pollute the
    // logs with a warning for these — the empty array fallback is the
    // correct UX. Real errors (5xx, malformed responses) still log.
    if (err instanceof TransientApiError && (err.status === 401 || err.status === 404)) {
      // silent: guest device with no coupons yet
    } else {
      console.warn('[coupons] wallet fetch failed:', err);
    }
    return [];
  }
}

export function useMyCoupons(): { wallet: UserCouponRow[]; loading: boolean; reload: () => void } {
  const [wallet, setWallet] = useState<UserCouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await listMyCoupons();
      if (!cancelled) {
        setWallet(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);

  return { wallet, loading, reload: () => setTick((t) => t + 1) };
}

// ─── Best-coupon engine ─────────────────────────────────────────────────

export interface BestCouponInput {
  subtotal: number;
  wilaya?: string | null;
  items?: { product_id?: string; category_id?: string; unit_price: number; quantity: number }[];
}

export async function findBestCoupon(input: BestCouponInput): Promise<BestCouponResponse> {
  const deviceId = await getDeviceId();
  try {
    const res = await callPublic<OkBody & BestCouponResponse>('coupon-best', {
      device_id: deviceId,
      subtotal: input.subtotal,
      wilaya: input.wilaya ?? null,
      items: input.items ?? [],
    });
    return { best: res.best, alternatives: res.alternatives ?? [] };
  } catch (err) {
    console.warn('[coupons] best-coupon failed:', err);
    return { best: null, alternatives: [] };
  }
}
