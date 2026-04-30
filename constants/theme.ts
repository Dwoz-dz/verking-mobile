/**
 * VERKING — Brand v5 (Master Plan, Phase 0).
 *
 * Calibrated palette pulled from the official VERKING / S.T.P Stationery
 * logo & background pattern:
 *
 *   ▸ `primary`    — #2D7DD2 trust blue (nav, brand wordmark, headings)
 *   ▸ `secondary`  — #12335E deep navy (text emphasis, brand depth)
 *   ▸ `cta`        — #FF7A1A warm orange — RESERVED for action only:
 *                    prices, Add-to-cart, FAB, urgency / promo chips.
 *                    Per user feedback, the app stays trust-blue-led;
 *                    orange must never dominate.
 *   ▸ `coral`      — #E85D6B kids coral (NEW badge, soft alerts)
 *   ▸ `sunshine`   — #FFC93C sunshine gold (TOP / ratings / flash sale)
 *   ▸ `mint`       — #43D9DB Gros pill / wholesale accent
 *   ▸ `fresh`      — #4CAF80 verdant green (eco / school supplies tile)
 *   ▸ `lavender`   — #7C5DDB deeper purple (creativity tile)
 *
 * Surfaces stay airy (off-white background, white cards, soft tinted
 * shadows). Plus Jakarta Sans is the brand font (loaded in _layout via
 * @expo-google-fonts/plus-jakarta-sans).
 */
import { Platform } from 'react-native';

/**
 * Brand gradients — used by buttons, hero overlays and active tab
 * pills. Until we ship `expo-linear-gradient`, callers either pick the
 * START color as a safe solid fallback OR composite two coloured Views
 * (positioned absolutely) for a 2-stop look.
 */
export const BrandGradients = {
  cta:        { from: '#FF7A1A', to: '#E85D6B' },     // CTA buttons
  hero:       { from: '#2D7DD2', to: '#7C5DDB' },     // Hero header band
  activeTab:  { from: '#FF7A1A', to: '#FFC93C' },     // Tab bar active pill
  premium:    { from: '#7C5DDB', to: '#2D7DD2' },     // Premium / loyalty
  fresh:      { from: '#43D9DB', to: '#4CAF80' },     // School / kids
  sunset:     { from: '#FFC93C', to: '#E85D6B' },     // Promo / sale
} as const;

export const Brand = {
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
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const Spacing = {
  base: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Brand font weights map. These keys map to the TTF asset names that
 * `expo-font.useFonts` registers from
 * @expo-google-fonts/plus-jakarta-sans. Reference them via
 * `fontFamily: BrandFont.bold` in style props so we can swap the brand
 * font globally from one place.
 */
export const BrandFont = {
  fallback: (Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }) ?? 'sans-serif'),
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

const tintColorLight = Brand.primary;
const tintColorDark = '#FFFFFF';

export const Colors = {
  light: {
    text: Brand.text,
    background: Brand.background,
    surface: Brand.surface,
    tint: tintColorLight,
    icon: Brand.textMuted,
    tabIconDefault: Brand.textMuted,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#0B1220',
    surface: '#111B2E',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: BrandFont.regular,
    serif: 'ui-serif',
    rounded: BrandFont.semibold,
    mono: 'ui-monospace',
  },
  android: {
    sans: BrandFont.regular,
    serif: 'serif',
    rounded: BrandFont.semibold,
    mono: 'monospace',
  },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'Plus Jakarta Sans', 'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
