/**
 * Why VERKING block — 2x2 grid of feature pills.
 */
import { Ionicons, type Ionicons as IconType } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

type IconName = React.ComponentProps<typeof IconType>['name'];

interface Feature {
  icon: IconName;
  bg: string;
  iconColor: string;
  titleKey: string;
  subKey: string;
}

const FEATURES: Feature[] = [
  { icon: 'shield-checkmark', bg: '#E0F6F7', iconColor: '#0E9A95', titleKey: 'home.why_quality_title', subKey: 'home.why_quality_sub' },
  { icon: 'pricetags', bg: '#FFF5E1', iconColor: Brand.accent, titleKey: 'home.why_price_title', subKey: 'home.why_price_sub' },
  { icon: 'happy', bg: '#FFE4EC', iconColor: Brand.coral, titleKey: 'home.why_kids_title', subKey: 'home.why_kids_sub' },
  { icon: 'headset', bg: '#E8EFFD', iconColor: Brand.primary, titleKey: 'home.why_support_title', subKey: 'home.why_support_sub' },
];

export function WhyVerkingBlock() {
  const { t } = useTranslation();
  const { textAlign } = useDirection();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { textAlign }]}>{t('home.why_title')}</Text>
      <View style={styles.grid}>
        {FEATURES.map((f) => (
          <View key={f.titleKey} style={styles.card}>
            <View style={[styles.iconBubble, { backgroundColor: f.bg }]}>
              <Ionicons name={f.icon} size={22} color={f.iconColor} />
            </View>
            <Text style={[styles.cardTitle, { textAlign }]} numberOfLines={2}>
              {t(f.titleKey)}
            </Text>
            <Text style={[styles.cardSub, { textAlign }]} numberOfLines={2}>
              {t(f.subKey)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  heading: { fontSize: 20, fontWeight: '900', color: Brand.secondary, marginBottom: Spacing.md, letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    maxWidth: '48%',
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#1E293B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: { fontWeight: '900', color: Brand.secondary, fontSize: 14 },
  cardSub: { color: Brand.textMuted, fontSize: 11.5, fontWeight: '600' },
});
