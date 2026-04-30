/**
 * MicroConfetti — micro-burst confetti for "win" moments without an
 * extra native dep.
 *
 * Why hand-roll instead of pulling `react-native-confetti-cannon`?
 *   ▸ Confetti happens for less than 800ms, on rare interactions
 *     (add-to-cart, coupon claim, order placed). Pulling a 30 KB
 *     dependency for that one moment is hard to justify, and we'd
 *     need an EAS rebuild to get it on-device.
 *   ▸ Reanimated 3 is already in the bundle. 8 absolute-positioned
 *     Views animated for 800ms is cheap GPU work.
 *   ▸ This component is self-contained and easy to swap for the real
 *     thing later if a "fuller" feel is requested.
 *
 * Usage:
 *   <MicroConfetti visible={hasJustClaimed} onDone={() => setHas(false)} />
 *
 * The component renders nothing when `visible` is false — keeping
 * mounted instances cheap.
 */
import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

const PARTICLE_COLORS = [
  Brand.cta, Brand.coral, Brand.mint, Brand.sunshine,
  Brand.lavender, Brand.fresh, Brand.primary, '#FFFFFF',
];

interface MicroConfettiProps {
  visible: boolean;
  /** Called once the burst animation completes. */
  onDone?: () => void;
}

export function MicroConfetti({ visible, onDone }: MicroConfettiProps) {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PARTICLE_COLORS.map((color, i) => (
        <Particle key={i} index={i} color={color} onLastDone={i === PARTICLE_COLORS.length - 1 ? onDone : undefined} />
      ))}
    </View>
  );
}

function Particle({
  index, color, onLastDone,
}: { index: number; color: string; onLastDone?: () => void }) {
  const { width, height } = Dimensions.get('window');
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    // Spread 8 particles across the centre — fan-out left/right.
    const direction = index % 2 === 0 ? -1 : 1;
    const xTarget = direction * (60 + Math.random() * 80);
    const yTarget = -(140 + Math.random() * 80);
    const delay = index * 30;

    translateX.value = withDelay(
      delay,
      withTiming(xTarget, { duration: 720, easing: Easing.out(Easing.quad) }),
    );
    translateY.value = withDelay(
      delay,
      withSequence(
        withTiming(yTarget, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withTiming(yTarget + 220, { duration: 380, easing: Easing.in(Easing.cubic) }),
      ),
    );
    rotate.value = withDelay(
      delay,
      withTiming(360 + Math.random() * 360, { duration: 760, easing: Easing.linear }),
    );
    opacity.value = withDelay(
      delay + 480,
      withTiming(0, { duration: 280 }, () => {
        if (onLastDone) runOnJS(onLastDone)();
      }),
    );
    // Center of screen ish: this useEffect runs once on mount
    void width; void height;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: color },
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 10,
    height: 14,
    marginLeft: -5,
    marginTop: -7,
    borderRadius: 3,
  },
});

export default MicroConfetti;
