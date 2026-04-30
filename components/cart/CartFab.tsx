/**
 * CartFab — floating "Cart" action button.
 *
 * Shape: ⌀56 circle in brand orange, bottom-right of the screen, above
 * the tab bar. A red counter badge sits on the top-right corner.
 *
 * Behaviour:
 *   ▸ Hidden when the cart is empty (`autoHide` prop, default true).
 *     Avoids visual clutter on first-launch home.
 *   ▸ Tapping it routes to `/cart`.
 *   ▸ Counter scale-bumps with reanimated whenever it changes — gives
 *     instant visual confirmation that an "Add to cart" tap worked,
 *     even when the FAB itself wasn't pressed.
 *   ▸ Optional haptic on press (medium impact).
 *
 * The FAB is rendered ONCE at the root layout, NOT inside individual
 * screens — that way it stays put across navigation and isn't re-created
 * on every route change.
 *
 * RTL: in Arabic the FAB flips to the bottom-LEFT corner so it sits on
 * the trailing edge of the reading direction (matches AliExpress AR).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useCartTotals } from '@/components/cart/CartProvider';
import { useFabBottomOffset } from '@/constants/layout';
import { Brand } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

interface CartFabProps {
  /** Hide entirely when the cart is empty. Default true. */
  autoHide?: boolean;
  /**
   * Optional manual override for the distance from the bottom edge
   * (px). When omitted, the FAB sits a safe gap above the floating
   * tab bar (~96 px including safe-area inset).
   */
  bottomOffset?: number;
}

export function CartFab({ autoHide = true, bottomOffset }: CartFabProps) {
  const router = useRouter();
  // Phase 1.4 — shared layout constant; the cart FAB and the promo
  // pill now agree on what "above the tab bar" means.
  const fabBottom = useFabBottomOffset();
  const { unit_count } = useCartTotals();
  const { rowDirection } = useDirection();
  const effectiveBottom = bottomOffset ?? fabBottom;

  // Bump animation on counter change.
  const scale = useSharedValue(1);
  const badgeScale = useSharedValue(1);

  useEffect(() => {
    if (unit_count === 0) return;
    scale.value = withSequence(
      withTiming(1.15, { duration: 120 }),
      withTiming(1, { duration: 180 }),
    );
    badgeScale.value = withSequence(
      withTiming(1.35, { duration: 120 }),
      withTiming(1, { duration: 180 }),
    );
  }, [badgeScale, scale, unit_count]);

  const containerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  if (autoHide && unit_count === 0) return null;

  // RTL: flip the corner anchor.
  const isRtl = rowDirection === 'row-reverse';
  const positionStyle = isRtl
    ? { left: 16, right: undefined }
    : { right: 16, left: undefined };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push('/cart');
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrapper, positionStyle, { bottom: effectiveBottom }, containerStyle]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Cart"
        accessibilityState={{ disabled: false }}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="bag-handle" size={24} color="#FFFFFF" />
        {unit_count > 0 ? (
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText} allowFontScaling={false}>
              {unit_count > 99 ? '99+' : String(unit_count)}
            </Text>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 50,
    elevation: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: Brand.coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
