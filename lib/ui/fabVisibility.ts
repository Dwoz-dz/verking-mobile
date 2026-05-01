/**
 * fabVisibility — global "is the user scrolling down?" signal so floating
 * elements (PromoFab, CartFab) can fade out of the way.
 *
 * Why a singleton bus instead of plumbing scroll position through
 * context:
 *   ▸ The FABs are mounted at the root layout and the scroll views are
 *     inside individual screens — they don't share a parent.
 *   ▸ A dozen screens each owning a `<ScrollView>` would otherwise need
 *     to thread a callback down to the FAB.
 *   ▸ A bus lets each screen be the dumbest possible ScrollView caller
 *     (one extra prop) while the FAB subscribes once.
 *
 * Behaviour:
 *   ▸ Reports the current scroll Y on every onScroll call.
 *   ▸ The hub diffs against the previous Y and exposes a "direction"
 *     state: 'up' | 'down' | 'idle'.
 *   ▸ FAB subscribes to direction; on 'down' → translateY off-screen,
 *     on 'up' or 'idle' → translateY back.
 *
 * Performance:
 *   ▸ Scroll events fire 60+ times/s. We only push direction CHANGES
 *     to subscribers (not every Y), so the listener cost is bounded.
 *   ▸ Threshold of 4 px filters jitter from finger trembles.
 */

export type ScrollDirection = 'up' | 'down' | 'idle';

const JITTER_THRESHOLD = 4;
const TOP_OF_PAGE_THRESHOLD = 24;

let _lastY = 0;
let _direction: ScrollDirection = 'idle';
const _listeners = new Set<(d: ScrollDirection) => void>();

/**
 * Call from a ScrollView's onScroll handler:
 *
 *   <ScrollView
 *     onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)}
 *     scrollEventThrottle={16}
 *   >
 */
export function reportScrollY(y: number): void {
  // At the top of the page, always show the FAB regardless of micro-jiggle.
  if (y <= TOP_OF_PAGE_THRESHOLD) {
    if (_direction !== 'idle') {
      _direction = 'idle';
      _listeners.forEach((fn) => fn('idle'));
    }
    _lastY = y;
    return;
  }

  const delta = y - _lastY;
  if (Math.abs(delta) < JITTER_THRESHOLD) return;

  const next: ScrollDirection = delta > 0 ? 'down' : 'up';
  if (next !== _direction) {
    _direction = next;
    _listeners.forEach((fn) => fn(next));
  }
  _lastY = y;
}

/**
 * Reset to "FAB visible" — call this when you swap screens or the
 * user pulls-to-refresh, so the FAB doesn't stay hidden across tabs.
 */
export function resetFabVisibility(): void {
  _lastY = 0;
  if (_direction !== 'idle') {
    _direction = 'idle';
    _listeners.forEach((fn) => fn('idle'));
  }
}

export function subscribeFabDirection(
  fn: (d: ScrollDirection) => void,
): () => void {
  _listeners.add(fn);
  // Push the current state immediately so newly-mounted FABs aren't
  // briefly out of sync.
  fn(_direction);
  return () => { _listeners.delete(fn); };
}
