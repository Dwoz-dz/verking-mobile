/**
 * Cart screen — `/cart` (modal-card route).
 *
 * Shows the user's pending order before checkout. Each line is a
 * Stitch-style glass card with:
 *   ▸ snapshot image (orange-tinted "V" fallback when missing),
 *   ▸ name + mode pill (Détail / Gros),
 *   ▸ unit price + line total,
 *   ▸ qty stepper (clamped to min_qty / stock_cap),
 *   ▸ delete button (free-form trash, no swipe-gestures yet).
 *
 * Footer pinned to the bottom:
 *   ▸ Subtotal + items count.
 *   ▸ "Continuer mes achats" — pop back to the shop.
 *   ▸ "Valider la commande" — push /checkout.
 *   ▸ Optional WhatsApp send-cart shortcut (hidden when no number).
 *
 * Empty state:
 *   ▸ Brand-tinted illustration with StationeryPattern accent.
 *   ▸ Single CTA back to the shop.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppliedCoupon } from '@/components/cart/AppliedCouponContext';
import { AppliedCouponBanner } from '@/components/cart/AppliedCouponBanner';
import { useCartActions, useCartLines, useCartTotals } from '@/components/cart/CartProvider';
import { BrandWallpaper } from '@/components/decorative/BrandWallpaper';
import { TrustStrip } from '@/components/storefront/TrustStrip';
import { BrandConfirmDialog } from '@/components/ui/BrandConfirmDialog';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { pickLocalized } from '@/i18n/pickLocalized';
import { useDirection } from '@/i18n/useDirection';
import { CURRENCY, formatPrice } from '@/lib/format';
import { track } from '@/services/analytics';
import { useDefaultWilaya, useMobileCartConfig } from '@/services/mobileConfig';
import { useLoyaltyAccount } from '@/services/loyalty';
import type { CartLine as CartLineType } from '@/lib/cart';
import { getWhatsAppNumber, buildCartMessage } from '@/services/whatsapp';
import type { CartLine } from '@/lib/cart';

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const lines = useCartLines();
  const totals = useCartTotals();
  const { setQty, remove, clear } = useCartActions();
  const cartConfig = useMobileCartConfig();
  const { effectiveCode: wilaya } = useDefaultWilaya();
  const coupon = useAppliedCoupon();
  const { settings: loyaltySettings } = useLoyaltyAccount();
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  useEffect(() => {
    void getWhatsAppNumber().then(setWhatsapp);
  }, []);

  // Recompute the best coupon every time the cart shape or wilaya
  // changes. Empty cart short-circuits inside refresh().
  useEffect(() => {
    void coupon.refresh({
      subtotal: totals.subtotal,
      wilaya,
      items: lines.map((l: CartLineType) => ({
        product_id: l.product_id,
        unit_price: l.unit_price,
        quantity: l.qty,
      })),
    });
    // We deliberately depend on subtotal+lineCount+wilaya, not the
    // entire `lines` reference, so a re-render with same shape is a
    // no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.subtotal, totals.line_count, wilaya]);

  // Fire view_cart once per visit (lines.length > 0 only — empty cart = no signal).
  useEffect(() => {
    if (lines.length > 0) {
      void track('view_cart', { line_count: lines.length, unit_count: totals.unit_count });
    }
    // Intentionally only fires when the screen first sees a non-empty cart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived shipping + thresholds from the admin's mobile_cart_settings.
  const belowMin = cartConfig.min_order > 0 && totals.subtotal < cartConfig.min_order;
  // Phase 9.5 — bundle savings deduct from the subtotal BEFORE shipping
  // and BEFORE coupon math, so the user sees the correct shipping
  // threshold and coupon-on-top behaviour.
  const subtotalAfterBundle = totals.subtotal_after_bundle;
  const remainingForFreeDelivery =
    cartConfig.free_delivery_threshold != null && subtotalAfterBundle < cartConfig.free_delivery_threshold
      ? cartConfig.free_delivery_threshold - subtotalAfterBundle
      : 0;
  let shipping =
    cartConfig.free_delivery_threshold != null && subtotalAfterBundle >= cartConfig.free_delivery_threshold
      ? 0
      : cartConfig.default_delivery_price;
  // Free-shipping coupon zeroes shipping regardless of threshold.
  if (coupon.freeShipping) shipping = 0;
  const grandTotal = Math.max(0, subtotalAfterBundle + shipping - coupon.discount);
  const showWhatsAppButton =
    Boolean(whatsapp) && cartConfig.whatsapp_enabled && cartConfig.checkout_mode !== 'app';
  const showAppCheckout = cartConfig.checkout_mode !== 'whatsapp';

  const locale = i18n.language as 'fr' | 'ar' | 'en';

  // Phase Final — branded confirm dialog instead of OS Alert.
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const onClear = () => {
    if (lines.length === 0) return;
    setConfirmClearOpen(true);
  };
  const onClearConfirm = () => {
    setConfirmClearOpen(false);
    clear();
  };

  const onWhatsApp = async () => {
    if (!whatsapp) return;
    const message = buildCartMessage({
      lines: lines.map((l) => ({
        name: pickName(l, locale),
        mode: l.mode,
        qty: l.qty,
        unit_price: l.unit_price,
      })),
      total: totals.subtotal,
      currency: CURRENCY,
    });
    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('[cart] wa link failed', err);
    }
  };

  // ─── Empty state ───────────────────────────────────────────
  if (lines.length === 0) {
    return <EmptyCart onClear={onClear} t={t} textAlign={textAlign} rowDirection={rowDirection} router={router} />;
  }

  // ─── Filled state ──────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onClear={onClear} t={t} textAlign={textAlign} />

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {lines.map((line) => (
          <CartRow
            key={line.id}
            line={line}
            locale={locale}
            rowDirection={rowDirection}
            textAlign={textAlign}
            onChangeQty={(qty) => setQty(line.id, qty)}
            onRemove={() => remove(line.id)}
            t={t}
          />
        ))}
        {totals.is_mixed_mode ? (
          <View style={styles.mixedNotice}>
            <Ionicons name="information-circle" size={14} color={Brand.primary} />
            <Text style={[styles.mixedNoticeText, { textAlign }]}>
              {t('cart.mixed_mode_notice')}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
        {/* Auto-applied coupon banner — hidden when no eligible coupon. */}
        <AppliedCouponBanner />

        <View style={styles.summaryBox}>
          <View style={[styles.summaryRow, { flexDirection: rowDirection }]}>
            <Text style={[styles.summaryLabel, { textAlign }]}>{t('cart.summary_items')}</Text>
            <Text style={styles.summaryValue}>
              {totals.unit_count} ({totals.line_count})
            </Text>
          </View>
          <View style={[styles.summaryRow, { flexDirection: rowDirection }]}>
            <Text style={[styles.summaryLabel, { textAlign }]}>{t('cart.summary_subtotal')}</Text>
            <Text style={styles.summaryValue}>{formatPrice(totals.subtotal)}</Text>
          </View>
          {/* Phase 9.5 — one row per active bundle, accent-coloured to match the pack. */}
          {totals.bundles.map((b) => (
            <View key={b.pack_id} style={[styles.summaryRow, { flexDirection: rowDirection }]}>
              <Text
                style={[styles.summaryLabel, { textAlign, color: b.pack_accent_color ?? Brand.cta, flex: 1 }]}
                numberOfLines={1}
              >
                🎒 {b.pack_title ?? 'Pack'} -{Math.round(b.pack_discount_pct)}%
              </Text>
              <Text style={[styles.summaryValue, { color: b.pack_accent_color ?? Brand.cta }]}>
                -{formatPrice(b.savings)}
              </Text>
            </View>
          ))}
          {coupon.discount > 0 ? (
            <View style={[styles.summaryRow, { flexDirection: rowDirection }]}>
              <Text style={[styles.summaryLabel, { textAlign, color: Brand.cta }]}>
                {coupon.code ?? t('coupons.title')}
              </Text>
              <Text style={[styles.summaryValue, { color: Brand.cta }]}>
                -{formatPrice(coupon.discount)}
              </Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, { flexDirection: rowDirection }]}>
            <Text style={[styles.summaryLabel, { textAlign }]}>{t('cart.summary_shipping')}</Text>
            <Text style={[styles.summaryValue, shipping === 0 && { color: Brand.success }]}>
              {shipping === 0 ? t('cart.shipping_free') : formatPrice(shipping)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryGrandRow, { flexDirection: rowDirection }]}>
            <Text style={[styles.summaryLabel, styles.summaryGrandLabel, { textAlign }]}>
              {t('cart.summary_total')}
            </Text>
            <Text style={styles.summaryTotal}>{formatPrice(grandTotal)}</Text>
          </View>
        </View>

        {/* Loyalty earn preview — shows the points credited after checkout. */}
        {loyaltySettings.is_enabled && loyaltySettings.earn_rate_per_da > 0 && grandTotal > 0 ? (
          <View style={styles.earnPreview}>
            <View style={styles.earnPreviewIcon}>
              <Ionicons name="sparkles" size={14} color={Brand.cta} />
            </View>
            <Text style={[styles.earnPreviewText, { textAlign }]}>
              {t('cart.earn_preview', {
                defaultValue: 'Vous gagnerez {{points}} points VERKING avec cette commande.',
                points: Math.floor(grandTotal * loyaltySettings.earn_rate_per_da),
              })}
            </Text>
          </View>
        ) : null}

        {/* Free-delivery hint when the user is below the threshold. */}
        {remainingForFreeDelivery > 0 ? (
          <View style={styles.hintRow}>
            <Ionicons name="rocket-outline" size={14} color={Brand.primary} />
            <Text style={[styles.hintText, { textAlign }]}>
              {t('cart.free_delivery_hint', { amount: formatPrice(remainingForFreeDelivery) })}
            </Text>
          </View>
        ) : null}

        {/* Min order block — visible AND blocking when subtotal < min_order. */}
        {belowMin ? (
          <View style={[styles.hintRow, styles.hintBlocker]}>
            <Ionicons name="warning-outline" size={14} color={Brand.danger} />
            <Text style={[styles.hintText, { color: Brand.danger, textAlign }]}>
              {t('cart.min_order_hint', { amount: formatPrice(cartConfig.min_order) })}
            </Text>
          </View>
        ) : null}

        <View style={[styles.ctaRow, { flexDirection: rowDirection }]}>
          <Pressable
            style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.85 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={16} color={Brand.secondary} />
            <Text style={styles.secondaryCtaText}>{t('cart.continue_shopping')}</Text>
          </Pressable>
          {showAppCheckout ? (
            <Pressable
              disabled={belowMin}
              style={({ pressed }) => [
                styles.primaryCta,
                { flex: 1 },
                belowMin && styles.primaryCtaDisabled,
                pressed && !belowMin && { opacity: 0.92 },
              ]}
              onPress={() => {
                if (belowMin) return;
                void track('begin_checkout', {
                  subtotal: totals.subtotal,
                  shipping,
                  total: grandTotal,
                  unit_count: totals.unit_count,
                });
                router.push('/checkout');
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.primaryCtaText}>{t('cart.checkout_cta')}</Text>
            </Pressable>
          ) : null}
        </View>

        {showWhatsAppButton ? (
          <Pressable
            style={({ pressed }) => [styles.whatsappBtn, pressed && { opacity: 0.9 }]}
            onPress={() => {
              void track('wa_order', {
                subtotal: totals.subtotal,
                line_count: totals.line_count,
              });
              void onWhatsApp();
            }}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
            <Text style={styles.whatsappBtnText}>{t('cart.whatsapp_cta')}</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>

      {/* Phase Final — branded clear-cart confirmation. */}
      <BrandConfirmDialog
        visible={confirmClearOpen}
        title={t('cart.clear_confirm_title')}
        message={t('cart.clear_confirm_body')}
        confirmLabel={t('cart.clear_confirm')}
        destructive
        onConfirm={onClearConfirm}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Subcomponents ───────────────────────────────────────────

interface HeaderProps {
  onClear: () => void;
  disabled?: boolean;
  t: (key: string) => string;
  textAlign: 'left' | 'right' | 'center';
}

function Header({ onClear, disabled, t, textAlign }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { textAlign }]}>{t('cart.title')}</Text>
        <Text style={[styles.headerSub, { textAlign }]}>{t('cart.subtitle')}</Text>
      </View>
      <Pressable
        onPress={onClear}
        disabled={disabled}
        style={({ pressed }) => [
          styles.clearBtn,
          (disabled || pressed) && { opacity: 0.5 },
        ]}
        accessibilityLabel={t('cart.clear_action')}
      >
        <Ionicons name="trash-outline" size={18} color={Brand.danger} />
      </Pressable>
    </View>
  );
}

interface CartRowProps {
  line: CartLine;
  locale: 'fr' | 'ar' | 'en';
  rowDirection: 'row' | 'row-reverse';
  textAlign: 'left' | 'right' | 'center';
  onChangeQty: (qty: number) => void;
  onRemove: () => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
}

function CartRow({ line, locale, rowDirection, textAlign, onChangeQty, onRemove, t }: CartRowProps) {
  const name = pickName(line, locale);
  const lineTotal = line.qty * line.unit_price;
  const decreaseDisabled = line.qty <= line.min_qty;
  const increaseDisabled = line.stock_cap !== null && line.qty >= line.stock_cap;

  const modeColor = line.mode === 'gros' ? Brand.mint : Brand.cta;
  const modeLabel = line.mode === 'gros' ? t('modes.gros') : t('modes.detail');

  return (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <View style={styles.imageBox}>
        {line.image ? (
          <Image source={{ uri: line.image }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Text style={styles.imageFallbackLetter}>
              {(name?.[0] ?? 'V').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={[styles.rowTopLine, { flexDirection: rowDirection }]}>
          <View style={[styles.modePill, { backgroundColor: modeColor }]}>
            <Text style={styles.modePillText}>{modeLabel}</Text>
          </View>
          {line.pack_id && line.pack_title ? (
            <View style={[styles.packPill, { backgroundColor: (line.pack_accent_color ?? Brand.cta) + '22' }]}>
              <Text style={styles.packPillEmoji}>🎒</Text>
              <Text
                style={[styles.packPillText, { color: line.pack_accent_color ?? Brand.cta }]}
                numberOfLines={1}
              >
                {line.pack_title}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            accessibilityLabel={t('cart.remove_line')}
          >
            <Ionicons name="close" size={16} color={Brand.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.rowName, { textAlign }]} numberOfLines={2}>
          {name}
        </Text>

        <View style={[styles.rowFoot, { flexDirection: rowDirection }]}>
          <View style={[styles.stepper, { flexDirection: rowDirection }]}>
            <Pressable
              disabled={decreaseDisabled}
              onPress={() => onChangeQty(line.qty - 1)}
              style={[styles.stepBtn, decreaseDisabled && styles.stepBtnDisabled]}
              accessibilityLabel={t('cart.qty_decrease')}
            >
              <Ionicons
                name="remove"
                size={14}
                color={decreaseDisabled ? Brand.textSubtle : Brand.secondary}
              />
            </Pressable>
            <Text style={styles.stepValue}>{line.qty}</Text>
            <Pressable
              disabled={increaseDisabled}
              onPress={() => onChangeQty(line.qty + 1)}
              style={[styles.stepBtn, increaseDisabled && styles.stepBtnDisabled]}
              accessibilityLabel={t('cart.qty_increase')}
            >
              <Ionicons
                name="add"
                size={14}
                color={increaseDisabled ? Brand.textSubtle : Brand.secondary}
              />
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.rowPrice}>{formatPrice(lineTotal)}</Text>
        </View>

        {line.stock_cap !== null && line.qty >= line.stock_cap ? (
          <Text style={[styles.rowHint, { textAlign }]}>
            {t('cart.stock_cap_hint', { max: line.stock_cap })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Empty cart screen — premium VERKING identity ─────────────
function EmptyCart({
  onClear, t, textAlign, rowDirection, router,
}: {
  onClear: () => void;
  t: (key: string) => string;
  textAlign: 'left' | 'right' | 'center';
  rowDirection: 'row' | 'row-reverse';
  router: ReturnType<typeof useRouter>;
}) {
  const { effectiveCode, wilaya } = useDefaultWilaya();
  const isRtl = rowDirection === 'row-reverse';
  const wilayaShort = wilaya
    ? `${effectiveCode} ${isRtl ? wilaya.name_ar : wilaya.name_fr}`
    : effectiveCode;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.emptyHeader, { flexDirection: rowDirection }]}>
        <Text style={[styles.emptyHeaderTitle, { textAlign }]}>
          {t('cart.title')} (0)
        </Text>
        <View style={[styles.emptyHeaderRight, { flexDirection: rowDirection }]}>
          <View style={[styles.emptyWilayaPill, { flexDirection: rowDirection }]}>
            <Ionicons name="location-sharp" size={11} color={Brand.primary} />
            <Text style={styles.emptyWilayaText} numberOfLines={1}>{wilayaShort}</Text>
          </View>
          <Pressable hitSlop={8} style={styles.emptyHeaderIconBtn}>
            <Ionicons name="heart-outline" size={18} color={Brand.secondary} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.emptyHeaderIconBtn} onPress={onClear}>
            <Ionicons name="trash-outline" size={18} color={Brand.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.emptyScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* VERKING brand illustration — wallpaper at the soft variant
            so the wordmark + school decorations carry the empty state. */}
        <BrandWallpaper variant="soft" style={styles.emptyIllustrationLg} />

        <Text style={[styles.emptyTitleLg, { textAlign }]}>
          {t('cart_empty.title')}
        </Text>
        <Text style={[styles.emptySubLg, { textAlign }]}>
          {t('cart_empty.subtitle')}
        </Text>

        {/* 2 CTAs */}
        <View style={styles.emptyCtaStack}>
          <Pressable
            style={({ pressed }) => [styles.primaryCta, pressed && { opacity: 0.92 }]}
            onPress={() => router.replace('/(tabs)/explore')}
          >
            <Ionicons name="storefront-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryCtaText}>{t('cart_empty.cta_browse')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.emptySecondaryCta, pressed && { opacity: 0.85 }]}
            onPress={() => router.replace('/(tabs)/explore')}
          >
            <Ionicons name="pricetags-outline" size={16} color={Brand.primary} />
            <Text style={styles.emptySecondaryCtaText}>{t('cart_empty.cta_offers')}</Text>
          </Pressable>
        </View>

        {/* Trust strip — admin-driven via Gestionnaire Mobile › Panier */}
        <View style={styles.trustGrid}>
          <TrustStrip />
        </View>
      </ScrollView>

      {/* Sticky bottom checkout bar — disabled on empty */}
      <View style={styles.emptyFooter}>
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyFooterLabel}>{t('cart.summary_total')}</Text>
          <Text style={styles.emptyFooterTotal}>{formatPrice(0)}</Text>
        </View>
        <View style={[styles.primaryCta, styles.primaryCtaDisabled, { paddingHorizontal: 20 }]}>
          <Ionicons name="lock-closed" size={14} color={Brand.textSubtle} />
          <Text style={[styles.primaryCtaText, { color: Brand.textSubtle }]}>
            {t('cart.checkout_cta')}
          </Text>
        </View>
      </View>

    </SafeAreaView>
  );
}

function pickName(line: CartLine, locale: 'fr' | 'ar' | 'en'): string {
  if (locale === 'ar') return line.name_ar || line.name_fr;
  if (locale === 'en') return line.name_en || line.name_fr;
  return line.name_fr;
}

// Helper used internally — `pickLocalized` is imported to keep the same
// helper available if a future locale is added; we currently use the
// inline pickName for clearer fallback rules.
void pickLocalized;

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 22,
    color: Brand.secondary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: BrandFont.medium,
    color: Brand.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Brand.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  row: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  imageBox: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Brand.primaryTint,
  },
  image: { width: '100%', height: '100%' },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primaryTint,
  },
  imageFallbackLetter: {
    fontFamily: BrandFont.extrabold,
    fontSize: 32,
    color: Brand.primary,
    fontWeight: '900',
  },

  rowBody: { flex: 1, gap: 4, justifyContent: 'space-between' },
  rowTopLine: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  modePillText: {
    color: '#FFFFFF',
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  packPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    flexShrink: 1,
    maxWidth: '60%',
  },
  packPillEmoji: { fontSize: 10 },
  packPillText: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.2,
  },
  rowName: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 13,
    color: Brand.text,
    lineHeight: 17,
  },
  rowFoot: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  rowPrice: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    color: Brand.cta,
    fontSize: 15,
  },
  rowHint: {
    color: Brand.warning,
    fontSize: 11,
    fontFamily: BrandFont.semibold,
    fontWeight: '600',
  },

  stepper: {
    backgroundColor: Brand.surfaceMuted,
    borderRadius: 999,
    padding: 2,
    alignItems: 'center',
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  stepBtnDisabled: { opacity: 0.5 },
  stepValue: {
    paddingHorizontal: 10,
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    color: Brand.secondary,
    fontSize: 13,
    minWidth: 22,
    textAlign: 'center',
  },

  mixedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Brand.primaryTint,
    borderRadius: Radius.md,
  },
  mixedNoticeText: {
    flex: 1,
    color: Brand.secondary,
    fontFamily: BrandFont.semibold,
    fontWeight: '600',
    fontSize: 12,
  },

  footerSafe: {
    backgroundColor: Brand.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    shadowColor: Brand.shadowDeep,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
  },
  summaryBox: {
    backgroundColor: Brand.surfaceMuted,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    gap: 4,
  },
  summaryRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: Brand.textMuted,
    fontFamily: BrandFont.semibold,
    fontWeight: '600',
    fontSize: 13,
  },
  summaryValue: {
    fontFamily: BrandFont.bold,
    fontWeight: '700',
    color: Brand.secondary,
    fontSize: 13,
  },
  summaryTotal: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    color: Brand.cta,
    fontSize: 18,
  },

  ctaRow: { gap: Spacing.sm, alignItems: 'stretch' },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surfaceMuted,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  secondaryCtaText: {
    color: Brand.secondary,
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 13,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Brand.cta,
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryCtaDisabled: {
    backgroundColor: Brand.surfaceContainerHigh,
    shadowOpacity: 0,
  },
  summaryGrandRow: {
    marginTop: 4,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
  },
  summaryGrandLabel: { color: Brand.secondary, fontWeight: '900' },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Brand.primaryTint,
    borderRadius: Radius.md,
  },
  hintBlocker: { backgroundColor: Brand.dangerSoft },

  earnPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: Brand.ctaSoft,
    borderRadius: Radius.md,
    marginTop: 6,
  },
  earnPreviewIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  earnPreviewText: {
    flex: 1, fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 11, color: Brand.cta,
  },

  hintText: {
    flex: 1,
    color: Brand.secondary,
    fontFamily: BrandFont.semibold,
    fontWeight: '600',
    fontSize: 12,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 14,
  },

  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    backgroundColor: '#25D366',
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 13,
  },

  emptyWrap: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyIllustration: {
    width: 220,
    height: 180,
    borderRadius: Radius.xxl,
    backgroundColor: Brand.primaryTint,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.shadowBlue,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  emptyTitle: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 20,
    color: Brand.secondary,
  },
  emptySub: {
    fontFamily: BrandFont.medium,
    color: Brand.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  // ─── Premium empty cart screen ─────────────────────────────
  emptyHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyHeaderTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 22, color: Brand.secondary, letterSpacing: -0.3,
    flex: 1,
  },
  emptyHeaderRight: { gap: 6, alignItems: 'center' },
  emptyWilayaPill: {
    backgroundColor: Brand.primaryTint,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, alignItems: 'center', gap: 3,
    maxWidth: 140,
  },
  emptyWilayaText: { color: Brand.primary, fontWeight: '900', fontSize: 11, letterSpacing: 0.2 },
  emptyHeaderIconBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Brand.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyScroll: { padding: Spacing.lg, paddingBottom: 120, alignItems: 'center', gap: Spacing.md },
  emptyIllustrationLg: {
    width: 240, height: 200,
    borderRadius: Radius.xxl,
    backgroundColor: Brand.primaryTint,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  emptyIconStack: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 0,
  },
  emptyIconBubble: {
    width: 84, height: 84, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadowDeep, shadowOpacity: 1,
    shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  emptyTitleLg: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 22, color: Brand.secondary, letterSpacing: -0.3,
    marginTop: Spacing.md,
  },
  emptySubLg: {
    fontFamily: BrandFont.medium, color: Brand.textMuted,
    fontSize: 14, lineHeight: 19,
    textAlign: 'center', paddingHorizontal: Spacing.md,
  },
  emptyCtaStack: { gap: Spacing.sm, alignSelf: 'stretch', marginTop: Spacing.sm },
  emptySecondaryCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primaryTint,
    borderWidth: 1, borderColor: Brand.primary + '33',
  },
  emptySecondaryCtaText: {
    color: Brand.primary, fontFamily: BrandFont.bold,
    fontWeight: '900', fontSize: 14,
  },
  trustGrid: {
    alignSelf: 'stretch', marginTop: Spacing.md,
  },
  emptyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    shadowColor: Brand.shadowDeep, shadowOpacity: 1,
    shadowRadius: 20, shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  emptyFooterLabel: { color: Brand.textMuted, fontSize: 11, fontWeight: '700' },
  emptyFooterTotal: { color: Brand.secondary, fontFamily: BrandFont.extrabold, fontSize: 18, fontWeight: '900' },
});
