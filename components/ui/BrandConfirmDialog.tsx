/**
 * BrandConfirmDialog — branded replacement for `Alert.alert([yes, no])`.
 *
 * Why:
 *   The OS Alert is functional but stylistically off-brand and looks
 *   identical on every platform. Logout, "Vider le cache", "Supprimer
 *   l'adresse" deserve a confirmation that matches VERKING's identity
 *   AND distinguishes destructive actions visually (red CTA, warning
 *   icon).
 *
 * Usage:
 *   <BrandConfirmDialog
 *     visible={isOpen}
 *     title="Supprimer l'adresse"
 *     message="Cette action est irréversible."
 *     destructive
 *     onConfirm={() => handleDelete()}
 *     onCancel={() => setOpen(false)}
 *   />
 */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Brand, BrandFont, Radius } from '@/constants/theme';

import { BrandModal } from './BrandModal';

interface BrandConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Custom emoji (defaults to ❓ for normal, ⚠️ for destructive). */
  emoji?: string;
  /** Confirm button label (default: "Confirmer"). */
  confirmLabel?: string;
  /** Cancel button label (default: "Annuler"). */
  cancelLabel?: string;
  /** True ⇒ confirm CTA renders red, ⚠️ icon used. Default false. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BrandConfirmDialog({
  visible,
  title,
  message,
  emoji,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: BrandConfirmDialogProps) {
  const { t } = useTranslation();
  const resolvedEmoji = emoji ?? (destructive ? '⚠️' : '❓');

  return (
    <BrandModal visible={visible} onClose={onCancel} dismissOnBackdrop={!destructive}>
      <BrandModal.Header emoji={resolvedEmoji} title={title} subtitle={message} />
      <BrandModal.Footer>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.cancelText}>
            {cancelLabel ?? t('common.cancel', { defaultValue: 'Annuler' })}
          </Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.confirm,
            destructive && styles.confirmDestructive,
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.confirmText}>
            {confirmLabel ?? t('common.confirm', { defaultValue: 'Confirmer' })}
          </Text>
        </Pressable>
      </BrandModal.Footer>
    </BrandModal>
  );
}

const styles = StyleSheet.create({
  cancel: {
    backgroundColor: Brand.surfaceMuted,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelText: {
    color: Brand.text,
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 13,
  },
  confirm: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radius.lg,
    minWidth: 110,
    alignItems: 'center',
    shadowColor: 'rgba(45,125,210,0.4)',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  confirmDestructive: {
    backgroundColor: Brand.danger,
    shadowColor: 'rgba(220,38,38,0.4)',
  },
  confirmText: {
    color: '#FFF',
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },
});

export default BrandConfirmDialog;
