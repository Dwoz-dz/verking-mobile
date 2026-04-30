/**
 * Safe wrappers around `expo-localization`. Each returns null if the
 * native module isn't linked into the current dev-client build —
 * mirrors the `safeStorage` pattern so the app boots gracefully on a
 * stale dev client.
 *
 * `getDeviceLanguageCode()` returns the language code only (e.g. "fr").
 * `getDeviceCountryCode()` returns the region/country (e.g. "DZ", "FR")
 * — used by the Phase 6.1 Arabic-first heuristic on cold launch.
 */
export function getDeviceLanguageCode(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-localization');
    if (mod && typeof mod.getLocales === 'function') {
      const locales = mod.getLocales();
      const tag = locales?.[0]?.languageCode;
      if (typeof tag === 'string' && tag.length > 0) return tag.toLowerCase();
    }
    const direct = mod?.locale;
    if (typeof direct === 'string' && direct.length > 0) {
      return direct.split('-')[0].toLowerCase();
    }
  } catch (err) {
    console.warn('[i18n] expo-localization unavailable, falling back:', err);
  }
  return null;
}

export function getDeviceCountryCode(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-localization');
    if (mod && typeof mod.getLocales === 'function') {
      const locales = mod.getLocales();
      const region = locales?.[0]?.regionCode;
      if (typeof region === 'string' && region.length > 0) return region.toUpperCase();
    }
    if (mod && typeof mod.region === 'string' && mod.region.length > 0) {
      return mod.region.toUpperCase();
    }
  } catch {
    /* Module missing — fall through to null. */
  }
  return null;
}
