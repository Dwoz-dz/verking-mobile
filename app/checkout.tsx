/**
 * Checkout — collects customer info and creates an order via the Edge
 * Function. Two entry paths:
 *
 *   1) Cart-based (default):
 *      User taps "Valider la commande" on /cart.
 *      We read all cart lines, group by sale mode, and pick the
 *      "dominant" mode (whichever has the most lines). If the cart
 *      mixes Gros and Détail, the other-mode lines are LEFT in the
 *      cart with a banner so the user can place a separate order for
 *      them — the Edge Function only accepts one mode per order.
 *
 *   2) Legacy single-product (back-compat):
 *      Product detail's "Acheter maintenant" pushes /checkout with
 *      ?productId=... params. That bypasses the cart entirely.
 *
 * On success we push the order to local history, remove ONLY the
 * placed lines from the cart (cart-based) or leave the cart untouched
 * (legacy), and route to /(tabs)/orders.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppliedCoupon } from '@/components/cart/AppliedCouponContext';
import { useCartActions, useCartLines } from '@/components/cart/CartProvider';
import { getDeviceId } from '@/lib/deviceId';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { CURRENCY, formatPrice } from '@/lib/format';
import type { CartLine } from '@/lib/cart';
import { createQuickOrder, type SaleMode } from '@/services/orders';
import { pushLocalOrder } from '@/services/orderHistory';
import {
  buildCartMessage,
  buildOrderMessage,
  getWhatsAppNumber,
  openWhatsApp,
} from '@/services/whatsapp';

interface CheckoutLine {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export default function CheckoutScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const locale = i18n.language as 'fr' | 'ar' | 'en';

  const params = useLocalSearchParams<{
    productId?: string;
    productName?: string;
    unitPrice?: string;
    quantity?: string;
    mode?: SaleMode;
  }>();

  const isLegacy = Boolean(params.productId);

  const cartLines = useCartLines();
  const { remove: removeCartLine } = useCartActions();
  const coupon = useAppliedCoupon();

  const { lines, mode, otherModeLines } = useMemo(() => {
    if (isLegacy) {
      const legacyLine: CheckoutLine = {
        product_id: String(params.productId ?? ''),
        product_name: String(params.productName ?? t('product.title_fallback')),
        quantity: Math.max(1, Number(params.quantity ?? '1')),
        unit_price: Number(params.unitPrice ?? '0'),
      };
      const legacyMode = (params.mode as SaleMode) ?? 'detail';
      return { lines: [legacyLine], mode: legacyMode, otherModeLines: [] as CartLine[] };
    }

    if (cartLines.length === 0) {
      return { lines: [] as CheckoutLine[], mode: 'detail' as SaleMode, otherModeLines: [] };
    }

    const detail = cartLines.filter((l) => l.mode === 'detail');
    const gros = cartLines.filter((l) => l.mode === 'gros');
    const dominantMode: SaleMode = gros.length > detail.length ? 'gros' : 'detail';
    const placed = dominantMode === 'gros' ? gros : detail;
    const others = dominantMode === 'gros' ? detail : gros;

    const checkoutLines: CheckoutLine[] = placed.map((l) => ({
      product_id: l.product_id,
      product_name:
        locale === 'ar'
          ? l.name_ar || l.name_fr
          : locale === 'en'
            ? l.name_en || l.name_fr
            : l.name_fr,
      quantity: l.qty,
      unit_price: l.unit_price,
    }));

    return { lines: checkoutLines, mode: dominantMode, otherModeLines: others };
  }, [cartLines, isLegacy, locale, params, t]);

  const subtotal = useMemo(
    () => lines.reduce((acc, l) => acc + l.unit_price * l.quantity, 0),
    [lines],
  );

  // Phase 9.5 — derive bundle savings from the live cart lines (which
  // still carry pack metadata) and deduct from the subtotal that goes
  // to the order placement, the order history, and loyalty earn.
  const bundleSavings = useMemo(() => {
    if (isLegacy || cartLines.length === 0) return 0;
    const placed = cartLines.filter((l) => l.mode === mode);
    const packs = new Map<string, { subtotal: number; pct: number }>();
    for (const l of placed) {
      if (!l.pack_id || !l.pack_discount_pct || l.pack_discount_pct <= 0) continue;
      const cur = packs.get(l.pack_id);
      const lineTotal = l.unit_price * l.qty;
      if (cur) cur.subtotal += lineTotal;
      else packs.set(l.pack_id, { subtotal: lineTotal, pct: l.pack_discount_pct });
    }
    let savings = 0;
    for (const p of packs.values()) savings += Math.round((p.subtotal * p.pct) / 100);
    return savings;
  }, [cartLines, isLegacy, mode]);

  const effectiveSubtotal = Math.max(0, subtotal - bundleSavings);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);

  useEffect(() => {
    void (async () => setWhatsappPhone(await getWhatsAppNumber()))();
  }, []);

  useEffect(() => {
    if (!isLegacy && cartLines.length === 0) {
      const id = setTimeout(() => router.replace('/(tabs)/explore'), 800);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [cartLines.length, isLegacy]);

  const submit = useCallback(async () => {
    if (lines.length === 0) {
      Alert.alert(t('checkout.missing_product_title'), t('checkout.missing_product_body'));
      return;
    }
    if (!name.trim() || !phone.trim()) {
      Alert.alert(t('checkout.required_title'), t('checkout.required_body'));
      return;
    }
    setSubmitting(true);
    try {
      const deviceId = coupon.userCouponId ? await getDeviceId() : null;
      const order = await createQuickOrder({
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_wilaya: wilaya.trim() || null,
        customer_address: address.trim() || null,
        delivery_type: 'home',
        payment_method: 'cod',
        mode,
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        applied_user_coupon_id: coupon.userCouponId,
        device_id: deviceId,
      });
      // Clear coupon state on success — the wallet row is now used,
      // wallet/alternatives will refresh next cart open.
      if (coupon.userCouponId) coupon.clear();

      const totalQty = lines.reduce((acc, l) => acc + l.quantity, 0);
      const headlineProduct = lines[0]?.product_name ?? '';
      const summary =
        lines.length === 1
          ? `${lines[0].quantity} x ${headlineProduct}`
          : `${totalQty} x ${lines.length} ${t('checkout.lines_count_other', { count: lines.length })}`;

      await pushLocalOrder({
        order_id: order.id,
        order_number: order.order_number,
        created_at: order.created_at ?? new Date().toISOString(),
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        total: order.total ?? effectiveSubtotal,
        mode,
        product_summary: summary,
        status: order.status ?? 'new',
      });

      // Loyalty: credit points on the post-bundle amount (idempotent on order_id).
      try {
        const { earnForOrder } = await import('@/services/loyalty');
        await earnForOrder(order.id, order.total ?? effectiveSubtotal);
      } catch (err) {
        console.warn('[checkout] loyalty earn failed (non-fatal):', err);
      }

      if (!isLegacy) {
        for (const l of lines) {
          removeCartLine(`${l.product_id}:${mode}`);
        }
      }

      Alert.alert(
        t('checkout.success_title'),
        t('checkout.success_body', { ref: order.order_number }),
        [{ text: t('common.ok'), onPress: () => router.replace('/(tabs)/orders') }],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t('checkout.error_generic');
      Alert.alert(t('checkout.error_title'), message);
    } finally {
      setSubmitting(false);
    }
  }, [
    address, isLegacy, lines, mode, name, notes, phone,
    removeCartLine, subtotal, t, wilaya,
  ]);

  const sendWhatsApp = async () => {
    const extras = [
      wilaya ? t('whatsapp.order_template_wilaya', { wilaya }) : null,
      address ? t('whatsapp.order_template_address', { address }) : null,
      notes ? t('whatsapp.order_template_note', { note: notes }) : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (lines.length === 1) {
      const only = lines[0];
      const message = buildOrderMessage({
        customerName: name.trim() || undefined,
        productName: only.product_name,
        productId: only.product_id,
        mode,
        quantity: only.quantity,
        unitPrice: only.unit_price,
        total: effectiveSubtotal,
        extra: extras,
      });
      await openWhatsApp({ message });
      return;
    }

    const message = buildCartMessage({
      customerName: name.trim() || undefined,
      lines: lines.map((l) => ({
        name: l.product_name,
        mode,
        qty: l.quantity,
        unit_price: l.unit_price,
      })),
      total: effectiveSubtotal,
      currency: CURRENCY,
      extra: extras,
    });
    await openWhatsApp({ message });
  };

  const modeLabel = mode === 'gros' ? t('modes.gros') : t('modes.detail');
  const otherModeLabel =
    otherModeLines.length > 0
      ? mode === 'gros'
        ? t('modes.detail')
        : t('modes.gros')
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t('checkout.title') }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            <View style={[styles.summaryHeader, { flexDirection: rowDirection }]}>
              <View style={[styles.modeChip, { backgroundColor: mode === 'gros' ? Brand.mint : Brand.cta }]}>
                <Text style={styles.modeChipText}>{modeLabel}</Text>
              </View>
              <Text style={styles.summaryCount}>
                {t('checkout.lines_count_other', { count: lines.length })}
              </Text>
            </View>
            <View style={styles.summaryLines}>
              {lines.slice(0, 3).map((l, i) => (
                <View key={`${l.product_id}-${i}`} style={[styles.summaryLineRow, { flexDirection: rowDirection }]}>
                  <Text style={[styles.summaryLineName, { textAlign }]} numberOfLines={1}>
                    {l.quantity} x {l.product_name}
                  </Text>
                  <Text style={styles.summaryLinePrice}>
                    {formatPrice(l.unit_price * l.quantity)}
                  </Text>
                </View>
              ))}
              {lines.length > 3 ? (
                <Text style={[styles.summaryMore, { textAlign }]}>
                  +{lines.length - 3}
                </Text>
              ) : null}
            </View>
            {bundleSavings > 0 ? (
              <View style={[styles.summaryTotalRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.summaryTotalLabel, { color: Brand.cta }]}>🎒 Remise Pack</Text>
                <Text style={[styles.summaryTotalValue, { color: Brand.cta }]}>-{formatPrice(bundleSavings)}</Text>
              </View>
            ) : null}
            <View style={[styles.summaryTotalRow, { flexDirection: rowDirection }]}>
              <Text style={styles.summaryTotalLabel}>{t('cart.summary_total')}</Text>
              <Text style={styles.summaryTotalValue}>{formatPrice(effectiveSubtotal)}</Text>
            </View>
          </View>

          {otherModeLabel ? (
            <View style={styles.mixedNotice}>
              <Ionicons name="information-circle" size={14} color={Brand.primary} />
              <Text style={[styles.mixedNoticeText, { textAlign }]}>
                {t('checkout.mixed_mode_notice', { mode: otherModeLabel })}
              </Text>
            </View>
          ) : null}

          <Field label={t('checkout.field_name')} value={name} onChangeText={setName} placeholder={t('checkout.field_name_ph')} textAlign={textAlign} />
          <Field label={t('checkout.field_phone')} value={phone} onChangeText={setPhone} placeholder={t('checkout.field_phone_ph')} keyboardType="phone-pad" textAlign={textAlign} />
          <Field label={t('checkout.field_wilaya')} value={wilaya} onChangeText={setWilaya} placeholder={t('checkout.field_wilaya_ph')} textAlign={textAlign} />
          <Field label={t('checkout.field_address')} value={address} onChangeText={setAddress} placeholder={t('checkout.field_address_ph')} multiline textAlign={textAlign} />
          <Field label={t('checkout.field_notes')} value={notes} onChangeText={setNotes} placeholder={t('checkout.field_notes_ph')} multiline textAlign={textAlign} />

          <Pressable
            onPress={submit}
            disabled={submitting || lines.length === 0}
            style={[styles.cta, (submitting || lines.length === 0) && { opacity: 0.7 }]}
          >
            <Ionicons name="bag-check" size={18} color="#FFF" />
            <Text style={styles.ctaText}>{submitting ? t('checkout.submitting') : t('checkout.submit')}</Text>
          </Pressable>

          {whatsappPhone ? (
            <Pressable onPress={() => void sendWhatsApp()} style={styles.whatsappBtn}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
              <Text style={styles.whatsappText}>{t('checkout.whatsapp_alt')}</Text>
            </Pressable>
          ) : (
            <Text style={styles.whatsappHint}>{t('checkout.whatsapp_disabled_hint')}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  textAlign: 'left' | 'right';
}

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, textAlign,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { textAlign }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Brand.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, { textAlign }, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  summary: {
    backgroundColor: Brand.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryHeader: { alignItems: 'center', justifyContent: 'space-between' },
  modeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  modeChipText: {
    color: '#FFFFFF', fontFamily: BrandFont.bold, fontWeight: '900',
    fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
  },
  summaryCount: {
    color: 'rgba(255,255,255,0.85)', fontFamily: BrandFont.semibold,
    fontWeight: '600', fontSize: 12,
  },
  summaryLines: {
    paddingTop: Spacing.xs, paddingBottom: Spacing.xs,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    gap: 4,
  },
  summaryLineRow: { alignItems: 'center', justifyContent: 'space-between' },
  summaryLineName: {
    flex: 1, color: 'rgba(255,255,255,0.92)',
    fontFamily: BrandFont.medium, fontWeight: '500', fontSize: 13, paddingRight: 8,
  },
  summaryLinePrice: { color: '#FFFFFF', fontFamily: BrandFont.bold, fontWeight: '700', fontSize: 13 },
  summaryMore: {
    color: 'rgba(255,255,255,0.65)', fontFamily: BrandFont.semibold,
    fontWeight: '600', fontSize: 11, marginTop: 2,
  },
  summaryTotalRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  summaryTotalLabel: {
    color: 'rgba(255,255,255,0.85)', fontFamily: BrandFont.semibold,
    fontWeight: '600', fontSize: 13,
  },
  summaryTotalValue: {
    color: Brand.sunshine, fontFamily: BrandFont.extrabold,
    fontWeight: '900', fontSize: 22, letterSpacing: -0.3,
  },
  mixedNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    backgroundColor: Brand.primaryTint, borderRadius: Radius.md,
  },
  mixedNoticeText: {
    flex: 1, color: Brand.secondary,
    fontFamily: BrandFont.semibold, fontWeight: '600', fontSize: 12,
  },
  field: { gap: 6 },
  fieldLabel: { fontWeight: '700', color: Brand.secondary, fontSize: 13 },
  input: {
    backgroundColor: Brand.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Brand.border,
    paddingHorizontal: 14, paddingVertical: 11,
    color: Brand.text, fontSize: 15,
  },
  cta: {
    marginTop: Spacing.md, backgroundColor: Brand.cta,
    paddingVertical: 14, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
    shadowColor: Brand.shadowOrange, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
  },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.4 },
  whatsappBtn: {
    backgroundColor: '#25D366', paddingVertical: 12, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  whatsappText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  whatsappHint: { color: Brand.textMuted, fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
});
