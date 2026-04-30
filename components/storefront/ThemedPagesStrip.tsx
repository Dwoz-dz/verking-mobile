/**
 * ThemedPagesStrip — horizontal scrollable strip of admin-curated
 * landing pages. Sits below the Hero on Home; tapping a pill
 * navigates to `/page/[slug]`.
 *
 * Hidden when the active themed pages list is empty so we don't
 * render a stray empty row.
 */
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { useActiveThemedPages } from '@/services/themedPages';

export function ThemedPagesStrip() {
  const { i18n } = useTranslation();
  const { rowDirection } = useDirection();
  const isAr = i18n.language === 'ar';
  const { pages } = useActiveThemedPages();

  if (pages.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      style={{ flexGrow: 0 }}
    >
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        {pages.map((p) => {
          const tone = p.tab_color || Brand.primary;
          const label = isAr ? p.title_ar : p.title_fr;
          return (
            <Link key={p.id} href={{ pathname: '/page/[slug]', params: { slug: p.slug } } as never} asChild>
              <Pressable
                style={[styles.pill, { borderColor: tone + '55', backgroundColor: tone + '10' }]}
              >
                {p.tab_emoji ? <Text style={styles.emoji}>{p.tab_emoji}</Text> : null}
                <Text style={[styles.label, { color: tone }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  row: { gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  emoji: { fontSize: 14 },
  label: { fontFamily: BrandFont.extrabold, fontWeight: '900', fontSize: 12, letterSpacing: -0.2, maxWidth: 140 },
});

export default ThemedPagesStrip;
