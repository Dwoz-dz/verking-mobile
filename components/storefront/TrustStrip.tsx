/**
 * TrustStrip — admin-driven reassurance grid.
 *
 * Reads `useMobileCartConfig().trust_signals` (managed under Gestionnaire
 * Mobile › Paramètres panier) and renders one card per enabled signal.
 * Falls back to the in-config defaults if the admin hasn't touched the
 * row yet — so the strip is never empty.
 *
 * Used by the empty-cart screen and the SmartEmptyState shell.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { useMobileCartConfig, type TrustSignalConfig } from '@/services/mobileConfig';

const TONE_BY_KEY: Record<string, string> = {
  shipping: Brand.primary,
  cod: Brand.fresh,
  whatsapp: '#25D366',
  warranty: Brand.cta,
  social: Brand.lavender,
};

const TONE_FALLBACKS = [Brand.primary, Brand.fresh, Brand.cta, Brand.lavender, Brand.coral];

function toneFor(signal: TrustSignalConfig, index: number): string {
  return TONE_BY_KEY[signal.key] ?? TONE_FALLBACKS[index % TONE_FALLBACKS.length];
}

function pickIcon(icon?: string): keyof typeof Ionicons.glyphMap {
  if (icon && icon in Ionicons.glyphMap) return icon as keyof typeof Ionicons.glyphMap;
  return 'shield-checkmark-outline';
}

interface TrustStripProps {
  style?: StyleProp<ViewStyle>;
}

export function TrustStrip({ style }: TrustStripProps) {
  const cart = useMobileCartConfig();
  const { i18n } = useTranslation();
  const enabled = cart.trust_signals.filter((s) => s.enabled);
  if (enabled.length === 0) return null;
  const isAr = i18n.language === 'ar';

  return (
    <View style={[styles.grid, style]}>
      {enabled.map((s, idx) => {
        const tone = toneFor(s, idx);
        const label = isAr ? (s.label_ar || s.label_fr) : s.label_fr;
        return (
          <View key={s.key} style={[styles.card, { borderColor: tone + '33' }]}>
            <View style={[styles.iconWrap, { backgroundColor: tone + '15' }]}>
              {s.icon_url ? (
                <Image
                  source={{ uri: s.icon_url }}
                  style={styles.iconImage}
                  contentFit="contain"
                />
              ) : (
                <Ionicons name={pickIcon(s.icon)} size={18} color={tone} />
              )}
            </View>
            <Text style={styles.label} numberOfLines={2}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

interface InlineLabelProps {
  textAlign: 'left' | 'right' | 'center';
}

/** Compact horizontal scroll variant for tight spaces. */
export function TrustStripInline({ textAlign }: InlineLabelProps) {
  const cart = useMobileCartConfig();
  const { i18n } = useTranslation();
  const { rowDirection } = useDirection();
  const enabled = cart.trust_signals.filter((s) => s.enabled);
  if (enabled.length === 0) return null;
  const isAr = i18n.language === 'ar';

  return (
    <View style={[styles.inlineRow, { flexDirection: rowDirection }]}>
      {enabled.slice(0, 4).map((s, idx) => {
        const tone = toneFor(s, idx);
        const label = isAr ? (s.label_ar || s.label_fr) : s.label_fr;
        return (
          <View key={s.key} style={[styles.inlineChip, { borderColor: tone + '33', flexDirection: rowDirection }]}>
            {s.icon_url ? (
              <Image
                source={{ uri: s.icon_url }}
                style={styles.inlineIconImage}
                contentFit="contain"
              />
            ) : (
              <Ionicons name={pickIcon(s.icon)} size={12} color={tone} />
            )}
            <Text style={[styles.inlineLabel, { textAlign }]} numberOfLines={1}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignSelf: 'stretch',
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: 24, height: 24 },
  inlineIconImage: { width: 14, height: 14 },
  label: {
    flex: 1,
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 11,
    color: Brand.secondary,
    lineHeight: 14,
  },
  inlineRow: {
    flexWrap: 'wrap',
    gap: 6,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.md,
  },
  inlineChip: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: Brand.surface,
  },
  inlineLabel: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 10,
    color: Brand.secondary,
  },
});
