/**
 * BrandWallpaper — full-bleed VERKING brand image rendered behind a
 * tinted overlay. Used as a header/hero background on Profile,
 * About, and the splash overlay.
 *
 * Variants:
 *   - 'soft'    — light overlay, logo highly visible (login / hero).
 *   - 'tinted'  — heavier navy overlay, logo at ~25% opacity (Profile
 *                 header where text overlays the image).
 *   - 'pattern' — repeated low-opacity logo behind content (empty states).
 *
 * Always sized to fill its parent, so wrap it in a View whose height
 * is fixed by the calling screen.
 */
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand } from '@/constants/theme';
import { BRAND_BG_PATTERN } from '@/lib/brand/logo';

export type BrandWallpaperVariant = 'soft' | 'tinted' | 'pattern';

interface BrandWallpaperProps {
  variant?: BrandWallpaperVariant;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const OVERLAY_BY_VARIANT: Record<BrandWallpaperVariant, string> = {
  soft:    'rgba(255,255,255,0.55)',          // crisp logo readable
  tinted:  'rgba(18,51,94,0.86)',             // navy header with brand watermark
  pattern: 'rgba(249,249,252,0.92)',          // near-background, subtle accent
};

const IMAGE_OPACITY_BY_VARIANT: Record<BrandWallpaperVariant, number> = {
  soft:    1,
  tinted:  0.35,
  pattern: 0.18,
};

export function BrandWallpaper({
  variant = 'tinted', style, children,
}: BrandWallpaperProps) {
  const overlay = OVERLAY_BY_VARIANT[variant];
  const opacity = IMAGE_OPACITY_BY_VARIANT[variant];

  return (
    <View style={[styles.wrap, variant === 'tinted' && { backgroundColor: Brand.secondary }, style]}>
      <Image
        source={BRAND_BG_PATTERN}
        style={[StyleSheet.absoluteFillObject, { opacity }]}
        contentFit="cover"
        contentPosition="center"
        transition={120}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: overlay }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Brand.background,
  },
});

export default BrandWallpaper;
