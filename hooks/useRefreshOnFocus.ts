/**
 * useRefreshOnFocus — bumps the global refresh bus the FIRST time a
 * screen gains focus, AND on every subsequent focus where the last
 * bump was more than `staleAfterMs` ago (default 30 s).
 *
 * Why:
 *   ▸ Tabs on mobile keep their state when you switch away — that's
 *     normal RN behaviour. Without a focus refresh, the user can be
 *     looking at a cached snapshot from the launch they made an hour
 *     ago. Pull-to-refresh fixes it manually, but the user shouldn't
 *     HAVE to.
 *   ▸ We don't bump on every focus or we'd hammer Supabase whenever
 *     the user toggles between Home and Cart. The 30 s window strikes
 *     the balance — fresh enough to feel "live", loose enough to be
 *     bandwidth-friendly.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

import { bumpRefresh, getRefreshTick } from '@/lib/refresh/refreshBus';

const DEFAULT_STALE_AFTER_MS = 30_000;

export function useRefreshOnFocus(staleAfterMs: number = DEFAULT_STALE_AFTER_MS): void {
  const lastBumpAt = useRef<number>(0);
  const lastTick = useRef<number>(getRefreshTick());

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const currentTick = getRefreshTick();
      // If anyone else (pull-to-refresh, another tab) already bumped
      // recently, treat that as our refresh — don't double-fire.
      if (currentTick !== lastTick.current) {
        lastBumpAt.current = now;
        lastTick.current = currentTick;
        return;
      }
      if (now - lastBumpAt.current >= staleAfterMs) {
        bumpRefresh();
        lastBumpAt.current = now;
        lastTick.current = getRefreshTick();
      }
      // No cleanup — the effect just runs on each focus tick.
      return undefined;
    }, [staleAfterMs]),
  );
}
