/**
 * ThemedTabs — horizontal scrollable filter tabs used at the top of
 * Explore. Inspired by AliExpress campaign tabs (Explorez / Économies
 * / Rentrée / …) but VERKING-themed: school-supplies categories +
 * commercial pillars (Économies, Spécial Gros).
 *
 * For Phase 2 the list is hard-coded and each tab maps to a local
 * filter applied client-side. Phase 5 will swap this for the dynamic
 * `mobile_themed_pages` table without changing the public API of this
 * component.
 */
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

export type ThemeKey = 'explorez' | 'economies' | 'rentree' | 'gros' | 'cartables' | 'trousses';

export const THEME_ORDER: ThemeKey[] = [
  'explorez', 'economies', 'rentree', 'gros', 'cartables', 'trousses',
];

const THEME_ICON: Record<ThemeKey, keyof typeof Ionicons.glyphMap> = {
  explorez:  'compass',
  economies: 'pricetags',
  rentree:   'school',
  gros:      'cube',
  cartables: 'briefcase',
  trousses:  'pencil',
};

const THEME_TONE: Record<ThemeKey, string> = {
  explorez:  Brand.primary,
  economies: Brand.cta,
  rentree:   Brand.fresh,
  gros:      Brand.mint,
  cartables: Brand.lavender,
  trousses:  Brand.coral,
};

interface ThemedTabsProps {
  active: ThemeKey;
  onSelect: (key: ThemeKey) => void;
}

export function ThemedTabs({ active, onSelect }: ThemedTabsProps) {
  const { t } = useTranslation();
  const { rowDirection } = useDirection();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Phase 1.6 — `flexGrow: 0` keeps the row from stretching to fill
      // empty space when there are few tabs; `decelerationRate="fast"`
      // makes the swipe land cleanly on the next tab instead of drifting
      // mid-chip (the half-cut fragments seen in PTP-N49).
      contentContainerStyle={styles.scroll}
      style={{ flexGrow: 0 }}
      decelerationRate="fast"
    >
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        {THEME_ORDER.map((key) => {
          const isActive = key === active;
          const tone = THEME_TONE[key];
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              style={[
                styles.tab,
                isActive && { backgroundColor: tone, borderColor: tone },
              ]}
            >
              <Ionicons
                name={THEME_ICON[key]}
                size={13}
                color={isActive ? '#FFF' : tone}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? '#FFF' : Brand.text },
                ]}
                numberOfLines={1}
              >
                {t(`explore_themes.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  row: { gap: 6 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1.5, borderColor: Brand.border,
    backgroundColor: '#FFF',
  },
  tabLabel: { fontSize: 12, fontWeight: '900', letterSpacing: -0.1 },
});

export default ThemedTabs;
