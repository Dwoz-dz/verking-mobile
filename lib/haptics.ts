/**
 * Tiny haptics wrapper — keeps expo-haptics import a single file away
 * so call sites stay tidy and platform fallbacks live in one place.
 *
 * Why a wrapper?
 *   ▸ `expo-haptics` no-ops gracefully on web but imports it everywhere
 *     leaks the platform check noise across the codebase.
 *   ▸ We want the same intent-named API in every screen
 *     (`tap()`, `success()`, `warning()`, `selection()`) so reading the
 *     code tells you the *meaning* of the feedback, not the level.
 *   ▸ A single Platform.OS guard here means we can also disable haptics
 *     globally later (e.g. via Mobile Settings) without touching call
 *     sites — flip ENABLED to false and every site goes silent.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const ENABLED = Platform.OS !== 'web';

function safe(fn: () => Promise<unknown>): void {
  if (!ENABLED) return;
  fn().catch(() => {
    /* haptics must never crash the app */
  });
}

/** Light tap — for non-destructive UI affordances (toggle, segment switch). */
export function tap(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Medium tap — for primary affordances (button press, card open). */
export function press(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Selection-like — for stepper +/− and segmented control changes. */
export function selection(): void {
  safe(() => Haptics.selectionAsync());
}

/** Success — order placed, item added, save published. */
export function success(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Warning — soft block, input rejected. */
export function warning(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Error — destructive failure, network refused, validation block. */
export function error(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
