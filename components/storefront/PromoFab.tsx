/**
 * PromoFab — admin-driven floating promotional pill above the bottom
 * tab bar. Phase 6 wiring:
 *
 *   ▸ Reads `mobile_fab_promotions` via `useFabPromo(ctx)` — the hook
 *     filters client-side by current cart total + wilaya + screen +
 *     auth state, sorts by priority desc, and returns the winner.
 *   ▸ Tracks one impression per (session, promo) and one click per
 *     tap, fire-and-forget.
 *   ▸ Hides cleanly when no candidate matches — no fallback Search
 *     button, no static rotation: silence is preferred to noise.
 *
 * The `screen` prop is set by the tab-layout host (defaults to
 * `home`). Future: derive automatically from the active route.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useCartTotals } from '@/components/cart/CartProvider';
import { useFabBottomOffset } from '@/constants/layout';
import { subscribeFabDirection, type ScrollDirection } from '@/lib/ui/fabVisibility';
import {
  resolveFabLink,
  trackFabClick,
  useFabImpressionTracking,
  useFabPromo,
  type FabScreen,
} from '@/services/fabPromotions';
import { useDefaultWilaya } from '@/services/mobileConfig';

interface PromoFabProps {
  /** Optional override — auto-detected from the active route otherwise. */
  screen?: FabScreen;
}

/**
 * Maps the active expo-router segment to a `FabScreen` string the
 * admin can target. Tabs route segments look like:
 *   ['(tabs)', 'index']    → 'home'
 *   ['(tabs)', 'explore']  → 'search'
 *   ['(tabs)', 'orders']   → 'orders'
 *   ['(tabs)', 'profile']  → 'profile'
 *   ['cart']               → 'cart'
 * Anything else (modal, settings, etc.) gets clamped to 'home' so
 * the FAB still has a reasonable filter to apply.
 */
function deriveScreen(segments: string[]): FabScreen {
  // segments come in as e.g. ['(tabs)', 'index']
  const last = segments[segments.length - 1] ?? '';
  if (last === 'cart' || segments.includes('cart')) return 'cart';
  if (last === 'index') return 'home';
  if (last === 'explore') return 'search';
  if (last === 'orders') return 'orders';
  if (last === 'profile') return 'profile';
  return 'home';
}

const KNOWN_IONICON_NAMES = new Set([
  'pricetag', 'pricetags', 'flash', 'flame', 'school', 'cart', 'gift', 'cube',
  'star', 'heart', 'rocket', 'sparkles', 'bookmark', 'time', 'eye',
]);

function isLikelyEmoji(s: string | null | undefined): boolean {
  if (!s) return false;
  // Emoji are typically a single grapheme cluster; Ionicons names are
  // ASCII slugs. This heuristic handles both without needing a full
  // Unicode property table.
  return [...s].some((ch) => ch.codePointAt(0)! > 127) || s.length <= 2;
}

export function PromoFab({ screen: screenOverride }: PromoFabProps) {
  const { i18n } = useTranslation();
  const router = useRouter();
  // Phase 1.4 — single source of truth (constants/layout) for FAB
  // position so it stays in lock-step with screen paddingBottom values.
  const fabBottom = useFabBottomOffset();
  const cart = useCartTotals();
  const { effectiveCode } = useDefaultWilaya();
  const segments = useSegments();

  const isAr = i18n.language === 'ar';
  const screen: FabScreen = screenOverride ?? deriveScreen(segments as unknown as string[]);

  // Memoise so the hook doesn't re-derive every render.
  const ctx = useMemo(
    () => ({
      cart_total: cart.subtotal,
      wilaya_code: effectiveCode,
      screen,
      is_logged_in: false,          // Phase 2A wires the real auth check
    }),
    [cart.subtotal, effectiveCode, screen],
  );
  const { promo } = useFabPromo(ctx);
  useFabImpressionTracking(promo?.id);

  // Phase Final — auto-hide on scroll-down (Instagram-style). Subscribes
  // to the global fabVisibility bus; any ScrollView that calls
  // `reportScrollY` will drive this animation.
  const translateY = useSharedValue(0);
  const [direction, setDirection] = useState<ScrollDirection>('idle');
  useEffect(() => {
    return subscribeFabDirection(setDirection);
  }, []);
  useEffect(() => {
    translateY.value = withTiming(direction === 'down' ? 80 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [direction, translateY]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!promo) return null;

  const label = isAr ? promo.label_ar : promo.label_fr;
  const iconAsEmoji = isLikelyEmoji(promo.icon);
  const iconAsIonicon = !iconAsEmoji && promo.icon && KNOWN_IONICON_NAMES.has(promo.icon)
    ? (promo.icon as keyof typeof Ionicons.glyphMap)
    : null;

  const onPress = () => {
    trackFabClick(promo.id);
    const target = resolveFabLink(promo);
    if (target) router.push(target as never);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: fabBottom }, animatedStyle]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: promo.bg_color },
          pressed && { transform: [{ scale: 0.96 }] },
        ]}
      >
        {iconAsEmoji && promo.icon ? (
          <Text style={[styles.icon, { color: promo.text_color }]}>{promo.icon}</Text>
        ) : iconAsIonicon ? (
          <Ionicons name={iconAsIonicon} size={14} color={promo.text_color} />
        ) : null}
        <Text style={[styles.label, { color: promo.text_color }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 50,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999,
    shadowColor: 'rgba(15,23,42,0.35)',
    shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    maxWidth: 240,
  },
  icon: { fontSize: 14 },
  label: { fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
});

export default PromoFab;
