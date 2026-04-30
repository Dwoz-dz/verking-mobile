/**
 * realtimeHub — single shared channel per (table, filter) tuple, with
 * many JS-side subscribers. Replaces the previous "every hook opens
 * its own channel" pattern that leaked one channel per navigation.
 *
 * Symptoms before:
 *   ▸ Profile / Loyalty tabs each spin up 4–6 channels.
 *   ▸ Every navigation back-and-forth adds another set (because
 *     `uniqueChannelName()` deliberately picks a new name per mount
 *     to dodge the "callbacks after subscribe()" crash). After 50
 *     navigation hops, ~150 idle channels are still open.
 *   ▸ Supabase enforces a per-client channel quota; on slow networks
 *     the WebSocket eventually drops and reconnect storms the server.
 *
 * Symptoms after:
 *   ▸ At most ONE channel exists per (table, filter) — no matter how
 *     many hooks subscribe. Each hook adds itself to the listener
 *     Set; the channel is created on first subscribe and torn down
 *     30 s after the last unsubscribe (lazy teardown so a quick
 *     "leave and come back" gesture doesn't thrash the connection).
 *
 * Surface:
 *   subscribeRealtime(table, filter, listener) → unsubscribe()
 *
 * `filter` follows the supabase-js shape: `column=eq.value` etc., or
 * undefined for "all rows on this table". Two hooks asking for the
 * same `table` with the same `filter` share the channel; differing
 * filters get separate channels (because the server-side filter is
 * part of the channel binding).
 */
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

const TEARDOWN_GRACE_MS = 30_000;

export type RealtimeEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE';
export type RealtimeListener = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

interface HubEntry {
  channel: RealtimeChannel;
  listeners: Set<RealtimeListener>;
  /** Pending teardown timer — null when the entry is in active use. */
  teardownTimer: ReturnType<typeof setTimeout> | null;
}

const _hub = new Map<string, HubEntry>();

function entryKey(table: string, filter?: string, event: RealtimeEvent = '*'): string {
  return `${table}::${filter ?? '*'}::${event}`;
}

/**
 * Subscribe to postgres_changes on `table` (optionally filtered).
 * Returns an unsubscribe function that the caller MUST invoke in
 * its useEffect cleanup, otherwise the listener leaks.
 *
 * @param table     Public-schema table name (e.g. 'mobile_loyalty_levels').
 * @param filter    Optional PostgREST filter ('column=eq.value'). Undefined → all rows.
 * @param listener  Called once per change event with the supabase payload.
 * @param event     Event filter — defaults to '*' (INSERT + UPDATE + DELETE).
 */
export function subscribeRealtime(
  table: string,
  filter: string | undefined,
  listener: RealtimeListener,
  event: RealtimeEvent = '*',
): () => void {
  const key = entryKey(table, filter, event);
  let entry = _hub.get(key);

  if (!entry) {
    // First subscriber for this (table, filter) — create the channel.
    const channelName = `vk-hub-${table}-${(filter ?? 'all').replace(/[^a-z0-9]/gi, '_')}-${event}`;
    const channel = supabase.channel(channelName);
    channel.on(
      // supabase-js types want "postgres_changes" as a string literal here.
      'postgres_changes' as 'postgres_changes',
      { event, schema: 'public', table, filter },
      (payload) => {
        const cur = _hub.get(key);
        if (!cur) return;
        // Snapshot before iterating in case a listener unsubscribes
        // mid-callback (which would mutate the Set).
        const snap = Array.from(cur.listeners);
        for (const fn of snap) {
          try { fn(payload as RealtimePostgresChangesPayload<Record<string, unknown>>); }
          catch (e) { if (__DEV__) console.warn('[realtimeHub] listener threw:', e); }
        }
      },
    );
    channel.subscribe((status) => {
      if (__DEV__ && status !== 'SUBSCRIBED') {
        console.log(`[realtimeHub] ${channelName} → ${status}`);
      }
    });
    entry = { channel, listeners: new Set(), teardownTimer: null };
    _hub.set(key, entry);
  } else if (entry.teardownTimer) {
    // We were about to tear this channel down — cancel the timer
    // because someone wants to use it again.
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }

  entry.listeners.add(listener);

  return () => {
    const cur = _hub.get(key);
    if (!cur) return;
    cur.listeners.delete(listener);
    if (cur.listeners.size === 0 && !cur.teardownTimer) {
      // Schedule lazy teardown so a "navigate away, navigate back
      // immediately" gesture doesn't churn the connection.
      const ch = cur.channel;
      cur.teardownTimer = setTimeout(() => {
        const stillCur = _hub.get(key);
        if (stillCur && stillCur.listeners.size === 0 && stillCur.channel === ch) {
          _hub.delete(key);
          supabase.removeChannel(ch).catch(() => { /* ignore */ });
        }
      }, TEARDOWN_GRACE_MS);
    }
  };
}

/**
 * Test/debug helper: snapshot of currently-managed channels and their
 * listener counts. Use from a dev console screen if you want to verify
 * a leak is gone.
 */
export function getHubStats(): { table: string; filter: string; listeners: number }[] {
  const out: { table: string; filter: string; listeners: number }[] = [];
  for (const [key, entry] of _hub.entries()) {
    const [table, filter] = key.split('::');
    out.push({ table, filter, listeners: entry.listeners.size });
  }
  return out;
}
