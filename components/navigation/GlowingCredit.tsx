/**
 * GlowingCredit — animated "By-Mohce-ND" credit footer.
 * Uses a shared shadowOpacity on the wrapper to fake a pulsing glow
 * (text-shadow CSS doesn't exist in RN; we layer two coloured shadows
 * via shadow* on the wrapper view).
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Brand, BrandFont } from '@/constants/theme';

interface Props {
  /** Year label override; defaults to current. */
  year?: number;
}

export function GlowingCredit({ year }: Props) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.45 + t.value * 0.55,
    shadowRadius: 12 + t.value * 14,
  }));

  const y = year ?? new Date().getFullYear();

  return (
    <View style={styles.wrap}>
      <Text style={styles.copy}>
        © {y} VERKING. جميع الحقوق محفوظة.
      </Text>
      <Animated.View style={[styles.glowWrap, glowStyle]}>
        <Text style={styles.creditText}>
          ✨ By <Text style={styles.creditAccent}>Mohcen-ND</Text>
        </Text>
      </Animated.View>
      <Text style={styles.version}>v1.0.0 · made with 🧡</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  copy: {
    fontFamily: BrandFont.medium,
    fontWeight: '600',
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
  },
  glowWrap: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: Brand.cta,
    shadowOffset: { width: 0, height: 0 },
  },
  creditText: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
  creditAccent: {
    color: Brand.sunshine,
  },
  version: {
    fontFamily: BrandFont.medium,
    fontWeight: '500',
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.4,
  },
});

export default GlowingCredit;
