/**
 * preloadHomeData — fire-and-forget warmup that runs while the splash
 * is on screen.
 *
 * Why:
 *   Without preload, the user watches the 2 s splash, lands on Home,
 *   then waits another 800–2000 ms for a flash of skeletons before
 *   any product / banner appears. The transitions feel doubled.
 *
 * What we preload:
 *   ▸ `hero_slides` (zone='main')   — the carousel above the fold
 *   ▸ first 8 categories            — CategoryRail
 *   ▸ first 8 featured products     — Offres du jour
 *
 * Why these three:
 *   They're the pixels above the fold on the first paint. Anything
 *   below scroll can lazy-load — the user won't notice.
 *
 * Performance budget:
 *   ▸ All three fetches run in parallel (Promise.allSettled) so the
 *     slowest one is the limiting factor, not the sum.
 *   ▸ Hard-capped at 1.8 s total. If a fetch is still in flight when
 *     the splash fades out, the response is still useful — every hook
 *     uses Supabase's request cache so the in-flight promise hydrates
 *     the cache key, and the consuming hook on Home picks it up
 *     without firing a duplicate request.
 *   ▸ Errors are swallowed silently. A failing preload must NEVER
 *     block boot — the screens that own the data will retry on mount
 *     and show their own loading / error states.
 *
 * Returns the preload promise so callers can await it if they want
 * (the splash doesn't — it just lets it finish in the background).
 */
import { listHeroSlides } from '@/services/heroSlides';
import { listCategories } from '@/services/categories';
import { listFeaturedProducts } from '@/services/products';
import { getUserPreferences } from '@/services/userPreferences';

const PRELOAD_TIMEOUT_MS = 1800;

let _started = false;
let _promise: Promise<void> | null = null;

export function preloadHomeData(): Promise<void> {
  if (_promise) return _promise;
  _started = true;

  // Phase Final-2 — Data saver mode: skip the heavy preload entirely
  // when the user has opted into low-bandwidth mode. Their first paint
  // on Home will hit the network normally (with proper loading
  // skeletons), but we don't waste bytes prefetching three feeds
  // they may never see.
  _promise = (async () => {
    const prefs = await getUserPreferences();
    if (prefs.data_saver_mode) {
      return; // resolve immediately, no fetches fire
    }

    const tasks: Promise<unknown>[] = [
      listHeroSlides('main').catch(() => null),
      listCategories(true).catch(() => null),
      listFeaturedProducts(8).catch(() => null),
    ];

    const timeout = new Promise<void>((resolve) => {
      setTimeout(resolve, PRELOAD_TIMEOUT_MS);
    });

    await Promise.race([
      Promise.allSettled(tasks).then(() => {}),
      timeout,
    ]);
  })();

  return _promise;
}

/**
 * Synchronous helper used by debug screens / tests. Returns whether the
 * preload has been kicked off this session — does NOT tell you if it
 * has completed (use `await preloadHomeData()` for that).
 */
export function preloadHasStarted(): boolean {
  return _started;
}
