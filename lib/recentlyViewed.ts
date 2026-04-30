/**
 * Recently Viewed registry.
 *
 * Lightweight store of the last N product ids the user opened from the
 * product detail screen. Used by the Home tab to render a "Vu
 * récemment" rail and by the recommender to bias related products.
 *
 * Why a separate module (vs cart):
 *   ▸ Different cardinality (20 ids vs typically 1–8 cart lines).
 *   ▸ Different write pattern: appended on every detail mount,
 *     debounce not needed (snapshot is cheap).
 *   ▸ Different display: id-only is enough — UI re-fetches the live
 *     product from `services/products` so prices stay fresh and
 *     out-of-stock items show the right state.
 *
 * Persistence: `safeStorage`, key `verking:recently:v1`. Versioning so
 * we can break the schema later without leaving stale entries.
 */
import { safeStorage } from '@/lib/storage';

const STORAGE_KEY = 'verking:recently:v1';
/** Hard cap — at this size we evict the oldest entry on push. */
export const RECENTLY_VIEWED_MAX = 20;

interface PersistedShape {
  v: 1;
  /** Most-recent first. */
  ids: string[];
  /** Epoch ms last write — useful for analytics + Home empty-state hints. */
  updated_at: number;
}

let cache: string[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (parsed && Array.isArray(parsed.ids)) {
          cache = parsed.ids
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
            .slice(0, RECENTLY_VIEWED_MAX);
        }
      }
    } catch (err) {
      console.warn('[recentlyViewed] hydrate failed:', err);
    } finally {
      if (cache === null) cache = [];
      hydrated = true;
    }
  })();
  return hydratePromise;
}

async function persist(): Promise<void> {
  if (!cache) return;
  try {
    const payload: PersistedShape = { v: 1, ids: cache, updated_at: Date.now() };
    await safeStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[recentlyViewed] persist failed:', err);
  }
}

/**
 * Push a freshly-viewed product id to the front of the list.
 *
 * - Deduplicates: if the id already exists it is moved to the front.
 * - Caps at RECENTLY_VIEWED_MAX (oldest entries fall off the tail).
 * - Persistence is fire-and-forget; the in-memory cache flips
 *   immediately so subsequent reads see the new state.
 */
export async function pushRecentlyViewed(productId: string): Promise<void> {
  if (!productId) return;
  await hydrate();
  const existing = cache ?? [];
  const next = [productId, ...existing.filter((id) => id !== productId)].slice(
    0,
    RECENTLY_VIEWED_MAX,
  );
  cache = next;
  void persist();
}

/**
 * Read the current recently-viewed ids (most-recent first), optionally
 * limited and optionally excluding ids the caller already has on
 * screen (e.g. the current product detail page should not see itself
 * in its own related rail).
 */
export async function getRecentlyViewed(opts?: {
  limit?: number;
  excludeIds?: readonly string[];
}): Promise<string[]> {
  await hydrate();
  const list = cache ?? [];
  const exclude = new Set(opts?.excludeIds ?? []);
  const filtered = list.filter((id) => !exclude.has(id));
  const limit = opts?.limit ?? RECENTLY_VIEWED_MAX;
  return filtered.slice(0, limit);
}

/** Clear the registry — exposed for the About / settings screen. */
export async function clearRecentlyViewed(): Promise<void> {
  cache = [];
  hydrated = true;
  try {
    await safeStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** Synchronous in-memory snapshot — only valid AFTER hydrate(). */
export function getRecentlyViewedSync(): readonly string[] {
  return cache ?? [];
}
