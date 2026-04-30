/**
 * Premium glassy product card — soft family-friendly v4.
 *
 * Pastel image plate, top-left -XX% chip (red), top-right glass heart
 * (orange), category label (blue), price (warm orange), FAB add-to-cart
 * (warm orange). Card structure stays clean white; only CTAs/prices use
 * orange so the overall identity stays calm and trust-leaning.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';

import { CountdownTimer } from '@/components/storefront/CountdownTimer';
import { HeartButton } from '@/components/storefront/HeartButton';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { pickLocalized } from '@/i18n/pickLocalized';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import { useDefaultWilaya, useShippingFor } from '@/services/mobileConfig';
import type { ProductWithImages, CategoryRow } from '@/types/database';

const PLACEHOLDER_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

// Slightly punchier than before — pastels at 92 % L washed the
// fallback text out, so we drop to ~84 % L. Same hue family.
const PASTEL_TINTS = [
  '#D7E4FA', '#BFEEEB', '#FFD9B8', '#E0D2FF', '#FFD0DD', '#FFEDB8',
];

function pastelFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PASTEL_TINTS[h % PASTEL_TINTS.length];
}

/**
 * Category-aware fallback emoji. When a product has no primary image,
 * we render the matching emoji on the pastel plate so the card still
 * communicates what the item is — much better than a faint "V"
 * watermark.
 */
function fallbackEmojiForCategory(category: CategoryRow | null | undefined): string {
  if (!category) return '📦';
  const slug = (category.slug ?? '').toLowerCase();
  const name = (category.name_fr ?? '').toLowerCase();
  const haystack = `${slug} ${name}`;
  if (/stylo|pen/.test(haystack))             return '✏️';
  if (/cahier|notebook/.test(haystack))       return '📓';
  if (/cartable|sac|backpack/.test(haystack)) return '🎒';
  if (/calc/.test(haystack))                  return '🧮';
  if (/livre|book/.test(haystack))            return '📚';
  if (/feutre|color|crayon|marker/.test(haystack)) return '🖍️';
  if (/peinture|paint/.test(haystack))        return '🎨';
  if (/regle|ruler/.test(haystack))           return '📏';
  if (/gomme|eraser/.test(haystack))          return '🧼';
  if (/colle|glue/.test(haystack))            return '🧷';
  if (/cisaille|scissor/.test(haystack))      return '✂️';
  if (/agenda|planner/.test(haystack))        return '📅';
  return '📦';
}

export type ProductCardVariant = 'rail' | 'grid' | 'wide';

interface ProductCardProps {
  product: ProductWithImages;
  width?: number;
  variant?: ProductCardVariant;
  category?: CategoryRow | null;
}

export function ProductCard({
  product, width = 168, variant = 'rail', category,
}: ProductCardProps) {
  const { t, i18n } = useTranslation();
  const { textAlign } = useDirection();
  const locale = i18n.language as 'fr' | 'ar' | 'en';
  const { effectiveCode, wilaya: defaultWilaya } = useDefaultWilaya();
  const zone = useShippingFor(effectiveCode);
  const isAr = locale === 'ar';
  const etaText =
    zone && zone.eta_days_min != null && zone.eta_days_max != null
      ? zone.eta_days_min === zone.eta_days_max
        ? t('geo.eta_days_other', { count: zone.eta_days_min })
        : t('geo.eta_range', { min: zone.eta_days_min, max: zone.eta_days_max })
      : null;
  const wilayaName = defaultWilaya
    ? isAr ? defaultWilaya.name_ar : defaultWilaya.name_fr
    : null;

  const sale =
    product.sale_price != null && product.sale_price < product.price && product.price > 0;
  const wholesale = product.wholesale_price != null && product.wholesale_price > 0;
  const stock = product.stock ?? 0;
  const lowStock =
    stock > 0 && product.low_stock_threshold != null && stock <= product.low_stock_threshold;
  const outOfStock = stock <= 0;

  const cardWidth: DimensionValue = variant === 'grid' ? '100%' : width;
  const tint = pastelFor(product.id);

  const name =
    pickLocalized(product as unknown as Record<string, unknown>, 'name', locale) ||
    product.name_fr;
  const categoryLabel = category
    ? pickLocalized(category as unknown as Record<string, unknown>, 'name', locale) ||
      category.name_fr
    : null;

  const discountPct =
    sale && product.sale_price != null
      ? Math.max(1, Math.round(((product.price - product.sale_price) / product.price) * 100))
      : 0;

  return (
    <Link href={{ pathname: '/product/[id]', params: { id: product.id } }} asChild>
      <Pressable style={[styles.card, { width: cardWidth }]}>
        {/* Image plate */}
        <View style={[styles.imagePlate, { backgroundColor: tint }]}>
          {product.primaryImage ? (
            <Image
              source={{ uri: product.primaryImage }}
              style={styles.image}
              contentFit="cover"
              transition={220}
              placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            />
          ) : (
            // Phase 1.2 fix — bold branded fallback so a missing image
            // looks intentional, not broken. Big category-aware emoji
            // + product name preview, no faint watermark.
            <View style={[styles.image, styles.imageFallback]}>
              <Text style={styles.fallbackEmoji}>
                {fallbackEmojiForCategory(category)}
              </Text>
              {categoryLabel ? (
                <Text style={styles.fallbackCategory} numberOfLines={1}>
                  {categoryLabel}
                </Text>
              ) : null}
              {name ? (
                <Text style={styles.fallbackName} numberOfLines={2}>
                  {name}
                </Text>
              ) : null}
            </View>
          )}
          {/* Gloss only on real images — washes out the bold fallback. */}
          {product.primaryImage ? (
            <View pointerEvents="none" style={styles.gloss} />
          ) : null}

          {discountPct > 0 ? (
            <View style={styles.discountChip}>
              <Text style={styles.discountChipText}>-{discountPct}%</Text>
            </View>
          ) : null}

          {/* Phase 10 — wishlist heart, top-right corner */}
          <View style={styles.heartSlot}>
            <HeartButton productId={product.id} size={18} />
          </View>

          {/* Flash sale countdown — only when sale is live AND has an end date.
              CountdownTimer auto-hides itself when expired. */}
          {sale && (product as { promo_end_at?: string | null }).promo_end_at ? (
            <View style={styles.timerSlot}>
              <CountdownTimer
                endsAt={(product as { promo_end_at?: string | null }).promo_end_at ?? null}
                size="xs"
              />
            </View>
          ) : null}

          {/* Phase 1.2 fix — single compact ROW (was vertical stack of 3
              that overflowed onto empty cards). The discount chip lives
              above this row, so we cap the visible badges to keep total
              vertical mass < 60 px. */}
          <View style={styles.tagRow}>
            {product.is_new ? (
              <View style={[styles.tag, { backgroundColor: Brand.coral }]}>
                <Text style={styles.tagText}>{t('badges.new')}</Text>
              </View>
            ) : null}
            {product.is_best_seller ? (
              <View style={[styles.tag, { backgroundColor: Brand.sunshine }]}>
                <Text style={[styles.tagText, { color: Brand.secondary }]}>{t('badges.best')}</Text>
              </View>
            ) : null}
            {wholesale && !product.is_new && !product.is_best_seller ? (
              // Wholesale badge yields its slot to NEW / TOP — those
              // are higher-signal for the average shopper. We keep
              // wholesale visible in the price area below regardless.
              <View style={[styles.tag, { backgroundColor: Brand.mint }]}>
                <Text style={[styles.tagText, { color: Brand.secondary }]}>{t('badges.gros')}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.heart}>
            <Ionicons name="heart-outline" size={14} color={Brand.cta} />
          </View>

          {outOfStock ? (
            <View style={styles.stockOverlay}>
              <Text style={styles.stockOverlayText}>{t('product.rupture_overlay')}</Text>
            </View>
          ) : null}
        </View>

        {/* Body */}
        <View style={styles.body}>
          {categoryLabel ? (
            <Text style={[styles.categoryLabel, { textAlign }]} numberOfLines={1}>
              {categoryLabel}
            </Text>
          ) : null}
          <Text style={[styles.name, { textAlign }]} numberOfLines={2}>{name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceMain}>
              {formatPrice(sale ? product.sale_price : product.price)}
            </Text>
            {sale ? (
              <Text style={styles.priceStrike}>{formatPrice(product.price)}</Text>
            ) : null}
          </View>

          {wholesale ? (
            <View style={styles.wholesaleRow}>
              <View style={styles.wholesaleDot} />
              <Text style={styles.wholesaleText} numberOfLines={1}>
                {t('product.wholesale_inline', { price: formatPrice(product.wholesale_price) })}
              </Text>
            </View>
          ) : null}

          <View style={styles.stockRow}>
            {outOfStock ? (
              <View style={[styles.stockPill, { backgroundColor: Brand.dangerSoft }]}>
                <Text style={[styles.stockPillText, { color: Brand.danger }]}>● {t('product.out_of_stock')}</Text>
              </View>
            ) : lowStock ? (
              <View style={[styles.stockPill, { backgroundColor: Brand.warningSoft }]}>
                <Text style={[styles.stockPillText, { color: Brand.warning }]}>● {t('product.low_stock')}</Text>
              </View>
            ) : (
              <View style={[styles.stockPill, { backgroundColor: Brand.successSoft }]}>
                <Text style={[styles.stockPillText, { color: Brand.success }]}>● {t('product.in_stock')}</Text>
              </View>
            )}
          </View>

          {!outOfStock && etaText && wilayaName ? (
            <View style={styles.etaPill}>
              <Ionicons name="rocket-outline" size={9} color={Brand.primary} />
              <Text style={styles.etaPillText} numberOfLines={1}>
                {t('geo.eta_label', { eta: etaText, wilaya: wilayaName })}
              </Text>
            </View>
          ) : null}

          {!outOfStock ? (
            <View style={styles.fab}>
              <Ionicons name="add" size={18} color="#FFF" />
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  imagePlate: {
    aspectRatio: 1,
    position: 'relative',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 4,
  },
  fallbackEmoji: {
    fontSize: 56,
    // Lift visually so it doesn't sit on top of the discount chip.
    marginTop: -8,
  },
  fallbackCategory: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 9,
    color: Brand.secondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  fallbackName: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 12,
    color: Brand.secondary,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 8,
    opacity: 0.85,
  },
  gloss: {
    ...StyleSheet.absoluteFillObject,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  discountChip: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Brand.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: Brand.danger,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  discountChipText: { color: '#FFF', fontWeight: '900', fontSize: 11, letterSpacing: 0.4 },
  timerSlot: { position: 'absolute', bottom: 8, left: 8 },
  heartSlot: { position: 'absolute', top: 6, right: 6 },
  // Phase 1.2 — horizontal row instead of vertical stack. Sits below
  // the discount chip but on the same side so the badges read as a
  // single "this is special" cluster rather than three stacked dots.
  tagRow: {
    position: 'absolute',
    top: 38,
    left: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: '70%',
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { color: '#FFF', fontWeight: '900', fontSize: 9, letterSpacing: 0.6 },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  stockOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  stockOverlayText: {
    color: '#FFF', fontWeight: '900', fontSize: 14,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  body: { padding: Spacing.sm, paddingTop: 10, gap: 4, position: 'relative' },
  categoryLabel: {
    fontSize: 9, fontWeight: '900', color: Brand.primary,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  name: {
    fontSize: 13, fontWeight: '800', color: Brand.text,
    lineHeight: 17, minHeight: 34, letterSpacing: -0.1,
  },
  priceRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    marginTop: 2, flexWrap: 'wrap',
  },
  priceMain: { fontSize: 17, fontWeight: '900', color: Brand.cta, letterSpacing: -0.2 },
  priceStrike: {
    fontSize: 11, color: Brand.textMuted, textDecorationLine: 'line-through',
    fontWeight: '600', opacity: 0.6,
  },
  wholesaleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Brand.mintSoft, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, alignSelf: 'flex-start', marginTop: 2,
  },
  wholesaleDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: Brand.mint },
  wholesaleText: { fontSize: 10.5, color: Brand.secondary, fontWeight: '800', letterSpacing: 0.2 },
  stockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  stockPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  stockPillText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.3 },
  etaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(45,125,210,0.07)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, alignSelf: 'flex-start',
    marginTop: 2,
  },
  etaPillText: {
    fontSize: 9.5, color: Brand.primary, fontWeight: '800',
    letterSpacing: 0.1, maxWidth: 140,
  },
  fab: {
    position: 'absolute', right: 10, bottom: 10,
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: Brand.cta,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
});
