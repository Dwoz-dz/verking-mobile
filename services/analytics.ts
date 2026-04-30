/**
 * Mobile analytics — fire-and-forget event tracker.
 *
 * Posts to the `track-event` Supabase Edge Function with:
 *   - device_id (stable per install, no PII)
 *   - event_type (allow-listed)
 *   - payload (sanitised JSON object, max 4KB)
 *   - locale, platform, app_version (for the upsert into app_users)
 *
 * Failures are silently swallowed: analytics must never block UX. We
 * don't retry on the client either — the next event will reach the
 * server if the network came back, and we're not building a queue
 * because losing 1 event in 1000 is acceptable for the current scope.
 *
 * Usage:
 *   import { track } from '@/services/analytics';
 *   void track('add_to_cart', { product_id, mode, qty });
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { i18next } from '@/i18n';
import { getDeviceId } from '@/lib/deviceId';

export type TrackedEvent =
  | 'session_start'
  | 'view_product'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'order_complete'
  | 'wa_order'
  | 'search'
  | 'view_category'
  | 'view_section'
  | 'language_switch';

function getEndpoint(): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/functions/v1/track-event`;
}

function getAnonKey(): string | null {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null;
}

function getAppMeta() {
  const platform = Platform.OS;
  const appVersion =
    (Constants.expoConfig?.version as string | undefined) ??
    (Constants.manifest2?.extra?.expoClient?.version as string | undefined) ??
    'unknown';
  const locale = i18next.language || 'fr';
  return { platform, app_version: appVersion, locale };
}

/**
 * Fire-and-forget event tracker. Returns a Promise that NEVER rejects —
 * if anything goes wrong we log a warning and resolve `false`.
 */
export async function track(
  event: TrackedEvent,
  payload?: Record<string, unknown>,
): Promise<boolean> {
  const endpoint = getEndpoint();
  const anon = getAnonKey();
  if (!endpoint || !anon) return false;

  let deviceId: string;
  try {
    deviceId = await getDeviceId();
  } catch {
    return false;
  }

  const meta = getAppMeta();
  const body = JSON.stringify({
    device_id: deviceId,
    event_type: event,
    payload: payload ?? null,
    locale: meta.locale,
    platform: meta.platform,
    app_version: meta.app_version,
  });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: anon,
        authorization: `Bearer ${anon}`,
      },
      body,
    });
    return res.ok;
  } catch (err) {
    if (__DEV__) console.warn('[analytics] track failed:', event, err);
    return false;
  }
}

/**
 * Convenience trigger fired from the root layout once on boot. Lets the
 * dashboard count daily / monthly active devices without each screen
 * having to remember to call something.
 */
export function trackSessionStart(): void {
  void track('session_start', {});
}
