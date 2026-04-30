/**
 * services/topPerformers.ts — public leaderboard.
 * Reads `get_top_performers_public` RPC. Names are server-side
 * masked ("M***D") for privacy; the client never sees full names.
 */
import { useEffect, useState } from 'react';

import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

export interface TopPerformerRow {
  rank: number;
  display_name: string;
  wilaya_code: string | null;
  metric_value: number;
}

export type LeaderboardMetric = 'points' | 'streak';

export async function getTopPerformers(
  metric: LeaderboardMetric = 'points',
  limit = 10,
): Promise<TopPerformerRow[]> {
  try {
    const { data, error } = await supabase.rpc('get_top_performers_public', {
      p_metric: metric,
      p_limit:  limit,
    });
    if (error) {
      console.warn('[topPerformers] rpc failed:', error.message);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      rank:         Number(r.rank) || 0,
      display_name: String(r.display_name ?? 'VERKING'),
      wilaya_code:  typeof r.wilaya_code === 'string' ? r.wilaya_code : null,
      metric_value: Number(r.metric_value) || 0,
    }));
  } catch {
    return [];
  }
}

export function useTopPerformers(metric: LeaderboardMetric = 'points', limit = 10) {
  const [rows, setRows] = useState<TopPerformerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await getTopPerformers(metric, limit);
      if (!cancelled) {
        setRows(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [metric, limit, globalTick]);

  return { rows, loading };
}
