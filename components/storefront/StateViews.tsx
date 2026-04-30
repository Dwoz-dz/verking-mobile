/**
 * Loading / Error / Empty state primitives.
 */
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

interface BaseProps {
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({ style, label }: BaseProps & { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.center, style]}>
      <ActivityIndicator color={Brand.primary} />
      <Text style={styles.muted}>{label ?? t('states.loading')}</Text>
    </View>
  );
}

export function ErrorState({
  style,
  message,
  onRetry,
}: BaseProps & { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.center, style]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{t('states.error_title')}</Text>
      <Text style={styles.muted} numberOfLines={4}>{message}</Text>
      {onRetry ? (
        <Text style={styles.retry} onPress={onRetry}>{t('common.retry')}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  style,
  title,
  subtitle,
  emoji = '🛍️',
}: BaseProps & { title?: string; subtitle?: string; emoji?: string }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.center, style]}>
      <Text style={styles.icon}>{emoji}</Text>
      <Text style={styles.title}>{title ?? t('states.empty_default')}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  icon: { fontSize: 36 },
  title: { fontWeight: '700', fontSize: 16, color: Brand.secondary, textAlign: 'center' },
  muted: { color: Brand.textMuted, textAlign: 'center' },
  retry: {
    marginTop: Spacing.sm,
    color: Brand.primary,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
