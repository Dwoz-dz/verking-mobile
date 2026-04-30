/**
 * Mini product card — image + name + price as a horizontal row.
 */
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { pickLocalized } from '@/i18n/pickLocalized';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import type { ProductWithImages } from '@/types/database';

interface MiniProductCardProps {
  product: ProductWithImages;
}

export function MiniProductCard({ product }: MiniProductCardProps) {
  const { i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const locale = i18n.language as 'fr' | 'ar' | 'en';
  const name =
    pickLocalized(product as unknown as Record<string, unknown>, 'name', locale) ||
    product.name_fr;
  const sale = product.sale_price != null && product.sale_price < product.price;
  const main = sale ? product.sale_price! : product.price;

  return (
    <Link href={{ pathname: '/product/[id]', params: { id: product.id } }} asChild>
      <Pressable style={[styles.card, { flexDirection: rowDirection }]}>
        <View style={styles.imageWrap}>
          {product.primaryImage ? (
            <Image source={{ uri: product.primaryImage }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, styles.fallback]}><Text style={{ fontSize: 18 }}>📦</Text></View>
          )}
        </View>
        <View style={styles.body}>
          <Text style={[styles.name, { textAlign }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.price, { textAlign }]}>{formatPrice(main)}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Brand.glass,
    borderRadius: Radius.lg,
    padding: 8,
    gap: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.glassBorder,
  },
  imageWrap: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Brand.surface, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 11, fontWeight: '800', color: Brand.text },
  price: { fontSize: 13, fontWeight: '900', color: Brand.cta, marginTop: 2 },
});
