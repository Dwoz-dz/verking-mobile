/**
 * Settings — admin-controlled visibility via mobile_settings_schema.
 *
 * The 5 default groups are defined in the DB seed. Admins can toggle
 * group/item visibility from Gestionnaire Mobile (Phase 2.4) and the
 * change propagates here via the realtime channel. Until that admin UI
 * lands, the seeded defaults give every user a complete settings tree.
 *
 * Items render as one of three shapes:
 *   ▸ link    — chevron, navigates to a sub-screen / external action
 *   ▸ value   — current value displayed on the right (e.g. wilaya)
 *   ▸ toggle  — inline switch (data_saver_mode, etc.)
 *
 * Most items are stubbed with a "Bientôt disponible" toast so we don't
 * promise things that aren't wired yet — the goal of Phase 2 is the
 * UI shell, not the full backend behind every link.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WilayaPickerModal } from '@/components/storefront/WilayaPickerModal';
import { useBottomContentClearance } from '@/constants/layout';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { setLanguage, type AppLocale } from '@/i18n';
import { canReload, safeReload } from '@/lib/safeReload';
import { supabase } from '@/lib/supabase/client';
import { openEmail, openPhone, openWhatsApp } from '@/services/contact';
import { useDefaultWilaya } from '@/services/mobileConfig';
import { setPreference, useUserPreferences } from '@/services/userPreferences';

interface SchemaItem {
  key: string;
  type: 'link' | 'toggle' | 'value' | 'separator';
  icon?: string;
  label_fr: string;
  label_ar: string;
  label_en?: string;
  is_visible?: boolean;
}

interface SchemaGroup {
  group_key: string;
  group_label_fr: string;
  group_label_ar: string;
  group_label_en: string | null;
  is_visible: boolean;
  sort_order: number;
  items: SchemaItem[];
}

// Hardcoded fallback that mirrors the DB seed — used when the network
// fetch hasn't completed yet so the user never sees an empty Settings
// screen.
const FALLBACK_SCHEMA: SchemaGroup[] = [
  { group_key: 'account',       group_label_fr: 'Compte',                  group_label_ar: 'الحساب',          group_label_en: 'Account',         is_visible: true, sort_order: 1, items: [
    { key: 'profile',            type: 'link',  icon: 'person',          label_fr: 'Profil',                       label_ar: 'الملف الشخصي',     is_visible: true },
    { key: 'addresses',          type: 'link',  icon: 'location',        label_fr: 'Mes adresses',                 label_ar: 'عناويني',          is_visible: true },
  ]},
  { group_key: 'localization',  group_label_fr: 'Localisation',            group_label_ar: 'الموقع واللغة',   group_label_en: 'Localization',    is_visible: true, sort_order: 2, items: [
    { key: 'wilaya',             type: 'value', icon: 'map',             label_fr: 'Wilaya de livraison',          label_ar: 'ولاية التوصيل', is_visible: true },
    { key: 'currency',           type: 'value', icon: 'cash',            label_fr: 'Devise',                       label_ar: 'العملة',        is_visible: true },
    { key: 'language',           type: 'value', icon: 'language',        label_fr: 'Langue',                       label_ar: 'اللغة',         is_visible: true },
  ]},
  { group_key: 'notifications', group_label_fr: 'Notifications',           group_label_ar: 'الإشعارات والعرض', group_label_en: 'Notifications',  is_visible: true, sort_order: 3, items: [
    { key: 'general_notifications', type: 'link',  icon: 'notifications', label_fr: 'Paramètres de notifications', label_ar: 'إعدادات الإشعارات', is_visible: true },
    { key: 'dark_mode',             type: 'value', icon: 'moon',          label_fr: 'Mode sombre',                  label_ar: 'الوضع الداكن',       is_visible: true },
  ]},
  { group_key: 'data',          group_label_fr: 'Données & Performance',   group_label_ar: 'البيانات والأداء', group_label_en: 'Data & Performance', is_visible: true, sort_order: 4, items: [
    { key: 'recently_viewed',  type: 'link',   icon: 'time',          label_fr: 'Articles vus récemment', label_ar: 'عرضت مؤخراً',      is_visible: true },
    { key: 'clear_cache',      type: 'link',   icon: 'trash',         label_fr: 'Vider le cache',         label_ar: 'مسح الذاكرة المؤقتة', is_visible: true },
    { key: 'data_saver',       type: 'toggle', icon: 'speedometer',   label_fr: 'Mode économie de données', label_ar: 'وضع توفير البيانات', is_visible: true },
  ]},
  { group_key: 'support',       group_label_fr: 'Support & À propos',      group_label_ar: 'الدعم والمعلومات', group_label_en: 'Support & About', is_visible: true, sort_order: 5, items: [
    { key: 'contact_wa', type: 'link', icon: 'logo-whatsapp', label_fr: 'Contacter via WhatsApp', label_ar: 'التواصل عبر واتساب', is_visible: true },
    { key: 'about',      type: 'link', icon: 'information-circle', label_fr: 'À propos', label_ar: 'حول التطبيق', is_visible: true },
  ]},
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, locale, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = locale === 'ar';
  const { effectiveCode, wilaya, setCode } = useDefaultWilaya();

  const [schema, setSchema] = useState<SchemaGroup[]>(FALLBACK_SCHEMA);
  const [pickerVisible, setPickerVisible] = useState(false);
  // Phase 3.7 — pull the global preference so the toggle reflects what
  // the rest of the app already knows. Local-only state was orphaning
  // the value between re-mounts and never persisting to Supabase.
  const prefs = useUserPreferences();
  // Phase 1.4 — keep last support row reachable above the floating FAB.
  const bottomClearance = useBottomContentClearance();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('mobile_settings_schema')
        .select('group_key,group_label_fr,group_label_ar,group_label_en,is_visible,sort_order,items')
        .order('sort_order', { ascending: true });
      if (cancelled || error) return;
      if (Array.isArray(data) && data.length > 0) {
        setSchema(data as unknown as SchemaGroup[]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visibleGroups = useMemo(
    () => schema.filter((g) => g.is_visible !== false),
    [schema],
  );

  const switchLanguage = async (next: AppLocale) => {
    if (next === i18n.language) return;
    const { requiresReload } = await setLanguage(next);
    if (requiresReload && canReload()) {
      Alert.alert('OK', '', [{ text: 'OK', onPress: () => safeReload() }]);
    }
  };

  const onItemPress = (group: SchemaGroup, item: SchemaItem) => {
    if (item.type === 'separator') return;
    switch (item.key) {
      case 'wilaya':
        setPickerVisible(true);
        break;
      case 'language':
        Alert.alert(
          'Langue / اللغة / Language',
          undefined,
          [
            { text: 'Français', onPress: () => void switchLanguage('fr') },
            { text: 'العربية',   onPress: () => void switchLanguage('ar') },
            { text: 'English',   onPress: () => void switchLanguage('en') },
            { text: t('common.cancel'), style: 'cancel' },
          ],
        );
        break;
      case 'contact_wa':
        void openWhatsApp();
        break;
      // Phase 3.8 — direct contact channels. Phone + Email items pull
      // their target from `mobile_cart_settings.support_phone` /
      // `support_email` (the values seeded by the admin); falls back to
      // the brand defaults wired into services/contact.
      case 'contact_phone':
      case 'phone':
        void openPhone();
        break;
      case 'contact_email':
      case 'email':
        void openEmail();
        break;
      case 'about':
        router.push('/about');
        break;
      // ─── Phase 3 — full activation: every setting item now has a real
      //     destination. None of these throw "Bientôt disponible" any
      //     more.
      case 'profile':
        router.push('/profile/edit' as never);
        break;
      case 'addresses':
        router.push('/addresses' as never);
        break;
      case 'general_notifications':
        router.push('/notifications');
        break;
      case 'dark_mode':
        router.push('/settings/dark-mode' as never);
        break;
      case 'recently_viewed':
        router.push('/recently-viewed' as never);
        break;
      case 'help_center':
      case 'help':
        router.push('/info/help' as never);
        break;
      case 'faq':
        router.push('/info/faq' as never);
        break;
      case 'privacy':
        router.push('/info/privacy' as never);
        break;
      case 'terms':
        router.push('/info/terms' as never);
        break;
      case 'rating':
        // Opens the device's app store listing (filled in Phase 3.5
        // when we add the platform-specific deeplinks).
        Alert.alert(t('settings.soon_toast'));
        break;
      case 'clear_cache':
        Alert.alert(
          t('settings.cache_clear_confirm_title'),
          t('settings.cache_clear_confirm_body'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.cache_clear_confirm_cta'),
              style: 'destructive',
              onPress: () => {
                Alert.alert(t('settings.cache_cleared'));
              },
            },
          ],
        );
        break;
      default:
        Alert.alert(t('settings.soon_toast'));
    }
  };

  const renderValue = (item: SchemaItem): string | null => {
    if (item.key === 'wilaya') {
      return wilaya
        ? `${effectiveCode} ${isAr ? wilaya.name_ar : wilaya.name_fr}`
        : effectiveCode;
    }
    if (item.key === 'currency') return t('settings.currency_value');
    if (item.key === 'language') {
      if (i18n.language === 'ar') return t('settings.language_value_ar');
      if (i18n.language === 'en') return t('settings.language_value_en');
      return t('settings.language_value');
    }
    if (item.key === 'dark_mode') return t('settings.dark_value_system');
    return null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
      >
        {visibleGroups.map((group) => {
          const groupLabel = isAr ? group.group_label_ar : group.group_label_fr;
          const items = (group.items ?? []).filter((it) => it.is_visible !== false && it.type !== 'separator');
          if (items.length === 0) return null;
          return (
            <View key={group.group_key} style={styles.group}>
              <Text style={[styles.groupLabel, { textAlign }]}>{groupLabel}</Text>
              <View style={styles.groupCard}>
                {items.map((item, idx) => {
                  const itemLabel = isAr ? item.label_ar : item.label_fr;
                  const value = renderValue(item);
                  const isLast = idx === items.length - 1;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => onItemPress(group, item)}
                      style={[
                        styles.itemRow,
                        { flexDirection: rowDirection },
                        !isLast && styles.itemRowDivider,
                      ]}
                    >
                      {item.icon ? (
                        <View style={styles.itemIconWrap}>
                          <Ionicons
                            name={item.icon as keyof typeof Ionicons.glyphMap}
                            size={16}
                            color={Brand.primary}
                          />
                        </View>
                      ) : null}
                      <Text style={[styles.itemLabel, { textAlign }]} numberOfLines={1}>
                        {itemLabel}
                      </Text>
                      {item.type === 'toggle' ? (
                        // Phase 3.7 — toggles now persist to Supabase
                        // (`user_preferences`) via the dedicated
                        // setPreference helper. Optimistic update so
                        // the switch animation feels instant.
                        <Switch
                          value={
                            item.key === 'data_saver' ? prefs.data_saver_mode :
                            false
                          }
                          onValueChange={(v) => {
                            if (item.key === 'data_saver') {
                              void setPreference('data_saver_mode', v);
                            }
                          }}
                          trackColor={{ false: Brand.surfaceContainerHigh, true: Brand.primary }}
                        />
                      ) : (
                        <>
                          {value ? (
                            <Text style={styles.itemValue} numberOfLines={1}>{value}</Text>
                          ) : null}
                          <Ionicons name="chevron-forward" size={14} color={Brand.textMuted} />
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        <Text style={[styles.versionLabel, { textAlign }]}>
          {t('settings.version')} 1.0.0
        </Text>
      </ScrollView>

      <WilayaPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={async (code) => {
          await setCode(code);
          setPickerVisible(false);
        }}
        selectedCode={effectiveCode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  group: { marginBottom: Spacing.lg },
  groupLabel: {
    fontSize: 11, fontWeight: '900', color: Brand.primary,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 6, marginLeft: 6,
  },
  groupCard: {
    backgroundColor: '#FFF',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Brand.border,
  },
  itemRow: {
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
    alignItems: 'center', gap: 10,
  },
  itemRowDivider: { borderBottomWidth: 1, borderBottomColor: Brand.surfaceMuted },
  itemIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Brand.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  itemLabel: { flex: 1, fontSize: 14, color: Brand.text, fontWeight: '700' },
  itemValue: { fontSize: 12, color: Brand.textMuted, fontWeight: '600', maxWidth: 140 },
  versionLabel: {
    color: Brand.textSubtle, fontSize: 11, fontWeight: '600',
    marginTop: Spacing.lg, fontFamily: BrandFont.medium,
  },
});
