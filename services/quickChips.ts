/**
 * quickChips — admin-managed Temu-style chips on the mobile home.
 *
 * Wire flow:
 *   • `listQuickChips()` calls the SECURITY DEFINER RPC
 *     `quick_chips_list_public(p_device_id)` which merges the global
 *     active list with the caller's saved order in
 *     `user_preferences.quick_chips_order`.
 *   • `saveQuickChipsOrder(ids)` persists a new order. The RPC drops
 *     unknown / inactive IDs silently, so the saved list never grows
 *     stale even if the admin deactivates a chip the user reordered.
 *
 * Realtime: the `mobile_quick_chips` table is in the supabase_realtime
 * publication, so subscribers can listen for chip CRUD without a
 * polling loop. We keep this hook simple — fetch once on mount, then
 * refetch on focus via `useFocusEffect` upstream if needed.
 */
import { useEffect, useState } from 'react';

import { getDeviceId } from '@/lib/deviceId';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

export interface QuickChip {
  id: string;
  chip_key: string;
  label_fr: string;
  label_ar: string;
  emoji: string | null;
  link_url: string;
  accent_color: string;
  sort_order: number;
}

export async function listQuickChips(): Promise<QuickChip[]> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('quick_chips_list_public', {
      p_device_id: deviceId,
    });
    if (error) {
      console.warn('[quickChips] list rpc failed:', error);
      return [];
    }
    return (data as QuickChip[]) ?? [];
  } catch (err) {
    console.warn('[quickChips] list crashed:', err);
    return [];
  }
}

export async function saveQuickChipsOrder(orderedIds: string[]): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('quick_chips_save_my_order', {
      p_device_id: deviceId,
      p_chip_ids: orderedIds,
    });
    if (error) {
      console.warn('[quickChips] save rpc failed:', error);
      return false;
    }
    return Boolean((data as { ok?: boolean } | null)?.ok);
  } catch (err) {
    console.warn('[quickChips] save crashed:', err);
    return false;
  }
}

/**
 * useQuickChips — fetch the admin-managed chip list once on mount.
 * Returns `chips`, a `loading` flag, and an `applyOrder(ids)` callback
 * that mutates the local list AND persists the order in the
 * background. The local mutation lets the drag UX feel instant.
 */
export function useQuickChips(): {
  chips: QuickChip[];
  loading: boolean;
  applyOrder: (orderedIds: string[]) => void;
} {
  const [chips, setChips] = useState<QuickChip[]>([]);
  const [loading, setLoading] = useState(true);
  const globalTick = useRefreshTick();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listQuickChips();
      if (!cancelled) {
        setChips(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [globalTick]);

  const applyOrder = (orderedIds: string[]) => {
    setChips((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      const reordered: QuickChip[] = [];
      for (const id of orderedIds) {
        const chip = byId.get(id);
        if (chip) reordered.push(chip);
      }
      // Append any chips that weren't in the saved list (admin added new ones)
      for (const chip of prev) {
        if (!orderedIds.includes(chip.id)) reordered.push(chip);
      }
      return reordered;
    });
    // Fire-and-forget — RPC is idempotent.
    void saveQuickChipsOrder(orderedIds);
  };

  return { chips, loading, applyOrder };
}
