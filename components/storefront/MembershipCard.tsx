/**
 * MembershipCard — VERKING loyalty card rendered like a real credit
 * card. Credit-card-shaped (16:10), tier-tinted gradient, embossed
 * brand mark, animated points balance, progress bar to the next tier.
 *
 * Why this lives in `components/storefront`:
 *   It's a reusable visual block — the Profile hero, the loyalty
 *   screen and the drawer all want the same renderer.
 *
 * Tier color logic comes from the loyalty levels admin row's
 * `badge_color` (so the brand can rebrand a tier without code
 * changes). When badge_color is missing we fall back to the
 * tier-name based palette below.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import type { LoyaltyAccount, LoyaltyLevel } from '@/services/loyalty';

export interface MembershipCardProps {
  account: LoyaltyAccount | null;
  currentTier: LoyaltyLevel | null;
  nextTier: LoyaltyLevel | null;
  /** Optional press handler — typically routes to /loyalty. */
  onPress?: () => void;
  /** Last 4 chars from the device id, used as the "card number suffix". */
  cardSuffix?: string;
  /** Display name to show on the card ("MEMBER" by default). */
  memberName?: string | null;
}

const TIER_FALLBACKS: Record<string, [string, string]> = {
  bronze:   ['#B87333', '#7B4A1F'],
  silver:   ['#A8B0BB', '#5C6573'],
  gold:     ['#FFC93C', '#C28F12'],
  platinum: ['#7C5DDB', '#2D7DD2'],
  diamond:  ['#43D9DB', '#7C5DDB'],
};

export function MembershipCard({
  account,
  currentTier,
  nextTier,
  onPress,
  cardSuffix = '••••',
  memberName,
}: MembershipCardProps) {
  const balance = account?.balance_points ?? 0;
  const lifetime = account?.lifetime_points ?? 0;

  // Progress 0..1 toward the next tier.
  const progress = useSharedValue(0);
  useEffect(() => {
    const start = currentTier?.threshold_points ?? 0;
    const end = nextTier?.threshold_points ?? Math.max(lifetime, 1);
    const span = Math.max(1, end - start);
    const cur  = Math.max(0, Math.min(span, lifetime - start));
    progress.value = withTiming(cur / span, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, currentTier?.threshold_points, nextTier?.threshold_points, lifetime]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const [from, to] = useMemo(() => {
    const explicit = currentTier?.badge_color;
    if (explicit && /^#[0-9a-f]{6}$/i.test(explicit)) {
      return [explicit, darken(explicit, 0.35)] as [string, string];
    }
    const key = (currentTier?.name_fr || currentTier?.level_key || 'bronze').toLowerCase();
    for (const [k, pair] of Object.entries(TIER_FALLBACKS)) {
      if (key.includes(k)) return pair;
    }
    return TIER_FALLBACKS.bronze;
  }, [currentTier?.badge_color, currentTier?.name_fr, currentTier?.level_key]);

  const tierLabel = currentTier?.name_fr ?? 'Bronze';
  const nextLabel = nextTier?.name_fr ?? null;
  const remaining = Math.max(
    0,
    (nextTier?.threshold_points ?? lifetime) - lifetime,
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
        styles.outer,
      ]}
    >
      <View style={[styles.card, { backgroundColor: from }]}>
        {/* Layered tint blob to fake a 2-stop gradient without
            pulling in expo-linear-gradient. */}
        <View
          style={[
            styles.gradientBlob,
            { backgroundColor: to, opacity: 0.85 },
          ]}
        />
        {/* Subtle dotted texture overlay (8% white dots, 24px grid). */}
        <View pointerEvents="none" style={styles.texture} />

        {/* Top row */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>VERKING MEMBER</Text>
            <Text style={styles.tierName} numberOfLines={1}>
              {tierLabel}
            </Text>
          </View>
          <View style={styles.iconBadge}>
            <Ionicons name="star" size={18} color="#fff" />
          </View>
        </View>

        {/* Card "number" — purely decorative */}
        <Text style={styles.cardNumber} accessibilityLabel="Card number suffix">
          •••• •••• •••• {cardSuffix}
        </Text>

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomLabel}>SOLDE</Text>
            <Text style={styles.balance}>{balance.toLocaleString('fr-FR')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.bottomLabel}>{(memberName || 'MEMBER').toUpperCase()}</Text>
            <Text style={styles.lifetime}>cumul {lifetime.toLocaleString('fr-FR')}</Text>
          </View>
        </View>

        {/* Progress strip to the next tier */}
        {nextLabel ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <Text style={styles.progressText} numberOfLines={1}>
              {remaining > 0
                ? `${remaining.toLocaleString('fr-FR')} pts → ${nextLabel}`
                : `Niveau max — ${tierLabel}`}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function darken(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: Spacing.md,
  },
  card: {
    aspectRatio: 1.6,
    width: '100%',
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    overflow: 'hidden',
    shadowColor: 'rgba(15,23,42,0.4)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 16,
    backgroundColor: '#444',
  },
  gradientBlob: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 999,
  },
  texture: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  kicker: {
    fontFamily: BrandFont.extrabold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.78)',
  },
  tierName: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 0.5,
    color: '#FFFFFF',
    marginTop: 2,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  cardNumber: {
    fontFamily: BrandFont.bold,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 22,
    zIndex: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: Spacing.md,
    zIndex: 2,
  },
  bottomLabel: {
    fontFamily: BrandFont.bold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.7)',
  },
  balance: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 28,
    color: '#FFFFFF',
    marginTop: 2,
  },
  lifetime: {
    fontFamily: BrandFont.semibold,
    fontWeight: '700',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  progressWrap: {
    marginTop: Spacing.sm,
    zIndex: 2,
  },
  progressBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Brand.cta,
    borderRadius: 999,
  },
  progressText: {
    fontFamily: BrandFont.semibold,
    fontWeight: '700',
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 6,
  },
});

export default MembershipCard;
