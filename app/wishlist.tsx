/**
 * /wishlist — saved products grid (Phase 10).
 *
 * Reads via `useWishlist()` (RPC + module Set), and rehydrates the full
 * ProductWithImages so we can reuse <ProductCard /> exactly as on Explore.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/storefront/ProductCard';
import { BrandConfirmDialog } from '@/components/ui/BrandConfirmDialog';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useDirection } from '@/i18n/useDirection';
import { listProductsByIds } from '@/services/products';
import { clearWishlist, useWishlist } from '@/services/wishlist';
import type { ProductWithImages } from '@/types/database';

export default function WishlistScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = i18n.language === 'ar';
  const { items, loading, reload } = useWishlist();
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [hydrating, setHydrating] = useState(true);
  // Phase 16.4 — pull-to-refresh + 30 s focus refresh.
  const { refreshing, onRefresh } = usePullRefresh();
  useRefreshOnFocus();

  // Hydrate full ProductWithImages from the wishlist's product_ids.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (items.length === 0) {
        if (!cancelled) { setProducts([]); setHydrating(false); }
        return;
      }
      setHydrating(true);
      const fresh = await listProductsByIds(items.map((w) => w.product_id));
      if (cancelled) return;
      // Preserve wishlist order (most recently added first).
      const order = new Map(items.map((w, i) => [w.product_id, i]));
      fresh.sort((a, b) => (order.get(a.id) ?? 9e9) - (order.get(b.id) ?? 9e9));
      setProducts(fresh);
      setHydrating(false);
    })();
    return () => { cancelled = true; };
  }, [items]);

  // Phase 4.5 — branded confirm dialog instead of OS Alert.
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const onClear = () => {
    if (items.length === 0) return;
    setConfirmClearOpen(true);
  };
  const onClearConfirm = async () => {
    setConfirmClearOpen(false);
    await clearWishlist();
    reload();
  };

  const isLoading = loading || hydrating;
  const hasItems = products.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]}>
          {t('wishlist.title', { defaultValue: 'Mes favoris' })}
        </Text>
        <Pressable onPress={onClear} hitSlop={12} style={styles.clearBtn}>
          <Ionicons name="trash-outline" size={18} color={hasItems ? Brand.danger : Brand.textSubtle} />
        </Pressable>
      </View>

      {/* Hero band — count + heart */}
      <View style={styles.heroBand}>
        <View style={styles.heroIcon}>
          <Ionicons name="heart" size={26} color={Brand.coral} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.heroTitle, { textAlign }]}>
            {t('wishlist.hero_title', {
              defaultValue: '{{count}} {{label}}',
              count: products.length,
              label: products.length === 1 ? 'article enregistré' : 'articles enregistrés',
            })}
          </Text>
          <Text style={[styles.heroSub, { textAlign }]}>
            {t('wishlist.hero_sub', {
              defaultValue: 'Touchez le ❤️ sur n\'importe quel produit pour le sauvegarder ici.',
            })}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : !hasItems ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color={Brand.textSubtle} />
          <Text style={[styles.emptyTitle, { textAlign }]}>
            {t('wishlist.empty_title', { defaultValue: 'Aucun favori pour l\'instant' })}
          </Text>
          <Text style={[styles.emptySub, { textAlign }]}>
            {t('wishlist.empty_sub', {
              defaultValue: 'Touchez le ❤️ sur les produits que vous voulez retrouver plus tard.',
            })}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.93 }]}
            onPress={() => router.push('/(tabs)/explore' as never)}
          >
            <Ionicons name="storefront-outline" size={16} color="#FFFFFF" />
            <Text style={styles.ctaText}>
              {t('wishlist.empty_cta', { defaultValue: 'Découvrir les produits' })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Brand.primary}
              colors={[Brand.primary, Brand.cta]}
            />
          }
        >
          <View style={styles.grid}>
            {products.map((p) => (
              <View key={p.id} style={styles.gridCell}>
                <ProductCard product={p} variant="grid" />
              </View>
            ))}
          </View>
          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      )}
      <BrandConfirmDialog
        visible={confirmClearOpen}
        title={t('wishlist.clear_title', { defaultValue: 'Vider la liste ?' })}
        message={t('wishlist.clear_body', {
          defaultValue: 'Cette action retire les {{count}} articles de votre liste.',
          count: items.length,
        })}
        confirmLabel={t('wishlist.clear_confirm', { defaultValue: 'Vider' })}
        destructive
        onConfirm={() => void onClearConfirm()}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  header: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Brand.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  clearBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Brand.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1, textAlign: 'center',
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 17, color: Brand.secondary, letterSpacing: -0.2,
  },

  heroBand: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: Spacing.md, marginTop: Spacing.xs,
    backgroundColor: Brand.coralSoft,
    borderRadius: Radius.xxl,
    padding: Spacing.md,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadowOrange, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, color: Brand.secondary, letterSpacing: -0.2,
  },
  heroSub: {
    fontFamily: BrandFont.medium, fontSize: 11.5, color: Brand.textMuted,
    marginTop: 3, lineHeight: 16,
  },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 18, color: Brand.secondary, marginTop: Spacing.sm,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: BrandFont.medium, fontSize: 13,
    color: Brand.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 18,
  },
  cta: {
    marginTop: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 12, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Brand.cta,
    shadowColor: Brand.shadowOrange, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 14, letterSpacing: 0.4,
  },

  scroll: { padding: Spacing.md, paddingTop: Spacing.lg },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
  },
  gridCell: { flexBasis: '48%', flexGrow: 1, minWidth: 0 },
});
