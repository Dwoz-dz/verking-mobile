/**
 * Hero carousel — paginated horizontal scroll over Supabase `hero_slides`.
 * i18n + RTL aware. Slide title/subtitle resolved via pickLocalized.
 */
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
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
import type { HeroSlideRow } from '@/types/database';

interface HeroCarouselProps {
  slides: HeroSlideRow[];
  height?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function HeroCarousel({ slides, height = 220 }: HeroCarouselProps) {
  const { t } = useTranslation();
  // Skip video-typed slides until expo-video is wired in. Without
  // a video player, `<Image>` would try to load an .mp4 URL and
  // render a solid black box — exactly the bug reported on PTP-N49.
  // Falling back to the welcome card keeps the home looking
  // intentional instead of broken.
  const data = useMemo(() => {
    const renderable = slides.filter(
      (s) => s.media_type !== 'video' && (s.media_url || s.title_fr || s.title_ar),
    );
    return renderable.length > 0 ? renderable : ([null] as (HeroSlideRow | null)[]);
  }, [slides]);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const slideWidth = SCREEN_WIDTH - Spacing.lg * 2;

  // Per-slide auto-rotate: each slide carries its own `duration_ms`
  // (set in the admin "Durée d'affichage" select). We re-arm the
  // timer whenever the active slide changes so a manual swipe also
  // resets the dwell window. Falls back to 4500ms if a slide row
  // somehow lacks a duration.
  useEffect(() => {
    if (data.length <= 1) return;
    const current = data[index];
    type RotatableSlide = HeroSlideRow & { duration_ms?: number; auto_rotate_seconds?: number };
    const slide = current as RotatableSlide | null;
    const fromMs = slide?.duration_ms;
    const fromSec = slide?.auto_rotate_seconds;
    const dwell =
      typeof fromMs === 'number' && Number.isFinite(fromMs) && fromMs > 1000 ? fromMs
      : typeof fromSec === 'number' && Number.isFinite(fromSec) && fromSec >= 3 ? fromSec * 1000
      : 4500;
    const id = setTimeout(() => {
      setIndex((i) => {
        const next = (i + 1) % data.length;
        scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
        return next;
      });
    }, dwell);
    return () => clearTimeout(id);
  }, [data, index, slideWidth]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / slideWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={styles.container}>
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
          <SlideView key={slide?.id ?? `welcome-${i}`} slide={slide} width={slideWidth} height={height} t={t} />
        ))}
      </ScrollView>
      {data.length > 1 ? (
        <View style={styles.dots}>
          {data.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && { backgroundColor: Brand.primary, width: 18 }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface SlideViewProps {
  slide: HeroSlideRow | null;
  width: number;
  height: number;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function SlideView({ slide, width, height, t }: SlideViewProps) {
  const { locale, textAlign } = useDirection();

  if (!slide) {
    // Welcome fallback. Layered rgba "spots" simulate a brand
    // gradient without pulling in expo-linear-gradient — keeps the
    // dependency surface small while still looking intentional.
    return (
      <View style={[styles.slide, styles.welcomeSlide, { width, height }]}>
        <View style={[styles.welcomeBlobOne, { backgroundColor: 'rgba(255,122,26,0.45)' }]} />
        <View style={[styles.welcomeBlobTwo, { backgroundColor: 'rgba(67,217,219,0.35)' }]} />
        <View style={styles.welcomeContent}>
          <Text style={[styles.welcomeKicker, { textAlign }]}>{t('home.hero_welcome_kicker')}</Text>
          <Text style={[styles.welcomeTitle, { textAlign }]}>{t('brand.name')}</Text>
          <Text style={[styles.welcomeSub, { textAlign }]}>
            {t('brand.subtitle')} — {t('brand.tagline')}
          </Text>
          <View style={styles.welcomeCtaPill}>
            <Text style={styles.welcomeCtaText}>{t('home.hero_welcome_hint')}</Text>
          </View>
        </View>
      </View>
    );
  }

  const slideRow = slide as unknown as Record<string, unknown>;
  const title = pickLocalized(slideRow, 'title', locale);
  const subtitle = pickLocalized(slideRow, 'subtitle', locale);
  const cta = pickLocalized(slideRow, 'cta_label', locale);

  return (
    <View style={[styles.slide, { width, height }]}>
      {slide.media_url ? (
        <Image
          source={{ uri: slide.media_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Brand.primary }]} />
      )}
      <View style={styles.overlay} />
      <View style={styles.slideContent}>
        {title ? <Text style={[styles.slideTitle, { textAlign }]} numberOfLines={2}>{title}</Text> : null}
        {subtitle ? <Text style={[styles.slideSub, { textAlign }]} numberOfLines={2}>{subtitle}</Text> : null}
        {cta ? (
          <View style={styles.ctaPill}>
            <Text style={styles.ctaText}>{cta}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  slide: {
    marginRight: 0,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Brand.surfaceMuted,
    justifyContent: 'flex-end',
  },
  welcomeSlide: { backgroundColor: Brand.secondary, justifyContent: 'center', overflow: 'hidden' },
  welcomeContent: { padding: Spacing.xl, gap: 4, zIndex: 2 },
  welcomeBlobOne: {
    position: 'absolute', top: -40, right: -30,
    width: 180, height: 180, borderRadius: 999,
  },
  welcomeBlobTwo: {
    position: 'absolute', bottom: -50, left: -30,
    width: 200, height: 200, borderRadius: 999,
  },
  welcomeKicker: { color: Brand.sunshine, fontWeight: '800', letterSpacing: 1.5, fontSize: 12, textTransform: 'uppercase' },
  welcomeTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 38, letterSpacing: 2, marginTop: 4 },
  welcomeSub: { color: '#FFFFFF', opacity: 0.92, fontWeight: '600', marginTop: 4 },
  welcomeCtaPill: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: Brand.cta,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
  },
  welcomeCtaText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,51,94,0.35)' },
  slideContent: { padding: Spacing.lg, gap: 4 },
  slideTitle: { color: '#FFF', fontWeight: '900', fontSize: 22, letterSpacing: 0.4 },
  slideSub: { color: '#FFF', fontWeight: '600', opacity: 0.9 },
  ctaPill: {
    marginTop: Spacing.sm,
    backgroundColor: Brand.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  ctaText: { color: '#FFF', fontWeight: '800', letterSpacing: 0.6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: Brand.border },
});
