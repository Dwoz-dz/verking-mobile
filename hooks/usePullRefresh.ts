/**
 * usePullRefresh — drop-in helper for any tab that wants a
 * RefreshControl on its main ScrollView / FlatList.
 *
 * Returns `{refreshing, onRefresh}` and ties them to the global
 * `refreshBus` so every data hook that imports `useRefreshTick()`
 * automatically refetches when the user pulls down.
 *
 * UX timing:
 *   ▸ The spinner shows for a minimum of 600 ms — without that, fast
 *     re-fetches finish in <100 ms and the spinner barely flashes,
 *     which feels broken (user thinks "did anything happen?").
 *   ▸ A maximum of 4 s, so a slow network never traps the user with
 *     a spinning indicator. Hooks finish in the background after.
 */
import { useCallback, useState } from 'react';

import { bumpRefresh } from '@/lib/refresh/refreshBus';

const MIN_SPINNER_MS = 600;
const MAX_SPINNER_MS = 4000;

export function usePullRefresh(): {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
} {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    bumpRefresh();
    const start = Date.now();
    // Wait for at least the minimum spinner duration so the gesture
    // feels acknowledged. We don't actually know when every hook has
    // finished — the bus is fire-and-forget — so we time-box.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(MAX_SPINNER_MS, MIN_SPINNER_MS));
    });
    void start; // referenced for future use (e.g. analytics)
    setRefreshing(false);
  }, []);

  return { refreshing, onRefresh };
}
