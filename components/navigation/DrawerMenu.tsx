/**
 * DrawerMenu — premium side drawer for VERKING.
 *
 * Anatomy:
 *   • Backdrop (black, fades 0 → 0.6) — taps close the drawer.
 *   • Sheet (85% width, gradient navy, rounded inner corners)
 *       ▸ Header card (avatar + name + tier + points)
 *       ▸ Quick-access primary nav (7 items)
 *       ▸ Order tracking + themed pages (2 items)
 *       ▸ Support row (5 items: WhatsApp / Phone / About / FAQ / Settings)
 *       ▸ Theme toggle (Light / Dark / AMOLED) + Language toggle
 *       ▸ GlowingCredit footer
 *
 * Animation:
 *   • Open: sheet slides in from edge (RTL → right, LTR → left), 280ms
 *     spring; backdrop fades in
 *   • Close: reverse + light haptic
 *   • Pan-to-close: edge drag dismisses
 *
 * Routing safety:
 *   Every menu item resolves to a route that already exists OR a
 *   safe fallback (e.g. /shop for "Catégories"). On press → close
 *   drawer first then router.push (avoids the brief flicker of two
 *   stacked screens).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { useTheme, useThemedBrand } from '@/lib/theme/ThemeContext';
import { useDrawer } from '@/components/navigation/DrawerProvider';
import { GlowingCredit } from '@/components/navigation/GlowingCredit';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useMyProfile } from '@/services/profile';
import { useDefaultWilaya } from '@/services/mobileConfig';
import { useLoyaltyAccount, useLoyaltyLevels, findCurrentTier } from '@/services/loyalty';
import { useRegistrationStatus } from '@/services/registration';
import { useSchoolProfile } from '@/services/school';
import { openWhatsApp, openPhone, openEmail } from '@/services/contact';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.86, 360);
const SWIPE_DISMISS_THRESHOLD = DRAWER_W * 0.35;

interface MenuItem {
  emoji: string;
  label: string;
  href?: string;
  onPress?: () => void;
  badge?: string | null;
  tint?: string;
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
}

export function DrawerMenu() {
  const { isOpen, close } = useDrawer();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { rowDirection } = useDirection();
  const isRtl = rowDirection === 'row-reverse';
  const isAr = i18n.language === 'ar';

  const { account: loyalty } = useLoyaltyAccount();
  const loyaltyLevels = useLoyaltyLevels();
  const tier = findCurrentTier(loyaltyLevels, loyalty?.lifetime_points ?? 0);
  const { profile: school } = useSchoolProfile();
  const { wilaya } = useDefaultWilaya();
  const themed = useThemedBrand();
  const { preference: themeMode, setPreference: setThemeMode } = useTheme();
  const { status: regStatus } = useRegistrationStatus();
  // Phase 4.4 — pull the avatar so the drawer header shows a real
  // image when the user has uploaded one.
  const { profile: myProfile } = useMyProfile();

  // ─── Animation state ───────────────────────────────────────────────
  // open: 0 (closed) → 1 (open). Direction picked by `isRtl`: from
  // right in RTL, from left in LTR.
  const open = useSharedValue(0);

  useEffect(() => {
    // Phase 4.6 — tighter spring (stiffness 280) and slightly lower
    // damping ratio for a snappier-but-still-elegant slide. The
    // previous values felt sluggish on low-end Android because the
    // overshoot bounce was too pronounced and the close animation
    // crossed 400 ms.
    open.value = withSpring(isOpen ? 1 : 0, {
      damping: 22,
      stiffness: 280,
      mass: 1,
    });
  }, [isOpen, open]);

  const closeWithHaptic = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    close();
  };

  // Pan gesture — drag the sheet toward its hidden edge to close.
  const dragX = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetX(isRtl ? 12 : -12)   // start tracking on a slight intent
    .onUpdate((evt) => {
      'worklet';
      // RTL: positive translationX moves the sheet rightward (offscreen).
      const dx = isRtl ? Math.max(0, evt.translationX) : Math.min(0, evt.translationX);
      dragX.value = dx;
    })
    .onEnd(() => {
      'worklet';
      const traveled = Math.abs(dragX.value);
      if (traveled > SWIPE_DISMISS_THRESHOLD) {
        dragX.value = withTiming(isRtl ? DRAWER_W : -DRAWER_W, { duration: 200 }, () => {
          dragX.value = 0;
          runOnJS(closeWithHaptic)();
        });
      } else {
        dragX.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  // ─── Animated styles ───────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: open.value * 0.6,
  }));

  // CRITICAL: when the drawer is "closed" we translate it past the
  // visible edge by DRAWER_W. But the sheet has shadowRadius:30 +
  // elevation:24 — the shadow halo extends ~30 px BEYOND the sheet's
  // bounds and bleeds back INTO the visible viewport, producing a faint
  // dark sliver / vertical strip on the screen edge that users
  // (correctly) read as "drawer is partially visible". Two fixes
  // combined here:
  //   1. Add `SHADOW_BUFFER` to the offscreen translation so the
  //      shadow halo is also outside the viewport.
  //   2. Drive `shadowOpacity` from `open.value` so when fully closed
  //      the shadow contributes literally zero pixels.
  const SHADOW_BUFFER = 60;
  const sheetStyle = useAnimatedStyle(() => {
    const slidePx = interpolate(open.value, [0, 1], [DRAWER_W + SHADOW_BUFFER, 0]);
    const dirSign = isRtl ? 1 : -1;
    return {
      transform: [
        { translateX: dirSign * slidePx + dragX.value },
      ],
      // Scale the shadow with the open state so a closed drawer
      // contributes literally no visual halo.
      shadowOpacity: open.value,
    };
  });

  // ─── Menu sections ─────────────────────────────────────────────────
  const onItemPress = (item: MenuItem) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    close();
    // Defer navigation by a tick so the close animation is visible.
    setTimeout(() => {
      if (item.onPress) item.onPress();
      else if (item.href) router.push(item.href as never);
    }, 80);
  };

  const sections: MenuSection[] = useMemo(() => [
    // Conditional sign-up CTA — only when the device is still a guest.
    ...(!regStatus.is_registered ? [{
      title: t('drawer.section.signup', { defaultValue: 'انضمّ إلينا' }),
      items: [
        { emoji: '🎁', label: t('drawer.signup', { defaultValue: 'سجّل واربح 500 نقطة' }), href: '/register' as string,
          tint: '#FF7A1A', badge: 'NEW' },
      ],
    } as MenuSection] : []),
    {
      title: t('drawer.section.shop', { defaultValue: 'Boutique' }),
      items: [
        { emoji: '🏠', label: t('drawer.home',     { defaultValue: 'Accueil' }),       href: '/(tabs)' },
        { emoji: '🛍️', label: t('drawer.shop',     { defaultValue: 'Boutique' }),     href: '/(tabs)/explore' },
        { emoji: '📂', label: t('drawer.cats',     { defaultValue: 'Catégories' }),   href: '/(tabs)/explore' },
        { emoji: '⭐', label: t('drawer.loyalty',  { defaultValue: 'Étoiles VERKING' }), href: '/loyalty' },
        { emoji: '❤️', label: t('drawer.wishlist', { defaultValue: 'Favoris' }),       href: '/wishlist' },
        { emoji: '🎒', label: t('drawer.packs',    { defaultValue: 'Packs Classe' }), href: '/packs' },
        { emoji: '🔥', label: t('drawer.promos',   { defaultValue: 'Promotions' }),   href: '/coupons' },
      ],
    },
    {
      title: t('drawer.section.orders', { defaultValue: 'Commandes' }),
      items: [
        { emoji: '🚚', label: t('drawer.tracking', { defaultValue: 'Suivi commande' }), href: '/(tabs)/orders' },
        { emoji: '📑', label: t('drawer.themed',   { defaultValue: 'Pages thématiques' }), href: '/(tabs)/explore' },
      ],
    },
    {
      title: t('drawer.section.help', { defaultValue: 'Support' }),
      items: [
        { emoji: '💬', label: t('drawer.whatsapp', { defaultValue: 'WhatsApp Support' }),
          onPress: () => { void openWhatsApp(); } },
        { emoji: '📞', label: t('drawer.contact',  { defaultValue: 'إتصل بنا' }),
          onPress: () => { void openPhone(); } },
        { emoji: '📧', label: t('drawer.email',    { defaultValue: 'Email' }),
          onPress: () => { void openEmail(); } },
        { emoji: 'ℹ️', label: t('drawer.about',    { defaultValue: 'À propos' }),     href: '/about' },
        { emoji: '❓', label: t('drawer.faq',      { defaultValue: 'Aide & FAQ' }),    href: '/page/faq' },
        { emoji: '⚙️', label: t('drawer.settings', { defaultValue: 'Paramètres' }),    href: '/settings' },
      ],
    },
  ], [t, regStatus.is_registered]);

  // ─── Render ─────────────────────────────────────────────────────────
  // Always render so close animations can play out; pointerEvents below
  // turns the whole tree non-interactive when closed.
  // `overflow: 'hidden'` on the root wrapper clips any out-of-viewport
  // bleed from the sheet (Android/Web shadow halos, gesture handler
  // wrapper artefacts). iOS shadows aren't clipped by overflow, but
  // that's already handled by SHADOW_BUFFER + animated shadowOpacity.
  return (
    <View
      pointerEvents={isOpen ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithHaptic} />
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            isRtl ? styles.sheetRight : styles.sheetLeft,
            { backgroundColor: themed.secondary || Brand.secondary },
            sheetStyle,
          ]}
          pointerEvents="box-none"
        >
          {/* Decorative blobs */}
          <View style={[styles.blobOne, { backgroundColor: 'rgba(255,122,26,0.32)' }]} />
          <View style={[styles.blobTwo, { backgroundColor: 'rgba(67,217,219,0.22)' }]} />

          <ScrollView
            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 8 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header card */}
            <View style={styles.header}>
              <UserAvatar
                size={56}
                uri={myProfile.avatar_url}
                fallbackText={school?.parent_name || school?.student_name || regStatus.name}
                bordered
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.helloText}>
                  {t('drawer.hello', { defaultValue: 'Bonjour 👋' })}
                </Text>
                <Text style={styles.headerName} numberOfLines={1}>
                  {school?.parent_name || school?.student_name || 'VERKING Member'}
                </Text>
                <View style={styles.headerChips}>
                  {tier ? (
                    <View style={[styles.headerChip, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                      <Ionicons name="star" size={11} color="#fff" />
                      <Text style={styles.headerChipText}>{tier.name_fr ?? 'Bronze'}</Text>
                    </View>
                  ) : null}
                  {wilaya ? (
                    <View style={[styles.headerChip, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                      <Ionicons name="location" size={11} color="#fff" />
                      <Text style={styles.headerChipText} numberOfLines={1}>
                        {isAr ? wilaya.name_ar : wilaya.name_fr}
                      </Text>
                    </View>
                  ) : null}
                  {(loyalty?.balance_points ?? 0) > 0 ? (
                    <View style={[styles.headerChip, { backgroundColor: 'rgba(255,201,60,0.28)' }]}>
                      <Text style={styles.starEmoji}>⭐</Text>
                      <Text style={styles.headerChipText}>
                        {loyalty?.balance_points} pts
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Sections */}
            {sections.map((section, sIdx) => (
              <View key={section.title ?? sIdx} style={styles.section}>
                {section.title ? (
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                ) : null}
                {section.items.map((item) => (
                  <DrawerItem
                    key={`${section.title}-${item.label}`}
                    item={item}
                    onPress={() => onItemPress(item)}
                  />
                ))}
              </View>
            ))}

            {/* Theme + language */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('drawer.section.appearance', { defaultValue: 'Apparence' })}
              </Text>
              <View style={styles.modeRow}>
                {(['light', 'dark', 'amoled', 'system'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                      setThemeMode(mode);
                    }}
                    style={[
                      styles.modePill,
                      themeMode === mode && styles.modePillActive,
                    ]}
                  >
                    <Text style={styles.modeEmoji}>
                      {mode === 'light' ? '☀️' : mode === 'dark' ? '🌙' : mode === 'amoled' ? '⚫' : '🤖'}
                    </Text>
                    <Text style={[styles.modeLabel, themeMode === mode && { color: '#fff' }]}>
                      {mode === 'light' ? 'Clair'
                        : mode === 'dark' ? 'Sombre'
                        : mode === 'amoled' ? 'AMOLED'
                        : 'Auto'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                  void i18n.changeLanguage(isAr ? 'fr' : 'ar');
                }}
                style={styles.langRow}
              >
                <Text style={styles.langEmoji}>🌐</Text>
                <Text style={styles.langLabel}>
                  {isAr ? 'Français' : 'العربية'}
                </Text>
                <Ionicons name="swap-horizontal" size={16} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

            {/* Glowing footer credit */}
            <GlowingCredit />
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface DrawerItemProps {
  item: MenuItem;
  onPress: () => void;
}
function DrawerItem({ item, onPress }: DrawerItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.itemRow,
        pressed && { backgroundColor: 'rgba(255,255,255,0.08)' },
      ]}
    >
      <Text style={styles.itemEmoji}>{item.emoji}</Text>
      <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
      {item.badge ? (
        <View style={styles.itemBadge}>
          <Text style={styles.itemBadgeText}>{item.badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.45)" />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: DRAWER_W,
    overflow: 'hidden',
    shadowColor: '#000',
    // shadowOpacity is driven by `open.value` via useAnimatedStyle so a
    // closed drawer leaves zero shadow halo in the visible viewport.
    shadowOpacity: 0,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  sheetLeft:  { left:  0, borderTopRightRadius: 28, borderBottomRightRadius: 28 },
  sheetRight: { right: 0, borderTopLeftRadius:  28, borderBottomLeftRadius:  28 },

  blobOne: {
    position: 'absolute', top: -80, right: -60,
    width: 240, height: 240, borderRadius: 999,
  },
  blobTwo: {
    position: 'absolute', bottom: -100, left: -60,
    width: 260, height: 260, borderRadius: 999,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.lg,
    zIndex: 2,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Brand.cta,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {
    color: '#fff', fontFamily: BrandFont.extrabold,
    fontWeight: '900', fontSize: 22,
  },
  helloText: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 12, letterSpacing: 0.4,
  },
  headerName: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold,
    fontWeight: '900', fontSize: 18, letterSpacing: 0.3,
    marginTop: 2,
  },
  headerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  headerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  headerChipText: {
    color: '#fff', fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 10, letterSpacing: 0.3,
  },
  starEmoji: { fontSize: 11 },

  section: {
    paddingHorizontal: Spacing.sm, paddingTop: 8, paddingBottom: 4,
    zIndex: 2,
  },
  sectionTitle: {
    fontFamily: BrandFont.bold, fontWeight: '900',
    fontSize: 11, color: 'rgba(255,255,255,0.55)',
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
    borderRadius: Radius.md,
  },
  itemEmoji: { fontSize: 18, width: 22, textAlign: 'center' },
  itemLabel: {
    flex: 1,
    fontFamily: BrandFont.semibold, fontWeight: '700',
    fontSize: 14, color: '#fff', letterSpacing: 0.2,
  },
  itemBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, backgroundColor: Brand.coral,
    minWidth: 22, alignItems: 'center',
  },
  itemBadgeText: {
    color: '#fff', fontFamily: BrandFont.extrabold,
    fontWeight: '900', fontSize: 10,
  },

  modeRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: Spacing.sm, paddingTop: 4,
  },
  modePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  modePillActive: {
    backgroundColor: Brand.cta,
    borderColor: Brand.ctaDeep,
  },
  modeEmoji: { fontSize: 14 },
  modeLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 11, letterSpacing: 0.3,
  },

  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: Spacing.sm, marginHorizontal: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  langEmoji: { fontSize: 18 },
  langLabel: {
    flex: 1,
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 14, color: '#fff',
  },
});

export default DrawerMenu;
