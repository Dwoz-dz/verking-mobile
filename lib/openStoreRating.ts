/**
 * openStoreRating — open the device's app store on the VERKING listing
 * with the rating dialog focused.
 *
 * Why this isn't `Linking.openURL('market://...')` straight up:
 *   ▸ Android: `market://details?id=<pkg>` opens Play Store directly,
 *     but the in-store rating prompt only appears if the user has the
 *     app installed AND is logged into Play Store. We deep-link to
 *     the listing — the user taps the star bar inside.
 *   ▸ iOS: a special URL `https://apps.apple.com/app/id<id>?action=write-review`
 *     opens the App Store with the review composer focused. The legacy
 *     `itms-apps://` scheme is deprecated in iOS 14+.
 *   ▸ Web/dev: gracefully no-op so a misconfigured URL doesn't crash
 *     the user out.
 *
 * The package id + App Store id come from `app.json` and `expo-constants`
 * respectively, so a future renaming doesn't ripple through the codebase.
 */
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { flashInfo } from '@/lib/ui/flash';

// Package id matches `app.json:expo.android.package`.
const ANDROID_PACKAGE = 'com.verking.mobile';
// Filled when the iOS app is published. Until then the iOS path opens
// a friendly toast instead of a 404.
const IOS_APP_ID: string | null = null;

export async function openStoreRating(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      // Best-effort: Play Store first, fall back to https.
      const playStore = `market://details?id=${ANDROID_PACKAGE}`;
      const httpsFallback = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
      const canOpen = await Linking.canOpenURL(playStore);
      await Linking.openURL(canOpen ? playStore : httpsFallback);
      return;
    }
    if (Platform.OS === 'ios') {
      if (!IOS_APP_ID) {
        flashInfo({
          title: '⭐ Bientôt sur l\'App Store',
          body: 'L\'évaluation iOS sera disponible dès la mise en ligne.',
        });
        return;
      }
      const writeReview = `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`;
      await Linking.openURL(writeReview);
      return;
    }
    // Web / unknown — no rating store to open.
    flashInfo({
      title: '⭐ Évaluez l\'application',
      body: 'Téléchargez VERKING sur Play Store pour laisser un avis.',
    });
  } catch (err) {
    console.warn('[openStoreRating] failed', err);
    flashInfo({
      title: 'Erreur',
      body: 'Impossible d\'ouvrir l\'évaluation. Réessayez plus tard.',
    });
  }
}
