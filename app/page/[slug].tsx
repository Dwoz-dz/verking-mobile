/**
 * Themed page — `/page/[slug]`.
 *
 * Renders an admin-curated landing page composed of:
 *   ▸ Hero — banner image + title + subtitle + countdown + CTA
 *   ▸ Sections — banner / products / rail / coupons / flash_sales
 *
 * Section types are dispatched to focused sub-renderers; unknown
 * types are silently skipped so admins can iterate the JSONB shape
 * without breaking older app builds.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountdownTimer } from '@/components/storefront/CountdownTimer';
import { FlashSaleRail } from '@/components/storefront/FlashSaleRail';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ErrorState, LoadingState } from '@/components/storefront/StateViews';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import { listProducts, listProductsByIds } from '@/services/products';
import { useClaimableCoupons } from '@/services/coupons';
import { useActiveFlashSales } from '@/services/flashSales';
import { useThemedPage, type ThemedSection } from '@/services/themedPages';
import type { ProductWithImages } from '@/types/database';

export default function ThemedPageScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = params.slug ?? '';
  const { t, i18n } = useTranslation();
  const { textAlign } = useDirection();
  const isAr = i18n.language === 'ar';
  const router = useRouter();
  const { page, loading } = useThemedPage(slug);

  const title = page ? (isAr ? page.title_ar : page.title_fr) : '';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title, headerBackTitle: 'Retour' }} />
      {loading ? (
        <LoadingState style={{ flex: 1 }} />
      ) : !page ? (
        <ErrorState
          style={{ flex: 1 }}
          message={t('common.retry')}
          onRetry={() => router.back()}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Hero page={page} isAr={isAr} textAlign={textAlign} />
          {page.sections.map((section, idx) => (
            <SectionDispatcher key={`${section.type}-${idx}`} section={section} isAr={isAr} textAlign={textAlign} />
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────

function Hero({
  page, isAr, textAlign,
}: {
  page: NonNullable<ReturnType<typeof useThemedPage>['page']>;
  isAr: boolean;
  textAlign: 'left' | 'right' | 'center';
}) {
  const router = useRouter();
  const heroTitle = (isAr ? page.hero_title_ar : page.hero_title_fr) ?? (isAr ? page.title_ar : page.title_fr);
  const heroSub = isAr ? page.hero_subtitle_ar : page.hero_subtitle_fr;
  const ctaLabel = isAr ? page.hero_cta_label_ar : page.hero_cta_label_fr;
  const tone = page.tab_color || Brand.primary;

  return (
    <View style={[styles.hero, { backgroundColor: tone }]}>
      {page.hero_banner_image ? (
        <Image
          source={{ uri: page.hero_banner_image }}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.45 }]}
          contentFit="cover"
          transition={120}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: tone, opacity: 0.35 }]} />

      <View style={styles.heroContent}>
        {page.tab_emoji ? <Text style={styles.heroEmoji}>{page.tab_emoji}</Text> : null}
        <Text style={[styles.heroTitle, { textAlign }]} numberOfLines={2}>
          {heroTitle}
        </Text>
        {heroSub ? (
          <Text style={[styles.heroSubtitle, { textAlign }]} numberOfLines={3}>
            {heroSub}
          </Text>
        ) : null}
        {page.hero_countdown_ends_at ? (
          <View style={styles.heroCountdown}>
            <CountdownTimer endsAt={page.hero_countdown_ends_at} size="md" />
          </View>
        ) : null}
        {ctaLabel && page.hero_cta_link ? (
          <Pressable
            onPress={() => {
              const link = String(page.hero_cta_link ?? '');
              if (link.startsWith('http')) return; // external link not handled here
              router.push(link as never);
            }}
            style={styles.heroCta}
          >
            <Text style={styles.heroCtaLabel}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color={tone} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Section dispatcher ─────────────────────────────────────────────────

function SectionDispatcher({
  section, isAr, textAlign,
}: {
  section: ThemedSection;
  isAr: boolean;
  textAlign: 'left' | 'right' | 'center';
}) {
  const title = (isAr ? (section as { title_ar?: string }).title_ar : (section as { title_fr?: string }).title_fr) ?? '';
  switch (section.type) {
    case 'banner':
      return <BannerSection section={section as Extract<ThemedSection, { type: 'banner' }>} isAr={isAr} textAlign={textAlign} />;
    case 'products':
      return <ProductsSection title={title} filter={(section as Extract<ThemedSection, { type: 'products' }>).filter} textAlign={textAlign} />;
    case 'rail':
      return <RailSection title={title} ids={(section as Extract<ThemedSection, { type: 'rail' }>).product_ids ?? []} textAlign={textAlign} />;
    case 'coupons':
      return <CouponsSection title={title} couponIds={(section as Extract<ThemedSection, { type: 'coupons' }>).coupon_ids} textAlign={textAlign} isAr={isAr} />;
    case 'flash_sales':
      return <FlashSalesSection title={title} textAlign={textAlign} />;
    default:
      return null;
  }
}

function SectionTitle({ title, textAlign }: { title?: string; textAlign: 'left' | 'right' | 'center' }) {
  if (!title) return null;
  return <Text style={[styles.sectionTitle, { textAlign }]}>{title}</Text>;
}

function BannerSection({
  section, isAr, textAlign,
}: {
  section: Extract<ThemedSection, { type: 'banner' }>;
  isAr: boolean;
  textAlign: 'left' | 'right' | 'center';
}) {
  const router = useRouter();
  const bannerTitle = isAr ? section.title_ar : section.title_fr;
  return (
    <Pressable
      onPress={() => {
        if (!section.link) return;
        if (section.link.startsWith('http')) return;
        router.push(section.link as never);
      }}
      style={styles.banner}
    >
      {section.image ? (
        <Image source={{ uri: section.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Brand.primaryTint }]} />
      )}
      <View style={[StyleSheet.absoluteFillObject, styles.bannerOverlay]} />
      {bannerTitle ? (
        <Text style={[styles.bannerTitle, { textAlign }]} numberOfLines={2}>{bannerTitle}</Text>
      ) : null}
    </Pressable>
  );
}

function ProductsSection({
  title, filter, textAlign,
}: {
  title: string;
  filter: Extract<ThemedSection, { type: 'products' }>['filter'];
  textAlign: 'left' | 'right' | 'center';
}) {
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listProducts({
        categoryId: filter?.category_id,
        limit: filter?.limit ?? 8,
      });
      if (!cancelled) setProducts(list);
    })();
    return () => { cancelled = true; };
  }, [filter?.category_id, filter?.limit]);

  if (products.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle title={title} textAlign={textAlign} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} width={160} />
        ))}
      </ScrollView>
    </View>
  );
}

function RailSection({
  title, ids, textAlign,
}: { title: string; ids: string[]; textAlign: 'left' | 'right' | 'center' }) {
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const list = await listProductsByIds(ids);
      if (!cancelled) setProducts(list);
    })();
    return () => { cancelled = true; };
  }, [ids.join(',')]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (products.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle title={title} textAlign={textAlign} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} width={160} />
        ))}
      </ScrollView>
    </View>
  );
}

function CouponsSection({
  title, couponIds, textAlign, isAr,
}: { title: string; couponIds?: string[]; textAlign: 'left' | 'right' | 'center'; isAr: boolean }) {
  const { coupons } = useClaimableCoupons();
  const filtered = couponIds && couponIds.length > 0
    ? coupons.filter((c) => couponIds.includes(c.id))
    : coupons;

  if (filtered.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle title={title} textAlign={textAlign} />
      <Link href={'/coupons' as never} asChild>
        <Pressable style={styles.couponsCta}>
          <Ionicons name="ticket" size={18} color={Brand.cta} />
          <Text style={[styles.couponsLabel, { textAlign }]} numberOfLines={1}>
            {filtered.length} coupons disponibles — toucher pour en réclamer
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Brand.cta} />
        </Pressable>
      </Link>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.couponsRail}>
        {filtered.slice(0, 6).map((c) => {
          const ctitle = isAr ? c.title_ar : c.title_fr;
          const valueText =
            c.discount_type === 'percent' ? `-${c.value}%` :
            c.discount_type === 'fixed' ? `-${formatPrice(c.value)}` :
            'Livraison';
          return (
            <Link key={c.id} href={'/coupons' as never} asChild>
              <Pressable style={styles.couponMini}>
                <Text style={styles.couponMiniValue}>{valueText}</Text>
                <Text style={styles.couponMiniTitle} numberOfLines={1}>{ctitle}</Text>
                <Text style={styles.couponMiniCode}>{c.code}</Text>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
    </View>
  );
}

function FlashSalesSection({
  title, textAlign,
}: { title: string; textAlign: 'left' | 'right' | 'center' }) {
  const { sales } = useActiveFlashSales();
  if (sales.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle title={title} textAlign={textAlign} />
      {sales.map((sale) => (
        <FlashSaleRail key={sale.id} sale={sale} />
      ))}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  scroll: { paddingBottom: 80 },

  hero: {
    minHeight: 220,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    overflow: 'hidden',
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
  },
  heroContent: { alignItems: 'flex-start', gap: 8, position: 'relative' },
  heroEmoji: { fontSize: 36 },
  heroTitle: {
    color: '#FFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 24, letterSpacing: -0.5,
  },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', lineHeight: 19 },
  heroCountdown: { marginTop: 4 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: '#FFF', marginTop: 6,
  },
  heroCtaLabel: { fontWeight: '900', fontSize: 13, color: Brand.text },

  section: { marginTop: Spacing.lg },
  sectionTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 16,
    color: Brand.secondary, letterSpacing: -0.2,
    paddingHorizontal: Spacing.md, marginBottom: 8,
  },
  rail: { paddingHorizontal: Spacing.md, gap: 10 },

  banner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    aspectRatio: 16 / 7,
    justifyContent: 'flex-end',
    padding: Spacing.sm,
  },
  bannerOverlay: { backgroundColor: 'rgba(15,23,42,0.25)' },
  bannerTitle: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },

  couponsCta: {
    marginHorizontal: Spacing.md,
    backgroundColor: Brand.cta + '15',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Brand.cta + '33',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  couponsLabel: { flex: 1, fontWeight: '800', fontSize: 12, color: Brand.text },
  couponsRail: { paddingHorizontal: Spacing.md, gap: 8, paddingTop: 8 },
  couponMini: {
    width: 130,
    backgroundColor: '#FFF',
    borderRadius: Radius.lg,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: Brand.cta + '33',
    gap: 2,
  },
  couponMiniValue: { fontWeight: '900', fontSize: 16, color: Brand.cta, letterSpacing: -0.3 },
  couponMiniTitle: { fontWeight: '800', fontSize: 11, color: Brand.text },
  couponMiniCode: { fontFamily: BrandFont.bold, fontSize: 10, color: Brand.primary, fontWeight: '900' },
});
