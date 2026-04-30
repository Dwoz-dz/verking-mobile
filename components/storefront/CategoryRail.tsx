/**
 * Stitch-style category rail — glass tiles 64x64 with rounded-2xl, soft shadow,
 * brand-tinted icon, label below. Reads multilingual names via pickLocalized.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { pickLocalized } from '@/i18n/pickLocalized';
import { useDirection } from '@/i18n/useDirection';
import type { CategoryRow } from '@/types/database';

interface CategoryRailProps {
  categories: CategoryRow[];
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface CategoryStyle {
  icon: IconName;
  iconColor: string;
  bg: string;
  border: string;
}

const PALETTE: CategoryStyle[] = [
  { icon: 'book',           iconColor: '#ea580c', bg: '#FFF1E6', border: '#FFD9BF' }, // Cahiers (orange)
  { icon: 'create',         iconColor: '#0040e0', bg: '#E6EBFF', border: '#C6D1FF' }, // Stylos (blue)
  { icon: 'briefcase',      iconColor: '#7c3aed', bg: '#F1E8FF', border: '#DAC4FF' }, // Sacs (purple)
  { icon: 'calculator',     iconColor: '#059669', bg: '#D7F4F2', border: '#A8E5E0' }, // Calcul (emerald)
  { icon: 'color-palette',  iconColor: '#db2777', bg: '#FFE4EC', border: '#FCC4D6' }, // Arts (pink)
  { icon: 'reader',         iconColor: '#0891b2', bg: '#E0F6F7', border: '#B2E5E9' },
  { icon: 'pencil',         iconColor: Brand.accentDeep, bg: '#FFF9D4', border: '#F0DC8E' },
  { icon: 'school',         iconColor: Brand.coral, bg: '#FFE4EC', border: '#FCC4D6' },
];

export function CategoryRail({ categories }: CategoryRailProps) {
  const { i18n } = useTranslation();
  const { rtl } = useDirection();
  const locale = i18n.language as 'fr' | 'ar' | 'en';

  if (categories.length === 0) return null;
  const ordered = rtl ? [...categories].reverse() : categories;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {ordered.map((c, i) => {
        const palette = PALETTE[i % PALETTE.length];
        const name =
          pickLocalized(c as unknown as Record<string, unknown>, 'name', locale) || c.name_fr;
        return (
          <Link
            key={c.id}
            href={{ pathname: '/(tabs)/explore', params: { categoryId: c.id } }}
            asChild
          >
            <Pressable style={styles.tile}>
              <View style={[styles.tileBubble, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                {c.image ? (
                  <Image source={{ uri: c.image }} style={styles.image} contentFit="cover" />
                ) : c.mobile_icon ? (
                  <Text style={styles.emoji}>{c.mobile_icon}</Text>
                ) : (
                  <Ionicons name={palette.icon} size={26} color={palette.iconColor} />
                )}
              </View>
              <Text style={styles.label} numberOfLines={2}>{name}</Text>
            </Pressable>
          </Link>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.md, gap: Spacing.md, paddingBottom: 4 },
  tile: { width: 72, alignItems: 'center', gap: 6 },
  tileBubble: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: Brand.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  image: { width: '100%', height: '100%' },
  emoji: { fontSize: 28 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.text,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});
