/**
 * networkPolicy — minimal policy helper that decides whether a heavy
 * media (looping background video, autoplay hero MP4, …) should be
 * loaded on the current device.
 *
 * The Algerian mobile market is data-constrained: most users sit on
 * limited 4G plans and notice every megabyte. Loading a 15 MB MP4 on
 * cellular by default is a great way to ship a one-star review. So
 * the policy is conservative by default.
 *
 * Implementation note:
 *   We deliberately don't pull `@react-native-community/netinfo` or
 *   `expo-battery` yet — those packages aren't installed in this
 *   build, and adding native deps is its own EAS rebuild. Instead, the
 *   policy reads the user's saved `data_saver_mode` preference (already
 *   present in `user_preferences`) and the explicit `video_autoplay`
 *   setting. When NetInfo lands later, the only function to update is
 *   `shouldAutoplayVideo()`.
 *
 * Mapping for `video_autoplay` (already stored in user_preferences):
 *   - 'always'    → always on
 *   - 'wifi_only' → on when we *believe* we're on Wi-Fi
 *                   (best-effort — without NetInfo we treat
 *                    `data_saver_mode = false` as the proxy)
 *   - 'never'     → off
 */

export type VideoAutoplayPref = 'always' | 'wifi_only' | 'never';

export interface NetworkPolicyContext {
  /** Inbound from `user_preferences.data_saver_mode`. Defaults to false. */
  data_saver_mode?: boolean;
  /** Inbound from `user_preferences.video_autoplay`. Defaults to wifi_only. */
  video_autoplay?: VideoAutoplayPref;
}

const DEFAULTS: Required<NetworkPolicyContext> = {
  data_saver_mode: false,
  video_autoplay: 'wifi_only',
};

/**
 * Decide whether a background or hero video should autoplay right now.
 *
 * Without a real network probe we play it safe: only the `always`
 * setting forces playback. `wifi_only` requires data_saver to be off
 * AND a future NetInfo hook to confirm Wi-Fi (best-effort proxy: if
 * the user kept defaults, we assume they're not data-constrained).
 */
export function shouldAutoplayVideo(ctx: NetworkPolicyContext = {}): boolean {
  const merged = { ...DEFAULTS, ...ctx };
  if (merged.video_autoplay === 'never') return false;
  if (merged.video_autoplay === 'always') return true;
  // wifi_only — without NetInfo, refuse autoplay if data saver is on.
  if (merged.data_saver_mode) return false;
  // We *don't* have a confirmed Wi-Fi signal yet (no NetInfo native
  // module). Returning `false` here trades engagement for trust:
  // "no surprise data burn" is more important to the Algerian
  // launch than a visual flourish. Flip this to `true` once NetInfo
  // is wired and reports Wi-Fi.
  return false;
}

/**
 * Decide whether to preload heavier image assets (e.g. high-res hero
 * banners). Mirrors the autoplay logic but is more permissive — even
 * data-saver mode still loads images, just at lower priority.
 */
export function shouldPreloadHeavyImages(ctx: NetworkPolicyContext = {}): boolean {
  const merged = { ...DEFAULTS, ...ctx };
  return !merged.data_saver_mode;
}
