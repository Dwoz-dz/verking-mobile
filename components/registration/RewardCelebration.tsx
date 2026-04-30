/**
 * RewardCelebration — fullscreen "you won!" modal.
 *
 * Shown right after a successful register / step2 / coupon claim.
 * Stacks 4 layers of joy:
 *   1. Backdrop with cream blur
 *   2. MicroConfetti burst (already used elsewhere)
 *   3. Animated trophy + count-up points number
 *   4. Coupon ticket card sliding from bottom (if a coupon was issued)
 *
 * The user dismisses via the big "🎉 على بركة الله" button. The parent
 * controls `visible` and provides `points`, `couponCode?` and an
 * optional `onDone()`.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MicroConfetti } from '@/components/decorative/MicroConfetti';
import { BrandFont, Radius, Spacing } from '@/constants/theme';
import { KidColors } from '@/constants/kidColors';

interface Props {
  visible: boolean;
  /** Points granted (animated count-up from 0 → points). */
  points: number;
  /** Optional coupon code if the welcome coupon was issued. */
  couponCode?: string | null;
  /** Optional headline override (default uses i18n via parent). */
  title?: string;
  /** Optional sub-headline. */
  subtitle?: string;
  /** Action label on the dismiss button. */
  ctaLabel?: string;
  onDone: () => void;
}

export function RewardCelebration({
  visible, points, couponCode, title, subtitle, ctaLabel, onDone,
}: Props) {
  // Animated count-up of the points number
  const counter = useSharedValue(0);
  const trophyScale = useSharedValue(0);
  const ticketY = useSharedValue(80);
  const ticketOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    counter.value = 0;
    trophyScale.value = 0;
    ticketY.value = 80;
    ticketOpacity.value = 0;

    trophyScale.value = withSequence(
      withSpring(1.18, { damping: 8, stiffness: 180 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    );
    counter.value = withDelay(
      120,
      withTiming(points, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    if (couponCode) {
      ticketY.value = withDelay(700, withSpring(0, { damping: 16, stiffness: 200 }));
      ticketOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [visible, points, couponCode, counter, trophyScale, ticketY, ticketOpacity]);

  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trophyScale.value }],
  }));

  const ticketStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ticketY.value }],
    opacity: ticketOpacity.value,
  }));

  // We can't read the SharedValue inside JSX directly without
  // re-rendering. Use derivedValue + a tiny bridge component.
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDone}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <MicroConfetti visible={visible} />
        <View style={styles.card}>
          {/* Decorative blobs */}
          <View style={[styles.blobOne, { backgroundColor: KidColors.coralPink + 'AA' }]} />
          <View style={[styles.blobTwo, { backgroundColor: KidColors.butter + 'CC' }]} />

          {/* Trophy emoji with bounce */}
          <Animated.View style={[styles.trophyWrap, trophyStyle]}>
            <Text style={styles.trophyEmoji}>🎉</Text>
          </Animated.View>

          {/* Headline */}
          <Text style={styles.title} numberOfLines={2}>
            {title ?? 'مبروك! 🎁'}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text>
          ) : null}

          {/* Animated points counter */}
          <View style={styles.pointsWrap}>
            <Text style={styles.plus}>+</Text>
            <CountUpText sharedValue={counter} style={styles.pointsValue} />
            <Text style={styles.pointsUnit}>pts</Text>
          </View>

          {/* Coupon ticket */}
          {couponCode ? (
            <Animated.View style={[styles.ticket, ticketStyle]}>
              <View style={styles.ticketLeft}>
                <Text style={styles.ticketEmoji}>🎫</Text>
              </View>
              <View style={styles.ticketDivider} />
              <View style={styles.ticketRight}>
                <Text style={styles.ticketLabel}>VOTRE COUPON</Text>
                <Text style={styles.ticketCode} numberOfLines={1}>{couponCode}</Text>
                <Text style={styles.ticketCta}>Disponible dans Mes coupons →</Text>
              </View>
            </Animated.View>
          ) : null}

          {/* Dismiss CTA */}
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              onDone();
            }}
            style={({ pressed }) => [
              styles.cta,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.ctaText}>
              {ctaLabel ?? 'على بركة الله 🚀'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Tiny helper that bridges a SharedValue<number> to a Text node by
// re-rendering with `useDerivedValue` + an inner state mirror. Keeps
// the RewardCelebration component self-contained without forcing
// every consumer to deal with reanimated worklets.
import { useDerivedValue, runOnJS } from 'react-native-reanimated';
import { useState as useStateInner } from 'react';
function CountUpText({ sharedValue, style }: { sharedValue: SharedValue<number>; style: object }) {
  void Animated; // keep import live for type usage above
  const [v, setV] = useStateInner(0);
  useDerivedValue(() => {
    runOnJS(setV)(Math.round(sharedValue.value));
    return sharedValue.value;
  }, [sharedValue]);
  return <Text style={style}>{v.toLocaleString('fr-FR')}</Text>;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: KidColors.creamSoft,
    borderRadius: Radius.xxl + 8,
    padding: Spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: 'rgba(15,23,42,0.4)',
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 24,
  },
  blobOne: {
    position: 'absolute',
    top: -60, right: -40,
    width: 200, height: 200, borderRadius: 999,
  },
  blobTwo: {
    position: 'absolute',
    bottom: -70, left: -50,
    width: 220, height: 220, borderRadius: 999,
  },
  trophyWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: KidColors.butter,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: KidColors.sunshine,
    zIndex: 2,
  },
  trophyEmoji: { fontSize: 56 },
  title: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 26, color: KidColors.text,
    marginTop: Spacing.md, textAlign: 'center', zIndex: 2,
  },
  subtitle: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 14, color: KidColors.textSoft,
    marginTop: 6, textAlign: 'center', zIndex: 2,
  },
  pointsWrap: {
    flexDirection: 'row', alignItems: 'baseline',
    marginTop: Spacing.lg, zIndex: 2,
  },
  plus: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 36, color: KidColors.cta,
  },
  pointsValue: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 56, color: KidColors.cta,
    letterSpacing: -1,
  },
  pointsUnit: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 18, color: KidColors.coralDeep,
    marginLeft: 6,
  },
  ticket: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: Spacing.md,
    backgroundColor: KidColors.blush,
    borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: KidColors.coral + '66',
    padding: Spacing.sm,
    width: '100%',
    zIndex: 2,
  },
  ticketLeft: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: KidColors.coral,
    alignItems: 'center', justifyContent: 'center',
  },
  ticketEmoji: { fontSize: 28 },
  ticketDivider: {
    width: 1, height: 36,
    backgroundColor: KidColors.coral + '44',
    marginHorizontal: Spacing.sm,
    borderStyle: 'dashed',
  },
  ticketRight: { flex: 1 },
  ticketLabel: {
    fontFamily: BrandFont.bold, fontWeight: '900',
    fontSize: 9, color: KidColors.coralDeep,
    letterSpacing: 1.4,
  },
  ticketCode: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 22, color: KidColors.coralDeep,
    letterSpacing: 1, marginTop: 2,
  },
  ticketCta: {
    fontFamily: BrandFont.medium, fontWeight: '700',
    fontSize: 11, color: KidColors.coralDeep,
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: Spacing.lg,
    backgroundColor: KidColors.cta,
    paddingHorizontal: Spacing.xl, paddingVertical: 14,
    borderRadius: Radius.pill,
    shadowColor: KidColors.cta,
    shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    zIndex: 2,
  },
  ctaText: {
    color: '#fff', fontFamily: BrandFont.extrabold,
    fontWeight: '900', fontSize: 16, letterSpacing: 0.5,
  },
});

export default RewardCelebration;
