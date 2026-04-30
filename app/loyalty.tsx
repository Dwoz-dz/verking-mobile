/**
 * Loyalty / Rewards hub — Phase 8 mobile experience.
 *
 * Layout (top-down):
 *   ▸ Premium banner  — gradient hero with the user's balance, lifetime
 *                       cumulative, and current tier badge.
 *   ▸ Tier progress   — bar with current → next tier, missing points,
 *                       and the perks unlocked at the current tier.
 *   ▸ Defis           — admin-curated mission cards with progress bars.
 *   ▸ Recompenses     — redeemable catalogue cards (coupons / shipping /
 *                       products) with tier and stock guards.
 *   ▸ Parrainage      — share the device's referral code (1-tap copy
 *                       + WhatsApp share).
 *   ▸ Historique      — last 10 ledger entries (earn / redeem).
 *
 * All sections are admin-driven via Gestionnaire Mobile › Fidélité.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWallpaper } from '@/components/decorative/BrandWallpaper';
import { useBottomContentClearance } from '@/constants/layout';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import {
  findCurrentTier, findNextTier,
  listMyLedger, listMyProgress,
  redeemReward,
  useLoyaltyAccount, useLoyaltyChallenges, useLoyaltyLevels, useLoyaltyRewards,
  type ChallengeProgress,
  type LoyaltyLedgerEntry,
  type LoyaltyChallenge,
  type LoyaltyReward,
} from '@/services/loyalty';

export default function LoyaltyScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = i18n.language === 'ar';

  const { account, settings, loading: accLoading, reload } = useLoyaltyAccount();
  const levels = useLoyaltyLevels();
  const challenges = useLoyaltyChallenges();
  const rewards = useLoyaltyRewards();

  const [progress, setProgress] = useState<ChallengeProgress[]>([]);
  const [ledger, setLedger] = useState<LoyaltyLedgerEntry[]>([]);
  const [redeemingKey, setRedeemingKey] = useState<string | null>(null);

  const refreshSecondary = useCallback(async () => {
    const [p, l] = await Promise.all([listMyProgress(), listMyLedger(15)]);
    setProgress(p);
    setLedger(l);
  }, []);
  useEffect(() => { void refreshSecondary(); }, [refreshSecondary, account?.balance_points, account?.lifetime_points]);

  // Phase 16.4 — pull-to-refresh + 30 s focus refresh.
  const { refreshing, onRefresh } = usePullRefresh();
  useRefreshOnFocus();
  // Phase 1.4 — keep last ledger row reachable above the floating FAB.
  const bottomClearance = useBottomContentClearance();

  const currentTier = useMemo(
    () => account ? findCurrentTier(levels, account.lifetime_points) : null,
    [levels, account],
  );
  const nextTier = useMemo(
    () => account ? findNextTier(levels, account.lifetime_points) : null,
    [levels, account],
  );
  const tierGap = nextTier && account ? Math.max(0, nextTier.threshold_points - account.lifetime_points) : 0;
  const tierProgressPct = useMemo(() => {
    if (!nextTier || !account) return currentTier ? 1 : 0;
    const span = nextTier.threshold_points - (currentTier?.threshold_points ?? 0);
    if (span <= 0) return 1;
    const advanced = account.lifetime_points - (currentTier?.threshold_points ?? 0);
    return Math.min(1, Math.max(0, advanced / span));
  }, [account, currentTier, nextTier]);

  const onRedeem = async (reward: LoyaltyReward) => {
    if (!account || redeemingKey) return;
    if (account.balance_points < reward.cost_points) {
      Alert.alert(
        t('loyalty.insufficient_title', { defaultValue: 'Pas assez de points' }),
        t('loyalty.insufficient_body', { defaultValue: 'Continuez à commander pour débloquer cette récompense.' }),
      );
      return;
    }
    setRedeemingKey(reward.reward_key);
    try {
      const res = await redeemReward(reward.reward_key);
      if (res.granted) {
        Alert.alert(
          t('loyalty.redeem_success_title', { defaultValue: '🎉 Récompense débloquée' }),
          t('loyalty.redeem_success_body', { defaultValue: 'Votre bon est ajouté à votre portefeuille.' }),
        );
        reload();
        void refreshSecondary();
      } else {
        const msg = res.reason === 'tier_locked'
          ? t('loyalty.redeem_tier_locked', { defaultValue: 'Cette récompense est réservée aux niveaux supérieurs.' })
          : res.reason === 'limit_reached'
          ? t('loyalty.redeem_limit', { defaultValue: 'Vous avez déjà débloqué cette récompense.' })
          : res.reason === 'out_of_stock'
          ? t('loyalty.redeem_oos', { defaultValue: 'Récompense épuisée pour le moment.' })
          : t('loyalty.redeem_failed', { defaultValue: 'Échec de l’échange.' });
        Alert.alert('Info', msg);
      }
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec');
    } finally {
      setRedeemingKey(null);
    }
  };

  const onShareReferral = async () => {
    if (!account?.referral_code) return;
    try {
      await Share.share({
        message: t('loyalty.share_message', {
          defaultValue: `🎁 Rejoignez VERKING avec mon code ${account.referral_code} et gagnez ${settings.referral_referee_bonus} points de bienvenue !`,
          code: account.referral_code,
          bonus: settings.referral_referee_bonus,
        }),
      });
    } catch { /* user cancelled */ }
  };

  if (accLoading || !account) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!settings.is_enabled) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={36} color={Brand.textSubtle} />
          <Text style={styles.disabledTitle}>
            {t('loyalty.disabled_title', { defaultValue: 'Programme en pause' })}
          </Text>
          <Text style={styles.disabledSub}>
            {t('loyalty.disabled_sub', { defaultValue: 'Le programme de fidélité est temporairement désactivé.' })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currencyLabel = isAr ? settings.currency_label_ar : settings.currency_label_fr;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]}>
          {t('loyalty.title', { defaultValue: 'Programme VERKING' })}
        </Text>
        <View style={{ width: 36 }} />
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
        {/* ─── Premium banner ───────────────────────────── */}
        <View style={styles.bannerWrap}>
          <BrandWallpaper variant="soft" style={styles.bannerWallpaper} />
          <View style={styles.bannerOverlay}>
            <View style={[styles.bannerHeader, { flexDirection: rowDirection }]}>
              {currentTier ? (
                <View style={[styles.tierBadge, { backgroundColor: currentTier.badge_color }]}>
                  <Ionicons name={(currentTier.badge_icon as keyof typeof Ionicons.glyphMap) || 'medal-outline'} size={14} color="#FFF" />
                  <Text style={styles.tierBadgeText}>
                    {(isAr ? currentTier.name_ar : currentTier.name_fr) || ''}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.bannerCurrency, { textAlign }]}>{currencyLabel}</Text>
            </View>
            <Text style={[styles.balance, { textAlign }]}>
              {account.balance_points.toLocaleString()} <Text style={styles.balanceSuffix}>pts</Text>
            </Text>
            <Text style={[styles.balanceSub, { textAlign }]}>
              ≈ {formatPrice(account.balance_points * settings.point_value_da)}
            </Text>
            <View style={[styles.statsRow, { flexDirection: rowDirection }]}>
              <BannerStat label={t('loyalty.stat_lifetime', { defaultValue: 'Cumul' })} value={account.lifetime_points.toLocaleString()} />
              <BannerStat label={t('loyalty.stat_pending', { defaultValue: 'En attente' })} value={account.pending_points.toLocaleString()} />
              <BannerStat label={t('loyalty.stat_tier', { defaultValue: 'Niveau' })} value={isAr ? (currentTier?.name_ar ?? '—') : (currentTier?.name_fr ?? '—')} />
            </View>
          </View>
        </View>

        {/* ─── Tier progress ───────────────────────────── */}
        {nextTier ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {t('loyalty.section_tier_title', { defaultValue: 'Prochain niveau' })}
            </Text>
            <View style={styles.tierCard}>
              <View style={[styles.tierCardHeader, { flexDirection: rowDirection }]}>
                <View style={[styles.tierBadge, { backgroundColor: nextTier.badge_color }]}>
                  <Ionicons name={(nextTier.badge_icon as keyof typeof Ionicons.glyphMap) || 'trophy-outline'} size={14} color="#FFF" />
                  <Text style={styles.tierBadgeText}>{isAr ? nextTier.name_ar : nextTier.name_fr}</Text>
                </View>
                <Text style={[styles.tierGap, { textAlign }]}>
                  {tierGap.toLocaleString()} pts {t('loyalty.tier_gap_suffix', { defaultValue: 'restants' })}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(tierProgressPct * 100)}%` }]} />
              </View>
              {currentTier && currentTier.perks_fr.length > 0 && (
                <View style={styles.perksList}>
                  {(isAr ? currentTier.perks_ar : currentTier.perks_fr).slice(0, 3).map((p, i) => (
                    <View key={i} style={[styles.perkRow, { flexDirection: rowDirection }]}>
                      <Ionicons name="checkmark-circle" size={13} color={Brand.fresh} />
                      <Text style={[styles.perkText, { textAlign }]}>{p}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : currentTier ? (
          <View style={styles.section}>
            <View style={[styles.maxedCard]}>
              <Ionicons name="ribbon" size={22} color={Brand.cta} />
              <Text style={[styles.maxedText, { textAlign }]}>
                {t('loyalty.tier_maxed', { defaultValue: 'Vous êtes au plus haut niveau — merci pour votre fidélité !' })}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ─── Challenges ───────────────────────────── */}
        {challenges.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {t('loyalty.section_challenges_title', { defaultValue: 'Défis du moment' })}
            </Text>
            <View style={styles.challengeList}>
              {challenges.map((c) => {
                const prog = progress.find((p) => p.challenge_key === c.challenge_key);
                const ratio = prog ? Math.min(1, Number(prog.progress_value) / Number(prog.target_value || 1)) : 0;
                const completed = !!prog && prog.completions > 0;
                return (
                  <ChallengeRow
                    key={c.id}
                    challenge={c}
                    ratio={ratio}
                    completed={completed}
                    isAr={isAr}
                    textAlign={textAlign}
                    rowDirection={rowDirection}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Rewards ───────────────────────────── */}
        {rewards.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {t('loyalty.section_rewards_title', { defaultValue: 'Catalogue de récompenses' })}
            </Text>
            <View style={styles.rewardsGrid}>
              {rewards.map((r) => {
                const tierLockedThreshold = r.required_level_key
                  ? levels.find((l) => l.level_key === r.required_level_key)?.threshold_points ?? null
                  : null;
                const tierLocked = tierLockedThreshold != null && account.lifetime_points < tierLockedThreshold;
                const insufficient = account.balance_points < r.cost_points;
                const oos = r.stock != null && r.stock <= 0;
                const disabled = tierLocked || oos;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => !disabled && onRedeem(r)}
                    style={({ pressed }) => [
                      styles.rewardCard,
                      pressed && !disabled && { opacity: 0.92 },
                      disabled && { opacity: 0.55 },
                    ]}
                  >
                    <View style={[styles.rewardIcon, { backgroundColor: insufficient ? Brand.surfaceMuted : Brand.ctaSoft }]}>
                      <Ionicons
                        name={(r.icon as keyof typeof Ionicons.glyphMap) || 'gift-outline'}
                        size={22}
                        color={insufficient ? Brand.textSubtle : Brand.cta}
                      />
                    </View>
                    <Text style={[styles.rewardTitle, { textAlign }]} numberOfLines={2}>
                      {isAr ? r.title_ar : r.title_fr}
                    </Text>
                    <Text style={[styles.rewardCost, { textAlign }]}>
                      {r.cost_points.toLocaleString()} pts
                    </Text>
                    {tierLocked ? (
                      <View style={styles.rewardLockedPill}>
                        <Ionicons name="lock-closed" size={10} color="#FFF" />
                        <Text style={styles.rewardLockedText}>{r.required_level_key}</Text>
                      </View>
                    ) : oos ? (
                      <Text style={styles.rewardOos}>{t('loyalty.reward_oos', { defaultValue: 'Épuisé' })}</Text>
                    ) : redeemingKey === r.reward_key ? (
                      <ActivityIndicator size="small" color={Brand.primary} style={{ marginTop: 4 }} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Referral ───────────────────────────── */}
        {account.referral_code && (
          <View style={styles.section}>
            <Pressable onPress={onShareReferral} style={({ pressed }) => [styles.referralCard, pressed && { opacity: 0.93 }]}>
              <View style={styles.referralIcon}>
                <Ionicons name="people" size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.referralTitle, { textAlign }]}>
                  {t('loyalty.referral_title', { defaultValue: 'Parrainez vos proches' })}
                </Text>
                <Text style={[styles.referralSub, { textAlign }]}>
                  {t('loyalty.referral_sub', { defaultValue: `+${settings.referral_referrer_bonus} pts à chaque inscription via votre code.` })}
                </Text>
                <View style={[styles.referralCodeRow, { flexDirection: rowDirection }]}>
                  <Text style={styles.referralCode}>{account.referral_code}</Text>
                  <Ionicons name="share-outline" size={16} color={Brand.cta} />
                </View>
              </View>
            </Pressable>
          </View>
        )}

        {/* ─── Ledger ───────────────────────────── */}
        {ledger.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {t('loyalty.section_history_title', { defaultValue: 'Historique' })}
            </Text>
            <View style={styles.ledgerList}>
              {ledger.slice(0, 10).map((e) => (
                <View key={e.id} style={[styles.ledgerRow, { flexDirection: rowDirection }]}>
                  <View style={[styles.ledgerIcon, { backgroundColor: e.points_delta >= 0 ? Brand.freshSoft : Brand.coralSoft }]}>
                    <Ionicons
                      name={e.points_delta >= 0 ? 'add' : 'remove'}
                      size={14}
                      color={e.points_delta >= 0 ? Brand.fresh : Brand.coral}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.ledgerNote, { textAlign }]} numberOfLines={1}>
                      {e.notes || labelForEvent(e.event_type)}
                    </Text>
                    <Text style={[styles.ledgerDate, { textAlign }]}>
                      {new Date(e.created_at).toLocaleDateString(isAr ? 'ar-DZ' : 'fr-FR')}
                    </Text>
                  </View>
                  <Text style={[styles.ledgerDelta, { color: e.points_delta >= 0 ? Brand.fresh : Brand.coral }]}>
                    {e.points_delta >= 0 ? '+' : ''}{e.points_delta}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChallengeRow({
  challenge, ratio, completed, isAr, textAlign, rowDirection,
}: {
  challenge: LoyaltyChallenge;
  ratio: number;
  completed: boolean;
  isAr: boolean;
  textAlign: 'left' | 'right' | 'center';
  rowDirection: 'row' | 'row-reverse';
}) {
  const title = isAr ? challenge.title_ar : challenge.title_fr;
  const desc = isAr ? challenge.description_ar : challenge.description_fr;
  return (
    <View style={[styles.challengeCard, completed && styles.challengeCompleted]}>
      <View style={[{ flexDirection: rowDirection, alignItems: 'center', gap: 10 }]}>
        <View style={[styles.challengeIcon, completed && { backgroundColor: Brand.freshSoft }]}>
          <Ionicons
            name={(challenge.icon as keyof typeof Ionicons.glyphMap) || 'flag-outline'}
            size={18}
            color={completed ? Brand.fresh : Brand.lavender}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.challengeTitle, { textAlign }]} numberOfLines={1}>{title}</Text>
          {desc ? <Text style={[styles.challengeDesc, { textAlign }]} numberOfLines={2}>{desc}</Text> : null}
        </View>
        <View style={[styles.rewardChip, completed && { backgroundColor: Brand.freshSoft }]}>
          <Ionicons name="sparkles" size={11} color={completed ? Brand.fresh : Brand.cta} />
          <Text style={[styles.rewardChipText, { color: completed ? Brand.fresh : Brand.cta }]}>+{challenge.reward_points}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: completed ? Brand.fresh : Brand.lavender }]} />
      </View>
    </View>
  );
}

function BannerStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function labelForEvent(eventType: string): string {
  switch (eventType) {
    case 'earn_signup':    return 'Bonus de bienvenue';
    case 'earn_order':     return 'Points sur commande';
    case 'earn_referral':  return 'Bonus parrainage';
    case 'earn_challenge': return 'Défi complété';
    case 'earn_admin':     return 'Cadeau VERKING';
    case 'redeem_reward':  return 'Échange récompense';
    case 'admin_adjust':   return 'Ajustement';
    default:               return eventType;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.sm },
  disabledTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 18,
    color: Brand.secondary, marginTop: Spacing.sm,
  },
  disabledSub: {
    fontFamily: BrandFont.medium, fontSize: 12,
    color: Brand.textMuted, textAlign: 'center', maxWidth: 260,
  },

  header: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Brand.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: {
    fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 17,
    color: Brand.secondary, letterSpacing: -0.2, flex: 1, textAlign: 'center',
  },

  scroll: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },

  // Banner
  bannerWrap: {
    borderRadius: Radius.xxl, overflow: 'hidden', position: 'relative',
    backgroundColor: Brand.secondary,
    minHeight: 200,
    shadowColor: Brand.shadowBlue, shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bannerWallpaper: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.55,
  },
  bannerOverlay: {
    padding: Spacing.lg,
    backgroundColor: 'rgba(18, 51, 94, 0.78)',
    flex: 1,
    gap: 6,
  },
  bannerHeader: {
    alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  bannerCurrency: {
    fontFamily: BrandFont.bold, fontWeight: '800', fontSize: 11,
    color: 'rgba(255,255,255,0.78)', letterSpacing: 0.5, textTransform: 'uppercase',
  },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  tierBadgeText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 11, letterSpacing: 0.4,
  },
  balance: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 42, color: '#FFFFFF', letterSpacing: -1, marginTop: 2,
  },
  balanceSuffix: { fontSize: 18, color: 'rgba(255,255,255,0.7)' },
  balanceSub: {
    fontFamily: BrandFont.medium, fontWeight: '600', fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  statsRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'space-between',
  },
  statCell: { flex: 1, gap: 2 },
  statLabel: {
    fontFamily: BrandFont.bold, fontSize: 9, color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 14,
    color: '#FFFFFF',
  },

  // Section
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, color: Brand.secondary,
  },

  // Tier card
  tierCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: Spacing.sm,
  },
  tierCardHeader: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tierGap: { fontFamily: BrandFont.bold, fontSize: 12, color: Brand.secondary },
  perksList: { gap: 4 },
  perkRow: { alignItems: 'center', gap: 6 },
  perkText: { fontFamily: BrandFont.medium, fontSize: 11, color: Brand.textMuted, flex: 1 },
  maxedCard: {
    backgroundColor: Brand.ctaSoft,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  maxedText: {
    fontFamily: BrandFont.bold, fontWeight: '800', fontSize: 12,
    color: Brand.cta, flex: 1,
  },

  // Progress
  progressTrack: {
    height: 8, backgroundColor: Brand.surfaceContainer,
    borderRadius: 999, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Brand.cta, borderRadius: 999,
  },

  // Challenges
  challengeList: { gap: Spacing.sm },
  challengeCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Brand.border,
    gap: 10,
  },
  challengeCompleted: { borderColor: Brand.fresh + '55', backgroundColor: Brand.freshSoft + '40' },
  challengeIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: Brand.lavenderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  challengeTitle: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 13, color: Brand.secondary },
  challengeDesc: { fontFamily: BrandFont.medium, fontSize: 11, color: Brand.textMuted, marginTop: 1 },
  rewardChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Brand.ctaSoft,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill,
  },
  rewardChipText: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 11 },

  // Rewards grid
  rewardsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
  },
  rewardCard: {
    flexBasis: '47%', flexGrow: 1, minWidth: 0,
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Brand.border,
    alignItems: 'flex-start', gap: 6,
  },
  rewardIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Brand.ctaSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rewardTitle: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 12, color: Brand.secondary, lineHeight: 15 },
  rewardCost: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 13, color: Brand.cta },
  rewardLockedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Brand.lavender,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.pill,
  },
  rewardLockedText: { color: '#FFF', fontFamily: BrandFont.bold, fontSize: 9, textTransform: 'uppercase' },
  rewardOos: { fontFamily: BrandFont.bold, fontSize: 10, color: Brand.textMuted },

  // Referral
  referralCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Brand.ctaSoft,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Brand.cta + '33',
  },
  referralIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: Brand.cta,
    alignItems: 'center', justifyContent: 'center',
  },
  referralTitle: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 14, color: Brand.secondary },
  referralSub: { fontFamily: BrandFont.medium, fontSize: 11, color: Brand.textMuted, marginTop: 2 },
  referralCodeRow: { alignItems: 'center', gap: 6, marginTop: 6 },
  referralCode: {
    fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 16,
    color: Brand.cta, letterSpacing: 1.5,
  },

  // Ledger
  ledgerList: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Brand.border,
    overflow: 'hidden',
  },
  ledgerRow: {
    paddingVertical: 10, paddingHorizontal: Spacing.md,
    alignItems: 'center', gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Brand.surfaceMuted,
  },
  ledgerIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  ledgerNote: { fontFamily: BrandFont.bold, fontWeight: '800', fontSize: 12, color: Brand.secondary },
  ledgerDate: { fontFamily: BrandFont.medium, fontSize: 10, color: Brand.textMuted, marginTop: 1 },
  ledgerDelta: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 13 },
});
