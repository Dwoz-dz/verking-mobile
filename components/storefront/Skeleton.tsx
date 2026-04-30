/**
 * Skeleton primitives — shimmering placeholders for slow-loading rails.
 *
 * Built on `react-native-reanimated` (already a dep) so the shimmer is
 * driven by the worklet runtime — no JS-thread setInterval flicker.
 *
 * Three exports:
 *   ▸ `<Skeleton />`             — base block, sized via props
 *   ▸ `<ProductCardSkeleton />`  — drop-in replacement for ProductCard
 *                                   while a rail is loading
 *   ▸ `<RailSkeleton count={4} />` — horizontal row of card skeletons
 *
 * The shimmer travels left → right (RTL flips it) and the wave is tinted
 * with the brand surfaceMuted so it blends into the page without
 * grabbing attention. Cards keep their final dimensions so layout
 * doesn't jump when the real content swaps in.
 */
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const progress = useSharedValue(0);
  const { rowDirection } = useDirection();
  const isRtl = rowDirection === 'row-reverse';

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = (isRtl ? -1 : 1) * (progress.value * 200 - 100);
    return { transform: [{ translateX }] };
  });

  return (
    <View
      style={[
        styles.base,
        { width: width as ViewStyle['width'], height, borderRadius: radius },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, shimmerStyle]} />
    </View>
  );
}

interface ProductCardSkeletonProps {
  width?: number;
}

export function ProductCardSkeleton({ width = 168 }: ProductCardSkeletonProps) {
  return (
    <View style={[styles.card, { width }]}>
      <Skeleton width="100%" height={width} radius={0} />
      <View style={styles.cardBody}>
        <Skeleton width="55%" height={9} radius={4} />
        <Skeleton width="92%" height={12} radius={4} style={{ marginTop: 8 }} />
        <Skeleton width="70%" height={12} radius={4} style={{ marginTop: 4 }} />
        <Skeleton width="40%" height={16} radius={4} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

interface RailSkeletonProps {
  count?: number;
  cardWidth?: number;
}

export function RailSkeleton({ count = 4, cardWidth = 168 }: RailSkeletonProps) {
  return (
    <View style={styles.rail}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} width={cardWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Brand.surfaceMuted,
    overflow: 'hidden',
  },
  shimmer: {
    width: '60%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  cardBody: { padding: Spacing.sm, paddingTop: 10 },
  rail: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});
