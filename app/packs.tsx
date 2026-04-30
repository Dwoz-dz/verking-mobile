/**
 * /packs — catalogue Phase 9 des Packs Classe.
 *
 * Layout :
 *   ▸ Header avec back + titre + niveau actuel (si défini).
 *   ▸ Hero band rappelant l'avantage bundle.
 *   ▸ Filter chips : Tous / Mon niveau (si défini) / Primaire / Moyen /
 *     Secondaire.
 *   ▸ Liste de cards Pack — chaque card a un dégradé teinté de la
 *     accent_color du pack, badge emoji XL, % remise + nb d'articles.
 *   ▸ Tap → action sheet avec description + CTA "Ajouter au panier"
 *     (résout les products via listProductsByIds + addItem en série).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCartActions } from '@/components/cart/CartProvider';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useDirection } from '@/i18n/useDirection';
import { formatPrice } from '@/lib/format';
import {
  CYCLE_LABEL_FR, CYCLE_LABEL_AR,
  addPackToCart,
  useClassPacks, useSchoolProfile,
  type ClassPack, type SchoolCycle, type ClassPackCycle,
} from '@/services/school';

const CYCLE_FALLBACK_ICON: Record<ClassPackCycle, keyof typeof Ionicons.glyphMap> = {
  primaire: 'school-outline',
  moyen: 'book-outline',
  secondaire: 'trophy-outline',
  all: 'star-outline',
};

type Filter = 'all' | 'mine' | SchoolCycle;

export default function PacksScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = i18n.language === 'ar';

  const packs = useClassPacks();
  const { profile } = useSchoolProfile();
  const [filter, setFilter] = useState<Filter>(profile ? 'mine' : 'all');
  const [activePack, setActivePack] = useState<ClassPack | null>(null);
  // Phase 16.4 — pull-to-refresh + 30 s focus refresh.
  const { refreshing, onRefresh } = usePullRefresh();
  useRefreshOnFocus();

  const filtered = useMemo(() => {
    if (filter === 'all') return packs;
    if (filter === 'mine') {
      if (!profile) return packs;
      return packs.filter((p) =>
        p.level_keys.includes(profile.level_key)
        || p.cycle === profile.cycle
        || p.cycle === 'all'
      );
    }
    return packs.filter((p) => p.cycle === filter || p.cycle === 'all' || p.level_keys.some((k) => k.endsWith(filter.slice(0, 2))));
  }, [packs, filter, profile]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]}>
          {t('packs.title', { defaultValue: 'Packs Classe' })}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
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
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroEmoji}>🎒</Text>
          </View>
          <View style={styles.heroBody}>
            <Text style={[styles.heroTitle, { textAlign }]}>
              {t('packs.hero_title', { defaultValue: 'La rentrée en un clic' })}
            </Text>
            <Text style={[styles.heroSub, { textAlign }]}>
              {profile
                ? t('packs.hero_personal', {
                    defaultValue: 'Bonjour {{level}} ! Voici les packs taillés pour votre niveau.',
                    level: isAr ? '' : profile.level_key.toUpperCase(),
                  })
                : t('packs.hero_sub', { defaultValue: 'Cahiers, stylos, calculatrice — la liste officielle bundlée avec une remise de groupe.' })}
            </Text>
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <FilterChip active={filter === 'all'} label={t('packs.filter_all', { defaultValue: 'Tous' })} onPress={() => setFilter('all')} />
          {profile ? (
            <FilterChip
              active={filter === 'mine'}
              label={t('packs.filter_mine', {
                defaultValue: 'Mon niveau ({{label}})',
                label: profile.level_key.toUpperCase(),
              })}
              tone={Brand.cta}
              onPress={() => setFilter('mine')}
            />
          ) : null}
          <FilterChip active={filter === 'primaire'} label={t('packs.filter_primaire', { defaultValue: 'Primaire' })} tone="#FF7A1A" onPress={() => setFilter('primaire')} />
          <FilterChip active={filter === 'moyen'} label={t('packs.filter_moyen', { defaultValue: 'Moyen' })} tone="#43D9DB" onPress={() => setFilter('moyen')} />
          <FilterChip active={filter === 'secondaire'} label={t('packs.filter_secondaire', { defaultValue: 'Secondaire' })} tone="#7C5DDB" onPress={() => setFilter('secondaire')} />
        </ScrollView>

        {/* List */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bag-outline" size={32} color={Brand.textSubtle} />
            <Text style={[styles.emptyText, { textAlign }]}>
              {t('packs.empty', { defaultValue: 'Aucun pack disponible pour ce filtre.' })}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((p) => (
              <PackCard key={p.id} pack={p} isAr={isAr} onPress={() => setActivePack(p)} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {activePack ? (
        <PackDetailSheet
          pack={activePack}
          isAr={isAr}
          textAlign={textAlign}
          onClose={() => setActivePack(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function FilterChip({ active, label, tone, onPress }: { active: boolean; label: string; tone?: string; onPress: () => void }) {
  const accent = tone ?? Brand.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: accent, borderColor: accent }]}
    >
      <Text style={[styles.chipText, active && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

function PackCard({ pack, isAr, onPress }: { pack: ClassPack; isAr: boolean; onPress: () => void }) {
  const title = isAr ? pack.title_ar : pack.title_fr;
  const subtitle = isAr ? pack.subtitle_ar : pack.subtitle_fr;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.93 }]}>
      <View style={[styles.cardCover, { backgroundColor: pack.accent_color + '22' }]}>
        <Text style={styles.cardEmoji}>{pack.badge_emoji || '🎒'}</Text>
        {pack.is_featured ? (
          <View style={[styles.featuredBadge]}>
            <Ionicons name="star" size={9} color="#FFFFFF" />
            <Text style={styles.featuredText}>VEDETTE</Text>
          </View>
        ) : null}
        {pack.bundle_discount_percent > 0 ? (
          <View style={[styles.discountBadge, { backgroundColor: pack.accent_color }]}>
            <Text style={styles.discountText}>-{Math.round(pack.bundle_discount_percent)}%</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.cardSub} numberOfLines={2}>{subtitle}</Text> : null}
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="cube-outline" size={11} color={Brand.primary} />
            <Text style={styles.metaText}>{pack.product_ids.length} articles</Text>
          </View>
          {pack.cycle ? (
            <View style={[styles.metaChip, { backgroundColor: pack.accent_color + '15' }]}>
              <Ionicons name={CYCLE_FALLBACK_ICON[pack.cycle]} size={11} color={pack.accent_color} />
              <Text style={[styles.metaText, { color: pack.accent_color }]}>
                {pack.cycle === 'all' ? 'Tous' : (isAr ? CYCLE_LABEL_AR[pack.cycle as SchoolCycle].slice(5) : CYCLE_LABEL_FR[pack.cycle as SchoolCycle].slice(6))}
              </Text>
            </View>
          ) : null}
          {pack.stock != null ? (
            <View style={[styles.metaChip, { backgroundColor: Brand.warningSoft }]}>
              <Ionicons name="time-outline" size={11} color={Brand.warning} />
              <Text style={[styles.metaText, { color: Brand.warning }]}>Stock {pack.stock}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
    </Pressable>
  );
}

function PackDetailSheet({
  pack, isAr, textAlign, onClose,
}: { pack: ClassPack; isAr: boolean; textAlign: 'left' | 'right' | 'center'; onClose: () => void }) {
  const { t } = useTranslation();
  const { add } = useCartActions();
  const [adding, setAdding] = useState(false);

  const title = isAr ? pack.title_ar : pack.title_fr;
  const description = isAr ? pack.description_ar : pack.description_fr;

  const onAddToCart = async () => {
    if (adding) return;
    if (pack.product_ids.length === 0) {
      Alert.alert('Info', t('packs.empty_pack', { defaultValue: 'Ce pack est vide pour l\'instant.' }));
      return;
    }
    setAdding(true);
    try {
      const result = await addPackToCart(pack, add);
      if (result.added_count === 0) {
        Alert.alert(
          'Info',
          t('packs.no_resolved', {
            defaultValue: 'Les produits de ce pack ne sont plus disponibles.',
          }),
        );
        return;
      }
      const discountLine = result.estimated_savings > 0
        ? `\n💰 Économie : ${formatPrice(result.estimated_savings)} (-${Math.round(pack.bundle_discount_percent)}%)`
        : '';
      const missingLine = result.missing_ids.length > 0
        ? `\n⚠️ ${result.missing_ids.length} produit(s) non disponible(s)`
        : '';
      Alert.alert(
        t('packs.added_title', { defaultValue: '🎒 Pack ajouté !' }),
        `${result.added_count} articles ajoutés au panier.${discountLine}${missingLine}`,
      );
      onClose();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.sheetCover, { backgroundColor: pack.accent_color + '22' }]}>
            <Text style={styles.sheetEmoji}>{pack.badge_emoji || '🎒'}</Text>
            {pack.bundle_discount_percent > 0 ? (
              <View style={[styles.sheetBadge, { backgroundColor: pack.accent_color }]}>
                <Text style={styles.sheetBadgeText}>-{Math.round(pack.bundle_discount_percent)}%</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.sheetTitle, { textAlign }]}>{title}</Text>
          {description ? (
            <Text style={[styles.sheetDescription, { textAlign }]}>{description}</Text>
          ) : null}

          <View style={styles.sheetMeta}>
            <SheetStat icon="cube-outline" label={t('packs.stat_items', { defaultValue: 'Articles' })} value={String(pack.product_ids.length)} />
            {pack.bundle_discount_percent > 0 ? (
              <SheetStat icon="pricetag-outline" label={t('packs.stat_discount', { defaultValue: 'Remise' })} value={`-${Math.round(pack.bundle_discount_percent)}%`} tone={Brand.cta} />
            ) : null}
            {pack.level_keys.length > 0 ? (
              <SheetStat icon="school-outline" label={t('packs.stat_levels', { defaultValue: 'Niveaux' })} value={pack.level_keys.map((k) => k.toUpperCase()).join(' · ')} />
            ) : null}
          </View>

          <Pressable
            onPress={onAddToCart}
            disabled={adding}
            style={({ pressed }) => [
              styles.sheetCta,
              { backgroundColor: pack.accent_color },
              pressed && !adding && { opacity: 0.92 },
              adding && { opacity: 0.65 },
            ]}
          >
            {adding ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cart" size={18} color="#FFFFFF" />
                <Text style={styles.sheetCtaText}>
                  {t('packs.add_full_pack', { defaultValue: 'Ajouter le pack complet' })}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={onClose} style={styles.sheetCancel}>
            <Text style={styles.sheetCancelText}>{t('common.cancel', { defaultValue: 'Annuler' })}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SheetStat({ icon, label, value, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tone?: string }) {
  return (
    <View style={styles.sheetStat}>
      <Ionicons name={icon} size={16} color={tone ?? Brand.primary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.sheetStatLabel}>{label}</Text>
        <Text style={[styles.sheetStatValue, { color: tone ?? Brand.secondary }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
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
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 17, color: Brand.secondary, flex: 1, textAlign: 'center',
    letterSpacing: -0.2,
  },

  scroll: { padding: Spacing.md, gap: Spacing.md },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Brand.primaryTint,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
  },
  heroLeft: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadowBlue, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroEmoji: { fontSize: 32 },
  heroBody: { flex: 1, minWidth: 0 },
  heroTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 17, color: Brand.secondary, letterSpacing: -0.2,
  },
  heroSub: {
    fontFamily: BrandFont.medium, fontSize: 12,
    color: Brand.textMuted, marginTop: 4, lineHeight: 17,
  },

  // Chips
  chipsRow: {
    paddingVertical: 4, paddingRight: Spacing.lg,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  chipText: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 12, color: Brand.secondary, letterSpacing: 0.2,
  },

  // List
  list: { gap: Spacing.sm },
  card: {
    flexDirection: 'row',
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Brand.border,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardCover: {
    width: 96, height: 96, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  cardEmoji: { fontSize: 38 },
  featuredBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: Brand.sunshine,
    paddingVertical: 2, paddingHorizontal: 6,
    borderRadius: Radius.pill,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  featuredText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 8, letterSpacing: 0.5,
  },
  discountBadge: {
    position: 'absolute', bottom: 6, right: 6,
    paddingVertical: 3, paddingHorizontal: 7,
    borderRadius: Radius.pill,
  },
  discountText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 11, letterSpacing: 0.4,
  },
  cardBody: { flex: 1, padding: Spacing.md, gap: 4, minWidth: 0 },
  cardTitle: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 14, color: Brand.secondary },
  cardSub: { fontFamily: BrandFont.medium, fontSize: 11, color: Brand.textMuted, marginTop: 2 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Brand.primaryTint,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  metaText: { fontFamily: BrandFont.bold, fontWeight: '800', fontSize: 10, color: Brand.primary },

  // Empty
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.xs },
  emptyText: { fontFamily: BrandFont.medium, fontSize: 13, color: Brand.textMuted, textAlign: 'center' },

  // Sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    maxHeight: '85%',
    shadowColor: Brand.shadowDeep, shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Brand.surfaceContainer,
    alignSelf: 'center', marginVertical: 10,
  },
  sheetContent: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl },
  sheetCover: {
    height: 140, borderRadius: Radius.xxl,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  sheetEmoji: { fontSize: 64 },
  sheetBadge: {
    position: 'absolute', top: 12, right: 12,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  sheetBadgeText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 14, letterSpacing: 0.5,
  },
  sheetTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 22, color: Brand.secondary, letterSpacing: -0.4,
  },
  sheetDescription: {
    fontFamily: BrandFont.medium, fontSize: 13, color: Brand.textMuted,
    lineHeight: 19,
  },
  sheetMeta: {
    backgroundColor: Brand.surfaceMuted,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  sheetStat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sheetStatLabel: { fontFamily: BrandFont.bold, fontSize: 9, color: Brand.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  sheetStatValue: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 13 },
  sheetCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 14, borderRadius: Radius.pill,
    shadowColor: Brand.shadowOrange, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  sheetCtaText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 15, letterSpacing: 0.5,
  },
  sheetCancel: { alignSelf: 'center', paddingVertical: 8 },
  sheetCancelText: { fontFamily: BrandFont.bold, fontSize: 12, color: Brand.textMuted },
});
