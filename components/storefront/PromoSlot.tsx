/**
 * PromoSlot — backend-driven advertisement / promo placement.
 *
 * The Home screen reserves named slots ("hero_secondary", "between_sections",
 * "seasonal", "wholesale", "announcement_strip", etc.) and renders a
 * <PromoSlot slot="..."> wherever the admin should be able to push a banner.
 *
 * Reads from Supabase `banners` table where `banner_type = slot`. If no
 * active banner exists for that slot, the component renders nothing — so
 * adding new ad zones is just a database insert from the admin dashboard.
 *
 * Variants:
 *   ▸ "strip"  — slim full-width tinted bar (announcement)
 *   ▸ "card"   — medium card with image / title / cta
 *   ▸ "wide"   — full-width hero-style card (image background + overlay)
 */
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { pickLocalized } from '@/i18n/pickLocalized';
import { useDirection } from '@/i18n/useDirection';
import { listActiveBanners } from '@/services/heroSlides';
import type { BannerRow } from '@/types/database';

export type PromoVariant = 'strip' | 'card' | 'wide';

interface PromoSlotProps {
  slot: string;
  variant?: PromoVariant;
  /** Tone fallback if the banner doesn't carry an image. */
  fallbackTone?: 'blue' | 'mint' | 'coral' | 'sunshine' | 'lavender';
}

const TONES = {
  blue: { bg: Brand.primaryTint, text: Brand.secondary, accent: Brand.primary },
  mint: { bg: Brand.mintSoft, text: Brand.secondary, accent: '#0E9A95' },
  coral: { bg: Brand.coralSoft, text: '#7A2E0A', accent: Brand.coral },
  sunshine: { bg: '#FFF6D6', text: Brand.secondary, accent: Brand.accentDeep },
  lavender: { bg: Brand.lavenderSoft, text: '#3A2784', accent: Brand.lavender },
} as const;

export function PromoSlot({ slot, variant = 'card', fallbackTone = 'blue' }: PromoSlotProps) {
  const { i18n } = useTranslation();
  const { textAlign } = useDirection();
  const locale = i18n.language as 'fr' | 'ar' | 'en';
  const [banner, setBanner] = useState<BannerRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await listActiveBanners(slot);
        if (cancelled) return;
        // Pick highest priority within the active window.
        const now = Date.now();
        const valid = all.filter((b) => {
          const start = b.start_at ? Date.parse(b.start_at) : 0;
          const end = b.end_at ? Date.parse(b.end_at) : Number.POSITIVE_INFINITY;
          return now >= start && now <= end;
        });
        setBanner(valid[0] ?? null);
      } catch (err) {
        console.warn('[PromoSlot] failed to load slot', slot, err);
      }
    })();
    return () => { cancelled = true; };
  }, [slot]);

  // No backend banner configured for this slot → render nothing (admin-managed).
  if (!banner) return null;

  const row = banner as unknown as Record<string, unknown>;
  const title = pickLocalized(row, 'title', locale);
  const subtitle = pickLocalized(row, 'subtitle', locale);
  const cta = pickLocalized(row, 'cta', locale);
  const image =
    (typeof banner.mobile_image === 'string' && banner.mobile_image) ||
    (typeof banner.image === 'string' && banner.image) ||
    (typeof banner.desktop_image === 'string' && banner.desktop_image) ||
    null;

  const tone = TONES[fallbackTone];
  const href =
    typeof banner.link === 'string' && banner.link.startsWith('/') ? banner.link : null;

  // ---------- STRIP variant ----------
  if (variant === 'strip') {
    const inner = (
      <View style={[styles.strip, { backgroundColor: tone.bg, borderColor: tone.accent + '40' }]}>
        <View style={[styles.stripDot, { backgroundColor: tone.accent }]} />
        <View style={{ flex: 1 }}>
          {title ? (
            <Text style={[styles.stripTitle, { color: tone.text, textAlign }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.stripSub, { color: tone.text, textAlign }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {cta ? (
          <View style={[styles.stripCta, { backgroundColor: tone.accent }]}>
            <Text style={styles.stripCtaText}>{cta}</Text>
          </View>
        ) : null}
      </View>
    );
    return wrapLink(inner, href);
  }

  // ---------- WIDE variant (image background) ----------
  if (variant === 'wide') {
    const inner = (
      <View style={styles.wide}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tone.bg }]} />
        )}
        <View style={styles.wideOverlay} />
        <View style={styles.wideContent}>
          {title ? (
            <Text style={[styles.wideTitle, { textAlign }]} numberOfLines={2}>{title}</Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.wideSub, { textAlign }]} numberOfLines={2}>{subtitle}</Text>
          ) : null}
          {cta ? (
            <View style={styles.widePill}>
              <Text style={styles.widePillText}>{cta}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
    return wrapLink(inner, href);
  }

  // ---------- CARD variant (default) ----------
  const inner = (
    <View style={[styles.card, { backgroundColor: tone.bg }]}>
      <View style={[styles.cardBlob, { backgroundColor: tone.accent }]} />
      {image ? (
        <Image source={{ uri: image }} style={styles.cardImage} contentFit="cover" />
      ) : null}
      <View style={styles.cardContent}>
        {title ? (
          <Text style={[styles.cardTitle, { color: tone.text, textAlign }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.cardSub, { color: tone.text, textAlign }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {cta ? (
          <View style={[styles.cardCta, { backgroundColor: tone.accent }]}>
            <Text style={styles.cardCtaText}>{cta}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
  return wrapLink(inner, href);
}

function wrapLink(inner: React.ReactElement, href: string | null) {
  if (!href) return inner;
  return (
    <Link href={href as never} asChild>
      <Pressable>{inner}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  // Strip
  strip: {
    marginHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  stripDot: { width: 10, height: 10, borderRadius: 999 },
  stripTitle: { fontWeight: '900', fontSize: 13, letterSpacing: -0.2 },
  stripSub: { fontWeight: '600', fontSize: 11, opacity: 0.85, marginTop: 1 },
  stripCta: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  stripCtaText: { color: '#FFF', fontWeight: '900', fontSize: 11, letterSpacing: 0.4 },

  // Card
  card: {
    marginHorizontal: Spacing.md,
    borderRadius: Radius.xxl,
    padding: Spacing.md,
    minHeight: 120,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardBlob: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 999,
    right: -50, top: -60, opacity: 0.30,
  },
  cardImage: {
    position: 'absolute',
    right: -10, bottom: -10,
    width: 120, height: 120,
  },
  cardContent: { gap: 6, maxWidth: '70%' },
  cardTitle: { fontWeight: '900', fontSize: 17, letterSpacing: -0.3 },
  cardSub: { fontWeight: '600', fontSize: 12, opacity: 0.85 },
  cardCta: { alignSelf: 'flex-start', marginTop: Spacing.sm, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  cardCtaText: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },

  // Wide (image background)
  wide: {
    marginHorizontal: Spacing.md,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'flex-end',
    shadowColor: Brand.shadowDeep,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  wideOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.30)' },
  wideContent: { padding: Spacing.lg, gap: 6 },
  wideTitle: { color: '#FFF', fontWeight: '900', fontSize: 22, letterSpacing: -0.4 },
  wideSub: { color: 'rgba(255,255,255,0.92)', fontWeight: '600', fontSize: 13 },
  widePill: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  widePillText: { color: Brand.cta, fontWeight: '900', fontSize: 12, letterSpacing: 0.3 },
});
