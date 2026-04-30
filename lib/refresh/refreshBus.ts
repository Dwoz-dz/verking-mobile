/**
 * refreshBus — global "user wants fresh data" signal.
 *
 * Why a bus instead of per-screen `reload()` plumbing:
 *   ▸ The Profile / Loyalty tabs aggregate 8–12 independent hooks
 *     (loyalty account, claimed coupons, wishlist count, school
 *     profile, streak, registration status, push topics, default
 *     wilaya…). Threading a single `reload()` through every one
 *     would mean editing every hook AND its callers every time we
 *     add a new data source.
 *   ▸ Pull-to-refresh is a "refresh EVERYTHING" gesture. The user
 *     doesn't care which Supabase tables back which UI bits — they
 *     just dragged the screen down.
 *
 * How it works:
 *   ▸ A monotonic `tick` counter, bumped on every emit.
 *   ▸ `useRefreshTick()` returns the current value and forces a
 *     re-render whenever the bus emits, so any hook that puts the
 *     tick in its `useEffect` deps automatically refetches.
 *   ▸ `bumpRefresh()` is the public emit. Wired to:
 *       - The pull-to-refresh handler (every tab).
 *       - `useRefreshOnFocus()` after a debounce, so revisiting a
 *         tab after >30 s also triggers a quiet refresh.
 *
 * Callbacks-style subscription is also exposed for non-hook code
 * (e.g. background sync timers).
 */
import { useEffect, useState } from 'react';

let _tick = 0;
type Listener = (tick: number) => void;
const _listeners = new Set<Listener>();

/** Bumps the refresh tick. Notifies every subscriber synchronously. */
export function bumpRefresh(): number {
  _tick += 1;
  // Snapshot before iterating so a listener that unsubscribes doesn't
  // mutate the set mid-loop.
  const snap = Array.from(_listeners);
  for (const fn of snap) {
    try { fn(_tick); } catch { /* ignore listener errors */ }
  }
  return _tick;
}

/** Reads the current tick without subscribing. */
export function getRefreshTick(): number {
  return _tick;
}

/** Subscribe a callback to refresh events. Returns an unsubscribe fn. */
export function subscribeRefresh(fn: Listener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/**
 * Hook that returns the current refresh tick and re-renders whenever
 * `bumpRefresh()` is called. Use it as a dep in `useEffect` to make
 * any data-fetching hook participate in the global refresh.
 *
 * @example
 *   const tick = useRefreshTick();
 *   useEffect(() => { fetchData(); }, [tick, otherDep]);
 */
export function useRefreshTick(): number {
  const [t, setT] = useState(_tick);
  useEffect(() => {
    const unsub = subscribeRefresh((next) => setT(next));
    // Sync once in case the tick advanced between render and effect mount.
    if (_tick !== t) setT(_tick);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return t;
}
