/**
 * TrustBadgesRow — 4 reassurance pills shown on Home below the hero.
 *
 * Built to look like a marketplace's "we promise" strip:
 *   ▸ Livraison rapide (truck — primary blue)
 *   ▸ Paiement à la livraison (cash — orange)
 *   ▸ Qualité garantie (shield-check — fresh green)
 *   ▸ Service à l'écoute (chat — lavender)
 *
 * Compact 2x2 grid on narrow screens (default) and a single horizontal
 * row on wider devices via flexbox wrap. Pure presentational — no
 * routing, no data fetch.
 */
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

interface BadgeSpec {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
  bg: string;
  titleKey: string;
  subKey: string;
}

const BADGES: BadgeSpec[] = [
  { key: 'shipping', icon: 'rocket',        tint: Brand.primary, bg: Brand.primaryTint, titleKey: 'home.why_price_title',   subKey: 'home.promo_strip_title' },
  { key: 'cod',      icon: 'wallet',        tint: Brand.cta,     bg: Brand.ctaSoft,     titleKey: 'home.why_quality_title', subKey: 'home.promo_strip_sub' },
  { key: 'quality',  icon: 'shield-checkmark', tint: Brand.fresh, bg: Brand.freshSoft, titleKey: 'home.why_kids_title',    subKey: 'home.why_quality_sub' },
  { key: 'support',  icon: 'chatbubbles',   tint: Brand.lavender, bg: Brand.lavenderSoft, titleKey: 'home.why_support_title', subKey: 'home.why_support_sub' },
];

export function TrustBadgesRow() {
  const { t } = useTranslation();
  const { textAlign } = useDirection();

  return (
    <View style={styles.grid}>
      {BADGES.map((b) => (
        <View key={b.key} style={[styles.cell, { backgroundColor: b.bg }]}>
          <View style={[styles.iconBubble, { backgroundColor: '#FFFFFF' }]}>
            <Ionicons name={b.icon} size={16} color={b.tint} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.title, { textAlign, color: b.tint }]} numberOfLines={1}>
              {t(b.titleKey)}
            </Text>
            <Text style={[styles.sub, { textAlign }]} numberOfLines={2}>
              {t(b.subKey)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  cell: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sub: {
    fontFamily: BrandFont.medium,
    fontWeight: '500',
    fontSize: 10,
    color: Brand.textMuted,
    marginTop: 1,
    lineHeight: 13,
  },
});
