/**
 * À propos tab — brand info, working hours, WhatsApp contact, language picker.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StationeryPattern } from '@/components/decorative/StationeryPattern';
import { Brandmark } from '@/components/storefront/Brandmark';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { setLanguage, SUPPORTED_LOCALES, type AppLocale } from '@/i18n';
import { useDirection } from '@/i18n/useDirection';
import { canReload, safeReload } from '@/lib/safeReload';
import { getSetting } from '@/services/settings';
import { getWhatsAppNumber, openWhatsApp } from '@/services/whatsapp';

export default function AboutScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, locale, rowDirection } = useDirection();
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [hours, setHours] = useState<string | null>(null);
  const [switching, setSwitching] = useState<AppLocale | null>(null);

  useEffect(() => {
    void (async () => {
      setWhatsapp(await getWhatsAppNumber());
      const wh = await getSetting<string>('working_hours');
      if (typeof wh === 'string') setHours(wh);
    })();
  }, []);

  const switchLanguage = async (next: AppLocale) => {
    if (next === locale || switching) return;
    setSwitching(next);
    try {
      const { requiresReload } = await setLanguage(next);
      if (requiresReload) {
        if (canReload()) {
          Alert.alert(
            t('about.rtl_reload_title'),
            t('about.rtl_reload_body'),
            [
              {
                text: t('common.ok'),
                onPress: async () => {
                  await safeReload();
                },
              },
            ],
          );
        } else {
          Alert.alert(
            t('about.rtl_reload_title'),
            t('about.rtl_reload_body'),
            [{ text: t('common.ok') }],
          );
        }
      }
    } finally {
      setSwitching(null);
    }
  };

  const langOptions: { code: AppLocale; label: string }[] = SUPPORTED_LOCALES.map((c) => ({
    code: c,
    label:
      c === 'fr'
        ? t('about.language_fr')
        : c === 'ar'
          ? t('about.language_ar')
          : t('about.language_en'),
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerBand}>
        <StationeryPattern variant="navy" intensity={0.55} density={28} seed={4242} />
        <View style={styles.headerContent}>
          <Brandmark size="lg" align="center" inverse variant="full" />
          <Text style={styles.headerTagline}>{t('about.section_house')}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t('about.section_house')}</Text>
          <Text style={[styles.cardBody, { textAlign }]}>{t('about.house_p1')}</Text>
          <Text style={[styles.cardBody, { textAlign }]}>
            {t('about.house_p2_html').replace(/<\/?b>/g, '')}
          </Text>
        </View>

        {hours ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { textAlign }]}>{t('about.section_hours')}</Text>
            <Text style={[styles.cardBody, { textAlign }]}>{hours}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t('about.section_language')}</Text>
          <View style={[styles.langRow, { flexDirection: rowDirection }]}>
            {langOptions.map((opt) => {
              const active = opt.code === i18n.language;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => void switchLanguage(opt.code)}
                  disabled={switching !== null}
                  style={[
                    styles.langBtn,
                    active && styles.langBtnActive,
                    switching === opt.code && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[styles.langBtnText, active && styles.langBtnTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {whatsapp ? (
          <Pressable onPress={() => void openWhatsApp()} style={styles.whatsappBtn}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
            <Text style={styles.whatsappText}>{t('about.whatsapp_cta')}</Text>
          </Pressable>
        ) : (
          <View style={[styles.card, styles.noticeCard]}>
            <Text style={[styles.noticeTitle, { textAlign }]}>
              {t('about.whatsapp_unconfigured_title')}
            </Text>
            <Text style={[styles.noticeBody, { textAlign }]}>
              {t('about.whatsapp_unconfigured_body')}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  headerBand: {
    backgroundColor: Brand.secondary,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
    marginBottom: Spacing.lg,
  },
  headerContent: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTagline: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: BrandFont.semibold,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
  },
  body: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: Spacing.sm,
  },
  cardTitle: { fontWeight: '800', color: Brand.secondary, fontSize: 16 },
  cardBody: { color: Brand.text, lineHeight: 20 },
  langRow: { gap: 8, flexWrap: 'wrap', marginTop: 6 },
  langBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  langBtnActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  langBtnText: { color: Brand.secondary, fontWeight: '700' },
  langBtnTextActive: { color: '#FFF' },
  whatsappBtn: {
    backgroundColor: '#25D366',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  whatsappText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  noticeCard: { borderColor: Brand.accent, borderStyle: 'dashed' },
  noticeTitle: { color: Brand.accent, fontWeight: '800' },
  noticeBody: { color: Brand.textMuted, fontSize: 13 },
});
