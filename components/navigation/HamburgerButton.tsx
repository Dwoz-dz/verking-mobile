/**
 * HamburgerButton — animated 3-line icon that morphs to a chevron
 * when the drawer opens. Drops into any header.
 */
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { Brand } from '@/constants/theme';
import { useThemedBrand } from '@/lib/theme/ThemeContext';
import { useDrawer } from '@/components/navigation/DrawerProvider';

interface Props {
  /** Tint for the icon strokes. Defaults to Brand.primary. */
  color?: string;
  /** 36 by default — big enough for a comfortable tap target. */
  size?: number;
}

export function HamburgerButton({ color, size = 36 }: Props) {
  const themed = useThemedBrand();
  const { isOpen, toggle } = useDrawer();
  const tint = color ?? themed.primary ?? Brand.primary;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(isOpen ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [isOpen, progress]);

  const onPress = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    toggle();
  };

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-5, 0]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` },
    ],
  }));
  const midStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [{ scaleX: interpolate(progress.value, [0, 1], [1, 0.4]) }],
  }));
  const botStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [5, 0]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, -45])}deg` },
    ],
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      accessibilityState={{ expanded: isOpen }}
      style={[styles.container, { width: size, height: size }]}
    >
      <View style={styles.linesWrap}>
        <Animated.View style={[styles.line, { backgroundColor: tint }, topStyle]} />
        <Animated.View style={[styles.line, { backgroundColor: tint }, midStyle]} />
        <Animated.View style={[styles.line, { backgroundColor: tint }, botStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  linesWrap: {
    width: 22,
    height: 16,
    justifyContent: 'space-between',
  },
  line: {
    height: 2.4,
    borderRadius: 2,
    width: '100%',
  },
});

export default HamburgerButton;
