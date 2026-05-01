/**
 * Hero banner — soft blue gradient with white CTA pill (orange text).
 * Pulls live slides from `hero_slides`. Falls back to a built-in welcome
 * panel that uses the trust-blue gradient (not aggressive orange).
 *
 * Phase 1 fix (PTP-N49 black box):
 *   The admin can upload `.mp4` (`media_type='video'`) via Gestionnaire
 *   Mobile. Without `expo-video` installed, `<Image>` would try to decode
 *   the .mp4 → render a solid black box. We resolve this defensively at
 *   render time:
 *     1. media_type === 'video' AND poster_url present → use poster_url
 *     2. media_type === 'video' AND no poster_url        → use fallback
 *        BG (gradient + welcome card) — never a black box
 *     3. media_type === 'image'                          → use media_url
 *   Phase 7 swaps step (1) for actual `<HeroVideo />` once expo-video
 *   ships in the next EAS Build. No DB changes needed; this is purely
 *   client-side defensive rendering.
 */
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { pickLocalized } from '@/i18n/pickLocalized';
import { useDirection } from '@/i18n/useDirection';
import { useUserPreferences } from '@/services/userPreferences';
import type { HeroSlideRow } from '@/types/database';

/**
 * Pick the best renderable URL for a slide — never returns a video URL,
 * because we'd render it as an Image and crash to a black box.
 *
 * Returns null when nothing is renderable, so the caller falls through
 * to the built-in welcome card.
 */
function pickHeroImageUrl(slide: HeroSlideRow | null | undefined): string | null {
  if (!slide) return null;
  // Image slides: pick media_url (or poster as a backup, just in case).
  if (slide.media_type === 'image') {
    return slide.media_url ?? slide.poster_url ?? null;
  }
  // Video slides: prefer the explicit poster, never fall through to the
  // .mp4 — that's the black-box bug.
  if (slide.media_type === 'video') {
    return slide.poster_url ?? null;
  }
  // Unknown / legacy media_type: trust media_url only if it doesn't
  // smell like a video.
  if (slide.media_url && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(slide.media_url)) {
    return slide.media_url;
  }
  return slide.poster_url ?? null;
}

interface HeroBannerProps {
  slides: HeroSlideRow[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function HeroBanner({ slides }: HeroBannerProps) {
  const { t } = useTranslation();
  // Phase Final-2 — data-saver mode disables auto-rotation so we don't
  // burn through the user's data quota fetching the next slide's image
  // every 5 s while they read the current one.
  const prefs = useUserPreferences();
  const data = useMemo(
    () => (slides.length > 0 ? slides : ([null] as (HeroSlideRow | null)[])),
    [slides],
  );
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const slideWidth = SCREEN_WIDTH - Spacing.md * 2;
  const slideHeight = Math.round(slideWidth * 0.55);

  useEffect(() => {
    if (data.length <= 1) return;
    if (prefs.data_saver_mode) return;
    const id = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % data.length;
        scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [data.length, slideWidth, prefs.data_saver_mode]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {data.map((slide, i) => (
          <Slide key={slide?.id ?? `welcome-${i}`} slide={slide} width={slideWidth} height={slideHeight} t={t} />
        ))}
      </ScrollView>
      {data.length > 1 ? (
        <View style={styles.dots}>
          {data.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface SlideProps {
  slide: HeroSlideRow | null;
  width: number;
  height: number;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function Slide({ slide, width, height, t }: SlideProps) {
  const { locale, textAlign } = useDirection();

  if (!slide) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Brand.primary }]} />
        <View style={[StyleSheet.absoluteFill, styles.gradientOverlay]} />
        <View style={styles.content}>
          <View style={styles.kickerPill}>
            <Text style={styles.kickerText}>{t('home.hero_welcome_kicker')}</Text>
          </View>
          <Text style={[styles.title, { textAlign }]} numberOfLines={2}>{t('brand.name')}</Text>
          <Text style={[styles.sub, { textAlign }]} numberOfLines={1}>
            {t('brand.subtitle')} — {t('brand.tagline')}
          </Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{t('home.see_all')}</Text>
          </View>
        </View>
      </View>
    );
  }

  const slideRow = slide as unknown as Record<string, unknown>;
  const title = pickLocalized(slideRow, 'title', locale);
  const subtitle = pickLocalized(slideRow, 'subtitle', locale);
  const cta = pickLocalized(slideRow, 'cta_label', locale);
  const ctaUrl = typeof slideRow.cta_url === 'string' ? slideRow.cta_url : null;

  // Phase 1 fix: never let a .mp4 reach <Image>. pickHeroImageUrl()
  // returns null when there's no poster on a video slide → we fall
  // through to the layered branded gradient below (no black box).
  const renderableUrl = pickHeroImageUrl(slide);
  const isVideoWithoutPoster = slide.media_type === 'video' && !renderableUrl;

  const inner = (
    <View style={[styles.slide, { width, height }]}>
      {renderableUrl ? (
        <Image
          source={{ uri: renderableUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
        />
      ) : (
        // Branded fallback: navy base + orange/cyan gradient blobs.
        // Layered Views (no expo-linear-gradient available) — same trick
        // used by the splash. Never a black/empty plate.
        <View style={[StyleSheet.absoluteFill, styles.brandedFallback]}>
          <View style={[styles.fallbackBlobOne]} />
          <View style={[styles.fallbackBlobTwo]} />
          {isVideoWithoutPoster ? (
            <View style={styles.fallbackBadge}>
              <Text style={styles.fallbackBadgeText}>📹 vidéo en préparation</Text>
            </View>
          ) : null}
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, styles.gradientOverlay]} />
      <View style={styles.content}>
        <View style={styles.kickerPill}>
          <Text style={styles.kickerText}>{t('home.hero_welcome_kicker')}</Text>
        </View>
        {title ? <Text style={[styles.title, { textAlign }]} numberOfLines={2}>{title}</Text> : null}
        {subtitle ? <Text style={[styles.sub, { textAlign }]} numberOfLines={1}>{subtitle}</Text> : null}
        {cta ? (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{cta}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (ctaUrl && ctaUrl.startsWith('/')) {
    return <Link href={ctaUrl as never} asChild><Pressable>{inner}</Pressable></Link>;
  }
  return inner;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  slide: {
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    shadowColor: Brand.shadowBlue,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  gradientOverlay: { backgroundColor: 'rgba(18,51,94,0.18)' },
  // Branded fallback — used when the slide is a video without a poster
  // OR when there's no media at all. Layered Views fake a 2-stop gradient
  // since expo-linear-gradient isn't in the bundle.
  brandedFallback: {
    backgroundColor: Brand.primary,
    overflow: 'hidden',
  },
  fallbackBlobOne: {
    position: 'absolute',
    top: -40, right: -30,
    width: 220, height: 220, borderRadius: 999,
    backgroundColor: 'rgba(255,122,26,0.35)',
  },
  fallbackBlobTwo: {
    position: 'absolute',
    bottom: -60, left: -40,
    width: 240, height: 240, borderRadius: 999,
    backgroundColor: 'rgba(67,217,219,0.25)',
  },
  fallbackBadge: {
    position: 'absolute',
    top: 10, right: 10,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
  },
  fallbackBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  content: { padding: Spacing.lg, gap: 6 },
  kickerPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  kickerText: {
    color: '#FFF', fontWeight: '900', fontSize: 10,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  title: { color: '#FFF', fontWeight: '900', fontSize: 26, letterSpacing: -0.5 },
  sub: { color: 'rgba(255,255,255,0.92)', fontWeight: '600', fontSize: 13 },
  cta: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: { color: Brand.cta, fontWeight: '900', fontSize: 13, letterSpacing: 0.3 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: Brand.surfaceContainer },
  dotActive: { width: 22, backgroundColor: Brand.primary },
});
