/**
 * Brand palettes for each theme mode.
 *
 * The shape mirrors `Brand` in `constants/theme.ts` so any consumer
 * that already imports `Brand` keeps working — what changes is the
 * RUNTIME values, surfaced through `useThemedBrand()`.
 *
 * Three modes are supported:
 *   • light  — current default (navy on off-white)
 *   • dark   — navy-on-near-black (Android material dark feel)
 *   • amoled — true black + neutral whites for OLED battery savings
 */
export type ThemeMode = 'light' | 'dark' | 'amoled';

export interface BrandPalette {
  primary: string;
  primarySoft: string;
  secondary: string;
  secondaryBright: string;
  cta: string;
  ctaDeep: string;
  ctaSoft: string;
  accent: string;
  accentDeep: string;
  sunshine: string;
  sunshineSoft: string;
  mint: string;
  mintSoft: string;
  coral: string;
  coralSoft: string;
  lavender: string;
  lavenderSoft: string;
  fresh: string;
  freshSoft: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  border: string;
  outlineSoft: string;
  inputBg: string;
  primaryTint: string;
  glass: string;
  glassBorder: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textOnPrimary: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  shadow: string;
  shadowDeep: string;
  shadowOrange: string;
  shadowBlue: string;
}

export const LIGHT_PALETTE: BrandPalette = {
  primary: '#2D7DD2',
  primarySoft: '#5CA0E1',
  secondary: '#12335E',
  secondaryBright: '#2E5BFF',
  cta: '#FF7A1A',
  ctaDeep: '#E25D00',
  ctaSoft: '#FFE9D6',
  accent: '#FFB300',
  accentDeep: '#C8A900',
  sunshine: '#FFC93C',
  sunshineSoft: '#FFF4D6',
  mint: '#43D9DB',
  mintSoft: '#D7F4F2',
  coral: '#E85D6B',
  coralSoft: '#FFE4EC',
  lavender: '#7C5DDB',
  lavenderSoft: '#EFE9FF',
  fresh: '#4CAF80',
  freshSoft: '#DCF4E5',
  background: '#F9F9FC',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F4F8',
  surfaceContainer: '#EEF0F4',
  surfaceContainerHigh: '#E5E8EE',
  border: '#E2E5EB',
  outlineSoft: '#D4DCE8',
  inputBg: '#F1F3F9',
  primaryTint: '#E5EFFB',
  glass: 'rgba(255,255,255,0.82)',
  glassBorder: 'rgba(255,255,255,0.65)',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#F59E0B',
  warningSoft: '#FFEFD3',
  danger: '#DC2626',
  dangerSoft: '#FFE4E0',
  shadow: 'rgba(15, 23, 42, 0.08)',
  shadowDeep: 'rgba(15, 23, 42, 0.12)',
  shadowOrange: 'rgba(255, 122, 26, 0.30)',
  shadowBlue: 'rgba(45, 125, 210, 0.28)',
};

export const DARK_PALETTE: BrandPalette = {
  ...LIGHT_PALETTE,
  // Vibrant brand colours stay — only neutrals + surfaces shift.
  primary: '#5CA0E1',         // brighter so it pops on dark surfaces
  primarySoft: '#7AB8EE',
  secondary: '#0B1A2E',
  background: '#0B1220',
  surface: '#111B2E',
  surfaceMuted: '#152339',
  surfaceContainer: '#1A2A45',
  surfaceContainerHigh: '#22354F',
  border: '#22354F',
  outlineSoft: '#2D4264',
  inputBg: '#152339',
  primaryTint: '#1B2C45',
  glass: 'rgba(17, 27, 46, 0.78)',
  glassBorder: 'rgba(60, 90, 130, 0.45)',
  text: '#ECEDEE',
  textMuted: '#9CA3AF',
  textSubtle: '#6B7280',
  ctaSoft: 'rgba(255,122,26,0.18)',
  sunshineSoft: 'rgba(255,201,60,0.18)',
  mintSoft: 'rgba(67,217,219,0.18)',
  coralSoft: 'rgba(232,93,107,0.18)',
  lavenderSoft: 'rgba(124,93,219,0.18)',
  freshSoft: 'rgba(76,175,128,0.18)',
  successSoft: 'rgba(22,163,74,0.18)',
  warningSoft: 'rgba(245,158,11,0.18)',
  dangerSoft: 'rgba(220,38,38,0.18)',
  shadow: 'rgba(0, 0, 0, 0.45)',
  shadowDeep: 'rgba(0, 0, 0, 0.6)',
};

export const AMOLED_PALETTE: BrandPalette = {
  ...DARK_PALETTE,
  // True-black surfaces for OLED screens (zero pixel power on black).
  background: '#000000',
  surface: '#0A0A0A',
  surfaceMuted: '#0F0F0F',
  surfaceContainer: '#141414',
  surfaceContainerHigh: '#1C1C1C',
  border: '#1F1F1F',
  outlineSoft: '#2A2A2A',
  inputBg: '#0F0F0F',
  primaryTint: '#102032',
  glass: 'rgba(0, 0, 0, 0.86)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',
};

export function paletteFor(mode: ThemeMode): BrandPalette {
  switch (mode) {
    case 'amoled': return AMOLED_PALETTE;
    case 'dark':   return DARK_PALETTE;
    case 'light':
    default:       return LIGHT_PALETTE;
  }
}
