/**
 * Large promo card — gradient-look filled banner with title / subtitle / CTA.
 * Two static gradients (mimicked with stacked Views since RN core has no
 * native gradient). Used between rails to break up the marketplace feed.
 */
import { Link, type LinkProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

export type PromoCardTone = 'sunset' | 'mint' | 'lavender' | 'sky';

interface PromoCardProps {
  title: string;
  subtitle?: string;
  cta?: string;
  tone?: PromoCardTone;
  emoji?: string;
  href?: LinkProps['href'];
}

const TONES: Record<PromoCardTone, { bg: string; accent: string; text: string; sub: string; ctaBg: string; ctaText: string }> = {
  sunset: { bg: '#FFE9D6', accent: '#FFB07A', text: '#7A2E0A', sub: '#A75330', ctaBg: '#F57C00', ctaText: '#FFF' },
  mint: { bg: '#D7F4F2', accent: '#76DCD8', text: Brand.secondary, sub: '#3E7C7A', ctaBg: '#0E9A95', ctaText: '#FFF' },
  lavender: { bg: '#E8E1FF', accent: '#B7A6F4', text: '#3A2784', sub: '#5C4BB1', ctaBg: '#6E5BD6', ctaText: '#FFF' },
  sky: { bg: '#DCEBFF', accent: '#7AB0F6', text: '#173764', sub: '#3F6BA6', ctaBg: Brand.primary, ctaText: '#FFF' },
};

export function PromoCard({
  title,
  subtitle,
  cta,
  tone = 'sky',
  emoji = '✨',
  href,
}: PromoCardProps) {
  const { textAlign } = useDirection();
  const c = TONES[tone];

  const inner = (
    <View style={[styles.card, { backgroundColor: c.bg }]}>
      {/* Decorative blurred circle */}
      <View style={[styles.blob, { backgroundColor: c.accent }]} />
      <View style={[styles.blobSmall, { backgroundColor: c.accent }]} />

      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.title, { color: c.text, textAlign }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.sub, { color: c.sub, textAlign }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {cta ? (
          <View style={[styles.cta, { backgroundColor: c.ctaBg }]}>
            <Text style={[styles.ctaText, { color: c.ctaText }]}>{cta}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable>{inner}</Pressable>
      </Link>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    minHeight: 130,
    justifyContent: 'center',
    shadowColor: '#1E293B',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    position: 'relative',
  },
  blob: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 999,
    right: -70,
    top: -80,
    opacity: 0.45,
  },
  blobSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
    right: 30,
    bottom: -60,
    opacity: 0.25,
  },
  content: { gap: 6 },
  emoji: { fontSize: 26 },
  title: { fontWeight: '900', fontSize: 18, letterSpacing: 0.2 },
  sub: { fontWeight: '600', fontSize: 12 },
  cta: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.4 },
});
