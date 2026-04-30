/**
 * MarketingEmptyState — friendly, brand-tinted empty placeholder used
 * on the Orders, Cart, and any other "no rows yet" screen.
 *
 * Designed to convert rather than apologise:
 *   ▸ Soft StationeryPattern background carries brand identity.
 *   ▸ Rounded brand icon bubble sells "we're alive, just empty".
 *   ▸ Title + subtitle in plain language — no "0 results" speak.
 *   ▸ Optional primary CTA + optional secondary tip line.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { StationeryPattern } from '@/components/decorative/StationeryPattern';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

interface MarketingEmptyStateProps {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryHint?: string;
  style?: StyleProp<ViewStyle>;
  /** Override the decorative pattern variant. */
  patternVariant?: ComponentProps<typeof StationeryPattern>['variant'];
}

export function MarketingEmptyState({
  icon = 'sparkles',
  title,
  subtitle,
  ctaLabel,
  onCta,
  secondaryHint,
  style,
  patternVariant = 'tinted',
}: MarketingEmptyStateProps) {
  const { textAlign } = useDirection();

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.illustration}>
        <StationeryPattern
          variant={patternVariant}
          intensity={0.7}
          density={20}
          seed={777}
        />
        <View style={styles.iconBubble}>
          <Ionicons name={icon} size={44} color={Brand.primary} />
        </View>
      </View>

      <Text style={[styles.title, { textAlign }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { textAlign }]}>{subtitle}</Text>
      ) : null}

      {ctaLabel && onCta ? (
        <Pressable
          onPress={onCta}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92 }]}
        >
          <Ionicons name="storefront-outline" size={16} color="#FFFFFF" />
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}

      {secondaryHint ? (
        <Text style={[styles.hint, { textAlign }]}>{secondaryHint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  illustration: {
    width: 220,
    height: 180,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubble: {
    width: 92,
    height: 92,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.shadowBlue,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  title: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 20,
    color: Brand.secondary,
  },
  subtitle: {
    fontFamily: BrandFont.medium,
    color: Brand.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  cta: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Brand.cta,
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaText: {
    color: '#FFFFFF',
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  hint: {
    fontFamily: BrandFont.medium,
    fontWeight: '500',
    color: Brand.textSubtle,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
});
