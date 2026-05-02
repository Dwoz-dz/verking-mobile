/**
 * Sentry — error & crash reporting for the mobile app.
 *
 * Integration policy:
 *   ▸ Sentry is OPTIONAL. The package is `@sentry/react-native` —
 *     install it with `npx expo install @sentry/react-native` and rebuild.
 *     Until installed, this module is a no-op so the bundle still works.
 *   ▸ DSN comes from `EXPO_PUBLIC_SENTRY_DSN`. If empty, Sentry stays
 *     disabled (useful for dev / local clones without a Sentry project).
 *   ▸ We tag every event with `release = expo updateId or commit SHA`,
 *     `environment = 'production' | 'development'`, and a stable
 *     anonymous device_id so user-bounded session replay works without
 *     PII.
 *
 * Usage:
 *   import { initMonitoring, captureError, withMonitoring } from '@/lib/monitoring/sentry';
 *   initMonitoring();                // call once from app/_layout.tsx
 *   captureError(err, { context });  // anywhere
 *   withMonitoring(MyComponent);     // optional ErrorBoundary wrapper
 */

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const RELEASE = process.env.EXPO_PUBLIC_RELEASE ?? 'dev';
const ENV = (process.env.EXPO_PUBLIC_SENTRY_ENV as 'production' | 'development' | 'staging') ?? 'production';

let _enabled = false;
// Lazy-loaded Sentry module — kept as `any` so TS doesn't complain when
// the package isn't installed. The runtime check below makes this safe.
let _Sentry: any = null;

/**
 * Initialise Sentry. Safe to call even when the package isn't installed
 * — falls back to a no-op (with a single console.log so devs know).
 */
export function initMonitoring(): void {
  if (_enabled) return;
  if (!SENTRY_DSN) {
    if (__DEV__) console.log('[monitoring] EXPO_PUBLIC_SENTRY_DSN not set — Sentry disabled');
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _Sentry = require('@sentry/react-native');
    _Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENV,
      release: RELEASE,
      tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,
      // Don't send PII / device tokens automatically.
      sendDefaultPii: false,
      // Reduce noise: drop frequent network errors that aren't actionable.
      beforeSend(event: any, hint: any) {
        const msg = String(hint?.originalException ?? event?.message ?? '');
        if (/Network request failed|AbortError|timeout/i.test(msg)) return null;
        return event;
      },
    });
    _enabled = true;
    if (__DEV__) console.log('[monitoring] Sentry initialised');
  } catch (e) {
    // Package not installed → silent no-op. Don't crash the app.
    if (__DEV__) {
      console.log(
        '[monitoring] @sentry/react-native not installed — install with `npx expo install @sentry/react-native` to enable error reporting',
      );
    }
  }
}

/** Capture an error with optional structured context. */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!_enabled || !_Sentry) return;
  try {
    if (context) {
      _Sentry.withScope((scope: any) => {
        scope.setExtras(context);
        _Sentry.captureException(err);
      });
    } else {
      _Sentry.captureException(err);
    }
  } catch { /* never let monitoring crash the app */ }
}

/** Tag the current user (use the anonymous device_id, never PII). */
export function setUserId(deviceId: string | null): void {
  if (!_enabled || !_Sentry) return;
  try {
    _Sentry.setUser(deviceId ? { id: deviceId } : null);
  } catch { /* swallow */ }
}

/** Add a breadcrumb (visible in event timeline). */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (!_enabled || !_Sentry) return;
  try {
    _Sentry.addBreadcrumb({ message, level: 'info', data, category: 'app' });
  } catch { /* swallow */ }
}

/** Wrap a component with the Sentry ErrorBoundary. No-op without Sentry. */
export function withMonitoring<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  if (!_enabled || !_Sentry) return Component;
  try {
    return _Sentry.withErrorBoundary(Component, { fallback: null });
  } catch {
    return Component;
  }
}
