/**
 * ThemeBackdrop — admin-driven background renderer for the home (and
 * any other screen that opts in).
 *
 * Behaviour cascade:
 *   1. Solid `theme.background_color` always paints first.
 *   2. If `theme.background_image_url` is set → render it stretched with
 *      `expo-image`, then a tinted overlay whose alpha is driven by
 *      `theme.overlay_opacity`.
 *   3. `background_video_url` is honoured ONLY if the network policy
 *      says it's safe (Wi-Fi + not data-saver). Without `expo-video`
 *      installed yet, we still respect the policy: if the policy says
 *      "play", we fall back to the image so the admin's intent (a
 *      richer background) is partially met. The actual `<Video>`
 *      render lives behind a TODO until the package is added.
 *   4. `theme.blur_amount` would map to `BlurView.intensity` once
 *      `expo-blur` is wired. Until then it boosts the overlay alpha
 *      slightly so heavy blur + heavy overlay still reads as "muted".
 *
 * `pointerEvents="none"` ensures the backdrop never eats taps from the
 * scroll view above it.
 */
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand } from '@/constants/theme';
import { shouldAutoplayVideo } from '@/lib/networkPolicy';
import { useMobileTheme } from '@/services/mobileConfig';
import { useUserPreferences } from '@/services/userPreferences';

interface ThemeBackdropProps {
  /** Optional override — defaults to filling the parent. */
  style?: StyleProp<ViewStyle>;
}

export function ThemeBackdrop({ style }: ThemeBackdropProps) {
  const theme = useMobileTheme();
  const prefs = useUserPreferences();

  // Honour the user's saved choices (data_saver_mode, video_autoplay)
  // backed by `prefs_get_my` RPC. The policy is still conservative on
  // wifi_only without a real NetInfo signal, but `always` and
  // `never` are now respected.
  const policyAllowsVideo = useMemo(
    () =>
      shouldAutoplayVideo({
        data_saver_mode: prefs.data_saver_mode,
        video_autoplay: prefs.video_autoplay,
      }),
    [prefs.data_saver_mode, prefs.video_autoplay],
  );

  const showVideo = Boolean(theme.background_video_url) && policyAllowsVideo;
  const imageUri = theme.background_image_url || null;

  // Blend the admin-set overlay opacity (0..100) with a small bump
  // when blur_amount is high — until expo-blur lands, we use a heavier
  // veil to mimic the "frosted" look the admin asked for.
  const overlayAlpha = useMemo(() => {
    const base = Math.min(100, Math.max(0, theme.overlay_opacity ?? 40));
    const blur = Math.min(20, Math.max(0, theme.blur_amount ?? 0));
    const adjusted = base + blur * 0.5; // up to +10pts at max blur
    return Math.min(100, adjusted) / 100;
  }, [theme.overlay_opacity, theme.blur_amount]);

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: theme.background_color || Brand.background },
        style,
      ]}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          contentPosition="center"
          transition={180}
          cachePolicy="memory-disk"
        />
      ) : null}

      {/* TODO(expo-video): when the package lands, render an
          autoplay-muted-loop <Video> here when `showVideo` is true.
          For now we just acknowledge the decision and keep the image
          fallback so admins still see their intent partially honoured. */}
      {showVideo ? null : null}

      {/* Tint overlay — only when there's something visual underneath,
          otherwise the solid background_color already does the job. */}
      {imageUri ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: `rgba(18, 51, 94, ${overlayAlpha.toFixed(2)})` },
          ]}
        />
      ) : null}
    </View>
  );
}

export default ThemeBackdrop;
