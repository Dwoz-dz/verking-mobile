/**
 * ComingSoonCard — placeholder product card shown when a rail / grid
 * has fewer than `min_grid_slots` real products.
 *
 * Phase Ultimate v2 — Phase 5 dependency. The component is built here
 * as a reusable so Phase 4 polish (replacing empty grids) can use it
 * without waiting for the engagement phase.
 *
 * Behaviour:
 *   ▸ Pulls a random title + emoji pair from the admin-driven pool
 *     stored in `mobile_coming_soon_config` (see services/comingSoonConfig).
 *   ▸ Optional "🔔 Préviens-moi" CTA (Phase 5 wires the push opt-in).
 *   ▸ Subtle pulse animation so the rail doesn't feel dead.
 *   ▸ Hash-stable: the same `index` always lands on the same emoji /
 *     title pair, so the rail doesn't shimmer on every re-render.
 *
 * Visuals:
 *   ┌──────────────────┐
 *   │ ┌──────────────┐ │
 *   │ │  ✨    ✨    │ │
 *   │ │   📦         │ │ ← cardboard-style emoji
 *   │ │              │ │
 *   │ │  ⭐  Pdt 1   │ │
 *   │ └──────────────┘ │
 *   │ Bientôt ici      │
 *   │ Trop hâte ! 🚀   │
 *   │  [🔔 Préviens-moi]│
 *   └──────────────────┘
 */
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { KidColors } from '@/constants/kidColors';

const DEFAULT_TITLES_FR = [
  'Bientôt ici',
  'Surprise en route',
  'Nouveauté qui arrive',
  'On y travaille',
  'Stay tuned',
  'Mystère à venir',
  "C'est pour bientôt",
  'Coming soon',
];
const DEFAULT_TITLES_AR = [
  'قريباً هنا',
  'مفاجأة قادمة',
  'جديد قريباً',
  'نُحضّر شيئاً',
  'ترقّبوا',
  'لُغز قادم',
  'قريبٌ جداً',
];
const DEFAULT_EMOJIS = ['📦', '🚀', '🎁', '⭐', '✨', '🎉', '🆕', '💝', '🎀'];

interface ComingSoonCardProps {
  /** Stable index — same index → same emoji + title pair. */
  index: number;
  /** Locale for the title pool. */
  locale?: 'fr' | 'ar' | 'en';
  /** Card width — matches sibling product cards in the same rail. */
  width?: DimensionValue;
  /** Override title pool. */
  titlePool?: string[];
  /** Override emoji pool. */
  emojiPool?: string[];
  /** Show "Préviens-moi" pill — admin-controlled by `show_notify_cta`. */
  showNotifyCta?: boolean;
  /** Tap handler — Phase 5 wires the push opt-in flow. */
  onNotifyTap?: () => void;
}

export function ComingSoonCard({
  index,
  locale = 'fr',
  width = 168,
  titlePool,
  emojiPool,
  showNotifyCta = false,
  onNotifyTap,
}: ComingSoonCardProps) {
  // Hash-stable selection so React's diff doesn't shuffle on re-render.
  const { title, emoji } = useMemo(() => {
    const titles = titlePool && titlePool.length > 0
      ? titlePool
      : (locale === 'ar' ? DEFAULT_TITLES_AR : DEFAULT_TITLES_FR);
    const emojis = emojiPool && emojiPool.length > 0 ? emojiPool : DEFAULT_EMOJIS;
    return {
      title: titles[index % titles.length] ?? titles[0],
      emoji: emojis[index % emojis.length] ?? emojis[0],
    };
  }, [index, locale, titlePool, emojiPool]);

  // Soft pulse — staggered so the rail doesn't strobe in unison.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withDelay(
      (index % 4) * 240,
      withRepeat(
        withSequence(
          withTiming(0.92, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const tint = TINTS[index % TINTS.length];
  const accent = ACCENTS[index % ACCENTS.length];

  return (
    <View style={[styles.card, { width }]}>
      <Animated.View style={[styles.imagePlate, { backgroundColor: tint }, pulseStyle]}>
        <Text style={styles.sparkleA}>✨</Text>
        <Text style={styles.sparkleB}>✨</Text>
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {locale === 'ar' ? 'ترقّبوا 🚀' : 'À ne pas manquer 🚀'}
        </Text>
        {showNotifyCta ? (
          <Pressable
            onPress={onNotifyTap}
            style={({ pressed }) => [styles.notifyBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.notifyBtnText}>
              🔔 {locale === 'ar' ? 'نبّهني' : 'Préviens-moi'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// 6 brand-aligned soft tints — peach / lavender / mint / butter / coral
// pink / sky. Looks warm against either dark or light theme.
const TINTS = [
  KidColors.peach,
  KidColors.lavenderSoft,
  KidColors.mintBubble,
  KidColors.butter,
  KidColors.coralPink,
  KidColors.sky,
] as const;

const ACCENTS = [
  KidColors.coralDeep,
  KidColors.lavenderDeep,
  KidColors.oceanDeep,
  KidColors.honey,
  KidColors.coral,
  KidColors.skyDeep,
] as const;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  imagePlate: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emoji: { fontSize: 64 },
  sparkleA: {
    position: 'absolute',
    top: 12, right: 14,
    fontSize: 18,
    opacity: 0.65,
  },
  sparkleB: {
    position: 'absolute',
    bottom: 14, left: 14,
    fontSize: 14,
    opacity: 0.55,
  },
  body: {
    padding: Spacing.sm,
    gap: 4,
  },
  title: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: -0.1,
  },
  subtitle: {
    fontFamily: BrandFont.medium,
    fontWeight: '600',
    fontSize: 11,
    color: Brand.textMuted,
  },
  notifyBtn: {
    marginTop: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: Brand.primaryTint,
    borderRadius: 999,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Brand.primary + '33',
  },
  notifyBtnText: {
    color: Brand.primary,
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
});

export default ComingSoonCard;
