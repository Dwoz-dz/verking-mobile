/**
 * DraggableChipsRow — admin-managed quick chips with Temu-style
 * long-press → drag → reorder UX.
 *
 * Behaviour:
 *   ▸ Tap (no long press)        → router.push(chip.link_url)
 *   ▸ Long-press 350ms            → enters drag mode + light haptic
 *   ▸ Pan horizontal              → reorder live (chips swap as the
 *                                   user crosses each chip's centre)
 *   ▸ Release                     → spring back, save reorder
 *                                   (medium haptic)
 *
 * Why Reanimated 3 + gesture-handler instead of a 3rd-party library:
 *   • Both packages are already shipped in the app (no extra
 *     install / rebuild).
 *   • The chip count is small (≤ 10), so a hand-rolled swap-based
 *     reorder is faster than a generic drag-and-drop list.
 *   • Layout animations stay GPU-driven via `LinearTransition`.
 *
 * RTL: the row uses `useDirection().rowDirection` so chip order flips
 * naturally in Arabic. Drag math operates on horizontal pixels, which
 * remains direction-agnostic — `Math.round(translateX / chipWidth)`
 * just happens to bucket negative offsets to the LTR-left or
 * RTL-right neighbour, exactly what we want.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { useQuickChips, type QuickChip } from '@/services/quickChips';

const CHIP_WIDTH_ESTIMATE = 110; // average chip incl. margin — enough for swap math
const LONG_PRESS_MS = 350;

export function DraggableChipsRow() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { rowDirection } = useDirection();
  const isAr = i18n.language === 'ar';
  const { chips, loading, applyOrder } = useQuickChips();

  const [activeId, setActiveId] = useState<string | null>(null);
  const orderRef = useRef<string[]>([]);

  // Keep the ref in sync with the current chip list so the drag
  // gesture always reads from the latest snapshot.
  orderRef.current = useMemo(() => chips.map((c) => c.id), [chips]);

  const onTapChip = useCallback(
    (chip: QuickChip) => {
      const target = chip.link_url || '/shop';
      router.push(target as never);
    },
    [router],
  );

  const onActiveChange = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  const onCommitOrder = useCallback(
    (newOrder: string[]) => {
      if (newOrder.length === 0) return;
      // Cheap deep-eq via JSON — chip ids are short uuids.
      if (JSON.stringify(newOrder) === JSON.stringify(orderRef.current)) return;
      applyOrder(newOrder);
    },
    [applyOrder],
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Skeleton: 5 placeholder pills */}
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.chipBase, styles.skeleton]} />
        ))}
      </View>
    );
  }

  if (chips.length === 0) return null;

  return (
    <View style={[styles.container, { flexDirection: rowDirection }]}>
      {chips.map((chip, index) => (
        <DraggableChip
          key={chip.id}
          chip={chip}
          index={index}
          isActive={activeId === chip.id}
          isAr={isAr}
          onTap={() => onTapChip(chip)}
          onActiveChange={onActiveChange}
          onCommitOrder={onCommitOrder}
          orderRef={orderRef}
        />
      ))}
    </View>
  );
}

interface DraggableChipProps {
  chip: QuickChip;
  index: number;
  isActive: boolean;
  isAr: boolean;
  onTap: () => void;
  onActiveChange: (id: string | null) => void;
  onCommitOrder: (newOrder: string[]) => void;
  orderRef: { current: string[] };
}

function DraggableChip({
  chip, index, isActive, isAr, onTap, onActiveChange, onCommitOrder, orderRef,
}: DraggableChipProps) {
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const elevation = useSharedValue(0);
  const opacity = useSharedValue(1);

  const triggerActive = useCallback(() => {
    onActiveChange(chip.id);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [chip.id, onActiveChange]);

  const triggerCommit = useCallback(
    (newOrder: string[]) => {
      onActiveChange(null);
      onCommitOrder(newOrder);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    },
    [onActiveChange, onCommitOrder],
  );

  // Long-press → enter drag mode (sets active state + lifts the chip)
  const longPress = Gesture.LongPress()
    .minDuration(LONG_PRESS_MS)
    .onStart(() => {
      'worklet';
      scale.value = withSpring(1.12, { damping: 14 });
      elevation.value = withTiming(12, { duration: 150 });
      opacity.value = withTiming(0.94, { duration: 150 });
      runOnJS(triggerActive)();
    });

  // Pan — only meaningful once long-press has activated drag mode.
  // We translate the chip and compute a target index based on swap
  // distance, then commit the new order on release.
  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onUpdate((evt) => {
      'worklet';
      // RTL: invert translation so visual drag matches finger
      translateX.value = isAr ? -evt.translationX : evt.translationX;
    })
    .onEnd(() => {
      'worklet';
      const dx = translateX.value;
      const swap = Math.round(dx / CHIP_WIDTH_ESTIMATE);
      const order = orderRef.current.slice();
      const from = index;
      const to = Math.min(order.length - 1, Math.max(0, from + swap));
      if (from !== to) {
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
      }
      // Spring back to home position and clear visual state.
      translateX.value = withSpring(0, { damping: 16, stiffness: 220 });
      scale.value = withSpring(1, { damping: 14 });
      elevation.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
      runOnJS(triggerCommit)(order);
    })
    .onFinalize(() => {
      'worklet';
      // Safety: release even if `onEnd` didn't fire (rare).
      translateX.value = withSpring(0, { damping: 16 });
      scale.value = withSpring(1, { damping: 14 });
      elevation.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    });

  // Tap — only fires when neither long-press nor pan claimed the
  // gesture, exactly the Temu UX where a quick tap = navigate.
  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      'worklet';
      if (success) {
        runOnJS(onTap)();
      }
    });

  const composed = Gesture.Race(Gesture.Simultaneous(longPress, pan), tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    elevation: elevation.value,
    shadowOpacity: elevation.value / 24,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        layout={LinearTransition.springify().damping(18).stiffness(180)}
        style={[
          styles.chipBase,
          {
            backgroundColor: chip.accent_color + '14', // ~8% alpha
            borderColor: chip.accent_color + '55',     // ~33% alpha
          },
          isActive && styles.chipActive,
          animatedStyle,
        ]}
      >
        {chip.emoji ? <Text style={styles.chipEmoji}>{chip.emoji}</Text> : null}
        <Text
          style={[styles.chipLabel, { color: chip.accent_color }]}
          numberOfLines={1}
        >
          {isAr ? chip.label_ar : chip.label_fr}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  chipBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: Brand.primaryTint,
    shadowColor: 'rgba(15,23,42,0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  chipActive: {
    zIndex: 5,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontFamily: BrandFont.bold,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  skeleton: {
    width: 80,
    height: 32,
    backgroundColor: Brand.surfaceMuted,
    borderColor: Brand.border,
  },
});

export default DraggableChipsRow;
