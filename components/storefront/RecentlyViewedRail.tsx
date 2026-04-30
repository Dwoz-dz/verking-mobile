/**
 * RecentlyViewedRail — horizontal rail of products the user opened
 * recently from a product detail screen.
 *
 * Self-contained: hydrates on mount, re-hydrates whenever the screen
 * gains focus (so the rail picks up new viewings without a full Home
 * remount). Quietly renders nothing when empty so the Home layout
 * doesn't show a hollow section.
 *
 * Architecture:
 *   ▸ `recentlyViewed` (lib) returns the id list (snapshot-only).
 *   ▸ `services/products.listProductsByIds` rehydrates fresh data
 *     (price, stock, primaryImage). Out-of-stock items still render
 *     so the user can re-open them; the ProductCard handles the
 *     "Rupture" overlay. Deleted/hidden products silently fall out.
 *   ▸ Title via SectionHeader for visual consistency.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/storefront/ProductCard';
import { SectionHeader } from '@/components/storefront/SectionHeader';
import { Spacing } from '@/constants/theme';
import { getRecentlyViewed } from '@/lib/recentlyViewed';
import { listProductsByIds } from '@/services/products';
import type { ProductWithImages } from '@/types/database';

interface RecentlyViewedRailProps {
  /** Hide entirely when fewer than this many products would render. */
  minToShow?: number;
  /** Cap on how many to fetch. */
  limit?: number;
  /** Ids to exclude (e.g. the product currently on screen). */
  excludeIds?: readonly string[];
}

export function RecentlyViewedRail({
  minToShow = 2,
  limit = 12,
  excludeIds,
}: RecentlyViewedRailProps) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<ProductWithImages[]>([]);

  const refresh = useCallback(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ids = await getRecentlyViewed({ limit, excludeIds });
        if (ids.length === 0) {
          if (!cancelled) setProducts([]);
          return;
        }
        const fresh = await listProductsByIds(ids);
        if (!cancelled) setProducts(fresh);
      } catch (err) {
        console.warn('[recently] refresh failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excludeIds, limit]);

  // Re-hydrate every time the host screen regains focus.
  useFocusEffect(refresh);

  if (products.length < minToShow) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('home.section_recently_title')}
        subtitle={t('home.section_recently_sub')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {products.map((p) => (
          <ProductCard key={p.id} product={p} width={150} variant="rail" />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.lg, gap: Spacing.sm },
  rail: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
});
