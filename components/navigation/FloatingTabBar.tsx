/**
 * FloatingTabBar — premium glass-pill tab bar that floats above the
 * native gesture / nav bar.
 *
 * Why this exists:
 *   The default `tabBarStyle` runs flush to the bottom edge with a
 *   fixed height, so on Android it overlaps the system gesture pill /
 *   3-button nav bar (cf. user feedback on PTP-N49). This component
 *   replaces it with a centered, rounded "pill" anchored above
 *   `useSafeAreaInsets().bottom + 12px` so the OS bar is never
 *   hidden by the tab area.
 *
 * Visual:
 *   ▸ 92% width pill, radius 28
 *   ▸ rgba(white, 0.92) "glass" — readable without expo-blur
 *     (we don't ship native BlurView yet; rgba + heavy shadow gets
 *     ~80% of the look at zero install cost)
 *   ▸ subtle inset border for definition on light backgrounds
 *   ▸ active tab → orange pill behind icon + label, scaled 1.05 with
 *     spring (Reanimated 3)
 *   ▸ haptic light impact on every tab change
 *
 * Plugged into `<Tabs tabBar={...}>` so we keep expo-router routing
 * exactly as-is — only the chrome changes.
 *
 * RTL: row direction flips automatically via `useDirection()` so
 * the tab order matches the script.
 */
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, BrandFont, Radius } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { useMobileTheme } from '@/services/mobileConfig';

const ICON_FOR_ROUTE: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  explore: 'grid',
  orders: 'receipt-outline',
  profile: 'person-circle-outline',
};

const ICON_ACTIVE_FOR_ROUTE: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  explore: 'grid',
  orders: 'receipt',
  profile: 'person-circle',
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { rowDirection } = useDirection();
  const theme = useMobileTheme();

  // Bottom anchor: respect safe-area + add a small breathing gap above
  // the OS gesture/nav bar so the pill never visually touches it.
  const bottomGap = Math.max(insets.bottom, 8) + 8;

  // Admin-driven tab bar style. The component is named "FloatingTabBar"
  // because that's the default; "flat" stretches edge-to-edge with no
  // shadow, "minimal" hides the labels.
  const style = theme.tab_bar_style ?? 'floating';
  const isFlat = style === 'flat';
  const isMinimal = style === 'minimal';

  const pillStyle = isFlat
    ? [styles.pill, styles.pillFlat]
    : [styles.pill];

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outer,
        { bottom: isFlat ? 0 : bottomGap },
      ]}
    >
      <View
        style={[
          ...pillStyle,
          { flexDirection: rowDirection },
          isFlat ? { paddingBottom: insets.bottom + 6 } : null,
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              if (Platform.OS !== 'web') {
                Haptics.selectionAsync().catch(() => {
                  /* no-op — haptics unavailable on emulator */
                });
              }
              navigation.navigate(route.name as never);
            }
          };

          const iconName = isFocused
            ? (ICON_ACTIVE_FOR_ROUTE[route.name] ?? 'ellipse')
            : (ICON_FOR_ROUTE[route.name] ?? 'ellipse-outline');

          return (
            <TabItem
              key={route.key}
              label={label}
              iconName={iconName}
              isFocused={isFocused}
              onPress={onPress}
              hideLabel={isMinimal}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabItemProps {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  isFocused: boolean;
  onPress: () => void;
  hideLabel?: boolean;
  accessibilityLabel: string;
}

function TabItem({ label, iconName, isFocused, onPress, accessibilityLabel, hideLabel = false }: TabItemProps) {
  const scale = useSharedValue(isFocused ? 1.06 : 1);
  const pillProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.06 : 1, { damping: 14, stiffness: 220 });
    pillProgress.value = withTiming(isFocused ? 1 : 0, { duration: 220 });
  }, [isFocused, pillProgress, scale]);

  const itemStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillProgress.value,
    transform: [{ scale: 0.9 + 0.1 * pillProgress.value }],
  }));

  const tint = isFocused ? Brand.cta : Brand.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel}
      style={styles.itemPressable}
      hitSlop={8}
    >
      <Animated.View style={[styles.item, itemStyle]}>
        <Animated.View style={[styles.activePill, pillStyle]} />
        <Ionicons name={iconName} size={22} color={tint} />
        {hideLabel ? null : (
          <Text style={[styles.itemLabel, { color: tint }]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  pill: {
    width: '92%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: Radius.xxl + 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: 'rgba(15,23,42,0.18)',
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,229,235,0.65)',
  },
  pillFlat: {
    width: '100%',
    borderRadius: 0,
    paddingTop: 6,
    shadowOpacity: 0,
    elevation: 0,
    borderTopWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  itemPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    minWidth: 60,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  activePill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Brand.ctaSoft,
    borderRadius: Radius.xl,
  },
  itemLabel: {
    fontFamily: BrandFont.bold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
});

export default FloatingTabBar;
