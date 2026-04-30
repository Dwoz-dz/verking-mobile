/**
 * SmartEmptyState — admin-driven empty placeholder with optional smart
 * surfaces.
 *
 * Reads `mobile_empty_states[screen_key]` (managed under Gestionnaire
 * Mobile › Empty states) and renders:
 *   ▸ Hero card (illustration + title + subtitle + 1–2 CTAs)
 *   ▸ Recently-viewed rail   (if show_recently_viewed)
 *   ▸ Trending rail          (if show_trending)
 *   ▸ Recommendations rail   (if show_recommendations)
 *   ▸ Referral CTA           (if show_referral_cta)
 *
 * If the admin row is missing or columns are null, falls back to the
 * inline default props the host passes — so screens never go blank.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MarketingEmptyState } from '@/components/storefront/MarketingEmptyState';
import { ProductCard } from '@/components/storefront/ProductCard';
import { RecentlyViewedRail } from '@/components/storefront/RecentlyViewedRail';
import { SectionHeader } from '@/components/storefront/SectionHeader';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { useEmptyState } from '@/services/emptyStates';
import { listBestSellers, listRecommended } from '@/services/products';
import type { ProductWithImages } from '@/types/database';

interface SmartEmptyStateProps {
  /** Screen key matching `mobile_empty_states.screen_key`. */
  screen: string;
  /** Default icon when the admin row sets no illustration_url. */
  defaultIcon?: ComponentProps<typeof Ionicons>['name'];
  /** Default title fallback. */
  defaultTitle: string;
  /** Default subtitle fallback. */
  defaultSubtitle?: string;
  /** Default primary CTA label fallback. */
  defaultCtaLabel?: string;
  /** Default primary CTA target href fallback (e.g. '/(tabs)/explore'). */
  defaultCtaHref?: string;
  /** Allow the host to override the smart-surface flags entirely. */
  forceShowRecentlyViewed?: boolean;
  forceShowTrending?: boolean;
  forceShowRecommendations?: boolean;
  forceShowReferralCta?: boolean;
  style?: StyleProp<ViewStyle>;
}

function pickLabel(fr: string | null | undefined, ar: string | null | undefined, lang: string, fb?: string): string | undefined {
  if (lang === 'ar' && ar && ar.trim()) return ar;
  if (fr && fr.trim()) return fr;
  if (ar && ar.trim()) return ar;
  return fb;
}

export function SmartEmptyState({
  screen,
  defaultIcon = 'sparkles',
  defaultTitle,
  defaultSubtitle,
  defaultCtaLabel,
  defaultCtaHref,
  forceShowRecentlyViewed,
  forceShowTrending,
  forceShowRecommendations,
  forceShowReferralCta,
  style,
}: SmartEmptyStateProps) {
  const row = useEmptyState(screen);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { textAlign } = useDirection();

  const lang = i18n.language;
  const title = pickLabel(row?.title_fr, row?.title_ar, lang, defaultTitle) ?? defaultTitle;
  const subtitle = pickLabel(row?.subtitle_fr, row?.subtitle_ar, lang, defaultSubtitle);
  const primaryLabel = pickLabel(row?.cta_primary_label_fr, row?.cta_primary_label_ar, lang, defaultCtaLabel);
  const primaryHref = (row?.cta_primary_link && row.cta_primary_link.trim()) || defaultCtaHref;
  const secondaryLabel = pickLabel(row?.cta_secondary_label_fr, row?.cta_secondary_label_ar, lang);
  const secondaryHref = row?.cta_secondary_link?.trim() || undefined;

  const showRecent = forceShowRecentlyViewed ?? row?.show_recently_viewed ?? false;
  const showTrending = forceShowTrending ?? row?.show_trending ?? false;
  const showRecs = forceShowRecommendations ?? row?.show_recommendations ?? false;
  const showReferral = forceShowReferralCta ?? row?.show_referral_cta ?? false;

  const onPrimary = primaryHref
    ? () => router.push(primaryHref as never)
    : undefined;

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, style]}
      showsVerticalScrollIndicator={false}
    >
      {row?.illustration_url ? (
        <View style={styles.heroIllustrationWrap}>
          <Image source={{ uri: row.illustration_url }} style={styles.heroIllustration} resizeMode="cover" />
        </View>
      ) : null}

      <MarketingEmptyState
        icon={defaultIcon}
        title={title}
        subtitle={subtitle ?? undefined}
        ctaLabel={primaryLabel ?? undefined}
        onCta={onPrimary}
        style={styles.hero}
      />

      {secondaryLabel && secondaryHref ? (
        <Pressable
          onPress={() => router.push(secondaryHref as never)}
          style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="chevron-forward-circle-outline" size={16} color={Brand.primary} />
          <Text style={[styles.secondaryCtaText, { textAlign }]}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}

      {showRecent ? (
        <View style={styles.surface}>
          <RecentlyViewedRail minToShow={1} limit={10} />
        </View>
      ) : null}

      {showTrending ? (
        <ProductsSurface
          title={t('home.section_best_title', { defaultValue: 'Tendance' })}
          subtitle={t('home.section_best_sub', { defaultValue: 'Ce que tout le monde regarde' })}
          fetcher={() => listBestSellers(8)}
        />
      ) : null}

      {showRecs ? (
        <ProductsSurface
          title={t('home.section_for_you_title', { defaultValue: 'Pour vous' })}
          subtitle={t('home.section_for_you_sub', { defaultValue: 'Sélectionné rien que pour vous' })}
          fetcher={() => listRecommended(8)}
        />
      ) : null}

      {showReferral ? (
        <Pressable
          onPress={() => router.push('/settings' as never)}
          style={({ pressed }) => [styles.referralCard, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.referralIcon}>
            <Ionicons name="gift-outline" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.referralText}>
            <Text style={[styles.referralTitle, { textAlign }]}>
              {t('referral.empty_title', { defaultValue: 'Invitez vos amis, gagnez 500 DA' })}
            </Text>
            <Text style={[styles.referralSub, { textAlign }]}>
              {t('referral.empty_sub', { defaultValue: 'Partagez votre code et recevez un bon d’achat' })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Brand.cta} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

interface ProductsSurfaceProps {
  title: string;
  subtitle?: string;
  fetcher: () => Promise<ProductWithImages[]>;
}

function ProductsSurface({ title, subtitle, fetcher }: ProductsSurfaceProps) {
  const [items, setItems] = useState<ProductWithImages[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetcher();
        if (!cancelled) setItems(data);
      } catch (err) {
        console.warn('[SmartEmptyState] surface fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [fetcher]);

  if (items.length === 0) return null;
  return (
    <View style={styles.surface}>
      <SectionHeader title={title} subtitle={subtitle} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {items.map((p) => (
          <ProductCard key={p.id} product={p} width={150} variant="rail" />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  heroIllustrationWrap: {
    height: 160,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Brand.primaryTint,
  },
  heroIllustration: { width: '100%', height: '100%' },
  hero: {
    flex: 0,
    paddingVertical: Spacing.lg,
  },
  secondaryCta: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primaryTint,
  },
  secondaryCtaText: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 12,
    color: Brand.primary,
  },
  surface: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  rail: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  referralCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Brand.ctaSoft,
    borderWidth: 1,
    borderColor: Brand.cta + '33',
  },
  referralIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Brand.cta,
    alignItems: 'center', justifyContent: 'center',
  },
  referralText: { flex: 1, minWidth: 0 },
  referralTitle: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 13,
    color: Brand.secondary,
  },
  referralSub: {
    fontFamily: BrandFont.medium,
    fontWeight: '500',
    fontSize: 11,
    color: Brand.textMuted,
    marginTop: 2,
  },
});
