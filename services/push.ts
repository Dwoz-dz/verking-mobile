/**
 * Push notifications service — Phase 11.
 *
 * Architecture:
 *   ▸ getExpoPushToken()           Returns the device's Expo push token.
 *                                  Tries to dynamically import
 *                                  `expo-notifications` — when the package
 *                                  is not yet installed, falls back to a
 *                                  mock token in __DEV__ (so the rest of
 *                                  the pipeline can be exercised end-to-end
 *                                  without the native module).
 *   ▸ registerForPushNotifications Permission flow + token fetch + RPC.
 *   ▸ setTopic / getMyTopics / unregisterDevice / countMyTopics — RPC wrappers.
 *   ▸ React hooks for topic-list rendering + opt-in count badge.
 *   ▸ wireNotificationHandlers     Sets up foreground display + tap routing.
 *
 * The mobile app should:
 *   1. Call `registerForPushNotifications()` once at boot (after the
 *      user is past onboarding so the OS prompt feels intentional).
 *   2. Call `wireNotificationHandlers(router)` once at boot to wire deep
 *      links from notification taps into expo-router.
 *   3. Re-run `registerForPushNotifications({ levelKey, wilayaCode })`
 *      when the user changes their school level / default wilaya so the
 *      audience-targeting RPC sees the new metadata.
 *
 * Install before shipping to device:
 *     npm install expo-notifications expo-device
 */
import { useCallback, useEffect, useState } from 'react';
import { NativeModules } from 'react-native';

import { getDeviceId } from '@/lib/deviceId';
import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { supabase } from '@/lib/supabase/client';

/**
 * Native-module guard.
 *
 * Even when `expo-notifications` is in node_modules, the dev client may
 * have been built WITHOUT the native lib (no `eas build` / `expo run:android`
 * yet). In that case importing `expo-notifications/build/index.js`
 * synchronously calls `requireNativeModule('ExpoPushTokenManager')` at
 * top level — that throws and corrupts the JS bridge enough that Fabric
 * crashes with `IllegalStateException: addViewAt failed`.
 *
 * We check `NativeModules.ExpoPushTokenManager` BEFORE any dynamic
 * import, so the package is never loaded unless its native side is
 * actually registered. In dev (without the native module) we still
 * return a mock token so the rest of the pipeline can be exercised.
 */
function hasNativePushModule(): boolean {
  try { return Boolean((NativeModules as Record<string, unknown>).ExpoPushTokenManager); }
  catch { return false; }
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface PushTopic {
  topic_key: string;
  label_fr: string;
  label_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  emoji: string | null;
  accent_color: string;
  is_required: boolean;
  opted_in: boolean;
  sort_order: number;
}

export interface RegisterOptions {
  levelKey?: string | null;
  wilayaCode?: string | null;
  locale?: 'fr' | 'ar' | 'en' | null;
  appVersion?: string | null;
  /** Allow callers (e.g. settings screen) to force a re-prompt for permission. */
  force?: boolean;
}

export interface RegisterResult {
  ok: boolean;
  reason?: 'permission_denied' | 'no_token' | 'rpc_error' | 'unknown';
  token?: string;
  is_new?: boolean;
  topics_count?: number;
}

// ─── Expo token (with graceful degradation) ────────────────────────────

const MOCK_TOKEN_PREFIX = 'ExponentPushToken[';

function makeMockToken(): string {
  // 24 chars to comfortably pass the DB regex (^Expo(nent)?PushToken\[[A-Za-z0-9_-]{16,}\]$)
  const r = () => Math.random().toString(36).slice(2);
  const tail = (r() + r()).slice(0, 24);
  return `${MOCK_TOKEN_PREFIX}${tail}]`;
}

/**
 * Returns the device's Expo push token.
 *
 * Behaviour:
 *   ▸ With `expo-notifications` installed → asks permission, fetches token.
 *   ▸ Without → in __DEV__ returns a mock token; in production returns null.
 *
 * The mock path lets the entire pipeline be smoke-tested (register RPC
 * accepts the token, `push_resolve_recipients` returns it, the edge fn
 * batches it) without the native module.
 */
export async function getExpoPushToken(): Promise<string | null> {
  // Guard: never touch expo-notifications if its native module isn't
  // registered. See hasNativePushModule() comment above for the why.
  if (!hasNativePushModule()) {
    if (__DEV__) {
      console.warn('[push] native module ExpoPushTokenManager absent — using mock token (dev only). Run `eas build` or `expo run:android` to compile native push.');
      return makeMockToken();
    }
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.status === 'granted' || settings.granted === true;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted' || req.granted === true;
    }
    if (!granted) return null;

    const tokenObj = await Notifications.getExpoPushTokenAsync();
    return tokenObj?.data ?? null;
  } catch (err) {
    console.warn('[push] expo-notifications import failed unexpectedly:', err);
    if (__DEV__) return makeMockToken();
    return null;
  }
}

/** Whether this dev client has the native push module compiled in. */
export function isNativePushAvailable(): boolean {
  return hasNativePushModule();
}

// ─── Notification handler (foreground + tap routing) ───────────────────

// Loose to accept expo-router's typed Router (whose `push` accepts a
// branded route union, not plain string). We only ever call `push` with
// a deep_link from our own campaigns, so the runtime check is fine.
type RouterLike = { push: (path: never) => void } | { push: (path: string) => void };

/**
 * Wire foreground display + tap-to-deeplink. Call once at app boot.
 *
 * This is intentionally tolerant: when `expo-notifications` isn't
 * installed yet, the wiring is a no-op. The same call site stays valid
 * after the package lands.
 */
export async function wireNotificationHandlers(router: RouterLike): Promise<void> {
  // Same guard as getExpoPushToken — don't load the package without
  // its native side registered, otherwise Fabric crashes.
  if (!hasNativePushModule()) {
    if (__DEV__) console.warn('[push] handler wiring skipped (native module absent in this dev client).');
    return;
  }
  try {
    const Notifications = await import('expo-notifications');

    // Show banner + sound when the app is in the foreground.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Tap routing: campaigns can ship a `data.deep_link` like '/packs',
    // '/loyalty', or '/product/<id>' and we forward it to expo-router.
    Notifications.addNotificationResponseReceivedListener((response: unknown) => {
      const data = (response as { notification?: { request?: { content?: { data?: Record<string, unknown> } } } })
        ?.notification?.request?.content?.data;
      const deepLink = typeof data?.deep_link === 'string' ? data.deep_link : null;
      if (deepLink && deepLink.startsWith('/')) {
        try { (router.push as (p: string) => void)(deepLink); }
        catch (err) { console.warn('[push] deep link push failed:', err); }
      }
    });
  } catch {
    // Package not installed yet — no-op until `npm install expo-notifications`.
    if (__DEV__) console.warn('[push] handler wiring skipped (expo-notifications absent).');
  }
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Full registration flow:
 *   1. Get the Expo push token (asks OS permission).
 *   2. Call `push_register_device` RPC with metadata + (optional) level
 *      and wilaya for targeting.
 *   3. The RPC seeds default opt-in preferences for any new topic.
 *
 * Idempotent — safe to re-call on every boot or when the user updates
 * their level / wilaya. The RPC upserts on device_id.
 */
export async function registerForPushNotifications(opts: RegisterOptions = {}): Promise<RegisterResult> {
  const token = await getExpoPushToken();
  if (!token) return { ok: false, reason: 'permission_denied' };

  let timezone: string | null = null;
  try {
    // Intl is universally available in Hermes / V8 — no native dep.
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch { /* noop */ }

  let platform: 'ios' | 'android' | 'web' | null = null;
  try {
    const { Platform } = await import('react-native');
    platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  } catch { /* noop */ }

  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('push_register_device', {
      p_device_id: deviceId,
      p_expo_token: token,
      p_platform: platform,
      p_app_version: opts.appVersion ?? null,
      p_locale: opts.locale ?? null,
      p_timezone: timezone,
      p_wilaya_code: opts.wilayaCode ?? null,
      p_level_key: opts.levelKey ?? null,
    });
    if (error) {
      console.warn('[push] register rpc failed:', error);
      return { ok: false, reason: 'rpc_error', token };
    }
    const result = (data as { is_new?: boolean; topics_count?: number } | null) ?? {};
    return { ok: true, token, is_new: result.is_new, topics_count: result.topics_count };
  } catch (err) {
    console.warn('[push] register failed:', err);
    return { ok: false, reason: 'unknown', token };
  }
}

export async function unregisterPushDevice(): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await supabase.rpc('push_unregister_device', { p_device_id: deviceId });
  } catch (err) {
    console.warn('[push] unregister failed:', err);
  }
}

export async function setTopic(topicKey: string, optedIn: boolean): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const { error } = await supabase.rpc('push_set_topic', {
      p_device_id: deviceId,
      p_topic_key: topicKey,
      p_opted_in: optedIn,
    });
    if (error) {
      console.warn('[push] setTopic failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[push] setTopic failed:', err);
    return false;
  }
}

export async function getMyTopics(): Promise<PushTopic[]> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('push_get_my_topics', { p_device_id: deviceId });
    if (error) throw error;
    return ((data ?? []) as unknown) as PushTopic[];
  } catch (err) {
    console.warn('[push] getMyTopics failed:', err);
    return [];
  }
}

export async function countMyTopics(): Promise<number> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('push_count_my_topics', { p_device_id: deviceId });
    if (error) throw error;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}

// ─── React hooks ───────────────────────────────────────────────────────

export function useMyPushTopics(): { topics: PushTopic[]; loading: boolean; reload: () => void } {
  const [topics, setTopics] = useState<PushTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const globalTick = useRefreshTick();
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const list = await getMyTopics();
      if (cancelled) return;
      setTopics(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tick, globalTick]);

  // Realtime: catalogue changes (admin adds/removes a topic) should
  // refresh the user's preferences view.
  useEffect(() => {
    const unsub = subscribeRealtime('mobile_push_topics', undefined, () => reload());
    return () => { unsub(); };
  }, [reload]);

  return { topics, loading, reload };
}

export function useMyTopicCount(): number {
  const [count, setCount] = useState(0);
  const globalTick = useRefreshTick();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const n = await countMyTopics();
      if (!cancelled) setCount(n);
    })();
    return () => { cancelled = true; };
  }, [globalTick]);
  return count;
}

/**
 * Optimistic toggle: flip locally first, then RPC-reconcile. Required
 * topics throw `this topic is required and cannot be opted out` from
 * the SQL function — callers should surface the error in the UI.
 */
export function useToggleTopic(reload: () => void): (topicKey: string, optedIn: boolean) => Promise<boolean> {
  return useCallback(async (topicKey: string, optedIn: boolean) => {
    const ok = await setTopic(topicKey, optedIn);
    reload();
    return ok;
  }, [reload]);
}
