/**
 * /settings/video-preferences — Phase Final-2 video playback prefs.
 *
 * Three knobs the user controls:
 *   ▸ Autoplay     : always | wifi_only | never
 *   ▸ Mute by default (auto-play with sound vs muted)
 *   ▸ Data saver hint: when ON, autoplay falls back to "never" even
 *     if the autoplay setting says "always". This is also flipped by
 *     the global "Mode économie de données" toggle so the two stay
 *     consistent.
 *
 * Persistence: `user_preferences.video_autoplay` via the existing
 * `setPreference` helper. No new RPC needed — the prefs schema
 * already has the column.
 *
 * Why a dedicated screen (vs inline in the toggle):
 *   The 3-mode autoplay choice doesn't fit a Switch; a radio-style
 *   picker with descriptions explains the trade-offs clearly.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { setPreference, useUserPreferences, type VideoAutoplayPref } from '@/services/userPreferences';

interface AutoplayOption {
  key: VideoAutoplayPref;
  emoji: string;
  title: string;
  subtitle: string;
}

export default function VideoPreferencesScreen() {
  const { t } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const prefs = useUserPreferences();

  const options: AutoplayOption[] = [
    {
      key: 'always',
      emoji: '🎬',
      title: t('video_prefs.always_title', { defaultValue: 'Toujours' }),
      subtitle: t('video_prefs.always_sub', { defaultValue: 'Lecture automatique en Wi-Fi et données mobiles' }),
    },
    {
      key: 'wifi_only',
      emoji: '📶',
      title: t('video_prefs.wifi_title', { defaultValue: 'Wi-Fi uniquement' }),
      subtitle: t('video_prefs.wifi_sub', { defaultValue: 'Économise les données mobiles' }),
    },
    {
      key: 'never',
      emoji: '⏸️',
      title: t('video_prefs.never_title', { defaultValue: 'Jamais' }),
      subtitle: t('video_prefs.never_sub', { defaultValue: 'Lecture uniquement quand vous appuyez' }),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
          {t('video_prefs.title', { defaultValue: 'Préférences vidéo' })}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.kicker, { textAlign }]}>
          {t('video_prefs.autoplay_label', { defaultValue: 'Lecture automatique' })}
        </Text>

        <View style={styles.optionGroup}>
          {options.map((opt) => {
            const isActive = prefs.video_autoplay === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => void setPreference('video_autoplay', opt.key)}
                style={({ pressed }) => [
                  styles.optionRow,
                  isActive && styles.optionRowActive,
                  pressed && { transform: [{ scale: 0.98 }] },
                  { flexDirection: rowDirection },
                ]}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { textAlign }]}>{opt.title}</Text>
                  <Text style={[styles.optionSub, { textAlign }]}>{opt.subtitle}</Text>
                </View>
                <View style={[styles.radio, isActive && styles.radioActive]}>
                  {isActive ? (
                    <View style={styles.radioDot} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Data-saver hint banner */}
        {prefs.data_saver_mode ? (
          <View style={styles.hintBanner}>
            <Ionicons name="speedometer-outline" size={16} color={Brand.warning} />
            <Text style={[styles.hintText, { textAlign }]}>
              {t('video_prefs.data_saver_hint', {
                defaultValue: 'Mode économie de données activé — la lecture automatique est forcée à "Jamais" tant qu\'il est actif.',
              })}
            </Text>
          </View>
        ) : null}

        {/* Quick toggle for the master data-saver flag */}
        <View style={styles.section}>
          <Text style={[styles.kicker, { textAlign }]}>
            {t('video_prefs.data', { defaultValue: 'Données' })}
          </Text>
          <View style={[styles.toggleRow, { flexDirection: rowDirection }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { textAlign }]}>
                {t('video_prefs.data_saver_title', { defaultValue: 'Mode économie de données' })}
              </Text>
              <Text style={[styles.optionSub, { textAlign }]}>
                {t('video_prefs.data_saver_sub', {
                  defaultValue: 'Réduit la qualité des images et désactive les vidéos automatiques.',
                })}
              </Text>
            </View>
            <Switch
              value={prefs.data_saver_mode}
              onValueChange={(v) => void setPreference('data_saver_mode', v)}
              trackColor={{ false: Brand.surfaceContainerHigh, true: Brand.primary }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.surfaceMuted,
  },
  title: {
    flex: 1,
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 17,
    color: Brand.secondary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  kicker: {
    fontFamily: BrandFont.bold,
    fontWeight: '900',
    fontSize: 11,
    color: Brand.primary,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  optionGroup: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Brand.surfaceMuted,
  },
  optionRowActive: { backgroundColor: Brand.primaryTint },
  optionEmoji: { fontSize: 22 },
  optionTitle: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 14,
    color: Brand.text,
  },
  optionSub: {
    fontFamily: BrandFont.medium,
    fontWeight: '500',
    fontSize: 12,
    color: Brand.textMuted,
    marginTop: 2,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Brand.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Brand.primary },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Brand.primary,
  },

  hintBanner: {
    marginTop: Spacing.md,
    backgroundColor: Brand.warningSoft,
    borderRadius: Radius.md,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: Brand.warning + '33',
  },
  hintText: {
    flex: 1,
    fontFamily: BrandFont.medium,
    fontWeight: '600',
    fontSize: 11.5,
    color: Brand.text,
    lineHeight: 15,
  },

  section: { marginTop: Spacing.lg },
  toggleRow: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
});
