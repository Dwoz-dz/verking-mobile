/**
 * VERKING brandmark — official lockup.
 *
 * Renders the brand identity in three forms:
 *   - variant="full"     - wordmark + S.T.P Stationery subtitle +
 *                          Gros (mint) and Détail (orange) strip.
 *                          Used on About header + splash overlay.
 *   - variant="wordmark" - wordmark + subtitle (no strip).
 *                          Used on top of pages, in headers.
 *   - variant="icon"     - square brand icon for nav avatars / chips.
 *
 * Visual sourcing:
 *   - If a real logo PNG has been wired in lib/brand/logo.ts, it
 *     renders as an Image (crisp, official asset).
 *   - Otherwise we fall back to the typographic VERKING wordmark
 *     using Plus Jakarta Sans 800 ExtraBold + the brand navy.
 *
 * RTL-aware: the Gros and Détail strip flips direction in Arabic so
 * the mint/orange pair always reads naturally.
 */
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, BrandFont, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { BRAND_LOGO_FULL, BRAND_LOGO_ICON } from '@/lib/brand/logo';

type BrandmarkVariant = 'full' | 'wordmark' | 'icon';
type BrandmarkSize = 'sm' | 'md' | 'lg' | 'xl';

interface BrandmarkProps {
  variant?: BrandmarkVariant;
  size?: BrandmarkSize;
  /** Legacy alias for `variant !== 'wordmark'`. Kept for back-compat. */
  showStrip?: boolean;
  align?: 'left' | 'center';
  /** Force the typographic wordmark even when an image asset is wired. */
  forceTextLogo?: boolean;
  /** Render the wordmark in inverse colours for dark hero surfaces. */
  inverse?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TITLE_SIZES: Record<BrandmarkSize, number> = { sm: 22, md: 28, lg: 34, xl: 44 };
const SUB_SIZES: Record<BrandmarkSize, number> = { sm: 10, md: 11, lg: 13, xl: 15 };
const ICON_SIZES: Record<BrandmarkSize, number> = { sm: 28, md: 40, lg: 56, xl: 80 };

export function Brandmark({
  variant,
  size = 'md',
  showStrip,
  align = 'left',
  forceTextLogo = false,
  inverse = false,
  style,
}: BrandmarkProps) {
  const { t } = useTranslation();
  const { rowDirection } = useDirection();

  const resolvedVariant: BrandmarkVariant =
    variant ?? (showStrip === false ? 'wordmark' : 'full');

  const titleSize = TITLE_SIZES[size];
  const subSize = SUB_SIZES[size];
  const iconSize = ICON_SIZES[size];

  const containerAlign = align === 'center' ? 'center' : 'flex-start';
  const textAlign = align === 'center' ? ('center' as const) : ('left' as const);

  const titleColor = inverse ? '#FFFFFF' : Brand.secondary;
  const subColor = inverse ? 'rgba(255,255,255,0.78)' : Brand.textMuted;

  if (resolvedVariant === 'icon') {
    if (BRAND_LOGO_ICON && !forceTextLogo) {
      return (
        <View style={[{ alignItems: containerAlign }, style]}>
          <Image
            source={BRAND_LOGO_ICON}
            style={{ width: iconSize, height: iconSize, borderRadius: iconSize * 0.22 }}
            contentFit="contain"
          />
        </View>
      );
    }
    return (
      <View
        style={[
          styles.iconFallback,
          { width: iconSize, height: iconSize, borderRadius: iconSize * 0.22 },
          style,
        ]}
      >
        <Text style={[styles.iconFallbackText, { fontSize: iconSize * 0.45 }]}>V</Text>
      </View>
    );
  }

  if (BRAND_LOGO_FULL && !forceTextLogo) {
    const imgWidth = titleSize * 6;
    const imgHeight = titleSize * 1.6;
    return (
      <View style={[{ alignItems: containerAlign }, style]}>
        <Image
          source={BRAND_LOGO_FULL}
          style={{ width: imgWidth, height: imgHeight }}
          contentFit="contain"
        />
        {resolvedVariant === 'full' ? (
          <ModeStrip rowDirection={rowDirection} t={t} marginTop={Spacing.sm} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { alignItems: containerAlign }, style]}>
      <Text
        style={[
          styles.title,
          { fontSize: titleSize, textAlign, color: titleColor },
        ]}
      >
        {t('brand.name')}
      </Text>
      <Text
        style={[
          styles.subtitle,
          { fontSize: subSize, textAlign, color: subColor },
        ]}
      >
        {t('brand.subtitle')}
      </Text>
      {resolvedVariant === 'full' ? (
        <ModeStrip rowDirection={rowDirection} t={t} marginTop={Spacing.sm} />
      ) : null}
    </View>
  );
}

interface ModeStripProps {
  rowDirection: 'row' | 'row-reverse';
  t: (key: string) => string;
  marginTop?: number;
}

function ModeStrip({ rowDirection, t, marginTop }: ModeStripProps) {
  return (
    <View
      style={[
        styles.modeStrip,
        { flexDirection: rowDirection, marginTop: marginTop ?? Spacing.sm },
      ]}
    >
      <View style={[styles.pill, { backgroundColor: Brand.mint }]}>
        <Text style={styles.pillText}>{t('modes.gros')}</Text>
      </View>
      <Text style={styles.amp}>{t('common.and')}</Text>
      <View style={[styles.pill, { backgroundColor: Brand.cta }]}>
        <Text style={[styles.pillText, { color: '#FFFFFF' }]}>{t('modes.detail')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  title: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    color: Brand.secondary,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: BrandFont.semibold,
    fontWeight: '600',
    color: Brand.textMuted,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  modeStrip: { alignItems: 'center', gap: Spacing.sm },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  pillText: {
    fontFamily: BrandFont.bold,
    fontWeight: '700',
    fontSize: 12,
    color: Brand.secondary,
    letterSpacing: 0.6,
  },
  amp: {
    fontFamily: BrandFont.bold,
    fontSize: 14,
    fontWeight: '800',
    color: Brand.textMuted,
  },
  iconFallback: {
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.shadowBlue,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconFallbackText: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
});
