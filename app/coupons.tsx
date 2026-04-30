/**
 * Coupons screen — two tabs:
 *   ▸ Disponibles  — claimable catalogue (anon SELECT, RLS-filtered).
 *   ▸ Portefeuille — claimed coupons for this device, fetched via the
 *                    `coupon-list-mine` edge route.
 *
 * Both lists render the same `CouponCard` to keep the visual
 * vocabulary consistent. Claiming a coupon is a single round-trip to
 * `coupon-claim` and refreshes both lists on success.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MicroConfetti } from '@/components/decorative/MicroConfetti';
import { useBottomContentClearance } from '@/constants/layout';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import { success as hapticSuccess } from '@/lib/haptics';
import {
  claimCoupon,
  useClaimableCoupons,
  useMyCoupons,
  type CouponRow,
  type UserCouponRow,
} from '@/services/coupons';

type Tab = 'available' | 'wallet';

export default function CouponsScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const [tab, setTab] = useState<Tab>('available');
  const [claimingCode, setClaimingCode] = useState<string | null>(null);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const isAr = i18n.language === 'ar';

  const { coupons: available, loading: loadingAvail, reload: reloadAvail } = useClaimableCoupons();
  const { wallet, loading: loadingWallet, reload: reloadWallet } = useMyCoupons();
  // Phase 16.4 — pull-to-refresh + 30 s focus refresh.
  const { refreshing, onRefresh } = usePullRefresh();
  useRefreshOnFocus();
  // Phase 1.4 — keep last coupon reachable above the floating FAB.
  const bottomClearance = useBottomContentClearance();

  const claimedSet = useMemo(
    () => new Set(wallet.map((w) => w.coupon_id)),
    [wallet],
  );

  const onClaim = async (coupon: CouponRow) => {
    if (claimedSet.has(coupon.id) || claimingCode) return;
    setClaimingCode(coupon.code);
    try {
      const res = await claimCoupon(coupon.code);
      if (!res.already_claimed) {
        hapticSuccess();
        setConfettiVisible(true);
      }
      Alert.alert(
        res.already_claimed ? t('coupons.claim_already') : t('coupons.claim_success_title'),
        res.already_claimed ? '' : t('coupons.claim_success_body'),
      );
      reloadWallet();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec');
    } finally {
      setClaimingCode(null);
    }
  };

  const renderEmpty = (title: string, sub: string, icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap) => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={36} color={Brand.primary} />
      </View>
      <Text style={[styles.emptyTitle, { textAlign }]}>{title}</Text>
      <Text style={[styles.emptySub, { textAlign }]}>{sub}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <MicroConfetti visible={confettiVisible} onDone={() => setConfettiVisible(false)} />
      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setTab('available')}
          style={[styles.tab, tab === 'available' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === 'available' && styles.tabLabelActive]}>
            {t('coupons.tab_available')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('wallet')}
          style={[styles.tab, tab === 'wallet' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === 'wallet' && styles.tabLabelActive]}>
            {t('coupons.tab_wallet')}
            {wallet.length > 0 ? ` (${wallet.length})` : ''}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomClearance }]}
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
        {tab === 'available' ? (
          loadingAvail ? null : available.length === 0 ? (
            renderEmpty(t('coupons.available_empty_title'), t('coupons.available_empty_sub'), 'pricetag-outline')
          ) : (
            available.map((c) => (
              <CouponCard
                key={c.id}
                coupon={c}
                isAr={isAr}
                rowDirection={rowDirection}
                textAlign={textAlign}
                action={
                  claimedSet.has(c.id)
                    ? { label: t('coupons.claimed'), disabled: true, tone: 'success' as const }
                    : {
                        label: claimingCode === c.code ? '…' : t('coupons.claim'),
                        disabled: claimingCode === c.code,
                        tone: 'primary' as const,
                        onPress: () => void onClaim(c),
                      }
                }
                t={t}
              />
            ))
          )
        ) : (
          loadingWallet ? null : wallet.length === 0 ? (
            renderEmpty(t('coupons.wallet_empty_title'), t('coupons.wallet_empty_sub'), 'wallet-outline')
          ) : (
            wallet.map((w) => (
              <CouponCard
                key={w.id}
                coupon={w.coupon}
                isAr={isAr}
                rowDirection={rowDirection}
                textAlign={textAlign}
                userCoupon={w}
                action={
                  w.used_at
                    ? { label: t('coupons.used'), disabled: true, tone: 'muted' as const }
                    : { label: t('coupons.claimed'), disabled: true, tone: 'success' as const }
                }
                t={t}
              />
            ))
          )
        )}
        {/* keep reload helper alive in case future Pull-to-refresh is added */}
        {void reloadAvail}
      </ScrollView>
    </SafeAreaView>
  );
}

interface CouponCardProps {
  coupon: CouponRow;
  isAr: boolean;
  rowDirection: 'row' | 'row-reverse';
  textAlign: 'left' | 'right' | 'center';
  action: { label: string; disabled?: boolean; tone: 'primary' | 'success' | 'muted'; onPress?: () => void };
  userCoupon?: UserCouponRow;
  t: (key: string, vars?: Record<string, unknown>) => string;
}

function CouponCard({
  coupon, isAr, rowDirection, textAlign, action, userCoupon, t,
}: CouponCardProps) {
  const title = isAr ? coupon.title_ar : coupon.title_fr;
  const description = isAr ? coupon.description_ar : coupon.description_fr;

  let discountLabel = '';
  if (coupon.discount_type === 'percent') {
    discountLabel = t('coupons.discount_percent', { value: coupon.value });
  } else if (coupon.discount_type === 'fixed') {
    discountLabel = t('coupons.discount_fixed', { value: coupon.value });
  } else {
    discountLabel = t('coupons.discount_free_shipping');
  }

  const minCartLabel =
    coupon.min_cart_amount > 0 ? t('coupons.min_cart', { amount: formatPrice(coupon.min_cart_amount) }) : null;

  const expiresLabel = coupon.ends_at
    ? t('coupons.expires_at', { date: new Date(coupon.ends_at).toLocaleDateString(isAr ? 'ar-DZ' : 'fr-DZ') })
    : null;

  const toneBg: Record<typeof action.tone, string> = {
    primary: Brand.cta,
    success: Brand.fresh,
    muted:   Brand.surfaceContainerHigh,
  };
  const toneText: Record<typeof action.tone, string> = {
    primary: '#FFF',
    success: '#FFF',
    muted:   Brand.textMuted,
  };

  return (
    <View style={[styles.card, { flexDirection: rowDirection }]}>
      {/* Discount slab */}
      <View style={styles.slab}>
        <Text style={styles.slabValue}>{discountLabel}</Text>
        <View style={styles.slabPunch} />
      </View>
      {/* Body */}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { textAlign }]} numberOfLines={1}>{title}</Text>
        {description ? (
          <Text style={[styles.cardDesc, { textAlign }]} numberOfLines={2}>{description}</Text>
        ) : null}
        <View style={[styles.cardMeta, { flexDirection: rowDirection }]}>
          <View style={styles.codePill}>
            <Text style={styles.codePillLabel}>{t('coupons.code_label')}</Text>
            <Text style={styles.codePillValue}>{coupon.code}</Text>
          </View>
          {minCartLabel ? <Text style={styles.metaText}>{minCartLabel}</Text> : null}
        </View>
        {expiresLabel ? (
          <Text style={[styles.expires, { textAlign }]}>{expiresLabel}</Text>
        ) : userCoupon?.used_at ? (
          <Text style={[styles.expires, { textAlign, color: Brand.textMuted }]}>
            {new Date(userCoupon.used_at).toLocaleDateString(isAr ? 'ar-DZ' : 'fr-DZ')}
          </Text>
        ) : null}
        <Pressable
          disabled={action.disabled}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.cardCta,
            { backgroundColor: toneBg[action.tone] },
            (action.disabled || pressed) && { opacity: 0.85 },
          ]}
        >
          <Text style={[styles.cardCtaLabel, { color: toneText[action.tone] }]}>
            {action.label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Brand.surfaceMuted,
  },
  tabActive: { backgroundColor: Brand.secondary },
  tabLabel: { color: Brand.textMuted, fontWeight: '900', fontSize: 13, letterSpacing: 0.2 },
  tabLabelActive: { color: '#FFF' },

  scroll: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.border,
    shadowColor: Brand.shadowBlue,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  slab: {
    width: 110,
    backgroundColor: Brand.cta,
    paddingVertical: Spacing.md,
    paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  slabValue: {
    color: '#FFF',
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 18, letterSpacing: -0.5, textAlign: 'center',
  },
  slabPunch: {
    position: 'absolute', right: -6, top: '50%',
    width: 12, height: 12, borderRadius: 999,
    backgroundColor: Brand.background,
    transform: [{ translateY: -6 }],
  },
  cardBody: { flex: 1, padding: Spacing.sm, gap: 4 },
  cardTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 14, color: Brand.text, letterSpacing: -0.2,
  },
  cardDesc: { fontSize: 11, color: Brand.textMuted, fontWeight: '600', lineHeight: 14 },
  cardMeta: { alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  codePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primaryTint,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  codePillLabel: { color: Brand.textMuted, fontWeight: '700', fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase' },
  codePillValue: { color: Brand.primary, fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
  metaText: { fontSize: 10.5, color: Brand.textMuted, fontWeight: '700' },
  expires: { fontSize: 10, color: Brand.textMuted, fontWeight: '600', marginTop: 2 },
  cardCta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, marginTop: 8,
  },
  cardCtaLabel: { fontWeight: '900', fontSize: 11.5, letterSpacing: 0.4 },

  emptyWrap: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyIconWrap: {
    width: 76, height: 76, borderRadius: 999,
    backgroundColor: Brand.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 16, color: Brand.secondary },
  emptySub: { color: Brand.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: Spacing.lg, lineHeight: 16 },
});
