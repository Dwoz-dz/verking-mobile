/**
 * Section header — bold dark title + subtle subtitle + "Voir tout →" link
 * in warm CTA color. RTL-aware chevron.
 */
import { Link, type LinkProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  href?: LinkProps['href'];
  ctaLabel?: string;
}

export function SectionHeader({ title, subtitle, href, ctaLabel }: SectionHeaderProps) {
  const { t } = useTranslation();
  const { rowDirection, chevronEnd, textAlign } = useDirection();
  return (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <View style={styles.titleCol}>
        <Text style={[styles.title, { textAlign }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { textAlign }]}>{subtitle}</Text> : null}
      </View>
      {href ? (
        <Link href={href} style={styles.cta}>
          <Text style={styles.ctaText}>{(ctaLabel ?? t('home.see_all'))} {chevronEnd}</Text>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  titleCol: { flex: 1 },
  title: { fontSize: 20, fontWeight: '900', color: Brand.text, letterSpacing: -0.4 },
  sub: { fontSize: 12, color: Brand.textMuted, fontWeight: '600', marginTop: 2 },
  cta: { paddingVertical: 4 },
  ctaText: { color: Brand.cta, fontWeight: '900', fontSize: 13 },
});
