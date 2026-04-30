/**
 * Profile / Mon compte tab — Phase 13 premium redesign.
 *
 * 7 sections (top → bottom):
 *   1. Hero card — gradient by tier + avatar + name + 🔥 streak
 *   2. MembershipCard — credit-card style loyalty with progress
 *   3. Quick Stats Row — 5 horizontal cards (Orders / Points /
 *      Coupons / Favoris / Streak)
 *   4. Action Grid 2×3 — Pack / Notifs / Adresses / Wilaya / Langue /
 *      Paramètres
 *   5. School Banner — only when the user has a school profile set
 *   6. Footer Actions — About / FAQ / WhatsApp / Conditions
 *   7. Logout — separated, red-tinted
 *
 * All counts read from live services (orders local, points loyalty,
 * coupons supabase, favoris wishlist, streak streaks). Animations:
 * spring on press, count-up on the streak number, soft shadows.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MicroConfetti } from '@/components/decorative/MicroConfetti';
import { HamburgerButton } from '@/components/navigation/HamburgerButton';
import { SignupPromptBanner } from '@/components/registration/SignupPromptBanner';
import { MembershipCard } from '@/components/storefront/MembershipCard';
import { SchoolLevelPicker } from '@/components/storefront/SchoolLevelPicker';
import { BrandConfirmDialog } from '@/components/ui/BrandConfirmDialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useMyProfile } from '@/services/profile';
import { useRegistrationStatus } from '@/services/registration';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useBottomContentClearance } from '@/constants/layout';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useDirection } from '@/i18n/useDirection';
import { getDeviceId } from '@/lib/deviceId';
import { useThemedBrand } from '@/lib/theme/ThemeContext';
import {
  findCurrentTier,
  findNextTier,
  useLoyaltyAccount,
  useLoyaltyLevels,
} from '@/services/loyalty';
import { useDefaultWilaya } from '@/services/mobileConfig';
import { getLocalOrders, type LocalOrderEntry } from '@/services/orderHistory';
import { useMyTopicCount } from '@/services/push';
import { useSchoolLevels, useSchoolProfile, type SchoolLevel } from '@/services/school';
import { useStreak } from '@/services/streaks';
import { openEmail, openPhone, openWhatsApp } from '@/services/contact';
import { useMyCoupons } from '@/services/coupons';
import { useWishlistCount } from '@/services/wishlist';

// Phase 1.4 — bottom clearance moved to `constants/layout` so the
// FAB pill and the last action tile stop fighting over the same
// 40 px strip above the tab bar.

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const themed = useThemedBrand();
  const isAr = i18n.language === 'ar';

  const { profile: schoolProfile } = useSchoolProfile();
  const schoolLevels = useSchoolLevels();
  const currentLevel = useMemo<SchoolLevel | null>(
    () => schoolLevels.find((l) => l.level_key === schoolProfile?.level_key) ?? null,
    [schoolLevels, schoolProfile?.level_key],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orders, setOrders] = useState<LocalOrderEntry[]>([]);

  const { wilaya: defaultWilaya } = useDefaultWilaya();
  const wishlistCount = useWishlistCount();
  const notifCount = useMyTopicCount();
  const { wallet: claimedCoupons } = useMyCoupons();
  const { account: loyaltyAccount } = useLoyaltyAccount();
  const loyaltyLevels = useLoyaltyLevels();

  const [confetti, setConfetti] = useState(false);
  const { streak } = useStreak({
    onMilestone: () => setConfetti(true),
  });
  const { status: regStatus } = useRegistrationStatus();
  // Phase 4.4 — pull the full profile so the Hero card can show the
  // user's avatar + bio without going through 3 different hooks.
  const { profile: myProfile } = useMyProfile();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const lifetime = loyaltyAccount?.lifetime_points ?? 0;
  const currentTier = findCurrentTier(loyaltyLevels, lifetime);
  const nextTier = findNextTier(loyaltyLevels, lifetime);

  const [cardSuffix, setCardSuffix] = useState('••••');
  useEffect(() => {
    void getDeviceId().then((id) => {
      setCardSuffix(id.slice(-4).toUpperCase());
    });
  }, []);

  useEffect(() => {
    void getLocalOrders().then(setOrders);
  }, []);

  // Phase 16.4 — pull-to-refresh + auto-refresh on tab focus (>30 s stale).
  const { refreshing, onRefresh } = usePullRefresh();
  useRefreshOnFocus();
  // Phase 1.4 — reserves room for tab bar AND the floating PromoFab pill
  // above it, so the last action tile is always reachable.
  const bottomClearance = useBottomContentClearance();

  const greeting = computeGreeting(t);
  const memberName = pickName(schoolProfile?.parent_name, schoolProfile?.student_name) ?? null;

  // ─── Press helpers ───────────────────────────────────────────────────
  const tap = () => Platform.OS !== 'web' && Haptics.selectionAsync().catch(() => {});

  // Phase 4.5 — branded confirm dialog instead of `Alert.alert([yes, no])`.
  // Logout itself remains local (the marketplace is still device-id-
  // based; full account auth lands later) but the UX now matches the
  // brand instead of using the OS prompt.
  const onLogoutTap = () => setLogoutOpen(true);
  const onLogoutConfirm = async () => {
    setLogoutOpen(false);
    try {
      const { safeStorage } = await import('@/lib/storage');
      await safeStorage.removeItem('vk:cart');
      await safeStorage.removeItem('vk:default_wilaya');
      await safeStorage.removeItem('vk:wishlist');
    } catch {
      /* noop — storage is best-effort here */
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themed.background }]} edges={['top']}>
      <MicroConfetti visible={confetti} onDone={() => setConfetti(false)} />
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
        {/* ─── 0. Signup prompt (guest only) ───────────────────────────── */}
        {!regStatus.is_registered ? <SignupPromptBanner /> : null}

        {/* ─── 1. Hero card ────────────────────────────────────────────── */}
        <HeroCard
          greeting={greeting}
          name={memberName ?? t('profile.guest', { defaultValue: 'Bienvenue 👋' })}
          tierName={currentTier?.name_fr ?? 'Bronze'}
          tierIcon="star"
          streakDays={streak.consecutive_days}
          avatarUri={myProfile.avatar_url}
          onPressAvatar={() => { tap(); router.push('/profile/edit' as never); }}
          onPressNotifs={() => { tap(); router.push('/notifications'); }}
          onPressSettings={() => { tap(); router.push('/settings'); }}
          textAlign={textAlign}
          rowDirection={rowDirection}
        />

        {/* ─── 2. Membership Card ─────────────────────────────────────── */}
        <View style={{ marginTop: Spacing.md }}>
          <MembershipCard
            account={loyaltyAccount}
            currentTier={currentTier}
            nextTier={nextTier}
            cardSuffix={cardSuffix}
            memberName={memberName ?? 'VERKING MEMBER'}
            onPress={() => { tap(); router.push('/loyalty'); }}
          />
        </View>

        {/* ─── 3. Quick Stats Row ─────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
          style={{ marginTop: Spacing.md }}
        >
          <StatCard
            emoji="📦"
            color={Brand.primary}
            value={orders.length}
            label={t('profile.stats.orders', { defaultValue: 'Commandes' })}
            onPress={() => router.push('/(tabs)/orders' as never)}
          />
          <StatCard
            emoji="⭐"
            color={Brand.cta}
            value={loyaltyAccount?.balance_points ?? 0}
            label={t('profile.stats.points', { defaultValue: 'Points' })}
            onPress={() => router.push('/loyalty')}
          />
          <StatCard
            emoji="💝"
            color={Brand.coral}
            value={claimedCoupons.length}
            label={t('profile.stats.coupons', { defaultValue: 'Coupons' })}
            onPress={() => router.push('/coupons')}
          />
          <StatCard
            emoji="❤️"
            color={Brand.lavender}
            value={wishlistCount}
            label={t('profile.stats.wishlist', { defaultValue: 'Favoris' })}
            onPress={() => router.push('/wishlist')}
          />
          <StatCard
            emoji="🔥"
            color={Brand.sunshine}
            value={streak.consecutive_days}
            label={t('profile.stats.streak', { defaultValue: 'Jours' })}
            onPress={() => { /* no-op — already on profile */ }}
          />
        </ScrollView>

        {/* ─── 4. Action Grid 2×3 ─────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { textAlign, color: themed.text }]}>
          {t('profile.actions_title', { defaultValue: 'Actions rapides' })}
        </Text>
        <View style={styles.actionGrid}>
          <ActionTile
            emoji="🎒"
            label={t('profile.action.packs', { defaultValue: 'Packs Classe' })}
            tint={Brand.fresh}
            onPress={() => { tap(); router.push('/packs'); }}
          />
          <ActionTile
            emoji="📲"
            label={t('profile.action.notifs', { defaultValue: 'Notifications' })}
            tint={Brand.primary}
            badge={notifCount > 0 ? String(notifCount) : null}
            onPress={() => { tap(); router.push('/notifications'); }}
          />
          <ActionTile
            emoji="📍"
            label={t('profile.action.addresses', { defaultValue: 'Adresses' })}
            tint={Brand.coral}
            onPress={() => { tap(); router.push('/settings'); }}
          />
          <ActionTile
            emoji="🌍"
            label={defaultWilaya ? `${isAr ? defaultWilaya.name_ar : defaultWilaya.name_fr}` : t('profile.action.wilaya', { defaultValue: 'Wilaya' })}
            tint={Brand.mint}
            onPress={() => { tap(); router.push('/settings'); }}
          />
          <ActionTile
            emoji="🌐"
            label={isAr ? 'Français' : 'العربية'}
            tint={Brand.lavender}
            onPress={() => {
              tap();
              void i18n.changeLanguage(isAr ? 'fr' : 'ar');
            }}
          />
          <ActionTile
            emoji="⚙️"
            label={t('profile.action.settings', { defaultValue: 'Paramètres' })}
            tint={Brand.secondary}
            onPress={() => { tap(); router.push('/settings'); }}
          />
        </View>

        {/* ─── 5. School Banner ───────────────────────────────────────── */}
        <SchoolBanner
          level={currentLevel}
          onEdit={() => { tap(); setPickerOpen(true); }}
          textAlign={textAlign}
          isAr={isAr}
        />

        {/* ─── 6. Footer Actions ──────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { textAlign, color: themed.text, marginTop: Spacing.lg }]}>
          {t('profile.help_title', { defaultValue: 'Aide & informations' })}
        </Text>
        <View style={styles.footerList}>
          <FooterRow
            emoji="ℹ️"
            label={t('profile.footer.about', { defaultValue: 'À propos' })}
            onPress={() => { tap(); router.push('/about'); }}
          />
          <FooterRow
            emoji="❓"
            label={t('profile.footer.help', { defaultValue: 'Aide & FAQ' })}
            onPress={() => { tap(); router.push('/page/faq' as never); }}
          />
          <FooterRow
            emoji="💬"
            label={t('profile.footer.whatsapp', { defaultValue: 'WhatsApp Support' })}
            onPress={() => { tap(); void openWhatsApp(t('profile.whatsapp_msg', { defaultValue: 'Bonjour VERKING !' })); }}
          />
          <FooterRow
            emoji="📞"
            label={t('profile.footer.call', { defaultValue: 'Appeler' })}
            onPress={() => { tap(); void openPhone(); }}
          />
          <FooterRow
            emoji="📧"
            label={t('profile.footer.email', { defaultValue: 'Envoyer un email' })}
            onPress={() => { tap(); void openEmail(); }}
          />
          <FooterRow
            emoji="📜"
            label={t('profile.footer.terms', { defaultValue: 'Conditions & confidentialité' })}
            onPress={() => { tap(); router.push('/page/cgu' as never); }}
          />
        </View>

        {/* ─── 7. Logout ──────────────────────────────────────────────── */}
        <Pressable
          onPress={onLogoutTap}
          style={({ pressed }) => [
            styles.logout,
            { borderColor: Brand.dangerSoft, backgroundColor: pressed ? Brand.dangerSoft : 'transparent' },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={Brand.danger} />
          <Text style={[styles.logoutText, { color: Brand.danger }]}>
            {t('profile.logout', { defaultValue: 'Se déconnecter' })}
          </Text>
        </Pressable>
      </ScrollView>

      {pickerOpen ? (
        <SchoolLevelPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSaved={() => setPickerOpen(false)}
        />
      ) : null}

      {/* Phase 4.5 — branded logout confirmation. */}
      <BrandConfirmDialog
        visible={logoutOpen}
        title={t('profile.logout_title', { defaultValue: 'Se déconnecter ?' })}
        message={t('profile.logout_body', {
          defaultValue: 'Cette action efface vos préférences locales (panier, wilaya, favoris, school).',
        })}
        confirmLabel={t('profile.logout_confirm', { defaultValue: 'Se déconnecter' })}
        destructive
        onConfirm={() => void onLogoutConfirm()}
        onCancel={() => setLogoutOpen(false)}
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════

interface HeroProps {
  greeting: string;
  name: string;
  tierName: string;
  tierIcon: keyof typeof Ionicons.glyphMap;
  streakDays: number;
  avatarUri?: string | null;
  onPressAvatar?: () => void;
  onPressNotifs: () => void;
  onPressSettings: () => void;
  textAlign: 'left' | 'right';
  rowDirection: 'row' | 'row-reverse';
}

function HeroCard({
  greeting, name, tierName, tierIcon, streakDays,
  avatarUri, onPressAvatar,
  onPressNotifs, onPressSettings, textAlign, rowDirection,
}: HeroProps) {
  return (
    <View style={styles.heroOuter}>
      <View style={[styles.hero, { backgroundColor: Brand.secondary }]}>
        {/* Decorative blobs */}
        <View style={[styles.blobOne, { backgroundColor: 'rgba(255,122,26,0.45)' }]} />
        <View style={[styles.blobTwo, { backgroundColor: 'rgba(67,217,219,0.32)' }]} />

        <View style={[styles.heroTopRow, { flexDirection: rowDirection }]}>
          {/* Phase 4.4 — avatar on the leading edge so the user always
              sees their picture / fallback initial as part of the hero
              identity. Tap = jump straight to /profile/edit. */}
          <Pressable onPress={onPressAvatar} hitSlop={6}>
            <UserAvatar size={56} uri={avatarUri} fallbackText={name} bordered />
          </Pressable>
          <View style={styles.heroLeft}>
            <Text style={[styles.heroKicker, { textAlign }]}>{greeting}</Text>
            <Text style={[styles.heroName, { textAlign }]} numberOfLines={1}>{name}</Text>
            <View style={[styles.heroChips, { flexDirection: rowDirection }]}>
              <View style={styles.tierChip}>
                <Ionicons name={tierIcon} size={12} color="#fff" />
                <Text style={styles.tierChipText}>{tierName}</Text>
              </View>
              {streakDays > 0 ? (
                <View style={styles.streakChip}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <Text style={styles.streakText}>
                    {streakDays} {streakDays === 1 ? 'jour' : 'jours'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={[styles.heroIcons, { flexDirection: rowDirection, gap: 8 }]}>
            <Pressable hitSlop={10} onPress={onPressNotifs} style={styles.heroIconBtn}>
              <Ionicons name="notifications-outline" size={18} color="#fff" />
            </Pressable>
            <Pressable hitSlop={10} onPress={onPressSettings} style={styles.heroIconBtn}>
              <Ionicons name="settings-outline" size={18} color="#fff" />
            </Pressable>
            <View style={styles.heroIconBtn}>
              <HamburgerButton color="#fff" size={28} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

interface StatCardProps {
  emoji: string;
  color: string;
  value: number;
  label: string;
  onPress: () => void;
}
function StatCard({ emoji, color, value, label, onPress }: StatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        { borderColor: color + '33', backgroundColor: color + '14' },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

interface ActionTileProps {
  emoji: string;
  label: string;
  tint: string;
  badge?: string | null;
  onPress: () => void;
}
function ActionTile({ emoji, label, tint, badge, onPress }: ActionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        { backgroundColor: tint + '12', borderColor: tint + '33' },
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <View style={[styles.actionEmojiWrap, { backgroundColor: tint + '22' }]}>
        <Text style={styles.actionEmoji}>{emoji}</Text>
        {badge ? (
          <View style={[styles.actionBadge, { backgroundColor: Brand.coral }]}>
            <Text style={styles.actionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.actionLabel, { color: tint }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

interface SchoolBannerProps {
  level: SchoolLevel | null;
  onEdit: () => void;
  textAlign: 'left' | 'right';
  isAr: boolean;
}
function SchoolBanner({ level, onEdit, textAlign, isAr }: SchoolBannerProps) {
  if (!level) {
    return (
      <Pressable onPress={onEdit} style={[styles.schoolEmpty]}>
        <Text style={styles.schoolEmptyEmoji}>🎓</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.schoolEmptyTitle, { textAlign }]}>
            Définir le niveau scolaire
          </Text>
          <Text style={[styles.schoolEmptySub, { textAlign }]}>
            Pour voir les recommandations adaptées
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
      </Pressable>
    );
  }
  const accent = level.accent_color || Brand.primary;
  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [
        styles.schoolBanner,
        { backgroundColor: accent + '14', borderColor: accent + '44' },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.schoolEmojiWrap, { backgroundColor: accent }]}>
        <Text style={{ fontSize: 22 }}>{level.emoji ?? '🎒'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.schoolKicker, { textAlign }]}>Niveau scolaire</Text>
        <Text style={[styles.schoolName, { textAlign, color: accent }]} numberOfLines={1}>
          {isAr ? (level.name_ar ?? level.name_fr) : level.name_fr}
        </Text>
      </View>
      <Ionicons name="pencil" size={16} color={accent} />
    </Pressable>
  );
}

interface FooterRowProps {
  emoji: string;
  label: string;
  onPress: () => void;
}
function FooterRow({ emoji, label, onPress }: FooterRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.footerRow,
        pressed && { backgroundColor: Brand.surfaceMuted },
      ]}
    >
      <Text style={styles.footerEmoji}>{emoji}</Text>
      <Text style={styles.footerLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Brand.textMuted} />
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function computeGreeting(t: (k: string, opts?: Record<string, unknown>) => string): string {
  const h = new Date().getHours();
  if (h < 5) return t('profile.greet.night', { defaultValue: 'Bonsoir' });
  if (h < 12) return t('profile.greet.morning', { defaultValue: 'Bonjour' });
  if (h < 18) return t('profile.greet.afternoon', { defaultValue: 'Bon après-midi' });
  return t('profile.greet.evening', { defaultValue: 'Bonsoir' });
}

function pickName(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return null;
}

// Silence the unused-import warning when the hook isn't yet wired into
// every section. (Link is referenced for type.)
void Link;

// ═══════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: Spacing.sm },

  heroOuter: { paddingHorizontal: Spacing.md },
  hero: {
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    overflow: 'hidden',
    minHeight: 130,
    justifyContent: 'center',
    shadowColor: 'rgba(15,23,42,0.3)',
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  blobOne: {
    position: 'absolute', top: -60, right: -30,
    width: 180, height: 180, borderRadius: 999,
  },
  blobTwo: {
    position: 'absolute', bottom: -70, left: -40,
    width: 220, height: 220, borderRadius: 999,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 2,
    gap: 12,
  },
  heroLeft: { flex: 1, gap: 4, minWidth: 0 },
  heroKicker: {
    color: Brand.sunshine, fontFamily: BrandFont.bold,
    fontSize: 11, fontWeight: '900', letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  heroName: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold,
    fontWeight: '900', fontSize: 22, letterSpacing: 0.4,
  },
  heroChips: { gap: 8, marginTop: 4 },
  tierChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tierChipText: {
    color: '#fff', fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 11, letterSpacing: 0.3,
  },
  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,201,60,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,201,60,0.5)',
  },
  streakEmoji: { fontSize: 12 },
  streakText: {
    color: '#FFC93C', fontFamily: BrandFont.extrabold,
    fontWeight: '900', fontSize: 11,
  },
  heroIcons: {},
  heroIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
  },

  statsRow: { paddingHorizontal: Spacing.md, gap: Spacing.xs, paddingVertical: 4 },
  statCard: {
    width: 96, padding: 12,
    borderRadius: Radius.lg, borderWidth: 1,
    alignItems: 'center', gap: 2,
  },
  statEmoji: { fontSize: 18 },
  statValue: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 22, marginTop: 2,
  },
  statLabel: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 11, color: Brand.textMuted,
  },

  sectionTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, letterSpacing: 0.3,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  actionGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.md, gap: Spacing.xs,
  },
  actionTile: {
    width: '31.5%', aspectRatio: 1,
    borderRadius: Radius.lg, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 8,
  },
  actionEmojiWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  actionEmoji: { fontSize: 22 },
  actionBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  actionBadgeText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  actionLabel: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 12, textAlign: 'center',
  },

  schoolBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md,
    marginHorizontal: Spacing.md, marginTop: Spacing.lg,
    borderRadius: Radius.lg, borderWidth: 1,
  },
  schoolEmojiWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  schoolKicker: {
    fontFamily: BrandFont.medium, fontWeight: '700',
    fontSize: 11, color: Brand.textMuted, letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  schoolName: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, marginTop: 2,
  },
  schoolEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md,
    marginHorizontal: Spacing.md, marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Brand.border,
    backgroundColor: Brand.surfaceMuted,
  },
  schoolEmptyEmoji: { fontSize: 28 },
  schoolEmptyTitle: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 14, color: Brand.text,
  },
  schoolEmptySub: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 12, color: Brand.textMuted, marginTop: 2,
  },

  footerList: {
    paddingHorizontal: Spacing.md, gap: 4,
  },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 14,
    borderRadius: Radius.md,
  },
  footerEmoji: { fontSize: 18 },
  footerLabel: {
    flex: 1,
    fontFamily: BrandFont.semibold, fontWeight: '700',
    fontSize: 14, color: Brand.text,
  },

  logout: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderRadius: Radius.lg, borderWidth: 1,
    justifyContent: 'center',
  },
  logoutText: {
    fontFamily: BrandFont.bold, fontWeight: '800', fontSize: 14,
  },
});
