/**
 * Loyalty / Rewards service — Phase 8.
 *
 * Reads:
 *   ▸ Settings, levels, challenges, rewards   →  anon SELECT on the
 *     four catalogue tables. Realtime-subscribed so admin saves
 *     propagate live.
 *   ▸ Account + ledger + per-challenge progress → SECURITY DEFINER
 *     RPCs scoped to the device_id (anon can't read these tables
 *     directly).
 *
 * Mutations:
 *   ▸ ensureAccount()        — get-or-create on first launch.
 *   ▸ earnForOrder()         — credits points after checkout (idempotent
 *                              on order_id).
 *   ▸ completeChallenge()    — admin-controlled mission completion.
 *   ▸ redeemReward()         — debit points + record redemption.
 *
 * All RPCs validate `p_device_id` against the device's own id; even if
 * a malicious client passes someone else's device id, they only ever
 * see / mutate that device's row. Service role bypasses RLS for admin
 * adjustments via the edge function.
 */
import { useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { supabase } from '@/lib/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────

export interface LoyaltySettings {
  is_enabled: boolean;
  currency_label_fr: string;
  currency_label_ar: string;
  currency_icon: string | null;
  point_value_da: number;
  earn_rate_per_da: number;
  signup_bonus: number;
  referral_referrer_bonus: number;
  referral_referee_bonus: number;
  terms_text_fr: string | null;
  terms_text_ar: string | null;
}

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  is_enabled: true,
  currency_label_fr: 'Étoiles VERKING',
  currency_label_ar: 'نجوم فيركينغ',
  currency_icon: 'sparkles',
  point_value_da: 1,
  earn_rate_per_da: 0.01,
  signup_bonus: 100,
  referral_referrer_bonus: 200,
  referral_referee_bonus: 100,
  terms_text_fr: null,
  terms_text_ar: null,
};

export interface LoyaltyLevel {
  level_key: string;
  name_fr: string;
  name_ar: string;
  threshold_points: number;
  badge_color: string;
  badge_icon: string | null;
  perks_fr: string[];
  perks_ar: string[];
  sort_order: number;
}

export interface LoyaltyChallenge {
  id: string;
  challenge_key: string;
  title_fr: string;
  title_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  icon: string | null;
  challenge_type: string;
  target_value: number;
  reward_points: number;
  reward_coupon_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_completions_per_user: number | null;
  sort_order: number;
}

export interface LoyaltyReward {
  id: string;
  reward_key: string;
  title_fr: string;
  title_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  icon: string | null;
  image_url: string | null;
  cost_points: number;
  reward_type: 'coupon' | 'free_shipping' | 'product' | 'merch' | 'custom';
  coupon_id: string | null;
  product_id: string | null;
  stock: number | null;
  per_user_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  required_level_key: string | null;
  sort_order: number;
}

export interface LoyaltyAccount {
  device_id: string;
  balance_points: number;
  lifetime_points: number;
  pending_points: number;
  tier_key: string | null;
  referral_code: string | null;
  referred_by_code: string | null;
  signup_bonus_granted: boolean;
  last_earned_at: string | null;
  created_at: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  device_id: string;
  event_type: string;
  points_delta: number;
  balance_after: number;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
}

export interface ChallengeProgress {
  challenge_id: string;
  challenge_key: string;
  progress_value: number;
  target_value: number;
  completions: number;
  last_completed_at: string | null;
}

// ─── Catalogue reads ────────────────────────────────────────────────────

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  try {
    const { data, error } = await supabase
      .from('mobile_loyalty_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_LOYALTY_SETTINGS;
    const r = data as Record<string, unknown>;
    return {
      is_enabled: r.is_enabled as boolean ?? true,
      currency_label_fr: (r.currency_label_fr as string) ?? DEFAULT_LOYALTY_SETTINGS.currency_label_fr,
      currency_label_ar: (r.currency_label_ar as string) ?? DEFAULT_LOYALTY_SETTINGS.currency_label_ar,
      currency_icon: (r.currency_icon as string | null) ?? DEFAULT_LOYALTY_SETTINGS.currency_icon,
      point_value_da: Number(r.point_value_da ?? DEFAULT_LOYALTY_SETTINGS.point_value_da),
      earn_rate_per_da: Number(r.earn_rate_per_da ?? DEFAULT_LOYALTY_SETTINGS.earn_rate_per_da),
      signup_bonus: Number(r.signup_bonus ?? 0),
      referral_referrer_bonus: Number(r.referral_referrer_bonus ?? 0),
      referral_referee_bonus: Number(r.referral_referee_bonus ?? 0),
      terms_text_fr: (r.terms_text_fr as string | null) ?? null,
      terms_text_ar: (r.terms_text_ar as string | null) ?? null,
    };
  } catch (err) {
    console.warn('[loyalty] settings fetch failed:', err);
    return DEFAULT_LOYALTY_SETTINGS;
  }
}

export async function getLoyaltyLevels(): Promise<LoyaltyLevel[]> {
  const { data, error } = await supabase
    .from('mobile_loyalty_levels')
    .select('level_key,name_fr,name_ar,threshold_points,badge_color,badge_icon,perks_fr,perks_ar,sort_order')
    .order('threshold_points', { ascending: true });
  if (error) {
    console.warn('[loyalty] levels fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as LoyaltyLevel[];
}

export async function getLoyaltyChallenges(): Promise<LoyaltyChallenge[]> {
  const { data, error } = await supabase
    .from('mobile_loyalty_challenges')
    .select('id,challenge_key,title_fr,title_ar,description_fr,description_ar,icon,challenge_type,target_value,reward_points,reward_coupon_id,starts_at,ends_at,max_completions_per_user,sort_order')
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('[loyalty] challenges fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as LoyaltyChallenge[];
}

export async function getLoyaltyRewards(): Promise<LoyaltyReward[]> {
  const { data, error } = await supabase
    .from('mobile_loyalty_rewards')
    .select('id,reward_key,title_fr,title_ar,description_fr,description_ar,icon,image_url,cost_points,reward_type,coupon_id,product_id,stock,per_user_limit,starts_at,ends_at,required_level_key,sort_order')
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('[loyalty] rewards fetch failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as LoyaltyReward[];
}

// ─── Account / mutations via RPC ────────────────────────────────────────

export async function ensureLoyaltyAccount(referredByCode?: string | null): Promise<LoyaltyAccount | null> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase.rpc('loyalty_get_or_create_account', {
    p_device_id: deviceId,
    p_referred_by_code: referredByCode ?? null,
  });
  if (error) {
    console.warn('[loyalty] ensureAccount failed:', error);
    return null;
  }
  return (data as unknown) as LoyaltyAccount;
}

export interface EarnForOrderResult {
  granted: boolean;
  reason?: string;
  points?: number;
  balance_points?: number;
  lifetime_points?: number;
  tier_key?: string;
}

export async function earnForOrder(orderId: string, amountDa: number): Promise<EarnForOrderResult> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase.rpc('loyalty_earn_for_order', {
    p_device_id: deviceId,
    p_order_id: orderId,
    p_amount_da: amountDa,
  });
  if (error) {
    console.warn('[loyalty] earnForOrder failed:', error);
    return { granted: false, reason: 'rpc_error' };
  }
  return (data as unknown) as EarnForOrderResult;
}

export interface CompleteChallengeResult {
  granted: boolean;
  reason?: string;
  points?: number;
  balance_points?: number;
  lifetime_points?: number;
  tier_key?: string;
  challenge_id?: string;
  coupon_id?: string | null;
  progress?: number;
  target?: number;
}

export async function completeChallenge(challengeKey: string, progressDelta?: number): Promise<CompleteChallengeResult> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase.rpc('loyalty_complete_challenge', {
    p_device_id: deviceId,
    p_challenge_key: challengeKey,
    p_progress_delta: progressDelta ?? null,
  });
  if (error) {
    console.warn('[loyalty] completeChallenge failed:', error);
    return { granted: false, reason: 'rpc_error' };
  }
  return (data as unknown) as CompleteChallengeResult;
}

export interface RedeemRewardResult {
  granted: boolean;
  reason?: string;
  redemption_id?: string;
  reward_id?: string;
  reward_type?: string;
  coupon_id?: string | null;
  product_id?: string | null;
  cost_points?: number;
  balance_points?: number;
  lifetime_points?: number;
  tier_key?: string;
  required_level?: string;
  balance?: number;
  cost?: number;
}

export async function redeemReward(rewardKey: string): Promise<RedeemRewardResult> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase.rpc('loyalty_redeem_reward', {
    p_device_id: deviceId,
    p_reward_key: rewardKey,
  });
  if (error) {
    console.warn('[loyalty] redeemReward failed:', error);
    return { granted: false, reason: 'rpc_error' };
  }
  return (data as unknown) as RedeemRewardResult;
}

export async function listMyLedger(limit = 30): Promise<LoyaltyLedgerEntry[]> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase.rpc('loyalty_list_my_ledger', {
    p_device_id: deviceId,
    p_limit: limit,
  });
  if (error) {
    console.warn('[loyalty] listMyLedger failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as LoyaltyLedgerEntry[];
}

export async function listMyProgress(): Promise<ChallengeProgress[]> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase.rpc('loyalty_list_my_progress', {
    p_device_id: deviceId,
  });
  if (error) {
    console.warn('[loyalty] listMyProgress failed:', error);
    return [];
  }
  return ((data ?? []) as unknown) as ChallengeProgress[];
}

// ─── React hooks ────────────────────────────────────────────────────────

/**
 * Hook returning the current loyalty account. Re-fetches on focus; the
 * account row is also realtime-broadcast so the balance updates if the
 * admin grants a manual adjustment.
 */
export function useLoyaltyAccount(): { account: LoyaltyAccount | null; settings: LoyaltySettings; reload: () => void; loading: boolean } {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [acct, set] = await Promise.all([ensureLoyaltyAccount(), getLoyaltySettings()]);
      if (cancelled) return;
      setAccount(acct);
      setSettings(set);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);

  // Realtime: server-side admin adjustments push fresh rows. Routed
  // through the realtime hub so multiple Profile/Loyalty re-mounts
  // share the same channel.
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      const deviceId = await getDeviceId();
      if (cancelled) return;
      unsub = subscribeRealtime(
        'mobile_loyalty_accounts',
        `device_id=eq.${deviceId}`,
        () => setTick((t) => t + 1),
      );
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  return { account, settings, reload: () => setTick((t) => t + 1), loading };
}

export function useLoyaltyLevels(): LoyaltyLevel[] {
  const [list, setList] = useState<LoyaltyLevel[]>([]);
  const globalTick = useRefreshTick();
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const data = await getLoyaltyLevels();
      if (!cancelled) setList(data);
    };
    void refresh();
    const unsub = subscribeRealtime('mobile_loyalty_levels', undefined, () => { void refresh(); });
    return () => { cancelled = true; unsub(); };
  }, [globalTick]);
  return list;
}

export function useLoyaltyChallenges(): LoyaltyChallenge[] {
  const [list, setList] = useState<LoyaltyChallenge[]>([]);
  const globalTick = useRefreshTick();
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const data = await getLoyaltyChallenges();
      if (!cancelled) setList(data);
    };
    void refresh();
    const unsub = subscribeRealtime('mobile_loyalty_challenges', undefined, () => { void refresh(); });
    return () => { cancelled = true; unsub(); };
  }, [globalTick]);
  return list;
}

export function useLoyaltyRewards(): LoyaltyReward[] {
  const [list, setList] = useState<LoyaltyReward[]>([]);
  const globalTick = useRefreshTick();
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const data = await getLoyaltyRewards();
      if (!cancelled) setList(data);
    };
    void refresh();
    const unsub = subscribeRealtime('mobile_loyalty_rewards', undefined, () => { void refresh(); });
    return () => { cancelled = true; unsub(); };
  }, [globalTick]);
  return list;
}

// ─── Tier helpers ──────────────────────────────────────────────────────

export function findCurrentTier(levels: LoyaltyLevel[], lifetime: number): LoyaltyLevel | null {
  let best: LoyaltyLevel | null = null;
  for (const l of levels) {
    if (l.threshold_points <= lifetime && (!best || l.threshold_points > best.threshold_points)) {
      best = l;
    }
  }
  return best;
}

export function findNextTier(levels: LoyaltyLevel[], lifetime: number): LoyaltyLevel | null {
  let best: LoyaltyLevel | null = null;
  for (const l of levels) {
    if (l.threshold_points > lifetime && (!best || l.threshold_points < best.threshold_points)) {
      best = l;
    }
  }
  return best;
}
