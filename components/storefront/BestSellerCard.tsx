/**
 * Wide horizontal "best seller" featured card — soft family-friendly v4.
 * Image left + content right. Price + Acheter use orange CTA color.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { pickLocalized } from '@/i18n/pickLocalized';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import type { ProductWithImages } from '@/types/database';

interface BestSellerCardProps {
  product: ProductWithImages;
  rating?: number;
}

export function BestSellerCard({ product, rating }: BestSellerCardProps) {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const locale = i18n.language as 'fr' | 'ar' | 'en';
  const name =
    pickLocalized(product as unknown as Record<string, unknown>, 'name', locale) ||
    product.name_fr;
  const desc = pickLocalized(product as unknown as Record<string, unknown>, 'description', locale);
  const sale = product.sale_price != null && product.sale_price < product.price;
  const main = sale ? product.sale_price! : product.price;

  return (
    <Link href={{ pathname: '/product/[id]', params: { id: product.id } }} asChild>
      <Pressable style={[styles.card, { flexDirection: rowDirection }]}>
        <View style={styles.imageWrap}>
          {product.primaryImage ? (
            <Image source={{ uri: product.primaryImage }} style={styles.image} contentFit="cover" />
          ) : (
            // Phase 1.3 — branded fallback (no faint emoji on white).
            // Match ProductCard's vocabulary: gradient blob + bold emoji.
            <View style={[styles.image, styles.fallback]}>
              <View style={styles.fallbackBlob} />
              <Text style={styles.fallbackEmoji}>📦</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          {rating !== undefined ? (
            <View style={[styles.ratingRow, { flexDirection: rowDirection }]}>
              <Ionicons name="star" size={14} color={Brand.accent} />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          ) : null}
          <Text style={[styles.name, { textAlign }]} numberOfLines={2}>{name}</Text>
          {desc ? <Text style={[styles.desc, { textAlign }]} numberOfLines={1}>{desc}</Text> : null}
          <View style={[styles.bottomRow, { flexDirection: rowDirection }]}>
            <Text style={styles.price}>{formatPrice(main)}</Text>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>{t('product.cta_buy')}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  imageWrap: {
    width: 110, height: 110,
    borderRadius: Radius.xl,
    backgroundColor: Brand.primaryTint,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackBlob: {
    position: 'absolute',
    top: -10, right: -10,
    width: 80, height: 80,
    borderRadius: 999,
    backgroundColor: 'rgba(255,201,60,0.25)',
  },
  fallbackEmoji: { fontSize: 44 },
  body: { flex: 1, gap: 4 },
  ratingRow: { alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 11, fontWeight: '800', color: Brand.textMuted },
  name: { fontWeight: '900', fontSize: 15, color: Brand.text, letterSpacing: -0.2 },
  desc: { fontSize: 12, color: Brand.textMuted, fontWeight: '500' },
  bottomRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  price: { fontSize: 18, fontWeight: '900', color: Brand.cta },
  cta: {
    backgroundColor: Brand.cta,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.md,
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
  },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
});
