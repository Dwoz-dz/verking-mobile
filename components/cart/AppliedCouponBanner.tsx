/**
 * AppliedCouponBanner — sits in the cart summary, shows the
 * auto-applied coupon and lets the user pick a different one from the
 * wallet via a bottom-sheet modal.
 *
 * If no claimed coupon is applicable to the current cart, the banner
 * stays hidden so we don't add visual noise.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppliedCoupon } from '@/components/cart/AppliedCouponContext';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';

export function AppliedCouponBanner() {
  const { t, i18n } = useTranslation();
  const { rowDirection, textAlign } = useDirection();
  const isAr = i18n.language === 'ar';
  const { code, discount, freeShipping, alternatives, wallet, setUserCouponId, userCouponId } = useAppliedCoupon();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!code) return null;

  const savingsLabel = freeShipping
    ? t('applied_coupon.free_shipping')
    : t('applied_coupon.savings', { amount: formatPrice(discount) });

  return (
    <>
      <View style={[styles.banner, { flexDirection: rowDirection }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="ticket" size={16} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { textAlign }]} numberOfLines={1}>
            {t('applied_coupon.auto_applied')}{' '}
            <Text style={styles.code}>{code}</Text>
          </Text>
          <Text style={[styles.savings, { textAlign }]}>{savingsLabel}</Text>
        </View>
        <Pressable onPress={() => setPickerOpen(true)} hitSlop={6} style={styles.changeBtn}>
          <Text style={styles.changeBtnText}>{t('applied_coupon.change')}</Text>
        </Pressable>
      </View>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top', 'bottom']}>
          <View style={[styles.modalHeader, { flexDirection: rowDirection }]}>
            <Text style={[styles.modalTitle, { textAlign }]}>{t('applied_coupon.alternatives_title')}</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={Brand.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {/* "no coupon" option */}
            <Pressable
              onPress={() => {
                setUserCouponId(null);
                setPickerOpen(false);
              }}
              style={[styles.altRow, { flexDirection: rowDirection }, !userCouponId && styles.altRowSelected]}
            >
              <View style={[styles.altDot, { backgroundColor: Brand.surfaceContainerHigh }]}>
                <Ionicons name="close" size={14} color={Brand.textMuted} />
              </View>
              <Text style={[styles.altLabel, { textAlign }]}>{t('applied_coupon.alternatives_clear')}</Text>
            </Pressable>

            {wallet
              .filter((w) => !w.used_at)
              .map((row) => {
                const alt = alternatives.find((a) => a.coupon_id === row.coupon_id);
                const eligible = alt !== undefined;
                const title = isAr ? row.coupon.title_ar : row.coupon.title_fr;
                const isSelected =
                  userCouponId === row.id ||
                  (!userCouponId && alternatives[0]?.coupon_id === row.coupon_id);
                return (
                  <Pressable
                    key={row.id}
                    onPress={() => {
                      if (!eligible) return;
                      setUserCouponId(row.coupon_id);
                      setPickerOpen(false);
                    }}
                    disabled={!eligible}
                    style={[
                      styles.altRow,
                      { flexDirection: rowDirection },
                      isSelected && eligible && styles.altRowSelected,
                      !eligible && styles.altRowDisabled,
                    ]}
                  >
                    <View style={[styles.altDot, { backgroundColor: Brand.cta }]}>
                      <Ionicons name="ticket" size={12} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.altLabel, { textAlign }]} numberOfLines={1}>
                        <Text style={styles.altCode}>{row.coupon.code}</Text>{'  '}
                        <Text style={styles.altTitle}>{title}</Text>
                      </Text>
                      <Text style={[styles.altDiscount, { textAlign }]}>
                        {alt
                          ? alt.type === 'free_shipping'
                            ? t('applied_coupon.free_shipping')
                            : t('applied_coupon.savings', { amount: formatPrice(alt.discount) })
                          : '—'}
                      </Text>
                    </View>
                    {isSelected && eligible ? (
                      <Ionicons name="checkmark-circle" size={20} color={Brand.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Brand.cta + '12',
    borderRadius: Radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Brand.cta + '33',
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: Brand.cta,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 12, color: Brand.text, fontWeight: '600' },
  code: { color: Brand.cta, fontWeight: '900', letterSpacing: 0.4 },
  savings: { color: Brand.cta, fontWeight: '900', fontSize: 13, marginTop: 1 },
  changeBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: '#FFF',
    borderWidth: 1, borderColor: Brand.cta + '55',
  },
  changeBtnText: { color: Brand.cta, fontWeight: '900', fontSize: 11 },

  modalHeader: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: 'rgba(15,23,42,0.06)',
  },
  modalTitle: { fontFamily: BrandFont.extrabold, fontSize: 18, fontWeight: '900', color: Brand.text },
  modalScroll: { padding: Spacing.md, gap: 8, paddingBottom: Spacing.xxl },
  altRow: {
    backgroundColor: '#FFF',
    borderRadius: Radius.lg,
    paddingHorizontal: 10, paddingVertical: 10,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)',
  },
  altRowSelected: { borderColor: Brand.primary, backgroundColor: '#F4F8FE' },
  altRowDisabled: { opacity: 0.45 },
  altDot: {
    width: 28, height: 28, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  altLabel: { fontSize: 13, color: Brand.text, fontWeight: '700' },
  altCode: { color: Brand.primary, fontFamily: BrandFont.extrabold, fontWeight: '900' },
  altTitle: { color: Brand.text, fontWeight: '700' },
  altDiscount: { fontSize: 11, color: Brand.cta, fontWeight: '900', marginTop: 2 },
});

export default AppliedCouponBanner;
