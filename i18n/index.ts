/**
 * VERKING — i18n core.
 *
 * Initialises i18next SYNCHRONOUSLY at module load so any `useTranslation()`
 * call across the app sees a ready instance — Expo Router walks the routes
 * graph at boot, which means components are imported (and may try to call
 * useTranslation) before any useEffect can run.
 *
 * `expo-localization` is read via a safe lazy require so a stale dev client
 * without the native module just falls back to French instead of crashing.
 */
import 'intl-pluralrules';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import { getDeviceCountryCode, getDeviceLanguageCode } from '@/lib/safeLocalization';
import { safeStorage } from '@/lib/storage';

import ar from './locales/ar.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

export type AppLocale = 'fr' | 'ar' | 'en';

export const SUPPORTED_LOCALES: AppLocale[] = ['fr', 'ar', 'en'];
export const DEFAULT_LOCALE: AppLocale = 'fr';
export const RTL_LOCALES: AppLocale[] = ['ar'];
const STORAGE_KEY = 'verking:locale';

/**
 * Phase 6.1 — country codes where Arabic should be the cold-launch
 * default even when the device's system locale is set to French.
 * Covers the DZ-first market goal (and rolls in the rest of the
 * Maghreb at near-zero extra cost).
 */
const ARABIC_FIRST_COUNTRIES = new Set(['DZ', 'MA', 'TN', 'LY', 'EG', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'PS', 'YE']);

function isSupported(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value);
}

/**
 * Cold-launch locale resolution chain:
 *   1. Country-aware: if the device is in DZ/MA/TN/etc., default to AR
 *      (the user can still override later via Settings → Langue and
 *      we respect their choice on every subsequent launch).
 *   2. System language: respect the OS locale tag if it's one we
 *      support.
 *   3. Hard fallback: French (the project's brand-default for legacy
 *      installs).
 *
 * The persisted-choice override happens later in `initI18n()` (async);
 * this function runs synchronously at module load, so it's only the
 * "first-ever launch" path.
 */
function detectInitialLocale(): AppLocale {
  const country = getDeviceCountryCode();
  if (country && ARABIC_FIRST_COUNTRIES.has(country)) {
    return 'ar';
  }
  const tag = getDeviceLanguageCode();
  if (tag && isSupported(tag)) return tag;
  return DEFAULT_LOCALE;
}

export function isRTL(locale: AppLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

function applyDirection(locale: AppLocale): boolean {
  const desiredRTL = isRTL(locale);
  if (I18nManager.isRTL === desiredRTL) return false;
  try {
    I18nManager.allowRTL(desiredRTL);
    I18nManager.forceRTL(desiredRTL);
  } catch (err) {
    console.warn('[i18n] applyDirection failed:', err);
  }
  return true;
}

// === Synchronous init at module load ===
const initialLocale: AppLocale = detectInitialLocale();
if (!i18next.isInitialized) {
  // .init returns a Promise but resources are already inlined, so the next
  // call to t() is safe even before the promise resolves.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  i18next.use(initReactI18next).init({
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    resources: {
      fr: { translation: fr },
      ar: { translation: ar },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });
}
applyDirection(initialLocale);

/**
 * Async post-init hook — swaps to the persisted locale (if any) AFTER the
 * synchronous module-level init. Call once at app boot.
 */
export async function initI18n(): Promise<AppLocale> {
  let stored: AppLocale | null = null;
  try {
    const raw = await safeStorage.getItem(STORAGE_KEY);
    if (isSupported(raw)) stored = raw;
  } catch (err) {
    console.warn('[i18n] storage read failed:', err);
  }
  if (stored && stored !== initialLocale) {
    try {
      await i18next.changeLanguage(stored);
      applyDirection(stored);
    } catch (err) {
      console.warn('[i18n] switch to stored locale failed:', err);
    }
    return stored;
  }
  return initialLocale;
}

export async function setLanguage(
  next: AppLocale,
): Promise<{ requiresReload: boolean }> {
  if (!isSupported(next)) throw new Error(`Unsupported locale: ${next}`);
  await i18next.changeLanguage(next);
  try {
    await safeStorage.setItem(STORAGE_KEY, next);
  } catch (err) {
    console.warn('[i18n] storage write failed:', err);
  }
  const flipped = applyDirection(next);
  return { requiresReload: flipped };
}

export function getCurrentLocale(): AppLocale {
  const lng = i18next.language;
  return isSupported(lng) ? lng : DEFAULT_LOCALE;
}

export { default as i18next } from 'i18next';
