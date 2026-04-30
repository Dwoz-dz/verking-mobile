/**
 * StationeryPattern — VERKING decorative background.
 *
 * A dependency-free, RTL-safe decorative layer used behind:
 *   ▸ the splash overlay (Brand identity reveal),
 *   ▸ empty states (`Aucune commande`, `Catalogue vide`, …),
 *   ▸ the About page header,
 *   ▸ optional accent on the Home hero.
 *
 * Why no SVG / Lottie?
 * --------------------
 * We deliberately avoid `react-native-svg` here so Phase 0 ships
 * without adding a new native module. The pattern is built from a
 * pseudo-random grid of positioned `<View>` dots + scattered
 * `Ionicons` (book / pencil / star / palette). Looks crafted, costs
 * nothing.
 *
 * The grid uses a deterministic seed derived from `seed` so the same
 * page always re-renders the exact same layout — no flicker on
 * re-mount. Dots and icons share a small palette pulled from `Brand`,
 * tinted to the surface they sit on.
 *
 * Usage:
 *   <View style={{ position: 'relative' }}>
 *     <StationeryPattern variant="navy" intensity={0.55} />
 *     ...content above the pattern...
 *   </View>
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Brand } from '@/constants/theme';

type StationeryPatternVariant = 'navy' | 'light' | 'cream' | 'tinted';

interface StationeryPatternProps {
  /** Surface palette this pattern is sitting on. Drives ink colours. */
  variant?: StationeryPatternVariant;
  /** 0..1 — overall opacity of the dot/icon ink. Default 0.55. */
  intensity?: number;
  /** Tile density. Higher = more dots per area. Default 22. */
  density?: number;
  /** Deterministic seed so the same page renders the same layout. */
  seed?: number;
  style?: StyleProp<ViewStyle>;
}

interface PaletteSpec {
  bg: string | null; // null = transparent (let parent choose surface)
  dots: string[];
  icons: string[];
}

const PALETTES: Record<StationeryPatternVariant, PaletteSpec> = {
  navy: {
    bg: Brand.secondary,
    dots: ['rgba(255,255,255,0.16)', 'rgba(67,217,219,0.45)', 'rgba(255,201,60,0.45)'],
    icons: ['rgba(255,255,255,0.55)', 'rgba(255,201,60,0.65)', 'rgba(67,217,219,0.65)', 'rgba(255,107,138,0.55)'],
  },
  light: {
    bg: null,
    dots: [Brand.primary + '33', Brand.coral + '33', Brand.sunshine + '55'],
    icons: [Brand.primary + 'AA', Brand.coral + 'AA', Brand.fresh + 'AA', Brand.lavender + 'AA'],
  },
  cream: {
    bg: '#FFF8EE',
    dots: [Brand.cta + '33', Brand.sunshine + '55', Brand.fresh + '33'],
    icons: [Brand.cta + 'AA', Brand.sunshine + 'AA', Brand.fresh + 'AA'],
  },
  tinted: {
    bg: Brand.primaryTint,
    dots: [Brand.primary + '33', Brand.lavender + '33', Brand.mint + '55'],
    icons: [Brand.primary + 'AA', Brand.lavender + 'AA', Brand.mint + 'AA'],
  },
};

const ICONS = ['book', 'pencil', 'star', 'color-palette', 'school', 'sparkles'] as const;

/** Tiny seeded PRNG (mulberry32) — deterministic per `seed`. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DotSpec {
  top: string;
  left: string;
  size: number;
  color: string;
}

interface IconSpec {
  top: string;
  left: string;
  size: number;
  color: string;
  name: (typeof ICONS)[number];
  rotate: number;
}

export function StationeryPattern({
  variant = 'navy',
  intensity = 0.55,
  density = 22,
  seed = 1337,
  style,
}: StationeryPatternProps) {
  const palette = PALETTES[variant];

  const { dots, icons } = useMemo(() => {
    const rng = makeRng(seed);
    const nextDots: DotSpec[] = [];
    const nextIcons: IconSpec[] = [];

    for (let i = 0; i < density; i++) {
      nextDots.push({
        top: `${(rng() * 100).toFixed(2)}%`,
        left: `${(rng() * 100).toFixed(2)}%`,
        size: 4 + rng() * 8,
        color: palette.dots[i % palette.dots.length],
      });
    }

    const iconCount = Math.max(3, Math.round(density / 4));
    for (let i = 0; i < iconCount; i++) {
      nextIcons.push({
        top: `${(rng() * 90 + 5).toFixed(2)}%`,
        left: `${(rng() * 90 + 5).toFixed(2)}%`,
        size: 14 + Math.round(rng() * 18),
        color: palette.icons[i % palette.icons.length],
        name: ICONS[i % ICONS.length],
        rotate: Math.round(rng() * 60 - 30),
      });
    }

    return { dots: nextDots, icons: nextIcons };
  }, [density, palette, seed]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.fill,
        palette.bg ? { backgroundColor: palette.bg } : null,
        { opacity: intensity },
        style,
      ]}
    >
      {dots.map((d, i) => (
        <View
          key={`d-${i}`}
          style={{
            position: 'absolute',
            top: d.top as unknown as number,
            left: d.left as unknown as number,
            width: d.size,
            height: d.size,
            borderRadius: 999,
            backgroundColor: d.color,
          }}
        />
      ))}
      {icons.map((ic, i) => (
        <View
          key={`i-${i}`}
          style={{
            position: 'absolute',
            top: ic.top as unknown as number,
            left: ic.left as unknown as number,
            transform: [{ rotate: `${ic.rotate}deg` }],
          }}
        >
          <Ionicons name={ic.name as never} size={ic.size} color={ic.color} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
