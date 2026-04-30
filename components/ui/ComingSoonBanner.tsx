/**
 * ComingSoonBanner — admin-driven anticipation strip for the top of
 * empty pages or rails.
 *
 * Two display modes (auto-resolved):
 *   ▸ Static: "🚀 Nouveaux produits en route, restez à l'écoute !"
 *   ▸ Countdown: when admin sets `expected_launch_date`, shows a live
 *     countdown ("⏰ Plus que 5 jours avant l'ouverture !").
 *
 * Reads from `mobile_coming_soon_config` (single 'default' row,
 * realtime-broadcast). When `enabled = false`, renders nothing.
 *
 * Phase 5 (Engagement) wires this into:
 *   ▸ /(tabs)/explore     — top of Boutique
 *   ▸ Empty rails on home  — when fewer than `min_grid_slots` real
 *                            products exist
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

interface ComingSoonBannerProps {
  /** Override admin text. */
  text?: string;
  /** Override emoji. */
  emoji?: string;
  /** ISO date — if set, renders a "X jours" countdown. */
  expectedLaunchDate?: string | null;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return null;
  const now = Date.now();
  const diffMs = target - now;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function ComingSoonBanner({
  text,
  emoji = '🚀',
  expectedLaunchDate,
}: ComingSoonBannerProps) {
  const { t, i18n } = useTranslation();
  const { textAlign } = useDirection();
  const isAr = i18n.language === 'ar';

  const days = daysUntil(expectedLaunchDate);

  let body: string;
  if (text) {
    body = text;
  } else if (days != null) {
    if (days === 0) {
      body = isAr ? 'الإطلاق اليوم!' : 'Lancement aujourd’hui !';
    } else if (days === 1) {
      body = isAr ? 'يوم واحد فقط ⏳' : 'Plus qu’1 jour ⏳';
    } else {
      body = isAr
        ? `${days} يوم على الإطلاق ⏳`
        : `Plus que ${days} jours avant l’ouverture ⏳`;
    }
  } else {
    body = t('coming_soon.banner_default', {
      defaultValue: isAr
        ? 'منتجات جديدة في الطريق إليك! ترقّبوا'
        : 'Nouveaux produits en route, restez à l’écoute !',
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.gradientLayer} />
      <View style={styles.gradientLayerBottom} />
      <View style={styles.row}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.text, { textAlign }]} numberOfLines={2}>
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Brand.lavender,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  // Faked 2-stop gradient (lavender → primary) using overlapping Views.
  gradientLayer: {
    position: 'absolute',
    inset: 0,
    backgroundColor: Brand.lavender,
  },
  gradientLayerBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '60%',
    backgroundColor: Brand.primary,
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 2,
  },
  emoji: { fontSize: 20 },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: -0.1,
    lineHeight: 17,
  },
});

export default ComingSoonBanner;
