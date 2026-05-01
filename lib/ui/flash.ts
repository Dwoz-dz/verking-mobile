/**
 * lib/ui/flash — single point of truth for one-off user-facing
 * messages that today fall back to `Alert.alert`.
 *
 * Why route through a helper instead of using `Alert.alert` directly
 * everywhere:
 *   ▸ The OS Alert is functionally fine but stylistically off-brand
 *     (white dialog, system font, no animation). Phase Final wires
 *     all these messages through one helper so a single future swap —
 *     replacing the implementation with a branded modal — propagates
 *     across every screen at once.
 *   ▸ It also lets us add cross-cutting behaviour later (analytics
 *     event, haptic feedback, voice-over hint) in one place.
 *
 * Today the helper is a thin pass-through. Tomorrow it becomes a
 * BrandModal-backed toast queue. **Call sites don't change.**
 *
 * Three flavours:
 *   ▸ flashInfo({ title, body? })          — single-OK confirmation
 *   ▸ flashError({ title?, body, error? }) — error report; logs `error`
 *                                            to the JS console for the
 *                                            crash reporter (Phase 7+).
 *   ▸ flashConfirm({ title, body, confirmLabel?, destructive?,
 *                    onConfirm, onCancel? }) — yes/no dialog
 */
import { Alert } from 'react-native';

export interface FlashInfoInput {
  title: string;
  body?: string;
}

export interface FlashErrorInput {
  title?: string;
  body: string;
  /** Original error — surfaced to the console for the crash reporter. */
  error?: unknown;
}

export interface FlashConfirmInput {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function flashInfo(input: FlashInfoInput): void {
  Alert.alert(input.title, input.body);
}

export function flashError(input: FlashErrorInput): void {
  // Keep the console line so the crash reporter (Sentry — Phase 7)
  // picks it up automatically once installed.
  if (input.error !== undefined) {
    console.warn(`[flash] ${input.title ?? 'Error'}:`, input.error);
  }
  Alert.alert(input.title ?? 'Erreur', input.body);
}

export function flashConfirm(input: FlashConfirmInput): void {
  Alert.alert(
    input.title,
    input.body,
    [
      {
        text: input.cancelLabel ?? 'Annuler',
        style: 'cancel',
        onPress: input.onCancel,
      },
      {
        text: input.confirmLabel ?? 'Confirmer',
        style: input.destructive ? 'destructive' : 'default',
        onPress: input.onConfirm,
      },
    ],
  );
}
