/**
 * VERKING marketplace — soft family-friendly Home v4.
 *
 * Layout (admin-managed promo slots are scattered between sections):
 *   ▸ Sticky header (menu / VERKING / search + cart icons)
 *   ▸ PromoSlot "announcement" (slim strip, optional)
 *   ▸ HeroBanner (gradient blue carousel, hero_slides DB)
 *   ▸ PromoSlot "hero_secondary" (card, optional)
 *   ▸ Rayons (CategoryRail)
 *   ▸ PromoSlot "between_categories" (card, optional)
 *   ▸ Ventes Flash (deals rail)
 *   ▸ PromoSlot "seasonal" (wide image-bg banner, optional)
 *   ▸ Nouveautés (2-col grid)
 *   ▸ Meilleures Ventes (BestSellerCard + mini cards)
 *   ▸ PromoSlot "wholesale" (card, optional)
 *   ▸ Spécial Gros + Wholesale rail
 *   ▸ Recommandés rail
 *   ▸ PromoSlot "footer_promo" (card, optional)
 *   ▸ WhyVerkingBlock + WhatsAppContactBlock + footer
 *
 * Each PromoSlot reads from `banners` table where `banner_type = slot`.
 * If no banner is configured, the slot renders nothing — the layout still
 * looks balanced and the admin can drop ads into any slot at any time.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BestSellerCard } from '@/components/storefront/BestSellerCard';
import { CategoryRail } from '@/components/storefront/CategoryRail';
import { DeliverToStrip } from '@/components/storefront/DeliverToStrip';
import { FlashSaleRail } from '@/components/storefront/FlashSaleRail';
import { HeroBanner } from '@/components/storefront/HeroBanner';
import { ThemedPagesStrip } from '@/components/storefront/ThemedPagesStrip';
import { MiniProductCard } from '@/components/storefront/MiniProductCard';
import { ProductCard } from '@/components/storefront/ProductCard';
import { PromoSlot } from '@/components/storefront/PromoSlot';
import { DraggableChipsRow } from '@/components/storefront/DraggableChipsRow';
import { RecentlyViewedRail } from '@/components/storefront/RecentlyViewedRail';
import { SectionHeader } from '@/components/storefront/SectionHeader';
import { TrustBadgesRow } from '@/components/storefront/TrustBadgesRow';
import { ErrorState, LoadingState } from '@/components/storefront/StateViews';
import { WhatsAppContactBlock } from '@/components/storefront/WhatsAppContactBlock';
import { WhyVerkingBlock } from '@/components/storefront/WhyVerkingBlock';
import { ThemeBackdrop } from '@/components/decorative/ThemeBackdrop';
import { HamburgerButton } from '@/components/navigation/HamburgerButton';
import { RailWithPlaceholders } from '@/components/storefront/RailWithPlaceholders';
import { ComingSoonBanner } from '@/components/ui/ComingSoonBanner';
import { ComingSoonCard } from '@/components/ui/ComingSoonCard';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useDirection } from '@/i18n/useDirection';
import { bumpRefresh } from '@/lib/refresh/refreshBus';
import { reportScrollY } from '@/lib/ui/fabVisibility';
import { useComingSoonConfig } from '@/services/comingSoonConfig';
import { listCategories } from '@/services/categories';
import { listHeroSlides } from '@/services/heroSlides';
import {
  listBestSellers,
  listDealsOfTheDay,
  listFeaturedProducts,
  listNewArrivals,
  listRecommended,
  listWholesaleDeals,
} from '@/services/products';
import { useActiveFlashSales } from '@/services/flashSales';
import type { CategoryRow, HeroSlideRow, ProductWithImages } from '@/types/database';

interface HomeData {
  slides: HeroSlideRow[];
  categories: CategoryRow[];
  featured: ProductWithImages[];
  newArrivals: ProductWithImages[];
  bestSellers: ProductWithImages[];
  deals: ProductWithImages[];
  wholesale: ProductWithImages[];
  recommended: ProductWithImages[];
}

const EMPTY: HomeData = {
  slides: [], categories: [], featured: [], newArrivals: [],
  bestSellers: [], deals: [], wholesale: [], recommended: [],
};

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const [data, setData] = useState<HomeData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sales: flashSales } = useActiveFlashSales();
  const comingSoon = useComingSoonConfig();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [slides, categories, featured, newArrivals, bestSellers, deals, wholesale, recommended] = await Promise.all([
        listHeroSlides('main').catch(() => [] as HeroSlideRow[]),
        listCategories(true),
        listFeaturedProducts(8),
        listNewArrivals(8),
        listBestSellers(8),
        listDealsOfTheDay(8),
        listWholesaleDeals(8),
        listRecommended(8),
      ]);
      setData({ slides, categories, featured, newArrivals, bestSellers, deals, wholesale, recommended });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Phase 16.4 — also notify other hooks (loyalty, coupons, etc.) so
    // pulling on Home refreshes anything they've cached too.
    bumpRefresh();
    await load();
    setRefreshing(false);
  }, [load]);
  // Phase 16.4 — refresh after 30 s of staleness when the tab regains focus.
  useRefreshOnFocus();

  const catById = useMemo(() => {
    const m = new Map<string, CategoryRow>();
    for (const c of data.categories) m.set(c.id, c);
    return m;
  }, [data.categories]);
  const catFor = (p: ProductWithImages) => (p.category_id ? catById.get(p.category_id) ?? null : null);

  const bestFeatured = data.bestSellers[0] ?? data.featured[0] ?? null;
  const bestMini = (data.bestSellers.length > 0 ? data.bestSellers : data.featured).slice(1, 3);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ThemeBackdrop />
      {/* Sticky header */}
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <View style={[styles.headerSide, { flexDirection: rowDirection, gap: 8 }]}>
          <HamburgerButton />
          <Text style={styles.brand}>{t('brand.name')}</Text>
        </View>
        <View style={[styles.headerSide, { flexDirection: rowDirection, gap: 14 }]}>
          <Pressable hitSlop={8}>
            <Ionicons name="search" size={22} color={Brand.text} />
          </Pressable>
          <Ionicons name="cart" size={22} color={Brand.cta} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
        showsVerticalScrollIndicator={false}
        // Phase Final — drive the FAB auto-hide bus.
        onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {loading ? (
          <LoadingState style={{ paddingVertical: 80 }} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : (
          <>
            {/* Geo-aware delivery strip — opens the wilaya picker on tap. */}
            <View style={styles.slotTop}>
              <DeliverToStrip />
            </View>

            {/* Slot: announcement strip (admin-managed) */}
            <View style={styles.slotSpaced}>
              <PromoSlot slot="announcement_strip" variant="strip" fallbackTone="sunshine" />
            </View>

            {/* Hero */}
            <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}>
              <HeroBanner slides={data.slides} />
            </View>

            {/* Admin-curated themed pages strip — Rentrée, Économies,
                Spécial Gros... Sit just below the Hero so the user
                can jump straight to a curated landing page. */}
            <View style={{ marginTop: Spacing.sm }}>
              <ThemedPagesStrip />
            </View>

            {/* Quick chips — admin-managed Temu-style draggable pills.
                Long-press to reorder, tap to navigate. */}
            <View style={{ marginTop: Spacing.md }}>
              <DraggableChipsRow />
            </View>

            {/* Trust strip — reassurance pills (livraison / COD / qualité / support). */}
            <View style={{ marginTop: Spacing.md }}>
              <TrustBadgesRow />
            </View>

            {/* Slot: hero secondary card */}
            <View style={styles.slotSpaced}>
              <PromoSlot slot="hero_secondary" variant="card" fallbackTone="coral" />
            </View>

            {/* Catégories */}
            <View style={styles.section}>
              <SectionHeader title={t('home.section_categories')} href="/(tabs)/explore" />
              {data.categories.length > 0 ? (
                <CategoryRail categories={data.categories} />
              ) : (
                <Text style={[styles.empty, { textAlign }]}>{t('home.empty_categories')}</Text>
              )}
            </View>

            {/* Slot: between categories */}
            <View style={styles.slotSpaced}>
              <PromoSlot slot="between_categories" variant="card" fallbackTone="lavender" />
            </View>

            {/* Admin-driven flash sales — orange banner + countdown +
                product rail per active campaign. Hides itself when no
                active sale is published. */}
            {flashSales.map((sale) => (
              <FlashSaleRail key={sale.id} sale={sale} />
            ))}

            {/* Ventes Flash — Phase 5.1 fills the rail with placeholder
                cards when admin hasn't seeded enough live products, so
                the user sees an intentional "ترقّبوا" rail instead of
                a blank section. */}
            <View style={styles.flashWrap}>
              <View style={[styles.flashHeader, { flexDirection: rowDirection }]}>
                <View>
                  <Text style={[styles.flashTitle, { textAlign }]}>{t('home.section_deals')}</Text>
                  <Text style={[styles.flashSub, { textAlign }]}>{t('home.section_deals_sub')}</Text>
                </View>
                <View style={styles.flashCount}>
                  <Ionicons name="flame" size={14} color={Brand.cta} />
                  <Text style={styles.flashCountText}>
                    {Math.max(data.deals.length, data.featured.length)} {t('home.see_all')}
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {(() => {
                  const real = data.deals.length > 0 ? data.deals : data.featured;
                  const minSlots = comingSoon.min_grid_slots > 0 ? comingSoon.min_grid_slots : 8;
                  const placeholders = Math.max(0, minSlots - real.length);
                  return (
                    <>
                      {real.map((p) => (
                        <ProductCard key={p.id} product={p} category={catFor(p)} width={170} />
                      ))}
                      {comingSoon.enabled
                        ? Array.from({ length: placeholders }).map((_, i) => (
                            <ComingSoonCard
                              key={`ph-deals-${i}`}
                              index={i}
                              locale={i18n.language === 'ar' ? 'ar' : 'fr'}
                              width={170}
                              titlePool={i18n.language === 'ar' ? comingSoon.pool_titles_ar : comingSoon.pool_titles_fr}
                              emojiPool={comingSoon.pool_emojis}
                              showNotifyCta={comingSoon.show_notify_cta}
                            />
                          ))
                        : null}
                    </>
                  );
                })()}
              </ScrollView>
            </View>
            {comingSoon.enabled && (data.deals.length + data.featured.length) === 0 ? (
              <ComingSoonBanner
                emoji={comingSoon.banner_emoji}
                text={(i18n.language === 'ar' ? comingSoon.banner_text_ar : comingSoon.banner_text_fr) ?? undefined}
                expectedLaunchDate={comingSoon.expected_launch_date}
              />
            ) : null}

            {/* Slot: seasonal hero (wide image bg) */}
            <View style={styles.slotSpaced}>
              <PromoSlot slot="seasonal" variant="wide" fallbackTone="blue" />
            </View>

            {/* Nouveautés (2-col grid) — Phase placeholder-pass: pad
                with ComingSoonCards so the grid is always 4 cells (2x2)
                even when admin only has 1-3 newArrivals seeded (or 0).
                Without this, a single newArrival rendered as one lonely
                card with awkward whitespace below, and an all-empty
                state hid the section entirely — exactly the
                "half-empty store" feel we're trying to kill. The
                section now renders whenever the admin enables
                ComingSoon, so users always see the rhythm of the page. */}
            {(data.newArrivals.length > 0 || comingSoon.enabled) ? (
              <View style={styles.section}>
                <SectionHeader
                  title={t('home.section_new')}
                  subtitle={t('home.section_new_sub')}
                  href="/(tabs)/explore"
                />
                <View style={styles.grid}>
                  {data.newArrivals.slice(0, 4).map((p) => (
                    <View key={p.id} style={styles.gridItem}>
                      <ProductCard product={p} category={catFor(p)} variant="grid" />
                    </View>
                  ))}
                  {comingSoon.enabled
                    ? Array.from({
                        length: Math.max(0, 4 - Math.min(4, data.newArrivals.length)),
                      }).map((_, i) => (
                        <View key={`ph-newArrivals-${i}`} style={styles.gridItem}>
                          <ComingSoonCard
                            index={data.newArrivals.length + i}
                            locale={i18n.language === 'ar' ? 'ar' : 'fr'}
                            width="100%"
                            titlePool={i18n.language === 'ar' ? comingSoon.pool_titles_ar : comingSoon.pool_titles_fr}
                            emojiPool={comingSoon.pool_emojis}
                          />
                        </View>
                      ))
                    : null}
                </View>
              </View>
            ) : null}

            {/* Meilleures Ventes — featured + mini */}
            {bestFeatured ? (
              <View style={styles.section}>
                <SectionHeader title={t('home.section_best')} subtitle={t('home.section_best_sub')} />
                <BestSellerCard product={bestFeatured} rating={4.9} />
                {bestMini.length > 0 ? (
                  <View style={styles.miniRow}>
                    {bestMini.map((p) => <MiniProductCard key={p.id} product={p} />)}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Slot: wholesale promo */}
            <View style={styles.slotSpaced}>
              <PromoSlot slot="wholesale" variant="card" fallbackTone="mint" />
            </View>

            {/* Spécial Gros — Phase Final: rail filled with placeholders
                when admin has fewer than min_grid_slots wholesale items
                seeded. Stops the section from disappearing entirely
                while we're ramping up the catalogue. */}
            <View style={styles.section}>
              <View style={styles.grosBanner}>
                <View style={styles.grosBannerDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.grosBannerTitle, { textAlign }]}>{t('home.section_wholesale')}</Text>
                  <Text style={[styles.grosBannerSub, { textAlign }]}>{t('home.section_wholesale_sub')}</Text>
                </View>
              </View>
              <RailWithPlaceholders
                items={data.wholesale}
                renderItem={(p) => <ProductCard product={p} category={catFor(p)} />}
                keyExtractor={(p) => p.id}
                locale={i18n.language === 'ar' ? 'ar' : 'fr'}
                bucketKey="wholesale"
              />
            </View>

            {/* Coups de cœur */}
            <View style={styles.section}>
              <SectionHeader
                title={t('home.section_featured')}
                subtitle={t('home.section_featured_sub')}
                href="/(tabs)/explore"
              />
              <RailWithPlaceholders
                items={data.featured}
                renderItem={(p) => <ProductCard product={p} category={catFor(p)} />}
                keyExtractor={(p) => p.id}
                locale={i18n.language === 'ar' ? 'ar' : 'fr'}
                bucketKey="featured"
              />
            </View>

            {/* Vu récemment — quietly skipped when fewer than 2 items.
                Re-hydrated on focus so it picks up new viewings. */}
            <RecentlyViewedRail minToShow={2} limit={10} />

            {/* Recommandés — also placeholder-filled. */}
            <View style={styles.section}>
              <SectionHeader
                title={t('home.section_recommended')}
                subtitle={t('home.section_recommended_sub')}
                href="/(tabs)/explore"
              />
              <RailWithPlaceholders
                items={data.recommended}
                renderItem={(p) => <ProductCard product={p} category={catFor(p)} />}
                keyExtractor={(p) => p.id}
                locale={i18n.language === 'ar' ? 'ar' : 'fr'}
                bucketKey="recommended"
              />
            </View>

            {/* Slot: footer promo */}
            <View style={styles.slotSpaced}>
              <PromoSlot slot="footer_promo" variant="card" fallbackTone="sunshine" />
            </View>

            <WhyVerkingBlock />
            <WhatsAppContactBlock />

            <View style={styles.footer}>
              <Text style={styles.footerLine}>{t('brand.name')} — {t('brand.subtitle')}</Text>
              <Text style={styles.footerSub}>{t('brand.tagline')}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  header: {
    height: 56,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    zIndex: 10,
  },
  headerSide: { alignItems: 'center', gap: 12 },
  brand: { fontSize: 20, fontWeight: '900', color: Brand.primary, letterSpacing: -0.5 },
  scroll: { paddingBottom: Spacing.xxl },

  slotTop: { marginTop: Spacing.sm },
  slotSpaced: { marginTop: Spacing.lg },
  section: { marginTop: Spacing.lg },
  rail: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: 4 },
  empty: { paddingHorizontal: Spacing.md, color: Brand.textMuted, fontStyle: 'italic' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  gridItem: { flexBasis: '48%', flexGrow: 1, maxWidth: '48%' },

  flashWrap: {
    marginTop: Spacing.lg,
    backgroundColor: '#FFF6EE',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  flashHeader: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  flashTitle: { fontSize: 20, fontWeight: '900', color: Brand.text, letterSpacing: -0.4 },
  flashSub: { fontSize: 12, color: Brand.textMuted, fontWeight: '600', marginTop: 2 },
  flashCount: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: '#FFD9BF',
  },
  flashCountText: { fontWeight: '900', color: Brand.cta, fontSize: 11 },

  miniRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },

  grosBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Brand.mintSoft,
    borderColor: '#A5F3FC',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grosBannerDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: Brand.mint },
  grosBannerTitle: { fontWeight: '900', color: Brand.text, fontSize: 14, letterSpacing: -0.2 },
  grosBannerSub: { color: Brand.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },

  footer: {
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  footerLine: { fontWeight: '900', color: Brand.secondary, letterSpacing: 0.5 },
  footerSub: { fontSize: 11, color: Brand.textMuted, marginTop: 2 },
});
