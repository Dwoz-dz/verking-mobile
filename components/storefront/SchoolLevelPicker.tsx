/**
 * SchoolLevelPicker — modale d'onboarding "Mode Étudiant".
 *
 * Affichée :
 *   ▸ Au tap du quick-action "École" du Profile.
 *   ▸ Depuis Settings → "Mode étudiant".
 *
 * Layout :
 *   ▸ Hero coloré avec Cap GraduationCap + question d'accueil.
 *   ▸ 3 sections par cycle (Primaire / Moyen / Secondaire), chacune
 *     avec une couleur d'accent VERKING distincte.
 *   ▸ Chaque niveau = card emoji-first (3AP / 4AM / 1AS…) + nom complet.
 *   ▸ Tap → met à jour la sélection ; "Confirmer" écrit via RPC.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import {
  CYCLE_LABEL_AR, CYCLE_LABEL_FR,
  groupByCycle, saveSchoolProfile,
  useSchoolLevels,
  type SchoolCycle, type SchoolLevel, type SchoolProfile,
} from '@/services/school';

const CYCLE_ICON: Record<SchoolCycle, keyof typeof Ionicons.glyphMap> = {
  primaire: 'school-outline',
  moyen: 'book-outline',
  secondaire: 'trophy-outline',
};
const CYCLE_HERO_COLOR: Record<SchoolCycle, string> = {
  primaire: '#FF7A1A',
  moyen: '#43D9DB',
  secondaire: '#7C5DDB',
};

interface Props {
  visible: boolean;
  initial?: SchoolProfile | null;
  onClose: () => void;
  onSaved: (profile: SchoolProfile) => void;
}

export function SchoolLevelPicker({ visible, initial, onClose, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const isAr = i18n.language === 'ar';
  const levels = useSchoolLevels();
  const grouped = useMemo(() => groupByCycle(levels), [levels]);

  const [selectedKey, setSelectedKey] = useState<string | null>(initial?.level_key ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSelectedKey(initial?.level_key ?? null);
  }, [visible, initial?.level_key]);

  const onConfirm = async () => {
    if (!selectedKey) return;
    setSaving(true);
    try {
      const profile = await saveSchoolProfile({ level_key: selectedKey });
      if (profile) onSaved(profile);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Échec.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.header, { flexDirection: rowDirection }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Brand.secondary} />
          </Pressable>
          <Text style={[styles.headerTitle, { textAlign }]}>
            {t('school.picker_title', { defaultValue: 'Mode Étudiant' })}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="school" size={28} color="#FFFFFF" />
            </View>
            <Text style={[styles.heroTitle, { textAlign }]}>
              {initial
                ? t('school.picker_change', { defaultValue: 'Changer mon niveau' })
                : t('school.picker_welcome', { defaultValue: 'Quel est votre niveau ?' })}
            </Text>
            <Text style={[styles.heroSub, { textAlign }]}>
              {t('school.picker_sub', {
                defaultValue: 'On personnalise l\'app — packs, conseils, prix de groupe et calendrier scolaire.',
              })}
            </Text>
          </View>

          {/* Cycles */}
          {(['primaire', 'moyen', 'secondaire'] as SchoolCycle[]).map((cycle) => {
            const cycleLevels = grouped[cycle];
            if (cycleLevels.length === 0) return null;
            return (
              <View key={cycle} style={styles.section}>
                <View style={[styles.sectionHeader, { flexDirection: rowDirection }]}>
                  <View style={[styles.cycleIcon, { backgroundColor: CYCLE_HERO_COLOR[cycle] }]}>
                    <Ionicons name={CYCLE_ICON[cycle]} size={14} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cycleTitle, { textAlign }]}>
                    {isAr ? CYCLE_LABEL_AR[cycle] : CYCLE_LABEL_FR[cycle]}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {cycleLevels.map((l) => (
                    <LevelCard
                      key={l.level_key}
                      level={l}
                      selected={selectedKey === l.level_key}
                      isAr={isAr}
                      onPress={() => setSelectedKey(l.level_key)}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          {!levels.length ? (
            <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={Brand.primary} />
            </View>
          ) : null}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={onConfirm}
            disabled={!selectedKey || saving}
            style={({ pressed }) => [
              styles.confirmBtn,
              (!selectedKey || saving) && styles.confirmBtnDisabled,
              pressed && selectedKey && !saving && { opacity: 0.92 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.confirmText}>
                  {selectedKey
                    ? t('school.picker_confirm', { defaultValue: 'Continuer' })
                    : t('school.picker_pick', { defaultValue: 'Choisissez un niveau' })}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function LevelCard({
  level, selected, isAr, onPress,
}: { level: SchoolLevel; selected: boolean; isAr: boolean; onPress: () => void }) {
  const label = isAr ? level.short_label_ar : level.short_label_fr;
  const fullName = isAr ? level.name_ar : level.name_fr;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && {
          borderColor: level.accent_color,
          borderWidth: 2,
          backgroundColor: level.accent_color + '15',
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.cardEmoji, { backgroundColor: level.accent_color + '22' }]}>
        <Text style={styles.cardEmojiText}>{level.emoji || '🎓'}</Text>
      </View>
      <Text style={[styles.cardLabel, { color: selected ? level.accent_color : Brand.secondary }]}>
        {label}
      </Text>
      <Text style={styles.cardName} numberOfLines={2}>{fullName}</Text>
      {selected ? (
        <View style={[styles.cardCheck, { backgroundColor: level.accent_color }]}>
          <Ionicons name="checkmark" size={11} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: Brand.surfaceMuted,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Brand.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, color: Brand.secondary, letterSpacing: -0.2,
  },

  scroll: { padding: Spacing.md, paddingBottom: 90, gap: Spacing.lg },

  // Hero
  hero: {
    alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md,
    borderRadius: Radius.xxl,
    backgroundColor: Brand.surface,
    borderWidth: 1, borderColor: Brand.border,
  },
  heroIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadowBlue, shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 19, color: Brand.secondary, marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md, textAlign: 'center',
  },
  heroSub: {
    fontFamily: BrandFont.medium, fontSize: 12,
    color: Brand.textMuted, textAlign: 'center',
    paddingHorizontal: Spacing.md, lineHeight: 17,
  },

  // Section
  section: { gap: Spacing.sm },
  sectionHeader: {
    alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  cycleIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cycleTitle: {
    flex: 1,
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 14, color: Brand.secondary, letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
  },
  card: {
    flexBasis: '30%', flexGrow: 1, minWidth: 0,
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    padding: Spacing.sm,
    borderWidth: 1, borderColor: Brand.border,
    alignItems: 'center', gap: 4,
    minHeight: 120,
    position: 'relative',
  },
  cardEmoji: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardEmojiText: { fontSize: 24 },
  cardLabel: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, letterSpacing: 0.5,
  },
  cardName: {
    fontFamily: BrandFont.medium, fontWeight: '500',
    fontSize: 10, color: Brand.textMuted,
    textAlign: 'center', lineHeight: 13,
  },
  cardCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Brand.surfaceMuted,
    shadowColor: Brand.shadowDeep, shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 14, borderRadius: Radius.pill,
    backgroundColor: Brand.cta,
    shadowColor: Brand.shadowOrange, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  confirmBtnDisabled: {
    backgroundColor: Brand.surfaceContainer, shadowOpacity: 0,
  },
  confirmText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 14, letterSpacing: 0.4,
  },
});
