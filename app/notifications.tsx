/**
 * /notifications — Phase 11 préférences push.
 *
 *   ▸ Hero band qui invite à activer si non encore registered.
 *   ▸ Liste des topics avec switches optimistes ; topics `is_required`
 *     affichent un cadenas et refusent l'opt-out (la RPC raise et on
 *     surface l'erreur).
 *   ▸ Bouton "Tout activer" / "Tout désactiver" pour les topics non requis.
 *   ▸ Bouton "Désactiver les notifications sur cet appareil" qui
 *     unregister le device — utile quand l'utilisateur ne veut plus
 *     rien recevoir sans toucher chaque topic.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useDirection } from '@/i18n/useDirection';
import {
  isNativePushAvailable,
  registerForPushNotifications,
  setTopic, unregisterPushDevice,
  useMyPushTopics, useMyTopicCount,
  type PushTopic,
} from '@/services/push';
import { useDefaultWilaya } from '@/services/mobileConfig';
import { useSchoolProfile } from '@/services/school';

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = i18n.language === 'ar';

  const { topics, loading, reload } = useMyPushTopics();
  const optedInCount = useMyTopicCount();
  const { effectiveCode: wilayaCode } = useDefaultWilaya();
  const { profile: schoolProfile } = useSchoolProfile();
  // Phase 16.4 — pull-to-refresh + 30 s focus refresh.
  const { refreshing, onRefresh } = usePullRefresh();
  useRefreshOnFocus();

  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState<boolean | null>(null); // null until first known
  const nativeAvailable = isNativePushAvailable();

  // First-load check: if user already has topic rows, they're registered.
  useEffect(() => {
    if (!loading) setRegistered(topics.length > 0);
  }, [loading, topics.length]);

  const onActivate = async () => {
    setRegistering(true);
    try {
      const result = await registerForPushNotifications({
        levelKey: schoolProfile?.level_key ?? null,
        wilayaCode: wilayaCode ?? null,
        locale: (i18n.language as 'fr' | 'ar' | 'en') ?? 'fr',
      });
      if (result.ok) {
        setRegistered(true);
        reload();
        Alert.alert(
          t('notifs.activated_title', { defaultValue: 'Notifications activées' }),
          t('notifs.activated_body', {
            defaultValue: 'Vous recevrez les nouvelles que vous avez choisies. Modifiables à tout moment ici.',
          }),
        );
      } else if (result.reason === 'permission_denied') {
        Alert.alert(
          t('notifs.permission_title', { defaultValue: 'Permission refusée' }),
          t('notifs.permission_body', {
            defaultValue: 'Activez les notifications pour VERKING dans les réglages du téléphone.',
          }),
        );
      } else {
        Alert.alert('Erreur', `Échec de l'activation (${result.reason ?? 'unknown'}).`);
      }
    } finally {
      setRegistering(false);
    }
  };

  const onToggle = async (topic: PushTopic, value: boolean) => {
    if (topic.is_required && !value) {
      Alert.alert(
        t('notifs.required_title', { defaultValue: 'Notification requise' }),
        t('notifs.required_body', {
          defaultValue: '"{{label}}" est essentiel au fonctionnement de l\'app et ne peut pas être désactivé.',
          label: isAr ? topic.label_ar : topic.label_fr,
        }),
      );
      return;
    }
    const ok = await setTopic(topic.topic_key, value);
    if (!ok) Alert.alert('Erreur', 'Échec de la mise à jour.');
    reload();
  };

  const onSetAll = async (optedIn: boolean) => {
    const targets = topics.filter((tp) => !tp.is_required);
    for (const tp of targets) {
      // Sequential — keeps the UI predictable; topics list is short (<10).
      await setTopic(tp.topic_key, optedIn);
    }
    reload();
  };

  const onUnregister = () => {
    Alert.alert(
      t('notifs.unregister_title', { defaultValue: 'Désactiver les notifications ?' }),
      t('notifs.unregister_body', {
        defaultValue: 'Vous ne recevrez plus aucune notification VERKING sur cet appareil.',
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Annuler' }), style: 'cancel' },
        {
          text: t('notifs.unregister_confirm', { defaultValue: 'Désactiver' }),
          style: 'destructive',
          onPress: async () => {
            await unregisterPushDevice();
            setRegistered(false);
            reload();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]}>
          {t('notifs.title', { defaultValue: 'Notifications' })}
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
        {/* Dev banner — visible only when native module is missing in this build */}
        {!nativeAvailable && __DEV__ ? (
          <View style={styles.devBanner}>
            <Ionicons name="construct-outline" size={16} color={Brand.warning} />
            <Text style={[styles.devBannerText, { textAlign }]}>
              {t('notifs.dev_warning', {
                defaultValue: 'Mode développement : ce build ne contient pas le module push natif. Toutes les actions utiliseront un token simulé. Lancez `eas build` ou `expo run:android` pour activer les vraies notifications.',
              })}
            </Text>
          </View>
        ) : null}

        {/* Hero band */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name={registered === false ? 'notifications-off-outline' : 'notifications'}
              size={28}
              color="#FFFFFF"
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroTitle, { textAlign }]}>
              {registered === false
                ? t('notifs.hero_off_title', { defaultValue: 'Restez à jour' })
                : t('notifs.hero_on_title', {
                    defaultValue: '{{count}} {{label}}',
                    count: optedInCount,
                    label: optedInCount === 1 ? 'sujet activé' : 'sujets activés',
                  })}
            </Text>
            <Text style={[styles.heroSub, { textAlign }]}>
              {registered === false
                ? t('notifs.hero_off_sub', {
                    defaultValue: 'Activez pour suivre vos commandes, ne pas rater une vente flash et débloquer des défis fidélité.',
                  })
                : t('notifs.hero_on_sub', {
                    defaultValue: 'Choisissez ce que vous voulez recevoir. Vous pouvez tout couper à tout moment.',
                  })}
            </Text>
          </View>
        </View>

        {/* CTA when not registered */}
        {registered === false ? (
          <Pressable
            onPress={onActivate}
            disabled={registering}
            style={({ pressed }) => [
              styles.cta,
              pressed && !registering && { opacity: 0.92 },
              registering && { opacity: 0.7 },
            ]}
          >
            {registering
              ? <ActivityIndicator color="#FFFFFF" />
              : <>
                  <Ionicons name="notifications" size={18} color="#FFFFFF" />
                  <Text style={styles.ctaText}>
                    {t('notifs.activate', { defaultValue: 'Activer les notifications' })}
                  </Text>
                </>
            }
          </Pressable>
        ) : null}

        {/* Bulk actions */}
        {topics.length > 0 && registered !== false ? (
          <View style={[styles.bulkRow, { flexDirection: rowDirection }]}>
            <Pressable onPress={() => onSetAll(true)} style={styles.bulkBtn}>
              <Ionicons name="checkmark-done" size={13} color={Brand.primary} />
              <Text style={styles.bulkText}>
                {t('notifs.enable_all', { defaultValue: 'Tout activer' })}
              </Text>
            </Pressable>
            <Pressable onPress={() => onSetAll(false)} style={styles.bulkBtn}>
              <Ionicons name="close" size={13} color={Brand.textMuted} />
              <Text style={[styles.bulkText, { color: Brand.textMuted }]}>
                {t('notifs.disable_all', { defaultValue: 'Tout désactiver (sauf requis)' })}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Topics list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Brand.primary} />
          </View>
        ) : topics.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { textAlign }]}>
              {t('notifs.empty', { defaultValue: 'Aucun sujet de notification configuré.' })}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {topics.map((tp) => (
              <TopicRow
                key={tp.topic_key}
                topic={tp}
                isAr={isAr}
                rowDirection={rowDirection}
                textAlign={textAlign}
                onToggle={(v) => onToggle(tp, v)}
              />
            ))}
          </View>
        )}

        {/* Unregister */}
        {registered ? (
          <Pressable onPress={onUnregister} style={styles.unregister}>
            <Ionicons name="notifications-off-outline" size={14} color={Brand.danger} />
            <Text style={styles.unregisterText}>
              {t('notifs.unregister_action', { defaultValue: 'Désactiver les notifications sur cet appareil' })}
            </Text>
          </Pressable>
        ) : null}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TopicRow({
  topic, isAr, rowDirection, textAlign, onToggle,
}: {
  topic: PushTopic;
  isAr: boolean;
  rowDirection: 'row' | 'row-reverse';
  textAlign: 'left' | 'right' | 'center';
  onToggle: (value: boolean) => void;
}) {
  const label = isAr ? topic.label_ar : topic.label_fr;
  const description = isAr ? topic.description_ar : topic.description_fr;

  return (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <View style={[styles.rowIcon, { backgroundColor: topic.accent_color + '22' }]}>
        <Text style={styles.rowEmoji}>{topic.emoji ?? '🔔'}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={[styles.rowTitleLine, { flexDirection: rowDirection }]}>
          <Text style={[styles.rowLabel, { textAlign }]} numberOfLines={1}>{label}</Text>
          {topic.is_required ? (
            <View style={styles.lockPill}>
              <Ionicons name="lock-closed" size={9} color="#FFFFFF" />
              <Text style={styles.lockPillText}>REQUIS</Text>
            </View>
          ) : null}
        </View>
        {description ? (
          <Text style={[styles.rowDesc, { textAlign }]} numberOfLines={2}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={topic.opted_in}
        onValueChange={onToggle}
        disabled={topic.is_required && topic.opted_in}
        trackColor={{ false: Brand.surfaceContainer, true: topic.accent_color + '88' }}
        thumbColor={topic.opted_in ? topic.accent_color : '#FFFFFF'}
      />
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
    flex: 1, textAlign: 'center',
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 17, color: Brand.secondary, letterSpacing: -0.2,
  },

  scroll: { padding: Spacing.md, gap: Spacing.md },

  devBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Brand.warningSoft,
    borderWidth: 1, borderColor: Brand.warning + '44',
  },
  devBannerText: {
    flex: 1,
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 11, color: Brand.warning, lineHeight: 15,
  },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xxl,
    backgroundColor: Brand.surface,
    borderWidth: 1, borderColor: Brand.border,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Brand.shadowBlue, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, color: Brand.secondary, letterSpacing: -0.2,
  },
  heroSub: {
    fontFamily: BrandFont.medium, fontSize: 12, color: Brand.textMuted,
    marginTop: 4, lineHeight: 17,
  },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 14, borderRadius: Radius.pill,
    backgroundColor: Brand.cta,
    shadowColor: Brand.shadowOrange, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 14, letterSpacing: 0.4,
  },

  bulkRow: { gap: Spacing.sm, justifyContent: 'flex-end' },
  bulkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surfaceMuted,
  },
  bulkText: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 11, color: Brand.primary, letterSpacing: 0.2,
  },

  list: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Brand.border,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    alignItems: 'center', gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Brand.surfaceMuted,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  rowEmoji: { fontSize: 22 },
  rowTitleLine: { alignItems: 'center', gap: 6 },
  rowLabel: {
    flex: 1,
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 13, color: Brand.secondary,
  },
  rowDesc: {
    fontFamily: BrandFont.medium, fontSize: 11,
    color: Brand.textMuted, marginTop: 2, lineHeight: 14,
  },
  lockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Brand.coral,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  lockPillText: {
    color: '#FFFFFF', fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 8, letterSpacing: 0.5,
  },

  center: {
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  emptyText: {
    fontFamily: BrandFont.medium, fontSize: 13, color: Brand.textMuted,
  },

  unregister: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  unregisterText: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 12, color: Brand.danger,
  },
});
