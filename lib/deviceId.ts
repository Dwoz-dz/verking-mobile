/**
 * Stable per-install device id.
 *
 * Generated once on first launch (random UUIDv4-ish) and persisted via
 * safeStorage so analytics can correlate events across sessions without
 * collecting any PII. If safeStorage is unavailable (e.g. dev client
 * without AsyncStorage native module), the id lives in memory only —
 * still useful within a single session.
 */
import { safeStorage } from '@/lib/storage';

const STORAGE_KEY = 'verking:device:v1';

/** Lightweight UUID-ish — sufficient for client-side analytics. */
function generateId(): string {
  // Random 12-char base36 + timestamp suffix → ~17 chars, very unique.
  const rnd = Math.random().toString(36).slice(2, 14).padEnd(12, '0');
  const ts = Date.now().toString(36);
  return `dev_${rnd}_${ts}`;
}

let cached: string | null = null;
let hydratePromise: Promise<string> | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const stored = await safeStorage.getItem(STORAGE_KEY);
      if (stored && typeof stored === 'string' && stored.length >= 8) {
        cached = stored;
        return stored;
      }
    } catch {
      /* fall through to fresh generation */
    }
    const fresh = generateId();
    cached = fresh;
    try {
      await safeStorage.setItem(STORAGE_KEY, fresh);
    } catch {
      /* in-memory only is fine */
    }
    return fresh;
  })();
  return hydratePromise;
}

/** Reset the device id — used by debug-only "wipe analytics" actions. */
export async function resetDeviceId(): Promise<void> {
  cached = null;
  hydratePromise = null;
  try {
    await safeStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
