/**
 * HeartButton — Phase 10 wishlist toggle.
 *
 * Reactive: subscribes to the module-level wishlist Set, so flipping the
 * heart on one card updates every instance of the same product across the
 * app. Optimistic via toggleWishlist() — UI flips first, RPC reconciles.
 *
 * Visual:
 *   ▸ Empty state  — outline heart in textMuted on a soft surface bubble.
 *   ▸ Saved state  — filled heart in coral with a subtle pulse on tap.
 *   ▸ Sized via the `size` prop; default 22px is the right footprint for
 *     a card-corner button without crowding the badges.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import { toggleWishlist, useIsSaved } from '@/services/wishlist';

interface HeartButtonProps {
  productId: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Render variant — `card` is the corner style with backdrop, `bare` is just the heart. */
  variant?: 'card' | 'bare';
}

export function HeartButton({ productId, size = 22, style, variant = 'card' }: HeartButtonProps) {
  const saved = useIsSaved(productId);
  const scale = useRef(new Animated.Value(1)).current;

  const onPress = async () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
    await toggleWishlist(productId);
  };

  const heart = (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons
        name={saved ? 'heart' : 'heart-outline'}
        size={size}
        color={saved ? Brand.coral : Brand.textMuted}
      />
    </Animated.View>
  );

  if (variant === 'bare') {
    return (
      <Pressable onPress={onPress} hitSlop={10} style={style}>
        {heart}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.cardWrap, style]}>
      <View style={[styles.cardBubble, saved && styles.cardBubbleSaved]}>
        {heart}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrap: { padding: 4 },
  cardBubble: {
    width: 36, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: Brand.shadow, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardBubbleSaved: {
    backgroundColor: Brand.coralSoft,
  },
});
