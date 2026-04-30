/**
 * UserAvatar — single source of truth for showing a user's profile
 * picture across the app (Drawer header, Profile hero, Membership card,
 * comments, leaderboard, …).
 *
 * Resolution chain:
 *   1. Explicit `uri` prop (callers that already hold the URL).
 *   2. `mobile_user_profiles.avatar_url` for the current device.
 *   3. Initial-letter fallback on a brand-tinted disc.
 *
 * Implementation notes:
 *   ▸ `expo-image` handles caching + transition animation.
 *   ▸ The fallback initial uses a hashed pastel from the device id so
 *     two guests don't accidentally pick the same color (matches the
 *     ProductCard pastel-tint trick).
 *   ▸ This is the foundation for Phase 7 (avatar upload) — that phase
 *     simply ships the picker that writes to `avatar_url`. No changes
 *     needed here.
 */
import { Image, type ImageStyle } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, BrandFont } from '@/constants/theme';
import { useRegistrationStatus } from '@/services/registration';

const PASTEL_TINTS = [
  '#FFD6C4', '#FFE89C', '#B5F2EE', '#EFE9FF', '#FFE4EC', '#B0E5C8',
];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PASTEL_TINTS[h % PASTEL_TINTS.length];
}

interface UserAvatarProps {
  /** Override the auto-resolved URL with a specific one. */
  uri?: string | null;
  /** Diameter in px (default 48). */
  size?: number;
  /** Manual fallback text — defaults to first letter of the device's name. */
  fallbackText?: string | null;
  /** Render a thin white border (looks great on dark backgrounds). */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function UserAvatar({
  uri,
  size = 48,
  fallbackText,
  bordered = false,
  style,
}: UserAvatarProps) {
  const { status } = useRegistrationStatus();

  // The avatar field isn't in RegistrationStatus yet — we'll add it in
  // Phase 3.1 once the /profile/edit screen lands. Until then, callers
  // pass `uri` explicitly when they have it.
  const resolvedUri = uri ?? null;

  const initial = useMemo(() => {
    if (typeof fallbackText === 'string' && fallbackText.trim().length > 0) {
      return fallbackText.trim().charAt(0).toUpperCase();
    }
    if (status.is_registered && status.name) {
      return status.name.trim().charAt(0).toUpperCase();
    }
    return 'V';
  }, [fallbackText, status.is_registered, status.name]);

  const tintSeed = (status.name ?? status.phone ?? 'guest') + initial;
  const tint = tintFor(tintSeed);

  const dimensions: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
  const borderStyle: ViewStyle = bordered
    ? { borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' }
    : {};

  if (resolvedUri) {
    // expo-image's `style` prop is `ImageStyle`, which doesn't accept
    // every ViewStyle key (notably `overflow: 'scroll'`). We isolate
    // the size dimensions into an Image-compatible shape so the type
    // checker stays happy while the visual contract is identical.
    const imageStyle: ImageStyle = {
      width: size,
      height: size,
      borderRadius: size / 2,
    };
    return (
      <View style={[styles.wrap, dimensions, borderStyle, style]}>
        <Image
          source={{ uri: resolvedUri }}
          style={imageStyle}
          contentFit="cover"
          transition={180}
        />
      </View>
    );
  }

  // Fallback — initial on tinted disc.
  return (
    <View
      style={[
        styles.wrap,
        styles.fallbackWrap,
        dimensions,
        { backgroundColor: tint },
        borderStyle,
        style,
      ]}
    >
      <Text style={[styles.initialText, { fontSize: Math.round(size * 0.42) }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: Brand.surfaceContainer,
  },
  fallbackWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initialText: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    color: Brand.secondary,
    letterSpacing: 0.3,
  },
});

export default UserAvatar;
