/**
 * ComingSoonModal — branded "Bientôt disponible" replacement.
 *
 * Replaces the bare `Alert.alert(t('settings.soon_toast'))` calls
 * scattered across the app with a polished modal:
 *   ▸ Animated emoji header (defaults to 🚧 🚀 ⏳ pool)
 *   ▸ Bilingual title + subtitle (auto FR/AR via i18n)
 *   ▸ Brand CTA "OK, compris"
 *   ▸ Optional secondary "🔔 Préviens-moi" CTA — triggers a push opt-in
 *     so the marketing team gets a count of interested users.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   ...
 *   <ComingSoonModal visible={open} onClose={() => setOpen(false)} />
 *
 * For one-off shouts, a thin imperative helper:
 *   import { showComingSoon } from '@/components/ui/ComingSoonModal';
 *   showComingSoon();   // mounts via portal-like global state
 */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Brand, BrandFont, Radius } from '@/constants/theme';

import { BrandModal } from './BrandModal';

interface ComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
  /** Custom override title (defaults to translated string). */
  title?: string;
  /** Custom override subtitle. */
  subtitle?: string;
  /** Custom emoji (defaults to 🚧). */
  emoji?: string;
  /** Show "Préviens-moi" secondary CTA. Default false. */
  showNotifyMe?: boolean;
  /** Called when the user taps "Préviens-moi". */
  onNotifyMe?: () => void;
}

export function ComingSoonModal({
  visible,
  onClose,
  title,
  subtitle,
  emoji = '🚧',
  showNotifyMe = false,
  onNotifyMe,
}: ComingSoonModalProps) {
  const { t } = useTranslation();

  const resolvedTitle = title ?? t('coming_soon.title', { defaultValue: 'Bientôt disponible' });
  const resolvedSubtitle = subtitle ?? t('coming_soon.subtitle', {
    defaultValue: 'Cette fonctionnalité arrive très bientôt. Restez à l’écoute !',
  });

  return (
    <BrandModal visible={visible} onClose={onClose}>
      <BrandModal.Header emoji={emoji} title={resolvedTitle} subtitle={resolvedSubtitle} />
      <BrandModal.Footer>
        {showNotifyMe ? (
          <Pressable
            onPress={() => {
              if (onNotifyMe) onNotifyMe();
              onClose();
            }}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.secondaryText}>
              🔔 {t('coming_soon.notify_me', { defaultValue: 'Préviens-moi' })}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.primary, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <Text style={styles.primaryText}>
            {t('coming_soon.ok', { defaultValue: 'OK, compris' })}
          </Text>
        </Pressable>
      </BrandModal.Footer>
    </BrandModal>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: Brand.cta,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryText: {
    color: '#FFF',
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  secondary: {
    backgroundColor: Brand.primaryTint,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.primary + '33',
  },
  secondaryText: {
    color: Brand.primary,
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 13,
  },
});

export default ComingSoonModal;
