/**
 * Central registry for VERKING brand visual assets.
 *
 * This file is the ONE place to wire the official logo PNG/SVG into the
 * app. Components like `Brandmark` and `SplashOverlay` import from here
 * so swapping the asset later is a single-line change.
 *
 * ─── How to wire the official logo ────────────────────────────────────
 * 1. Drop the master logo file at:
 *      assets/images/verking-logo.png            (full lockup, ~1024px)
 *      assets/images/verking-icon.png            (square icon, ~512px)
 *      assets/images/verking-bg-pattern.png      (repeat pattern, optional)
 * 2. Uncomment the matching `require(...)` lines below.
 * 3. Restart Metro (`expo start -c`) — Brandmark will switch from the
 *    text wordmark to the image automatically.
 *
 * Until then, the app keeps rendering the polished text wordmark — no
 * broken image refs, no boot crash, no missing-asset console noise.
 * ─────────────────────────────────────────────────────────────────────
 */
import type { ImageSourcePropType } from 'react-native';

/** Full lockup (wordmark + subtitle + Gros/Détail strip). */
export const BRAND_LOGO_FULL: ImageSourcePropType =
  require('@/assets/images/verking-logo.png');

/** Square brand icon — nav avatar, splash, push notifications. Falls
 *  back to the full lockup until a square crop is added. */
export const BRAND_LOGO_ICON: ImageSourcePropType =
  require('@/assets/images/verking-logo.png');

/** Tileable decorative background — splash, About header, empty states.
 *  Reuses the full lockup at low opacity (looks great as a watermark). */
export const BRAND_BG_PATTERN: ImageSourcePropType =
  require('@/assets/images/verking-logo.png');

/** Convenience helper — true once the brand image assets are wired. */
export const hasBrandLogo = BRAND_LOGO_FULL !== null;
