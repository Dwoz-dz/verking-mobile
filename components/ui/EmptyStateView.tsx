/**
 * EmptyStateView — generic, brand-styled empty state.
 *
 * Different from `SmartEmptyState` (which is admin-driven via
 * `mobile_empty_states` and includes smart surfaces like trending /
 * recently-viewed rails): EmptyStateView is the base **shell** for any
 * one-off empty placeholder — used for cart-line "panier vide", form
 * "aucun résultat", offline screen, etc.
 *
 * Three sizes:
 *   sm — compact 100 px tall (good for inline lists)
 *   md — default 200 px (rails / sections)
 *   lg — big 320 px (full screens)
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';

export type EmptyStateSize = 'sm' | 'md' | 'lg';

interface EmptyStateViewProps {
  size?: EmptyStateSize;
  emoji?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Soft tint for the icon disc (default: brand primary). */
  tone?: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  /** Additional content below the CTA (e.g. suggestion chips). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function EmptyStateView({
  size = 'md',
  emoji,
  icon = 'sparkles-outline',
  tone,
  title,
  subtitle,
  ctaLabel,
  onCta,
  children,
  style,
}: EmptyStateViewProps) {
  const accent = tone ?? Brand.primary;
  const sizeStyles = SIZE_MAP[size];

  return (
    <View style={[styles.wrap, sizeStyles.wrap, style]}>
      {emoji ? (
        <Text style={[styles.emoji, sizeStyles.emoji]}>{emoji}</Text>
      ) : (
        <View
          style={[
            styles.iconPlate,
            sizeStyles.iconPlate,
            { backgroundColor: accent + '1F' },
          ]}
        >
          <Ionicons name={icon} size={sizeStyles.iconSize} color={accent} />
        </View>
      )}
      <Text style={[styles.title, sizeStyles.title]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, sizeStyles.subtitle]}>{subtitle}</Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Pressable
          onPress={onCta}
          style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
}

const SIZE_MAP: Record<EmptyStateSize, {
  wrap: ViewStyle;
  emoji: { fontSize: number };
  iconPlate: { width: number; height: number; borderRadius: number };
  iconSize: number;
  title: { fontSize: number };
  subtitle: { fontSize: number };
}> = {
  sm: {
    wrap: { paddingVertical: Spacing.md, gap: 6 },
    emoji: { fontSize: 32 },
    iconPlate: { width: 48, height: 48, borderRadius: 16 },
    iconSize: 20,
    title: { fontSize: 13 },
    subtitle: { fontSize: 11 },
  },
  md: {
    wrap: { paddingVertical: Spacing.lg, gap: 8 },
    emoji: { fontSize: 56 },
    iconPlate: { width: 72, height: 72, borderRadius: 22 },
    iconSize: 28,
    title: { fontSize: 16 },
    subtitle: { fontSize: 13 },
  },
  lg: {
    wrap: { paddingVertical: Spacing.xl, gap: 10 },
    emoji: { fontSize: 80 },
    iconPlate: { width: 96, height: 96, borderRadius: 28 },
    iconSize: 38,
    title: { fontSize: 19 },
    subtitle: { fontSize: 14 },
  },
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emoji: { textAlign: 'center' },
  iconPlate: { alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    color: Brand.text,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: BrandFont.medium,
    fontWeight: '500',
    color: Brand.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  cta: {
    marginTop: 6,
    backgroundColor: Brand.cta,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  ctaText: {
    color: '#FFF',
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  children: {
    marginTop: Spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
});

export default EmptyStateView;
