/**
 * AppliedCouponContext — keeps the user's chosen coupon alive between
 * Cart and Checkout. The UI auto-suggests the best one whenever the
 * cart subtotal changes; the user can override via the alternatives
 * modal. The selection is purely client-side until checkout, where
 * `mobile-create-order` re-validates and applies it server-side.
 *
 * Persistence is intentionally session-only — when the user closes the
 * app the auto-apply runs again with whatever wallet coupons are still
 * valid, which is the expected behaviour.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { findBestCoupon, listMyCoupons, type BestCouponResult, type UserCouponRow } from '@/services/coupons';

interface AppliedCouponState {
  /** The user-coupon row id (mobile_user_coupons.id) we'll send to the server. */
  userCouponId: string | null;
  /** The coupon-row code (display only). */
  code: string | null;
  /** The discount amount in DA the engine simulated for the current cart. */
  discount: number;
  /** True when discount_type === 'free_shipping' (cart should zero shipping). */
  freeShipping: boolean;
  /** Best alternative options the engine returned (for the picker modal). */
  alternatives: BestCouponResult[];
  /** True while a refresh is in flight. */
  loading: boolean;
}

interface AppliedCouponContextValue extends AppliedCouponState {
  /** User's full wallet (post-claim, server-fetched). Used by the picker. */
  wallet: UserCouponRow[];
  /** Recompute the best coupon for the given subtotal/wilaya/items. */
  refresh: (input: { subtotal: number; wilaya: string | null; items?: { product_id?: string; category_id?: string; unit_price: number; quantity: number }[] }) => Promise<void>;
  /** User picked a specific user_coupon — overrides the auto best. */
  setUserCouponId: (id: string | null) => void;
  /** Clear after a successful order. */
  clear: () => void;
}

const AppliedCouponContext = createContext<AppliedCouponContextValue | null>(null);

export function AppliedCouponProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<UserCouponRow[]>([]);
  const [autoBest, setAutoBest] = useState<BestCouponResult | null>(null);
  const [alternatives, setAlternatives] = useState<BestCouponResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [override, setOverride] = useState<string | null>(null);

  // Latest call wins — drop stale responses if subtotal changed mid-flight.
  const inflight = useRef(0);

  // Refresh wallet on mount + when applied coupon changes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listMyCoupons();
      if (!cancelled) setWallet(list);
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async (input: { subtotal: number; wilaya: string | null; items?: { product_id?: string; category_id?: string; unit_price: number; quantity: number }[] }) => {
    if (input.subtotal <= 0) {
      setAutoBest(null);
      setAlternatives([]);
      return;
    }
    const myCallId = ++inflight.current;
    setLoading(true);
    try {
      const res = await findBestCoupon(input);
      if (myCallId === inflight.current) {
        setAutoBest(res.best);
        setAlternatives(res.alternatives);
      }
    } finally {
      if (myCallId === inflight.current) setLoading(false);
    }
  }, []);

  const value = useMemo<AppliedCouponContextValue>(() => {
    // Resolve which user_coupon is "active": the override if the user
    // picked one explicitly, else the engine's best pick.
    let userCouponId: string | null = null;
    let code: string | null = null;
    let discount = 0;
    let freeShipping = false;

    if (override) {
      const row = wallet.find((w) => w.coupon_id === override);
      if (row) {
        userCouponId = row.id;
        code = row.coupon.code;
        // Reuse the engine's discount estimate when present, else 0.
        const alt = alternatives.find((a) => a.coupon_id === override) ?? autoBest;
        discount = alt && alt.coupon_id === override ? alt.discount : 0;
        freeShipping = row.coupon.discount_type === 'free_shipping';
      }
    } else if (autoBest) {
      const row = wallet.find((w) => w.coupon_id === autoBest.coupon_id);
      if (row) {
        userCouponId = row.id;
        code = autoBest.code;
        discount = autoBest.discount;
        freeShipping = autoBest.type === 'free_shipping';
      }
    }

    return {
      userCouponId, code, discount, freeShipping, alternatives, loading,
      wallet,
      refresh,
      setUserCouponId: (couponRowId: string | null) => setOverride(couponRowId),
      clear: () => {
        setOverride(null);
        setAutoBest(null);
        setAlternatives([]);
      },
    };
  }, [autoBest, alternatives, override, wallet, loading, refresh]);

  return (
    <AppliedCouponContext.Provider value={value}>
      {children}
    </AppliedCouponContext.Provider>
  );
}

export function useAppliedCoupon(): AppliedCouponContextValue {
  const ctx = useContext(AppliedCouponContext);
  if (!ctx) {
    throw new Error('useAppliedCoupon must be used inside <AppliedCouponProvider>');
  }
  return ctx;
}
