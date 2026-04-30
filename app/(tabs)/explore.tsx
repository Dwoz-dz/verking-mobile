/**
 * Explore — VERKING discovery screen with themed campaign tabs.
 *
 * Top-down structure:
 *   ▸ Search bar (camera placeholder + input + search button).
 *   ▸ Themed tabs (Explorez, Économies, Rentrée, Gros, Cartables, Trousses).
 *   ▸ Coupon banner — surfaces only on the Économies tab.
 *   ▸ Content:
 *       - On the default Explorez tab with no search → curated rails:
 *         Deal du jour, Promotions, Nouveautés, Pour vous (full grid).
 *       - Other themes → filtered grid (deals, wholesale, search query…).
 *
 * The themed tabs are deliberately a UI shell at this stage; the
 * filters they apply use existing `listProducts` parameters. Phase 5
 * swaps this for the dynamic `mobile_themed_pages` source.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HamburgerButton } from '@/components/navigation/HamburgerButton';
import { ProductCard } from '@/components/storefront/ProductCard';
import { SmartEmptyState } from '@/components/storefront/SmartEmptyState';
import { ErrorState, LoadingState } from '@/components/storefront/StateViews';
import {
  clearRecentSearches, logSearch, searchProductsRanked,
  useRecentSearches, useTrendingSearches,
} from '@/services/search';
import { ThemedTabs, type ThemeKey } from '@/components/storefront/ThemedTabs';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useDirection } from '@/i18n/useDirection';
import { bumpRefresh } from '@/lib/refresh/refreshBus';
import {
  listProducts,
  listFeaturedProducts,
  listNewArrivals,
  listDealsOfTheDay,
} from '@/services/products';
import type { ProductWithImages } from '@/types/database';

interface ThemeBucket {
  featured: ProductWithImages[];
  deals: ProductWithImages[];
  newArrivals: ProductWithImages[];
  forYou: ProductWithImages[];
}

const EMPTY_BUCKET: ThemeBucket = { featured: [], deals: [], newArrivals: [], forYou: [] };

export default function ShopScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();

  const params = useLocalSearchParams<{ categoryId?: string; theme?: string }>();
  const initialTheme = (params.theme as ThemeKey) ?? 'explorez';

  const [activeTheme, setActiveTheme] = useState<ThemeKey>(initialTheme);
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState<ThemeBucket>(EMPTY_BUCKET);
  const [filtered, setFiltered] = useState<ProductWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trending = useTrendingSearches();
  const { recents, reload: reloadRecents } = useRecentSearches();
  const isAr = i18n.language === 'ar';

  const usingFilteredView = activeTheme !== 'explorez' || search.trim().length > 0;

  const fetchFiltered = useCallback(async (): Promise<ProductWithImages[]> => {
    const q = search.trim();
    // Phase 10 — when the user typed a query, use the multilingual RPC
    // ranking. Themed prefilters fall back to listProducts when there's
    // no explicit query.
    if (q) return searchProductsRanked(q, 60);
    const opts: Parameters<typeof listProducts>[0] = { limit: 60 };
    if (params.categoryId) opts.categoryId = params.categoryId;
    switch (activeTheme) {
      case 'economies':  opts.dealsOnly = true; break;
      case 'gros':       opts.wholesaleOnly = true; break;
      case 'rentree':    opts.search = 'cartable'; break;
      case 'cartables':  opts.search = 'cartable'; break;
      case 'trousses':   opts.search = 'trousse'; break;
      default: break;
    }
    return listProducts(opts);
  }, [activeTheme, search, params.categoryId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (usingFilteredView) {
        const list = await fetchFiltered();
        setFiltered(list);
      } else {
        const [featured, deals, newArrivals, forYou] = await Promise.all([
          listFeaturedProducts(8),
          listDealsOfTheDay(8),
          listNewArrivals(8),
          listProducts({ limit: 24 }),
        ]);
        setBucket({ featured, deals, newArrivals, forYou });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    }
  }, [usingFilteredView, fetchFiltered]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Phase 16.4 — emit on the global bus so trending/recents/coupons
    // refetch too.
    bumpRefresh();
    await load();
    setRefreshing(false);
  }, [load]);
  // Phase 16.4 — auto-refresh on tab focus (debounced 30 s).
  useRefreshOnFocus();

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />,
    [refreshing, onRefresh],
  );

  const onSubmitSearch = useCallback(() => {
    const q = search.trim();
    if (!q) return;
    void logSearch(q, filtered.length, 'manual').then(reloadRecents);
  }, [search, filtered.length, reloadRecents]);

  const pickQuery = useCallback((q: string, source: 'trending' | 'recent') => {
    setSearch(q);
    void logSearch(q, null, source).then(reloadRecents);
  }, [reloadRecents]);

  const onClearRecents = useCallback(() => {
    void clearRecentSearches().then(reloadRecents);
  }, [reloadRecents]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Search bar ──────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { flexDirection: rowDirection }]}>
          <View style={{ paddingHorizontal: 4 }}>
            <HamburgerButton size={32} />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={onSubmitSearch}
            placeholder={t('explore_themes.search_placeholder')}
            placeholderTextColor={Brand.textMuted}
            style={[styles.searchInput, { textAlign }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setSearch('')} style={styles.searchClear}>
              <Ionicons name="close-circle" size={18} color={Brand.textMuted} />
            </Pressable>
          ) : null}
          <Pressable style={styles.searchSubmit} onPress={onSubmitSearch}>
            <Ionicons name="search" size={16} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* Phase 10 — trending chips + recents (only when search is empty) */}
      {search.trim().length === 0 && activeTheme === 'explorez' && (trending.length > 0 || recents.length > 0) ? (
        <View style={styles.chipsBlock}>
          {trending.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {trending.map((tr) => (
                <Pressable
                  key={tr.id}
                  onPress={() => pickQuery(tr.query, 'trending')}
                  style={({ pressed }) => [
                    styles.trendChip,
                    { backgroundColor: tr.accent_color + '18', borderColor: tr.accent_color + '44' },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.trendChipEmoji}>{tr.emoji ?? '🔎'}</Text>
                  <Text style={[styles.trendChipText, { color: tr.accent_color }]} numberOfLines={1}>
                    {isAr ? tr.label_ar : tr.label_fr}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {recents.length > 0 ? (
            <View style={styles.recentsBlock}>
              <View style={[styles.recentsHeader, { flexDirection: rowDirection }]}>
                <Ionicons name="time-outline" size={13} color={Brand.textMuted} />
                <Text style={[styles.recentsLabel, { textAlign }]}>
                  {t('explore.recents', { defaultValue: 'Recherches récentes' })}
                </Text>
                <Pressable onPress={onClearRecents} hitSlop={6}>
                  <Text style={styles.recentsClear}>
                    {t('explore.clear', { defaultValue: 'Effacer' })}
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {recents.slice(0, 8).map((r) => (
                  <Pressable
                    key={r.normalised_query}
                    onPress={() => pickQuery(r.query, 'recent')}
                    style={({ pressed }) => [
                      styles.recentChip,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name="time-outline" size={11} color={Brand.textMuted} />
                    <Text style={styles.recentChipText} numberOfLines={1}>{r.query}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ─── Themed tabs ────────────────────────────────────── */}
      <ThemedTabs active={activeTheme} onSelect={setActiveTheme} />

      {/* ─── Coupon banner — only on Économies ──────────────── */}
      {activeTheme === 'economies' ? (
        <View style={styles.couponBanner}>
          <View style={styles.couponBannerIcon}>
            <Ionicons name="ticket" size={18} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.couponBannerTitle, { textAlign }]}>
              {t('explore_themes.coupon_banner_title')}
            </Text>
            <Text style={[styles.couponBannerSub, { textAlign }]}>
              {t('explore_themes.coupon_banner_sub')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ─── Content ────────────────────────────────────────── */}
      {loading ? (
        <LoadingState style={{ flex: 1 }} />
      ) : error ? (
        <ErrorState style={{ flex: 1 }} message={error} onRetry={() => void load()} />
      ) : usingFilteredView ? (
        filtered.length === 0 ? (
          <SmartEmptyState
            screen="search"
            defaultIcon="search-outline"
            defaultTitle={t('shop.empty_title')}
            defaultSubtitle={t('shop.empty_subtitle')}
            forceShowTrending
            forceShowRecommendations
            style={{ flex: 1 }}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.gridScroll} refreshControl={refreshControl}>
            <View style={styles.grid}>
              {filtered.map((p) => (
                <View key={p.id} style={styles.gridItem}>
                  <ProductCard product={p} variant="grid" />
                </View>
              ))}
            </View>
          </ScrollView>
        )
      ) : bucket.deals.length === 0 && bucket.featured.length === 0
          && bucket.newArrivals.length === 0 && bucket.forYou.length === 0 ? (
        // Phase 1.7 — every bucket is empty (admin hasn't seeded products
        // yet, or filters returned 0). The legacy code rendered a blank
        // ScrollView with an 80 px spacer — confusing for the user, who
        // saw an all-white screen. SmartEmptyState picks up content from
        // `mobile_empty_states.shop` (admin-managed) and falls back to
        // a friendly default + smart surfaces (trending / recently
        // viewed / recommendations) so the screen never goes silent.
        <SmartEmptyState
          screen="shop"
          defaultIcon="storefront-outline"
          defaultTitle={t('shop.empty_title')}
          defaultSubtitle={t('shop.empty_subtitle')}
          forceShowRecentlyViewed
          forceShowTrending
          forceShowRecommendations
          style={{ flex: 1 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {bucket.deals.length > 0 ? (
            <Section
              title={t('explore_themes.section_deal_today')}
              tone={Brand.cta}
              products={bucket.deals}
              textAlign={textAlign}
            />
          ) : null}
          {bucket.featured.length > 0 ? (
            <Section
              title={t('explore_themes.section_promotions')}
              tone={Brand.coral}
              products={bucket.featured}
              textAlign={textAlign}
            />
          ) : null}
          {bucket.newArrivals.length > 0 ? (
            <Section
              title={t('explore_themes.section_new_arrivals')}
              tone={Brand.fresh}
              products={bucket.newArrivals}
              textAlign={textAlign}
            />
          ) : null}
          {bucket.forYou.length > 0 ? (
            <View style={styles.forYouWrap}>
              <Text style={[styles.forYouTitle, { textAlign }]}>
                {t('explore_themes.section_for_you')}
              </Text>
              <View style={styles.grid}>
                {bucket.forYou.map((p) => (
                  <View key={p.id} style={styles.gridItem}>
                    <ProductCard product={p} variant="grid" />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({
  title, tone, products, textAlign,
}: {
  title: string;
  tone: string;
  products: ProductWithImages[];
  textAlign: 'left' | 'right' | 'center';
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionDot, { backgroundColor: tone }]} />
        <Text style={[styles.sectionTitle, { textAlign }]}>{title}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} width={160} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },

  searchWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 6 },
  searchBar: {
    backgroundColor: '#FFF',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 4,
  },
  searchCamBtn: {
    width: 34, height: 34, borderRadius: 999,
    backgroundColor: Brand.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  searchInput: {
    flex: 1, height: 36,
    color: Brand.text, fontSize: 14, fontWeight: '600',
    paddingHorizontal: 4,
  },
  searchSubmit: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: Brand.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  searchClear: { paddingHorizontal: 4 },

  // Phase 10 — trending + recents chips under the search bar
  chipsBlock: { paddingBottom: 4, gap: 6 },
  // Phase 1.6 — symmetric horizontal padding so the first/last chip
  // breathe equally on both ends, preventing the half-cut fragments at
  // the screen edges that showed up in PTP-N49 screenshots.
  chipsRow: { gap: 8, paddingHorizontal: Spacing.md },
  trendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 11,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  trendChipEmoji: { fontSize: 13 },
  trendChipText: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 11, letterSpacing: 0.2,
  },
  recentsBlock: { gap: 4 },
  recentsHeader: {
    paddingHorizontal: 2, paddingTop: 4,
    alignItems: 'center', gap: 5,
  },
  recentsLabel: {
    flex: 1,
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 10, color: Brand.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  recentsClear: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 10, color: Brand.cta, letterSpacing: 0.3,
  },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surface,
    borderWidth: 1, borderColor: Brand.border,
  },
  recentChipText: {
    fontFamily: BrandFont.bold, fontWeight: '700',
    fontSize: 11, color: Brand.text,
  },

  couponBanner: {
    marginHorizontal: Spacing.md, marginTop: 6, marginBottom: 4,
    backgroundColor: '#E0F2FE',
    borderRadius: Radius.lg,
    padding: 10,
    borderWidth: 1, borderColor: '#BAE6FD',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  couponBannerIcon: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: Brand.cta,
    alignItems: 'center', justifyContent: 'center',
  },
  couponBannerTitle: { fontSize: 13, fontWeight: '900', color: Brand.secondary, letterSpacing: -0.1 },
  couponBannerSub: { fontSize: 11, color: Brand.textMuted, fontWeight: '700', marginTop: 2 },

  scrollContent: { paddingTop: Spacing.sm, paddingBottom: 80 },
  section: { marginBottom: Spacing.md },
  sectionHead: {
    paddingHorizontal: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 999 },
  sectionTitle: {
    fontFamily: BrandFont.extrabold, fontSize: 16, fontWeight: '900',
    color: Brand.secondary, letterSpacing: -0.2,
  },
  rail: { paddingHorizontal: Spacing.md, gap: 10, paddingBottom: 4 },

  forYouWrap: { paddingHorizontal: Spacing.md, marginTop: 6 },
  forYouTitle: {
    fontFamily: BrandFont.extrabold, fontSize: 18, fontWeight: '900',
    color: Brand.secondary, letterSpacing: -0.2, marginBottom: 10,
  },

  gridScroll: { paddingHorizontal: Spacing.md, paddingBottom: 80 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { flexBasis: '48%', flexGrow: 1, maxWidth: '48%' },
});
