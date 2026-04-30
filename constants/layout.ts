/**
 * Layout constants — single source of truth for the bottom-stack
 * geometry so the floating tab bar, the cart FAB, the promo FAB and
 * the screen content padding never disagree.
 *
 * Why the indirection:
 *   Before this file every screen / FAB hard-coded `92` or `110` and
 *   the constants drifted apart over time → on Profile the promo FAB
 *   landed on top of the action tiles (PTP-N49 screenshot).
 *
 *   With a single import, "the FAB sits above the tab bar" and "the
 *   ScrollView's last item is reachable" stay in lock-step.
 *
 * Numbers in pixels (logical, not device pixels):
 *
 *   TAB_BAR_HEIGHT             ≈ 60  pill-style floating tab bar
 *   TAB_BAR_BOTTOM_PADDING     = 8   gap between OS bar and tab bar
 *   TAB_BAR_TOTAL              = 92  TAB_BAR_HEIGHT + padding + cushion
 *
 *   FAB_HEIGHT                 ≈ 40  promo / cart FAB pill
 *   FAB_GAP                    = 16  breathing room above the tab bar
 *
 *   Add the device's `insets.bottom` on top of these — handled by the
 *   `useBottomClearance()` hook below.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_BOTTOM_PADDING = 8;
export const TAB_BAR_TOTAL = 92; // matches the legacy hard-coded value

export const FAB_HEIGHT = 40;
export const FAB_GAP = 16;

/**
 * Bottom offset for floating elements (FAB pill, cart button) that sit
 * ABOVE the tab bar. Includes the device safe-area inset.
 */
export function useFabBottomOffset(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_TOTAL + insets.bottom;
}

/**
 * `paddingBottom` for ScrollView / FlatList content so the LAST item
 * stays reachable above BOTH the tab bar AND the FAB pill that floats
 * over it.
 *
 * Used by Profile, Loyalty, Wishlist, Coupons, Notifications and any
 * screen that renders below the floating tab bar with a PromoFab
 * potentially active.
 */
export function useBottomContentClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_TOTAL + FAB_HEIGHT + FAB_GAP + insets.bottom;
}

/**
 * Static fallback for places that can't call hooks (e.g. style objects
 * outside a component). Doesn't include the safe-area inset; callers
 * who care about edge-of-screen accuracy should switch to the hook.
 */
export const BOTTOM_CONTENT_CLEARANCE_STATIC =
  TAB_BAR_TOTAL + FAB_HEIGHT + FAB_GAP;
