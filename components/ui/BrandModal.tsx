/**
 * BrandModal — reusable VERKING modal shell.
 *
 * Replaces ad-hoc `<Modal />` + custom backdrop + centered card patterns
 * scattered across the app (RewardCelebration, SchoolLevelPicker,
 * WilayaPickerModal, …) with a single consistent shape so:
 *   ▸ Brand colors / radii / shadows stay in lock-step
 *   ▸ Backdrop tap to dismiss is uniform
 *   ▸ Animation timing matches across screens (premium feel)
 *
 * Composition:
 *   <BrandModal visible onClose>
 *     <BrandModal.Header icon="..." title="..." subtitle="..." />
 *     <BrandModal.Body>...</BrandModal.Body>
 *     <BrandModal.Footer>...</BrandModal.Footer>
 *   </BrandModal>
 *
 * Or ad-hoc by passing children directly.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';

interface BrandModalProps {
  visible: boolean;
  onClose: () => void;
  /** Tap on the backdrop dismisses by default. Set false for required modals. */
  dismissOnBackdrop?: boolean;
  /** Maximum width override (default: 92% screen, max 420 px). */
  maxWidth?: number;
  /** Container style override (e.g. background color for branded modals). */
  containerStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function BrandModal({
  visible,
  onClose,
  dismissOnBackdrop = true,
  maxWidth = 420,
  containerStyle,
  children,
}: BrandModalProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.94);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      scale.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.4)) });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.94, { duration: 180 });
    }
  }, [opacity, scale, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onClose : undefined}
          accessibilityLabel="Fermer"
        />
        <Animated.View
          style={[styles.card, { maxWidth }, containerStyle, cardStyle]}
          accessibilityRole="alert"
        >
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Composition slots ─────────────────────────────────────────────────

interface HeaderProps {
  icon?: ComponentProps<typeof Ionicons>['name'];
  emoji?: string;
  title: string;
  subtitle?: string;
  /** Tone color for the icon plate (default: brand primary). */
  tone?: string;
}

function BrandModalHeader({ icon, emoji, title, subtitle, tone }: HeaderProps) {
  const accent = tone ?? Brand.primary;
  return (
    <View style={headerStyles.wrap}>
      {emoji ? (
        <Text style={headerStyles.emoji}>{emoji}</Text>
      ) : icon ? (
        <View style={[headerStyles.iconPlate, { backgroundColor: accent + '1F' }]}>
          <Ionicons name={icon} size={26} color={accent} />
        </View>
      ) : null}
      <Text style={headerStyles.title}>{title}</Text>
      {subtitle ? <Text style={headerStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function BrandModalBody({ children }: { children: ReactNode }) {
  return <View style={bodyStyles.wrap}>{children}</View>;
}

function BrandModalFooter({ children }: { children: ReactNode }) {
  return <View style={footerStyles.wrap}>{children}</View>;
}

BrandModal.Header = BrandModalHeader;
BrandModal.Body = BrandModalBody;
BrandModal.Footer = BrandModalFooter;

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  card: {
    width: '100%',
    backgroundColor: Brand.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
  },
});

const headerStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  emoji: { fontSize: 48, marginBottom: 4 },
  iconPlate: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 18,
    color: Brand.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: BrandFont.medium,
    fontWeight: '500',
    fontSize: 13,
    color: Brand.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
});

const bodyStyles = StyleSheet.create({
  wrap: { gap: 8, paddingVertical: 4 },
});

const footerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: Spacing.md,
    flexWrap: 'wrap',
  },
});

export default BrandModal;
