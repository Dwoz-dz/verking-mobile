/**
 * /settings/dark-mode — Phase 3.3 dedicated theme picker.
 *
 * The drawer already exposes 4 theme pills (Clair / Sombre / AMOLED /
 * Auto) but the user might land on Settings looking for a focused
 * "Mode sombre" option. This screen offers:
 *   ▸ 4 mode tiles with descriptions
 *   ▸ Live preview card that mirrors the app's surface + text colors
 *     so the user sees the impact before committing
 *   ▸ Persistence is automatic via the existing ThemeContext
 *     (`setPreference`) — no new RPC needed; the theme_mode column
 *     was added in Phase 2.1 for future server-side sync.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { useTheme, useThemedBrand, type ThemePreference } from '@/lib/theme/ThemeContext';

interface ModeOption {
  key: ThemePreference;
  emoji: string;
  title: string;
  subtitle: string;
}

export default function DarkModeScreen() {
  const { t } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const { preference, setPreference } = useTheme();
  const themed = useThemedBrand();

  const options: ModeOption[] = [
    {
      key: 'system',
      emoji: '🤖',
      title: t('dark_mode.system_title', { defaultValue: 'Automatique' }),
      subtitle: t('dark_mode.system_sub', { defaultValue: 'Suit les réglages de votre téléphone' }),
    },
    {
      key: 'light',
      emoji: '☀️',
      title: t('dark_mode.light_title', { defaultValue: 'Clair' }),
      subtitle: t('dark_mode.light_sub', { defaultValue: 'Lumineux pour la journée' }),
    },
    {
      key: 'dark',
      emoji: '🌙',
      title: t('dark_mode.dark_title', { defaultValue: 'Sombre' }),
      subtitle: t('dark_mode.dark_sub', { defaultValue: 'Doux pour les yeux le soir' }),
    },
    {
      key: 'amoled',
      emoji: '⚫',
      title: t('dark_mode.amoled_title', { defaultValue: 'AMOLED (noir profond)' }),
      subtitle: t('dark_mode.amoled_sub', {
        defaultValue: 'Économise la batterie sur écrans OLED',
      }),
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themed.background }]} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={themed.text} />
        </Pressable>
        <Text style={[styles.title, { textAlign, color: themed.text }]} numberOfLines={1}>
          {t('dark_mode.title', { defaultValue: 'Mode d’affichage' })}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <View style={[styles.preview, { backgroundColor: themed.background, borderColor: themed.border ?? Brand.border }]}>
          <Text style={[styles.previewKicker, { color: themed.primary ?? Brand.primary }]}>
            {t('dark_mode.preview_label', { defaultValue: 'Aperçu' })}
          </Text>
          <View style={[styles.previewCard, { backgroundColor: themed.surface ?? Brand.surface }]}>
            <Text style={[styles.previewTitle, { color: themed.text }]}>VERKING</Text>
            <Text style={[styles.previewSub, { color: themed.textMuted ?? Brand.textMuted }]}>
              {t('dark_mode.preview_body', {
                defaultValue: 'Voici à quoi ressemble votre interface.',
              })}
            </Text>
            <View style={[styles.previewBtn, { backgroundColor: themed.cta ?? Brand.cta }]}>
              <Text style={styles.previewBtnText}>
                {t('dark_mode.preview_cta', { defaultValue: 'Bouton orange' })}
              </Text>
            </View>
          </View>
        </View>

        {/* Mode tiles */}
        <Text style={[styles.sectionTitle, { color: themed.text }]}>
          {t('dark_mode.choose', { defaultValue: 'Choisissez votre style' })}
        </Text>
        <View style={styles.modeGrid}>
          {options.map((opt) => {
            const isActive = preference === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setPreference(opt.key)}
                style={({ pressed }) => [
                  styles.modeTile,
                  { backgroundColor: themed.surface ?? Brand.surface, borderColor: themed.border ?? Brand.border },
                  isActive && styles.modeTileActive,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.checkSlot, isActive && styles.checkSlotActive]}>
                  {isActive ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
                </View>
                <Text style={styles.modeEmoji}>{opt.emoji}</Text>
                <Text style={[styles.modeTitle, { color: themed.text }]}>{opt.title}</Text>
                <Text style={[styles.modeSub, { color: themed.textMuted ?? Brand.textMuted }]} numberOfLines={2}>
                  {opt.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  title: {
    flex: 1,
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  preview: {
    borderRadius: Radius.xxl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  previewKicker: {
    fontFamily: BrandFont.bold,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  previewCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  previewTitle: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 0.5,
  },
  previewSub: { fontSize: 13, fontWeight: '600' },
  previewBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.md,
    marginTop: 6,
  },
  previewBtnText: {
    color: '#FFF',
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.4,
  },

  sectionTitle: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: -0.1,
    marginBottom: Spacing.sm,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  modeTile: {
    flexBasis: '48.5%',
    flexGrow: 1,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  modeTileActive: {
    borderColor: Brand.cta,
    borderWidth: 2,
    backgroundColor: Brand.ctaSoft,
  },
  checkSlot: {
    position: 'absolute',
    top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSlotActive: {
    backgroundColor: Brand.cta,
    borderColor: Brand.cta,
  },
  modeEmoji: { fontSize: 32 },
  modeTitle: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: -0.1,
    marginTop: 4,
  },
  modeSub: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
});
