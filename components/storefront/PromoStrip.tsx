/**
 * Slim colourful promo strip — sits above the hero. Used to advertise
 * delivery, support, payment-on-delivery etc.
 */
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

export function PromoStrip() {
  const { t } = useTranslation();
  const { rowDirection, textAlign } = useDirection();
  return (
    <View style={[styles.wrap, { flexDirection: rowDirection }]}>
      <View style={styles.iconBubble}>
        <Ionicons name="rocket" size={18} color="#FFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
          {t('home.promo_strip_title')}
        </Text>
        <Text style={[styles.sub, { textAlign }]} numberOfLines={1}>
          {t('home.promo_strip_sub')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: '#FFF7E6',
    borderRadius: Radius.lg,
    padding: 12,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#FFE0A3',
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.accent,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  title: { fontWeight: '900', color: Brand.secondary, fontSize: 13 },
  sub: { color: Brand.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
});
