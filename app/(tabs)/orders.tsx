/**
 * Orders tab — local history of orders placed from this device. i18n + RTL.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HamburgerButton } from '@/components/navigation/HamburgerButton';
import { SmartEmptyState } from '@/components/storefront/SmartEmptyState';
import { BrandConfirmDialog } from '@/components/ui/BrandConfirmDialog';
import { useBottomContentClearance } from '@/constants/layout';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import { clearLocalOrders, getLocalOrders, type LocalOrderEntry } from '@/services/orderHistory';

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function OrdersScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const [orders, setOrders] = useState<LocalOrderEntry[]>([]);

  const bottomClearance = useBottomContentClearance();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const reload = useCallback(async () => {
    setOrders(await getLocalOrders());
  }, []);

  // Phase 16.4 — pull-to-refresh. Local order list is already
  // refreshed on focus by `useFocusEffect` below; the pull-to-refresh
  // also triggers any other Supabase-backed hooks via the global bus.
  const { refreshing, onRefresh: pullRefresh } = usePullRefresh();
  const onRefresh = useCallback(async () => {
    await Promise.all([pullRefresh(), reload()]);
  }, [pullRefresh, reload]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onClear = () => setConfirmClearOpen(true);
  const onClearConfirm = async () => {
    setConfirmClearOpen(false);
    await clearLocalOrders();
    void reload();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={[styles.headerRow, { flexDirection: rowDirection }]}>
          <HamburgerButton />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { textAlign }]}>{t('orders.title')}</Text>
            <Text style={[styles.sub, { textAlign }]}>{t('orders.subtitle')}</Text>
          </View>
        </View>
      </View>

      {orders.length === 0 ? (
        <SmartEmptyState
          screen="orders"
          defaultIcon="receipt-outline"
          defaultTitle={t('orders.empty_title')}
          defaultSubtitle={t('orders.empty_subtitle')}
          defaultCtaLabel={t('cart.empty_cta')}
          defaultCtaHref="/(tabs)/explore"
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: bottomClearance }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Brand.primary}
              colors={[Brand.primary, Brand.cta]}
            />
          }
        >
          {orders.map((o) => (
            <View key={o.order_id} style={styles.card}>
              <View style={[styles.row, { flexDirection: rowDirection }]}>
                <Text style={styles.orderNumber}>#{o.order_number}</Text>
                <View
                  style={[
                    styles.modePill,
                    o.mode === 'gros' ? styles.modeGros : styles.modeDetail,
                  ]}
                >
                  <Text
                    style={[
                      styles.modePillText,
                      o.mode === 'gros' ? styles.modeGrosText : styles.modeDetailText,
                    ]}
                  >
                    {o.mode === 'gros' ? t('modes.gros') : t('modes.detail')}
                  </Text>
                </View>
              </View>
              <Text style={[styles.summary, { textAlign }]} numberOfLines={2}>
                {o.product_summary}
              </Text>
              <View style={[styles.rowEnd, { flexDirection: rowDirection }]}>
                <Text style={styles.date}>{formatDate(o.created_at, i18n.language)}</Text>
                <Text style={styles.total}>{formatPrice(o.total)}</Text>
              </View>
              <View style={[styles.statusRow, { flexDirection: rowDirection }]}>
                <Text style={styles.statusDot}>●</Text>
                <Text style={styles.statusLabel}>
                  {t('orders.status_label', { status: o.status || 'new' })}
                </Text>
              </View>
            </View>
          ))}

          <Pressable onPress={onClear} style={styles.clear}>
            <Text style={styles.clearText}>{t('orders.clear')}</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Phase 4.5 — branded confirm dialog for the destructive
          "Effacer l'historique" action. */}
      <BrandConfirmDialog
        visible={confirmClearOpen}
        title={t('orders.clear_confirm_title')}
        message={t('orders.clear_confirm_body')}
        confirmLabel={t('orders.clear_confirm')}
        cancelLabel={t('orders.clear_cancel')}
        destructive
        onConfirm={() => void onClearConfirm()}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  headerRow: { alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '900', color: Brand.secondary, letterSpacing: 0.4 },
  sub: { color: Brand.textMuted, fontWeight: '600', marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: Spacing.sm,
  },
  row: { alignItems: 'center', justifyContent: 'space-between' },
  rowEnd: { alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  orderNumber: { fontWeight: '900', color: Brand.secondary, letterSpacing: 0.5 },
  modePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  modeDetail: { backgroundColor: Brand.accent },
  modeDetailText: { color: '#FFF' },
  modeGros: { backgroundColor: Brand.mint },
  modeGrosText: { color: Brand.secondary },
  modePillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  summary: { color: Brand.text, fontSize: 13 },
  date: { color: Brand.textMuted, fontSize: 11, fontWeight: '600' },
  total: { color: Brand.primary, fontSize: 18, fontWeight: '900' },
  statusRow: { alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { color: Brand.success, fontSize: 10 },
  statusLabel: { color: Brand.textMuted, fontSize: 11, fontWeight: '600' },
  clear: { alignSelf: 'center', marginTop: Spacing.lg, paddingVertical: 8, paddingHorizontal: 16 },
  clearText: { color: Brand.danger, fontWeight: '700' },
});
