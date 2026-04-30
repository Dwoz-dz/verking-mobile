/**
 * SignupPromptBanner — eye-catching "🎁 سجل الآن" pinned card.
 *
 * Where it shows up:
 *   • Profile screen (top, conditional !is_registered)
 *   • Cart empty state
 *   • Checkout (guest only, above CTA)
 *
 * The component is a pure presentational tile — the parent decides
 * whether to render it (conditional on `useRegistrationStatus()`).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFont, Radius, Spacing } from '@/constants/theme';
import { KidColors } from '@/constants/kidColors';

interface Props {
  /** Optional override (defaults to compact). */
  variant?: 'compact' | 'full';
  /** Optional dismiss action — when omitted, the X is hidden. */
  onDismiss?: () => void;
}

export function SignupPromptBanner({ variant = 'compact', onDismiss }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const onPress = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.push('/register' as never);
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        variant === 'full' && styles.full,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {/* Layered candy gradient */}
      <View style={[styles.blobOne, { backgroundColor: KidColors.coralPink + 'CC' }]} />
      <View style={[styles.blobTwo, { backgroundColor: KidColors.butter + 'AA' }]} />

      <View style={styles.giftCircle}>
        <Text style={styles.giftEmoji}>🎁</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={2}>
          {t('signup_banner.title', { defaultValue: 'سجل الآن واربح 500 نقطة' })}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {t('signup_banner.sub', { defaultValue: 'تسجيل بسيط بدون كلمة سر — هدية فورية ✨' })}
        </Text>
      </View>

      <View style={styles.cta}>
        <Ionicons name="arrow-forward-circle" size={26} color={KidColors.cta} />
      </View>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          style={styles.dismiss}
        >
          <Ionicons name="close" size={14} color={KidColors.textSoft} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.xxl,
    backgroundColor: KidColors.creamSoft,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: KidColors.coralPink + '88',
    shadowColor: KidColors.coral,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  full: { paddingVertical: 18 },
  blobOne: {
    position: 'absolute',
    right: -30, top: -30,
    width: 140, height: 140, borderRadius: 999,
  },
  blobTwo: {
    position: 'absolute',
    left: -40, bottom: -40,
    width: 130, height: 130, borderRadius: 999,
  },
  giftCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: KidColors.butter,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: KidColors.sunshine,
    zIndex: 2,
  },
  giftEmoji: { fontSize: 24 },
  title: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 14, color: KidColors.text,
    zIndex: 2,
  },
  sub: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 12, color: KidColors.textSoft,
    marginTop: 2, zIndex: 2,
  },
  cta: { zIndex: 2 },
  dismiss: {
    position: 'absolute',
    top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 3,
  },
});

export default SignupPromptBanner;
