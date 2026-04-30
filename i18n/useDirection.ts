/**
 * useDirection — single hook that exposes the current locale, RTL flag, and
 * convenience values for layout (rowDirection, textAlign, chevron arrow).
 *
 * Components import this once and stop sprinkling `I18nManager.isRTL` checks
 * across the codebase.
 */
import { useTranslation } from 'react-i18next';
import { I18nManager, type FlexAlignType } from 'react-native';

import { DEFAULT_LOCALE, isRTL, type AppLocale } from '@/i18n';

export interface DirectionState {
  locale: AppLocale;
  rtl: boolean;
  /** Use as `style={{ flexDirection: rowDirection }}`. */
  rowDirection: 'row' | 'row-reverse';
  /** Use as `style={{ textAlign }}`. */
  textAlign: 'left' | 'right';
  /** Forward chevron in the current direction (→ in LTR, ← in RTL). */
  chevronEnd: '→' | '←';
  /** flex alignment for "start" of the line. */
  alignStart: FlexAlignType;
  /** flex alignment for "end" of the line. */
  alignEnd: FlexAlignType;
}

export function useDirection(): DirectionState {
  const { i18n } = useTranslation();
  const locale = ((i18n.language as AppLocale | undefined) ?? DEFAULT_LOCALE) as AppLocale;
  // Trust I18nManager.isRTL for the actual flip state — locale-derived isRTL
  // may not match if the user just switched and hasn't reloaded yet.
  const rtl = I18nManager.isRTL || isRTL(locale);
  return {
    locale,
    rtl,
    rowDirection: rtl ? 'row-reverse' : 'row',
    textAlign: rtl ? 'right' : 'left',
    chevronEnd: rtl ? '←' : '→',
    alignStart: rtl ? 'flex-end' : 'flex-start',
    alignEnd: rtl ? 'flex-start' : 'flex-end',
  };
}
