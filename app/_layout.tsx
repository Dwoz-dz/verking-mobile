/**
 * Root layout — boots i18n + brand fonts before unhiding the splash.
 *
 * We keep the splash visible until BOTH:
 *   - i18n initialised (so the first frame renders in the right locale
 *     + RTL direction, no FOUC),
 *   - Plus Jakarta Sans (Brand font) is registered with expo-font, so
 *     no text flashes in the platform default font.
 *
 * Font loading uses @expo-google-fonts/plus-jakarta-sans which ships
 * the .ttf files inside node_modules. If the font load fails (no
 * network on first launch, etc.) we still boot the app: Brand styles
 * fall back to the platform sans-serif via BrandFont.fallback.
 */
// Phase 12.f — install the RN Web 0.21 shadow-shim BEFORE any component
// that ships a style with shadow* props mounts, otherwise the indexed
// setter on CSSStyleDeclaration explodes during the first commit. The
// shim is a no-op outside the web target, so importing it
// unconditionally is safe.
import { installWebStyleShim } from '@/lib/webStyleShim';
installWebStyleShim();

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppliedCouponProvider } from '@/components/cart/AppliedCouponContext';
import { CartFab } from '@/components/cart/CartFab';
import { CartProvider } from '@/components/cart/CartProvider';
import { AnimatedSplash } from '@/components/decorative/AnimatedSplash';
import { DrawerMenu } from '@/components/navigation/DrawerMenu';
import { DrawerProvider } from '@/components/navigation/DrawerProvider';
import { ThemeProvider as VkThemeProvider } from '@/lib/theme/ThemeContext';
import { isOnboarded } from '@/app/onboarding';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initI18n } from '@/i18n';
import { mountMobileConfigChannel } from '@/lib/realtime/mobileConfigChannel';
import { trackSessionStart } from '@/services/analytics';
import { wireNotificationHandlers } from '@/services/push';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op */
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [i18nReady, setI18nReady] = useState(false);
  // Phase 16 — keep the AnimatedSplash mounted as an overlay until BOTH
  // the boot dependencies are ready AND the splash's own 2 s minimum
  // showtime has elapsed. We track them as two flags so neither can
  // shorten the other: a fast cold boot still gets the full splash
  // (premium feel), and a slow boot doesn't yank the splash mid-fade.
  const [splashMounted, setSplashMounted] = useState(true);    // false after fade completes
  const [splashMinElapsed, setSplashMinElapsed] = useState(false); // flips at +2 s

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initI18n();
      } catch (err) {
        console.warn('[boot] i18n init failed:', err);
      } finally {
        if (!cancelled) setI18nReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (i18nReady && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
      // Fire-and-forget: never blocks UX even on cold cache or no network.
      trackSessionStart();
      // First-launch onboarding gate. The flag is set inside the
      // onboarding screen on completion / skip, so subsequent
      // launches go straight to the home tab.
      void (async () => {
        const seen = await isOnboarded();
        if (!seen) router.replace('/onboarding' as never);
      })();
    }
  }, [i18nReady, fontsLoaded, fontError, router]);

  // Mount the mobile-config realtime channel once. Survives the whole
  // app lifetime; supabase-js handles reconnects internally.
  useEffect(() => {
    const unmount = mountMobileConfigChannel();
    return () => unmount();
  }, []);

  // Phase 11 — wire push notification handlers only when the native
  // ExpoPushTokenManager module is registered (i.e. this build was
  // produced with `eas build` or `expo run:android` after the package
  // was installed). The wiring helper self-skips when absent.
  //
  // Registration is intentionally NOT auto-fired at boot anymore — the
  // user activates from /notifications when they're ready. That gives a
  // clean OS prompt with intent, and avoids any chance of the native
  // module side-loading throwing on first launch.
  useEffect(() => {
    void wireNotificationHandlers(router);
  }, [router]);

  // Phase 16 — anti-freeze boot: never return null. We ALWAYS render
  // the full provider tree on the very first frame so it can hydrate
  // in parallel with the splash animation. The AnimatedSplash overlays
  // the tree until BOTH (a) i18n + fonts have resolved and (b) the
  // splash's own minimum 2 s showtime has elapsed — whichever comes
  // last. That keeps the splash a single mount (no animation restart)
  // while still guaranteeing the user never sees a half-loaded UI.
  const bootReady = i18nReady && (fontsLoaded || fontError);

  // Minimum-show-time gate: starts a 2 s timer on first paint.
  useEffect(() => {
    const t = setTimeout(() => setSplashMinElapsed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Tell the splash to fade out only when both gates are open.
  // `bootReady` carries the `Error | null` from `fontError`, so we
  // coerce to a strict boolean for the splash prop.
  const splashShouldHide = Boolean(bootReady) && splashMinElapsed;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <VkThemeProvider>
    <DrawerProvider>
    <CartProvider>
      <AppliedCouponProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="product/[id]"
            options={{
              title: 'Produit',
              presentation: 'card',
              headerBackTitle: 'Retour',
            }}
          />
          <Stack.Screen
            name="cart"
            options={{
              title: 'Mon panier',
              presentation: 'card',
              headerBackTitle: 'Retour',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="checkout"
            options={{ title: 'Commande rapide', presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen
            name="about"
            options={{ title: 'À propos', presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="settings/index"
            options={{ title: 'Paramètres', presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="coupons"
            options={{ title: 'Coupons', presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="notifications"
            options={{ title: 'Notifications', presentation: 'card', headerBackTitle: 'Retour', headerShown: false }}
          />
          <Stack.Screen
            name="loyalty"
            options={{ title: 'Étoiles VERKING', presentation: 'card', headerBackTitle: 'Retour', headerShown: false }}
          />
          <Stack.Screen
            name="packs"
            options={{ title: 'Packs Classe', presentation: 'card', headerBackTitle: 'Retour', headerShown: false }}
          />
          <Stack.Screen
            name="wishlist"
            options={{ title: 'Favoris', presentation: 'card', headerBackTitle: 'Retour', headerShown: false }}
          />
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="register"
            options={{ headerShown: false, presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="page/[slug]"
            options={{ title: '', presentation: 'card', headerBackTitle: 'Retour' }}
          />
          {/* Phase 3.5 — admin-driven static info pages (Help / FAQ /
              Privacy / Terms). Distinct from `/page/[slug]` (themed
              marketing pages) so the simple text content doesn't have
              to fit the rich themed-page schema. */}
          <Stack.Screen
            name="info/[slug]"
            options={{ headerShown: false, presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="profile/edit"
            options={{ headerShown: false, presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="addresses"
            options={{ headerShown: false, presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="recently-viewed"
            options={{ headerShown: false, presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="settings/dark-mode"
            options={{ headerShown: false, presentation: 'card', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="settings/video-preferences"
            options={{ headerShown: false, presentation: 'card', headerBackTitle: 'Retour' }}
          />
        </Stack>
        <CartFab />
        <DrawerMenu />
        <StatusBar style="auto" />
      </ThemeProvider>
      </AppliedCouponProvider>
    </CartProvider>
    </DrawerProvider>
    </VkThemeProvider>
    {/* Phase 16 — splash overlay. Mounted exactly once on first paint
        and stays on top of the Stack until the parent's two gates
        (boot ready AND 2 s minimum) are both open. We then flip
        `hide={true}`, which drives the splash's internal fade-out;
        on completion the splash calls `onDone` and we drop it from
        the tree. Single mount → no animation restart, no invisible
        zombie overlay. */}
    {splashMounted && (
      <AnimatedSplash
        hide={splashShouldHide}
        onDone={() => setSplashMounted(false)}
      />
    )}
    </GestureHandlerRootView>
  );
}
