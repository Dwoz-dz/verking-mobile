/**
 * DeliverToStrip — "Livrer vers [Alger]" header strip, sits just below
 * the sticky Home header. Shows the active wilaya, the fee, the free
 * shipping threshold (if configured), and opens the WilayaPickerModal
 * when tapped.
 *
 * Hidden entirely while wilayas/zones are still loading so the layout
 * doesn't jump on cold start.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WilayaPickerModal } from '@/components/storefront/WilayaPickerModal';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import {
  useDefaultWilaya,
  useMobileCartConfig,
  useShippingFor,
} from '@/services/mobileConfig';

export function DeliverToStrip() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const isAr = i18n.language === 'ar';
  const [pickerVisible, setPickerVisible] = useState(false);

  const { effectiveCode, wilaya, setCode, loading } = useDefaultWilaya();
  const zone = useShippingFor(effectiveCode);
  const cart = useMobileCartConfig();

  // The threshold the picker should display: per-wilaya override beats
  // the global cart setting.
  const freeThreshold = useMemo(() => {
    if (zone?.free_threshold_override != null) return zone.free_threshold_override;
    return cart.free_delivery_threshold;
  }, [zone, cart.free_delivery_threshold]);

  if (loading || !wilaya) return null;

  const wilayaName = isAr ? wilaya.name_ar : wilaya.name_fr;
  const feeText = zone
    ? zone.fee > 0
      ? formatPrice(zone.fee)
      : t('geo.fee_free')
    : null;

  return (
    <>
      <Pressable
        onPress={() => setPickerVisible(true)}
        style={[styles.strip, { flexDirection: rowDirection }]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="location" size={14} color={Brand.primary} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.label, { textAlign }]} numberOfLines={1}>
            {t('geo.deliver_to')}{' '}
            <Text style={styles.wilayaName}>{wilayaName}</Text>
            {feeText ? <Text style={styles.feeText}>{'  • '}{feeText}</Text> : null}
          </Text>
          {freeThreshold != null && freeThreshold > 0 ? (
            <Text style={[styles.subtext, { textAlign }]} numberOfLines={1}>
              {t('geo.free_shipping_above', { amount: formatPrice(freeThreshold) })}
            </Text>
          ) : null}
        </View>
        <Text style={styles.changeLink}>{t('geo.change_wilaya')}</Text>
        <Ionicons name="chevron-forward" size={14} color={Brand.primary} />
      </Pressable>

      <WilayaPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={async (code) => {
          await setCode(code);
          setPickerVisible(false);
        }}
        selectedCode={effectiveCode}
      />
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: Spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(45,125,210,0.06)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(45,125,210,0.12)',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 26, height: 26, borderRadius: 999,
    backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(45,125,210,0.18)',
  },
  content: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, color: Brand.text, fontWeight: '600' },
  wilayaName: { color: Brand.primary, fontWeight: '900' },
  feeText: { color: Brand.cta, fontWeight: '900' },
  subtext: { fontSize: 10.5, color: Brand.textMuted, fontWeight: '600', marginTop: 1 },
  changeLink: { color: Brand.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
});

export default DeliverToStrip;
