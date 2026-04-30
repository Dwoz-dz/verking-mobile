/**
 * /info/[slug] — Phase 3.5 admin-driven static info pages.
 *
 * Reads from `mobile_pages` (Phase 2.1) — a deliberately simple
 * "slug → title + body" CMS for the four standard documents:
 *   /info/help       Centre d'aide
 *   /info/faq        Questions fréquentes
 *   /info/privacy    Confidentialité
 *   /info/terms      Conditions d'utilisation
 *
 * The body is plain text (admin-managed, easy to localise). When the
 * admin team needs richer pages with images / sections, the existing
 * `/page/[slug]` (themed pages) covers that — this route is for the
 * boring-but-essential T&C / Privacy / Help content.
 *
 * Realtime: any admin edit on `mobile_pages` propagates immediately
 * (the table is in the supabase_realtime publication).
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyStateView } from '@/components/ui/EmptyStateView';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { useRefreshTick } from '@/lib/refresh/refreshBus';
import { subscribeRealtime } from '@/lib/realtime/realtimeHub';
import { supabase } from '@/lib/supabase/client';

interface PageRow {
  slug: string;
  title_fr: string;
  title_ar: string | null;
  body_fr: string;
  body_ar: string | null;
  is_published: boolean;
  updated_at: string;
}

const SLUG_FALLBACK_TITLES: Record<string, { fr: string; ar: string; emoji: string }> = {
  help:    { fr: 'Centre d’aide',          ar: 'مركز المساعدة',  emoji: '🆘' },
  faq:     { fr: 'Questions fréquentes',   ar: 'الأسئلة الشائعة', emoji: '❓' },
  privacy: { fr: 'Confidentialité',        ar: 'الخصوصية',       emoji: '🛡️' },
  terms:   { fr: 'Conditions d’utilisation', ar: 'شروط الاستخدام', emoji: '📜' },
};

export default function InfoPageScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const { i18n, t } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = i18n.language === 'ar';
  const globalTick = useRefreshTick();

  const [page, setPage] = useState<PageRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const fetchPage = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('mobile_pages')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) setPage(data as PageRow);
      else setPage(null);
      setLoading(false);
    };
    void fetchPage();

    // Realtime via hub — admin edits propagate without an app restart.
    const unsub = subscribeRealtime('mobile_pages', `slug=eq.${slug}`, () => {
      void fetchPage();
    });
    return () => { cancelled = true; unsub(); };
  }, [slug, globalTick]);

  const fallback = SLUG_FALLBACK_TITLES[slug];
  const title = page
    ? (isAr ? (page.title_ar ?? page.title_fr) : page.title_fr)
    : (fallback ? (isAr ? fallback.ar : fallback.fr) : slug);
  const body = page ? (isAr ? (page.body_ar ?? page.body_fr) : page.body_fr) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
          {fallback ? `${fallback.emoji} ${title}` : title}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : !page || !body ? (
        <EmptyStateView
          size="lg"
          emoji={fallback?.emoji ?? '📄'}
          title={t('info.empty_title', { defaultValue: 'Contenu en préparation' })}
          subtitle={t('info.empty_sub', {
            defaultValue: 'Cette page est en cours de rédaction par notre équipe.',
          })}
          ctaLabel={t('common.back', { defaultValue: 'Retour' })}
          onCta={() => router.back()}
          style={{ flex: 1 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.body, { textAlign }]}>{body}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={11} color={Brand.textSubtle} />
            <Text style={styles.metaText}>
              {t('info.updated_at', {
                defaultValue: 'Mis à jour : {{date}}',
                date: new Date(page.updated_at).toLocaleDateString(
                  isAr ? 'ar-DZ' : 'fr-DZ',
                ),
              })}
            </Text>
          </View>
        </ScrollView>
      )}
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
    fontSize: 16,
    color: Brand.secondary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.text,
    lineHeight: 21,
    fontFamily: BrandFont.medium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
  },
  metaText: {
    fontSize: 11,
    color: Brand.textSubtle,
    fontWeight: '600',
  },
});
