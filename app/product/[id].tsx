/**
 * Product details — Stitch v3 layout.
 *
 * Hero gallery (4:5) with floating heart + dot indicators • category tag +
 * star rating + stock pill • side-by-side glass price box (Détail | Gros) •
 * mode toggle • quantity stepper + total • description • related rail •
 * sticky bottom: orange "Add to cart" + blue "Buy now" + green WhatsApp.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAddToCart, useCartLineFor } from '@/components/cart/CartProvider';
import { ModeToggle } from '@/components/storefront/ModeToggle';
import { effectiveUnitPrice } from '@/components/storefront/Price';
import { ProductCard } from '@/components/storefront/ProductCard';
import { QuantityStepper } from '@/components/storefront/QuantityStepper';
import { ErrorState, LoadingState } from '@/components/storefront/StateViews';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { pickLocalized } from '@/i18n/pickLocalized';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import { listProducts, getProduct } from '@/services/products';
import { getSetting } from '@/services/settings';
import { getWhatsAppNumber, openWhatsApp } from '@/services/whatsapp';
import { pushRecentlyViewed } from '@/lib/recentlyViewed';
import { track } from '@/services/analytics';
import type { ProductWithImages } from '@/types/database';
import type { SaleMode } from '@/services/orders';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const locale = i18n.language as 'fr' | 'ar' | 'en';

  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<ProductWithImages | null>(null);
  const [related, setRelated] = useState<ProductWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SaleMode>('detail');
  const [qty, setQty] = useState(1);
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);
  const [grosMin, setGrosMin] = useState<number>(10);
  const [activeImage, setActiveImage] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [p, phone, min] = await Promise.all([
        getProduct(id),
        getWhatsAppNumber(),
        getSetting<number>('wholesale_min_quantity'),
      ]);
      setProduct(p);
      setWhatsappPhone(phone);
      if (typeof min === 'number' && min > 0) setGrosMin(min);
      if (p?.category_id) {
        const rel = await listProducts({ categoryId: p.category_id, limit: 8 });
        setRelated(rel.filter((x) => x.id !== p.id).slice(0, 6));
      } else {
        setRelated([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  // Track view in the "Recently viewed" registry + remote analytics.
  useEffect(() => {
    if (id) {
      void pushRecentlyViewed(id);
      void track('view_product', { product_id: id });
    }
  }, [id]);

  useEffect(() => {
    if (mode === 'gros' && qty < grosMin) setQty(grosMin);
    if (mode === 'detail' && qty < 1) setQty(1);
  }, [mode, grosMin, qty]);

  const unit = useMemo(() => {
    if (!product) return 0;
    return effectiveUnitPrice(product.price, product.sale_price, product.wholesale_price, mode);
  }, [product, mode]);

  const total = unit * qty;
  const stock = product?.stock ?? 0;
  const outOfStock = product != null && stock <= 0;
  const maxQty = stock > 0 ? stock : undefined;

  const productName = product
    ? pickLocalized(product as unknown as Record<string, unknown>, 'name', locale) || product.name_fr
    : '';
  const productDesc = product
    ? pickLocalized(product as unknown as Record<string, unknown>, 'description', locale)
    : '';

  const addToCart = useAddToCart();
  const lineInCart = useCartLineFor(product?.id ?? '', mode);
  const inCartQty = lineInCart?.qty ?? 0;

  const onAddToCart = () => {
    if (!product || outOfStock) return;
    addToCart({
      product_id: product.id,
      mode,
      unit_price: unit,
      name_fr: product.name_fr,
      name_ar: product.name_ar,
      name_en: (product as unknown as Record<string, unknown>).name_en as string | null,
      image: product.primaryImage,
      qty,
      min_qty: mode === 'gros' ? grosMin : 1,
      stock_cap: stock > 0 ? stock : null,
    });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    void track('add_to_cart', {
      product_id: product.id,
      mode,
      qty,
      unit_price: unit,
    });
  };

  const goCheckout = () => {
    if (!product) return;
    router.push({
      pathname: '/checkout',
      params: {
        productId: product.id,
        productName,
        unitPrice: String(unit),
        quantity: String(qty),
        mode,
      },
    });
  };

  const sendWhatsApp = async () => {
    if (!product) return;
    await openWhatsApp({
      productName, productId: product.id, mode, quantity: qty, unitPrice: unit, total,
    });
  };

  const sale = product?.sale_price != null && product.sale_price < (product.price ?? 0);
  const wholesale = product?.wholesale_price != null && product.wholesale_price > 0;
  const detailPrice = sale ? product!.sale_price! : product?.price ?? 0;
  const grosPrice = wholesale ? product!.wholesale_price! : product?.price ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: t('brand.subtitle'),
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { color: Brand.primary, fontWeight: '900' },
        }}
      />

      {loading ? (
        <LoadingState style={{ flex: 1 }} />
      ) : error ? (
        <ErrorState style={{ flex: 1 }} message={error} onRetry={() => void load()} />
      ) : !product ? (
        <ErrorState style={{ flex: 1 }} message={t('product.title_fallback')} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.gallery}>
              {product.images.length > 0 ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setActiveImage(i);
                  }}
                >
                  {product.images.map((img) => (
                    <Image
                      key={img.id}
                      source={{ uri: img.url }}
                      style={[styles.galleryImage, { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1 }]}
                      contentFit="cover"
                      transition={200}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={[styles.galleryImage, styles.galleryFallback, { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1 }]}>
                  <Text style={{ fontSize: 60 }}>📦</Text>
                </View>
              )}
              {product.images.length > 1 ? (
                <View style={styles.dots}>
                  {product.images.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
                  ))}
                </View>
              ) : null}
              <View style={styles.heart}>
                <Ionicons name="heart" size={20} color={Brand.primary} />
              </View>
            </View>

            <View style={styles.infoHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{t('brand.subtitle')}</Text>
                </View>
                <Text style={[styles.name, { textAlign }]}>{productName}</Text>
              </View>
              <View style={styles.headerSide}>
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={14} color={Brand.accent} />
                  <Text style={styles.ratingText}>4.8</Text>
                </View>
                {outOfStock ? (
                  <Text style={[styles.stockTag, { color: Brand.danger }]}>{t('product.out_of_stock')}</Text>
                ) : (
                  <Text style={[styles.stockTag, { color: Brand.success }]}>{t('product.in_stock')}</Text>
                )}
              </View>
            </View>

            <View style={[styles.priceBox, { flexDirection: rowDirection }]}>
              <View style={styles.priceCol}>
                <Text style={styles.priceLabel}>{t('product.total_label_detail').replace('Total ', '')}</Text>
                <View style={[styles.priceMainRow, { flexDirection: rowDirection }]}>
                  <Text style={styles.priceMain}>{formatPrice(detailPrice)}</Text>
                  {sale ? <Text style={styles.priceStrike}>{formatPrice(product.price)}</Text> : null}
                </View>
              </View>
              <View style={styles.priceDivider} />
              <View style={[styles.priceCol, { alignItems: 'flex-end' }]}>
                <View style={[styles.grosHeader, { flexDirection: rowDirection }]}>
                  <View style={styles.grosTag}>
                    <Text style={styles.grosTagText}>{t('badges.gros')}</Text>
                  </View>
                  {wholesale ? (
                    <Text style={styles.priceLabel}>
                      {t('product.min_qty_helper', { min: grosMin }).replace(/^[^:]*:\s*/, 'Min. ')} pcs
                    </Text>
                  ) : (
                    <Text style={styles.priceLabel}>—</Text>
                  )}
                </View>
                <Text style={[styles.priceMain, { color: wholesale ? Brand.primary : Brand.textMuted }]}>
                  {formatPrice(grosPrice)}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <ModeToggle value={mode} onChange={setMode} />
            </View>

            <View style={[styles.qtyRow, { flexDirection: rowDirection }]}>
              <QuantityStepper value={qty} onChange={setQty} min={mode === 'gros' ? grosMin : 1} max={maxQty} />
              <View style={styles.totalCol}>
                <Text style={[styles.totalLabel, { textAlign }]}>
                  {t('product.total_label_detail').replace('Détail', mode === 'gros' ? t('modes.gros') : t('modes.detail'))}
                </Text>
                <Text style={styles.totalValue}>{formatPrice(total)}</Text>
              </View>
            </View>

            {productDesc ? (
              <View style={styles.descSection}>
                <Text style={[styles.descTitle, { textAlign }]}>{t('product.mode_label').replace('Mode de vente', 'Description')}</Text>
                <Text style={[styles.descBody, { textAlign }]}>{productDesc}</Text>
              </View>
            ) : null}

            {related.length > 0 ? (
              <View style={styles.relatedSection}>
                <View style={[styles.relatedHeader, { flexDirection: rowDirection }]}>
                  <Text style={[styles.descTitle, { textAlign }]}>{t('home.section_recommended')}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {related.map((p) => (
                    <ProductCard key={p.id} product={p} width={150} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.ctaBar, { flexDirection: rowDirection }]}>
            <Pressable
              onPress={onAddToCart}
              disabled={outOfStock}
              style={[styles.ctaAdd, outOfStock && styles.ctaDisabled]}
              accessibilityLabel={t('product.cta_add_to_cart')}
            >
              <Ionicons name="bag-add" size={18} color="#FFF" />
              <Text style={styles.ctaAddText}>
                {outOfStock
                  ? t('product.cta_unavailable')
                  : inCartQty > 0
                    ? `${t('product.cta_in_cart')} (${inCartQty})`
                    : t('product.cta_add_to_cart')}
              </Text>
            </Pressable>
            <Pressable
              onPress={goCheckout}
              disabled={outOfStock}
              style={[styles.ctaBuy, outOfStock && styles.ctaDisabled]}
              accessibilityLabel={t('product.cta_buy')}
            >
              <Ionicons name="flash" size={16} color="#FFF" />
              <Text style={styles.ctaBuyText}>{t('product.cta_buy')}</Text>
            </Pressable>
            {whatsappPhone ? (
              <Pressable
                onPress={() => void sendWhatsApp()}
                style={styles.ctaWhatsapp}
                accessibilityLabel="WhatsApp"
              >
                <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  scroll: { paddingBottom: 130 },
  gallery: { position: 'relative', backgroundColor: Brand.surfaceMuted },
  galleryImage: {},
  galleryFallback: { alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 18, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { width: 28, backgroundColor: Brand.primary },
  heart: {
    position: 'absolute', top: 18, right: 18, width: 44, height: 44, borderRadius: 999,
    backgroundColor: Brand.glass, borderWidth: 1, borderColor: Brand.glassBorder,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadow, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  infoHeader: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, flexDirection: 'row', gap: Spacing.md },
  tagPill: {
    alignSelf: 'flex-start', backgroundColor: Brand.surfaceContainerHigh,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6,
  },
  tagPillText: { fontSize: 10, fontWeight: '900', color: Brand.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 22, fontWeight: '900', color: Brand.text, letterSpacing: -0.4, lineHeight: 28 },
  headerSide: { alignItems: 'flex-end', gap: 6 },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primaryTint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  ratingText: { fontWeight: '900', color: Brand.primary, fontSize: 12 },
  stockTag: { fontSize: 11, fontWeight: '900' },
  priceBox: {
    marginHorizontal: Spacing.md, marginTop: Spacing.lg,
    backgroundColor: Brand.glass, borderColor: Brand.glassBorder, borderWidth: 1,
    borderRadius: Radius.xxl, padding: Spacing.md,
    alignItems: 'center', justifyContent: 'space-between',
    shadowColor: Brand.shadow, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  priceCol: { flex: 1, gap: 4 },
  priceDivider: { width: 1, height: 40, backgroundColor: Brand.outlineSoft, marginHorizontal: Spacing.sm },
  priceLabel: { fontSize: 10, fontWeight: '900', color: Brand.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  priceMainRow: { alignItems: 'baseline', gap: 6 },
  priceMain: { fontSize: 22, fontWeight: '900', color: Brand.text, letterSpacing: -0.5 },
  priceStrike: { fontSize: 12, color: Brand.textMuted, textDecorationLine: 'line-through', fontWeight: '600' },
  grosHeader: { alignItems: 'center', gap: 6, marginBottom: 2 },
  grosTag: { backgroundColor: Brand.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  grosTagText: { color: '#FFF', fontWeight: '900', fontSize: 9, letterSpacing: 0.6 },
  section: { marginHorizontal: Spacing.md, marginTop: Spacing.lg },
  qtyRow: { marginHorizontal: Spacing.md, marginTop: Spacing.lg, alignItems: 'center', justifyContent: 'space-between' },
  totalCol: { alignItems: 'flex-end' },
  totalLabel: { fontSize: 10, fontWeight: '900', color: Brand.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  totalValue: { fontSize: 22, fontWeight: '900', color: Brand.primary, marginTop: 2, letterSpacing: -0.5 },
  descSection: {
    marginHorizontal: Spacing.md, marginTop: Spacing.xl, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Brand.surfaceContainer, gap: 8,
  },
  descTitle: { fontSize: 16, fontWeight: '900', color: Brand.text, letterSpacing: -0.3 },
  descBody: { color: Brand.text, lineHeight: 22, fontSize: 14 },
  relatedSection: { marginTop: Spacing.xl, gap: Spacing.sm },
  relatedHeader: { paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'space-between' },
  rail: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.4)',
    gap: 10, alignItems: 'center',
    shadowColor: Brand.shadowDeep, shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: -12 },
  },
  ctaAdd: {
    flex: 2, backgroundColor: Brand.cta, paddingVertical: 14, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
    shadowColor: Brand.shadowOrange, shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  ctaAddText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
  ctaBuy: {
    flex: 1.2, backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
    shadowColor: Brand.shadowBlue, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  ctaBuyText: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.2 },
  ctaDisabled: { backgroundColor: Brand.surfaceContainerHigh, shadowOpacity: 0 },
  ctaWhatsapp: {
    flex: 1, height: 50, backgroundColor: '#25D366', borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#25D366', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
});
