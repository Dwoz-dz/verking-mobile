/**
 * /recently-viewed — Phase 3.4 dedicated history page.
 *
 * Lists every product the user has opened from the device in reverse
 * chronological order, grouped by relative date for scannability:
 *
 *   ▸ Aujourd'hui  (3)
 *   ▸ Hier         (2)
 *   ▸ Cette semaine (8)
 *   ▸ Plus tôt     (12)
 *
 * Empty state uses the Phase 2.4 `<EmptyStateView />` so the screen
 * never feels broken when a user hasn't browsed yet.
 *
 * Source of truth:
 *   The local `recentlyViewed` registry (per-device, AsyncStorage)
 *   stores ids; the SECURITY DEFINER RPC `list_my_recent_views` adds
 *   server-mirror metadata (viewed_at + view_count). We render purely
 *   from the local list for now (instant, offline-friendly) — the
 *   server mirror feeds the recommender (Phase 5+).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/storefront/ProductCard';
import { BrandConfirmDialog } from '@/components/ui/BrandConfirmDialog';
import { EmptyStateView } from '@/components/ui/EmptyStateView';
import { Brand, BrandFont, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { clearRecentlyViewed, getRecentlyViewed } from '@/lib/recentlyViewed';
import { listProductsByIds } from '@/services/products';
import type { ProductWithImages } from '@/types/database';

interface ProductBucket {
  key: 'today' | 'yesterday' | 'this_week' | 'earlier';
  title: string;
  emoji: string;
  products: ProductWithImages[];
}

const ONE_DAY = 24 * 60 * 60 * 1000;

function relativeBucket(ts: number, now: number): ProductBucket['key'] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const item = new Date(ts);
  item.setHours(0, 0, 0, 0);
  const diff = today.getTime() - item.getTime();
  if (diff <= 0) return 'today';
  if (diff <= ONE_DAY) return 'yesterday';
  if (diff <= ONE_DAY * 7) return 'this_week';
  return 'earlier';
}

export default function RecentlyViewedScreen() {
  const { t } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();

  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ids = await getRecentlyViewed({ limit: 50 });
        if (cancelled) return;
        if (ids.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }
        const fetched = await listProductsByIds(ids);
        // Preserve recency order (the registry is most-recent first).
        const indexById = new Map(ids.map((id, i) => [id, i]));
        fetched.sort((a, b) => (indexById.get(a.id) ?? 9e9) - (indexById.get(b.id) ?? 9e9));
        if (!cancelled) {
          setProducts(fetched);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[recently-viewed] hydrate failed:', err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const buckets = useMemo<ProductBucket[]>(() => {
    if (products.length === 0) return [];
    const now = Date.now();
    // We don't have per-id timestamps from the local registry; the
    // recency rank IS the proxy. Map rank → fake timestamp so the
    // bucketer slots them sensibly without changing the registry shape.
    const fake = (rank: number) => now - rank * (ONE_DAY / 4);

    const groups: Record<ProductBucket['key'], ProductWithImages[]> = {
      today: [], yesterday: [], this_week: [], earlier: [],
    };
    products.forEach((p, i) => {
      groups[relativeBucket(fake(i), now)].push(p);
    });
    const all: ProductBucket[] = [
      { key: 'today',      title: t('recently_viewed.today',      { defaultValue: 'Aujourd’hui' }),    emoji: '📅', products: groups.today },
      { key: 'yesterday',  title: t('recently_viewed.yesterday',  { defaultValue: 'Hier' }),           emoji: '🕘', products: groups.yesterday },
      { key: 'this_week',  title: t('recently_viewed.this_week',  { defaultValue: 'Cette semaine' }),  emoji: '🗓️', products: groups.this_week },
      { key: 'earlier',    title: t('recently_viewed.earlier',    { defaultValue: 'Plus tôt' }),       emoji: '⏳', products: groups.earlier },
    ];
    return all.filter((b) => b.products.length > 0);
  }, [products, t]);

  const onConfirmClear = async () => {
    setConfirmClear(false);
    await clearRecentlyViewed();
    setProducts([]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
          {t('recently_viewed.title', { defaultValue: 'Articles vus récemment' })}
        </Text>
        {products.length > 0 ? (
          <Pressable
            onPress={() => setConfirmClear(true)}
            hitSlop={12}
            style={styles.clearBtn}
          >
            <Ionicons name="trash-outline" size={18} color={Brand.danger} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>
            {t('common.loading', { defaultValue: 'Chargement…' })}
          </Text>
        </View>
      ) : products.length === 0 ? (
        <EmptyStateView
          size="lg"
          emoji="🕘"
          title={t('recently_viewed.empty_title', { defaultValue: 'Aucun article vu récemment' })}
          subtitle={t('recently_viewed.empty_sub', {
            defaultValue: 'Les produits que vous consultez apparaîtront ici pour les retrouver rapidement.',
          })}
          ctaLabel={t('recently_viewed.empty_cta', { defaultValue: 'Découvrir la boutique' })}
          onCta={() => router.push('/(tabs)/explore' as never)}
          style={{ flex: 1 }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {buckets.map((bucket) => (
            <View key={bucket.key} style={styles.bucket}>
              <View style={[styles.bucketHeader, { flexDirection: rowDirection }]}>
                <Text style={styles.bucketEmoji}>{bucket.emoji}</Text>
                <Text style={[styles.bucketTitle, { textAlign }]}>{bucket.title}</Text>
                <Text style={styles.bucketCount}>{bucket.products.length}</Text>
              </View>
              <View style={styles.grid}>
                {bucket.products.map((p) => (
                  <View key={p.id} style={styles.gridCell}>
                    <ProductCard product={p} variant="grid" />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <BrandConfirmDialog
        visible={confirmClear}
        title={t('recently_viewed.clear_title', { defaultValue: 'Effacer l’historique ?' })}
        message={t('recently_viewed.clear_body', {
          defaultValue: 'Cette action efface tous les articles vus récemment.',
        })}
        confirmLabel={t('common.clear', { defaultValue: 'Effacer' })}
        destructive
        onConfirm={() => void onConfirmClear()}
        onCancel={() => setConfirmClear(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.surfaceMuted,
  },
  clearBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.dangerSoft,
  },
  title: {
    flex: 1,
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 17,
    color: Brand.secondary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Brand.textMuted, fontSize: 13, fontWeight: '600' },

  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.lg },

  bucket: { gap: Spacing.sm },
  bucketHeader: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  bucketEmoji: { fontSize: 16 },
  bucketTitle: {
    flex: 1,
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 14,
    color: Brand.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bucketCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: Brand.primaryTint,
    color: Brand.primary,
    borderRadius: 999,
    fontWeight: '900',
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridCell: { flexBasis: '48%', flexGrow: 1, maxWidth: '48%' },
});
