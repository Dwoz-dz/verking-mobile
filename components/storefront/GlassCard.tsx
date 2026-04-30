/**
 * Glass surface — semi-transparent white card with soft tinted shadow.
 * Mirrors the Stitch "glass-card" pattern (without backdrop-filter, since RN
 * doesn't support it natively without expo-blur). Visual close-enough.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Drop shadow intensity. */
  elevation?: 'sm' | 'md' | 'lg';
}

export function GlassCard({
  children,
  style,
  radius = Radius.xl,
  elevation = 'md',
}: GlassCardProps) {
  return (
    <View style={[styles.base, shadows[elevation], { borderRadius: radius }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Brand.glass,
    borderWidth: 1,
    borderColor: Brand.glassBorder,
  },
});

const shadows = StyleSheet.create({
  sm: {
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  md: {
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  lg: {
    shadowColor: Brand.shadowDeep,
    shadowOpacity: 1,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
});
