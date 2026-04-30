/**
 * Mobile remote-config realtime channel.
 *
 * Subscribes once at app boot to Postgres changes on every `mobile_*`
 * table that drives admin-controlled UI (theme, cart settings, home
 * sections, wilayas, plus future Phase 1+ tables). When a change
 * arrives, we map the table name → cache scope and call
 * `invalidateMobileConfigScope(scope)` — hooks bound to that scope
 * re-fetch the fresh row, every other hook keeps its warm cache.
 *
 * The channel is fire-and-forget: connection drops are handled by
 * supabase-js with auto-reconnect, and a stale cache always falls
 * back to the 60 s in-memory TTL so the worst case after a missed
 * event is one minute of staleness — not a broken UI.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { invalidateMobileConfigScope } from '@/services/mobileConfig';

// Map of `public.<table>` → cache scope used inside mobileConfig.ts.
// Keep the right-hand strings in sync with the keys passed to
// setCached / getCached in services/mobileConfig.ts. New phases just
// add entries here.
const TABLE_TO_SCOPE: Record<string, string> = {
  mobile_theme:          'theme',
  mobile_cart_settings:  'cart',
  mobile_home_sections:  'home_sections',
  wilayas:               'wilayas',
  mobile_shipping_zones: 'shipping_zones',
  // Note: mobile_flash_sales has its own focused subscription in
  // services/flashSales.ts (it needs full re-enrichment, not just a
  // cache bump), so we leave it out of the scoped invalidation map.
};

let activeChannel: RealtimeChannel | null = null;

export function mountMobileConfigChannel(): () => void {
  if (activeChannel) {
    // Already mounted — return the existing teardown so callers can
    // still own the lifecycle.
    return unmountMobileConfigChannel;
  }

  const channel = supabase.channel('mobile-config-broadcast');

  for (const [table, scope] of Object.entries(TABLE_TO_SCOPE)) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: { eventType?: string }) => {
        if (__DEV__) {
          console.log('[realtime] mobile-config change', {
            table, scope, event: payload?.eventType,
          });
        }
        invalidateMobileConfigScope(scope);
      },
    );
  }

  channel.subscribe((status) => {
    if (__DEV__) console.log('[realtime] mobile-config subscription:', status);
  });

  activeChannel = channel;
  return unmountMobileConfigChannel;
}

export function unmountMobileConfigChannel(): void {
  if (!activeChannel) return;
  const ch = activeChannel;
  activeChannel = null;
  supabase.removeChannel(ch).catch(() => { /* noop */ });
}
