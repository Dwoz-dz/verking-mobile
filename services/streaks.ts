/**
 * services/streaks.ts — daily-visit streak counter.
 *
 * Wire:
 *   • `streak_tick(p_device_id)` is called once per app foreground
 *     (StateChange → 'active'). It bumps the row, advances or resets
 *     the consecutive-day counter, and emits the `milestone` field
 *     when the user first crosses 7 / 30 / 100 / 365 days.
 *   • The mobile UI uses `useStreak()` to render the counter + a
 *     progress bar to the next milestone. When `milestone` is non-null
 *     in the tick payload, we show confetti + grant loyalty bonus
 *     points (handled by the consumer screen).
 *
 * Why we tick on `AppState === 'active'` instead of on root mount:
 *   On Android, the dev client / production app keeps the JS context
 *   alive across launches when the user backgrounds + reopens. A pure
 *   mount-time tick would only fire once per cold start and miss the
 *   "user opened the app today" event. AppState changes catch both.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getDeviceId } from '@/lib/deviceId';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

export interface StreakSnapshot {
  consecutive_days: number;
  total_visits: number;
  longest_streak: number;
  last_visit_date: string | null;
  last_milestone: number | null;
}

const ZERO_SNAPSHOT: StreakSnapshot = {
  consecutive_days: 0,
  total_visits: 0,
  longest_streak: 0,
  last_visit_date: null,
  last_milestone: null,
};

const MILESTONES = [7, 30, 100, 365] as const;

export interface StreakTickResult {
  ok: boolean;
  first_visit_today: boolean;
  consecutive_days: number;
  total_visits: number;
  longest_streak: number;
  /** Set only the FIRST time the user crosses 7 / 30 / 100 / 365. */
  milestone: number | null;
}

export async function tickStreak(): Promise<StreakTickResult | null> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('streak_tick', { p_device_id: deviceId });
    if (error) {
      console.warn('[streaks] tick rpc failed:', error.message);
      return null;
    }
    return (data as StreakTickResult) ?? null;
  } catch (err) {
    console.warn('[streaks] tick crashed:', err);
    return null;
  }
}

export async function getMyStreak(): Promise<StreakSnapshot> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('streak_get_my', { p_device_id: deviceId });
    if (error || !data) return ZERO_SNAPSHOT;
    const r = data as Record<string, unknown>;
    return {
      consecutive_days: Number(r.consecutive_days) || 0,
      total_visits: Number(r.total_visits) || 0,
      longest_streak: Number(r.longest_streak) || 0,
      last_visit_date: typeof r.last_visit_date === 'string' ? r.last_visit_date : null,
      last_milestone: r.last_milestone == null ? null : Number(r.last_milestone),
    };
  } catch {
    return ZERO_SNAPSHOT;
  }
}

/** Returns the next milestone after the given consecutive day count. */
export function nextMilestone(consecutive: number): number {
  for (const m of MILESTONES) {
    if (m > consecutive) return m;
  }
  return MILESTONES[MILESTONES.length - 1];
}

/**
 * Hook: returns the streak snapshot, refetches on app foreground, and
 * fires `streak_tick` once per session. The `onMilestone` callback is
 * invoked exactly once per crossing — the consumer wires it to a
 * confetti burst + a loyalty grant.
 */
export function useStreak(opts?: { onMilestone?: (days: number) => void }): {
  streak: StreakSnapshot;
  loading: boolean;
} {
  const [streak, setStreak] = useState<StreakSnapshot>(ZERO_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const tickedRef = useRef(false);
  const onMilestoneRef = useRef(opts?.onMilestone);
  onMilestoneRef.current = opts?.onMilestone;
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;

    const runTick = async () => {
      if (tickedRef.current) return;
      tickedRef.current = true;
      const res = await tickStreak();
      if (cancelled) return;
      if (res?.ok) {
        setStreak((prev) => ({
          ...prev,
          consecutive_days: res.consecutive_days,
          total_visits: res.total_visits,
          longest_streak: res.longest_streak,
        }));
        if (res.milestone && onMilestoneRef.current) {
          onMilestoneRef.current(res.milestone);
        }
      }
    };

    const refresh = async () => {
      const snap = await getMyStreak();
      if (!cancelled) {
        setStreak(snap);
        setLoading(false);
      }
    };

    void refresh().then(() => {
      if (AppState.currentState === 'active') void runTick();
    });

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        // On every foreground transition, re-tick (but the RPC itself
        // is idempotent within the same calendar day).
        tickedRef.current = false;
        void runTick().then(refresh);
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [globalTick]);

  return { streak, loading };
}
