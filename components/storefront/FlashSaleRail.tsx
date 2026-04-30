/**
 * FlashSaleRail — horizontal rail of products inside a single flash
 * sale, topped by an orange banner with the campaign title and a
 * countdown to `ends_at`.
 *
 * Self-contained: hides itself when the sale's countdown reaches 0
 * (CountdownTimer onExpire) and lets the Home re-fetch on the next
 * realtime event.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CountdownTimer } from '@/components/storefront/CountdownTimer';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import type { FlashSaleEnriched } from '@/services/flashSales';

const PLACEHOLDER_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

interface FlashSaleRailProps {
  sale: FlashSaleEnriched;
}

export function FlashSaleRail({ sale }: FlashSaleRailProps) {
  const { i18n, t } = useTranslation();
  const { rowDirection, textAlign } = useDirection();
  const isAr = i18n.language === 'ar';
  const [expired, setExpired] = useState(false);

  if (expired || sale.products.length === 0) return null;

  const title = isAr ? sale.title_ar : sale.title_fr;
  const subtitle = isAr ? sale.subtitle_ar : sale.subtitle_fr;

  const discountLabel =
    sale.discount_type === 'percent'
      ? `-${sale.discount_value}%`
      : `-${sale.discount_value} DA`;

  return (
    <View style={styles.wrap}>
      {/* Banner / hero */}
      <View
        style={styles.banner}
        // Orange → coral gradient using inline backgroundImage trick
        // is not native; we fake it with two overlapping views.
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Brand.cta }]} />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: Brand.coral, opacity: 0.55 },
          ]}
        />
        {sale.banner_image ? (
          <Image
            source={{ uri: sale.banner_image }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.4 }]}
            contentFit="cover"
            transition={120}
          />
        ) : null}

        <View style={[styles.bannerInner, { flexDirection: rowDirection }]}>
          <View style={styles.discountBubble}>
            <Ionicons name="flash" size={18} color={Brand.cta} />
            <Text style={styles.discountText}>{discountLabel}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { textAlign }]} numberOfLines={1}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { textAlign }]} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
          <CountdownTimer
            endsAt={sale.ends_at}
            size="sm"
            onExpire={() => setExpired(true)}
          />
        </View>
      </View>

      {/* Product rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {sale.products.map((p) => {
          const name = isAr ? (p.name_ar || p.name_fr) : p.name_fr;
          return (
            <Link
              key={p.id}
              href={{ pathname: '/product/[id]', params: { id: p.id } }}
              asChild
            >
              <Pressable style={styles.card}>
                <View style={styles.imageBox}>
                  {p.primaryImage ? (
                    <Image
                      source={{ uri: p.primaryImage }}
                      style={styles.image}
                      contentFit="cover"
                      transition={220}
                      placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
                    />
                  ) : (
                    <View style={[styles.image, styles.imageFallback]}>
                      <Text style={styles.imageFallbackLetter}>
                        {(name?.[0] ?? 'V').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.discountChip}>
                    <Text style={styles.discountChipText}>{discountLabel}</Text>
                  </View>
                </View>
                <Text style={[styles.name, { textAlign }]} numberOfLines={2}>{name}</Text>
                <View style={[styles.priceRow, { flexDirection: rowDirection }]}>
                  <Text style={styles.flashPrice}>{formatPrice(p.flash_price)}</Text>
                  {p.original_price > p.flash_price ? (
                    <Text style={styles.strikePrice}>{formatPrice(p.original_price)}</Text>
                  ) : null}
                </View>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
      {void t /* keep i18n namespace alive for future title translations */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: Spacing.sm,
    backgroundColor: '#FFF6EE',
    paddingBottom: Spacing.sm,
  },
  banner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    overflow: 'hidden',
    minHeight: 64,
    justifyContent: 'center',
  },
  bannerInner: {
    alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 4,
  },
  discountBubble: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 4,
    shadowColor: 'rgba(0,0,0,0.2)', shadowOpacity: 1, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  discountText: { color: Brand.cta, fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 13, letterSpacing: -0.2 },
  title: { color: '#FFF', fontFamily: BrandFont.extrabold, fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 11, marginTop: 1 },

  rail: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingTop: Spacing.sm },
  card: {
    width: 140,
    backgroundColor: '#FFF',
    borderRadius: Radius.lg,
    padding: 8,
    gap: 6,
    borderWidth: 1, borderColor: '#FFE7CF',
  },
  imageBox: {
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#FFE7CF',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE7CF' },
  imageFallbackLetter: { fontFamily: BrandFont.extrabold, fontSize: 28, color: Brand.cta, fontWeight: '900' },
  discountChip: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: Brand.cta,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999,
  },
  discountChipText: { color: '#FFF', fontWeight: '900', fontSize: 10, letterSpacing: 0.4 },
  name: { fontWeight: '800', color: Brand.text, fontSize: 12, lineHeight: 15, minHeight: 30 },
  priceRow: { alignItems: 'baseline', gap: 4 },
  flashPrice: { color: Brand.cta, fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 14 },
  strikePrice: { color: Brand.textMuted, fontSize: 10, textDecorationLine: 'line-through', fontWeight: '600' },
});

export default FlashSaleRail;
