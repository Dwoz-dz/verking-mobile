/**
 * QuickPillsRow — top-of-Home shortcut chips.
 *
 * One row of horizontally-scrolling pills that route the user to the
 * Shop tab pre-filtered. Each pill carries:
 *   ▸ a soft brand-tinted background,
 *   ▸ a small icon for instant recognition,
 *   ▸ short label.
 *
 * The pills are intentionally NOT category-aware — they map to
 * marketplace intents (Promo, Nouveau, Gros, Best, Tout). Categories
 * are surfaced separately in the dedicated CategoriesRail.
 *
 * RTL: the inner row inherits `rowDirection` so the chip order flips
 * naturally in Arabic. Light haptic on press for tactility.
 */
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { tap } from '@/lib/haptics';

interface PillSpec {
  key: string;
  href: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  bg: string;
  fg: string;
  labelKey: string;
}

const PILLS: PillSpec[] = [
  { key: 'all',     href: '/(tabs)/explore',                  icon: 'apps',          bg: Brand.primaryTint, fg: Brand.primary,   labelKey: 'shop.filter_all' },
  { key: 'promo',   href: '/(tabs)/explore?filter=promo',     icon: 'flame',         bg: Brand.ctaSoft,     fg: Brand.cta,       labelKey: 'badges.promo' },
  { key: 'gros',    href: '/(tabs)/explore?filter=gros',      icon: 'cube',          bg: Brand.mintSoft,    fg: Brand.secondary, labelKey: 'badges.gros' },
  { key: 'new',     href: '/(tabs)/explore?filter=new',       icon: 'sparkles',      bg: Brand.coralSoft,   fg: Brand.coral,     labelKey: 'badges.new' },
  { key: 'best',    href: '/(tabs)/explore?filter=best',      icon: 'star',          bg: Brand.sunshineSoft, fg: Brand.accentDeep, labelKey: 'badges.best' },
];

export function QuickPillsRow() {
  const { t } = useTranslation();
  const { rowDirection } = useDirection();
  const isRtl = rowDirection === 'row-reverse';
  const items = isRtl ? [...PILLS].reverse() : PILLS;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {items.map((p) => (
        <Link key={p.key} href={p.href as never} asChild>
          <Pressable
            onPress={() => tap()}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: p.bg },
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name={p.icon} size={14} color={p.fg} />
            <Text style={[styles.pillText, { color: p.fg }]} numberOfLines={1}>
              {t(p.labelKey)}
            </Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  pillText: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

// Re-export the View import for type linting if tooling complains; keeps
// this file fully encapsulated.
void View;
