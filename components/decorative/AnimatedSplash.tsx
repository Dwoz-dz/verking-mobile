/**
 * AnimatedSplash — premium boot splash for VERKING (Phase 16).
 *
 * Why this exists:
 *   The previous boot path returned `null` while i18n + fonts loaded,
 *   leaving the user staring at a black void between the native splash
 *   hide and the first home render (200–800 ms depending on device).
 *   That gap was perceived as a freeze. This component fills the gap
 *   with a fully-animated branded splash that's safe to render BEFORE
 *   any provider is mounted: it reaches Supabase only via
 *   `useRegistrationStatus()`, which already self-handles offline.
 *
 * What it ships:
 *   ▸ Full-bleed navy → purple → blue gradient (faked via 4 layered
 *     Views, since `expo-linear-gradient` is intentionally not in the
 *     bundle — the existing codebase fakes gradients the same way).
 *   ▸ 30 twinkling star particles + soft pink glow at the bottom.
 *   ▸ A centered cream card with the multi-colour "VERKING" wordmark
 *     (V emphasized, staggered slide-up entrance) + S.T.P pill.
 *   ▸ Bilingual taglines (FR + AR) and a heart divider.
 *   ▸ Three bouncing loading dots.
 *   ▸ Animated progress bar 0 → 85 % with pink→purple→blue fill (full
 *     gradient, masked by `overflow:hidden` so the colours don't shift
 *     as the fill grows).
 *   ▸ Personalised greeting at the top — "Bienvenue [name] 👋" when
 *     the device is registered, "Bienvenue 👋" otherwise.
 *
 * Animation primitives:
 *   Reanimated 3 + a single JS interval for the count-up text. The
 *   useEffect cleanup tears every interval / shared-value down on
 *   unmount so we don't leak workers if the parent yanks us early.
 *
 * Strict rules respected:
 *   View / Text / StyleSheet / Animated only — no `div`, no
 *   `className`, no inline CSS strings.
 */
import { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useRegistrationStatus } from '@/services/registration';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────

const TOTAL_DURATION_MS = 2000;
const FADE_OUT_MS = 380;
const PROGRESS_DURATION_MS = 1500;
const PROGRESS_TARGET = 85; // %

const LOGO_TEXT = 'VERKING';
const LETTER_COLORS = [
  '#FF4444', '#FF8C00', '#FFD700', '#32CD32',
  '#1E90FF', '#8A2BE2', '#FF69B4',
];

const PROGRESS_TRACK_WIDTH = Math.min(SCREEN_W - 64, 300);
const PROGRESS_FILL_WIDTH  = (PROGRESS_TRACK_WIDTH * PROGRESS_TARGET) / 100;

// Pre-computed star positions so they don't re-randomise on every render.
// 22 instead of 28 — visually identical at this density, ~20 % less GC pressure
// on low-end Android. The eye doesn't notice the missing 6.
const STARS = Array.from({ length: 22 }, (_, i) => ({
  key: i,
  top:   Math.random() * 0.92,
  left:  Math.random() * 0.96,
  size:  2 + Math.random() * 3,
  delay: Math.floor(Math.random() * 1800),
  opacity: 0.3 + Math.random() * 0.45,
}));

// Floating emoji items — pruned from 6 to 4 to keep the centre card from
// feeling crowded on small phones (≤ 360 dp). The remaining items are
// positioned in the corners so they bracket the card without competing.
const FLOATERS: { emoji: string; top: number; left?: number; right?: number; size: number; rotate: number; delay: number }[] = [
  { emoji: '✏️', top: 0.06, left: 0.04,                 size: 34, rotate: -28, delay: 0   },
  { emoji: '⭐',  top: 0.09, right: 0.08,                size: 24, rotate:   0, delay: 300 },
  { emoji: '🧼', top: 0.68, left: 0.04,                 size: 28, rotate: -20, delay: 350 },
  { emoji: '🎒', top: 0.70, right: 0.06,                size: 30, rotate:  18, delay: 600 },
];

// ─── Public API ───────────────────────────────────────────────────────

export interface AnimatedSplashProps {
  /** Called once the fade-out animation finishes — parent should unmount. */
  onDone?: () => void;
  /**
   * When true, the splash starts its fade-out (380 ms) immediately. Use
   * the parent's "boot ready AND minimum 2 s elapsed" gate to flip this
   * — that way the splash never disappears before its animation has
   * had time to land, and never hangs invisibly while waiting for boot.
   *
   * If omitted (legacy callers), the splash falls back to its own
   * internal 2 s timer.
   */
  hide?: boolean;
  /** Hide the personalised greeting (e.g. when called from inside an in-app screen). */
  hideGreeting?: boolean;
  /** Legacy: ignored when `hide` is provided. */
  durationMs?: number;
}

export function AnimatedSplash({
  onDone,
  hide,
  hideGreeting = false,
  durationMs = TOTAL_DURATION_MS,
}: AnimatedSplashProps) {
  const { status } = useRegistrationStatus();
  const greetingName = !hideGreeting && status.is_registered && status.name ? status.name.trim() : '';

  // ── Root fade-out ──────────────────────────────────────────────────
  // Two driving modes:
  //   1) Parent passes `hide` — fade kicks in when it flips to true.
  //   2) Parent omits `hide` — fall back to a self-firing 2 s timer.
  // We keep both paths because callers other than the boot layout
  // (e.g. a "manual splash preview" admin tool) may want the legacy
  // self-driven behaviour.
  const rootOpacity = useSharedValue(1);
  const [tapDismissArmed, setTapDismissArmed] = useState(false);

  // After 1 s the splash is "tap to skip" enabled. Power users can
  // bypass the rest of the show by tapping anywhere; the fade-out is
  // the same animation as the auto-dismiss path so it never feels
  // jarring.
  useEffect(() => {
    const t = setTimeout(() => setTapDismissArmed(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const triggerFade = (reason: 'parent-hide' | 'auto' | 'tap') => {
    void reason;
    rootOpacity.value = withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  };

  const onTap = () => {
    if (!tapDismissArmed) return;
    triggerFade('tap');
  };

  useEffect(() => {
    if (typeof hide === 'undefined') return; // self-driven mode handles it below
    if (hide) triggerFade('parent-hide');
    // onDone intentionally omitted — we don't want a parent re-render
    // to re-fire a fade that's already running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hide]);

  useEffect(() => {
    if (typeof hide !== 'undefined') return; // parent-driven mode
    const t = setTimeout(() => triggerFade('auto'), durationMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  // ── Card scale + opacity ───────────────────────────────────────────
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    cardScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) });
  }, [cardOpacity, cardScale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  // ── Progress bar fill width ────────────────────────────────────────
  const fillWidth = useSharedValue(0);
  useEffect(() => {
    fillWidth.value = withDelay(
      300,
      withTiming(PROGRESS_FILL_WIDTH, {
        duration: PROGRESS_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [fillWidth]);

  const fillStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));

  // ── Progress percent text (JS-side count-up) ───────────────────────
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const start = Date.now() + 300;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed < 0) return;
      const t = Math.min(1, elapsed / PROGRESS_DURATION_MS);
      // ease-out-cubic, matches the Reanimated curve above
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(PROGRESS_TARGET * eased));
      if (t >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.root, rootStyle]}>
      {/* Background gradient (4 vertical bands, navy → purple → blue) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.band, { backgroundColor: '#1A0F3D' }]} />
        <View style={[styles.band, { backgroundColor: '#2D1B69' }]} />
        <View style={[styles.band, { backgroundColor: '#4C1D95' }]} />
        <View style={[styles.band, { backgroundColor: '#1E3A5F' }]} />
      </View>

      {/* Soft pink radial glow at the bottom */}
      <View pointerEvents="none" style={styles.bottomGlow} />

      {/* Stars background — twinkling */}
      {STARS.map((s) => (
        <Star
          key={s.key}
          top={s.top * SCREEN_H}
          left={s.left * SCREEN_W}
          size={s.size}
          delay={s.delay}
          baseOpacity={s.opacity}
        />
      ))}

      {/* Floating emoji items */}
      {FLOATERS.map((f, i) => (
        <Floater
          key={i}
          emoji={f.emoji}
          top={f.top * SCREEN_H}
          left={f.left !== undefined ? f.left * SCREEN_W : undefined}
          right={f.right !== undefined ? f.right * SCREEN_W : undefined}
          size={f.size}
          rotate={f.rotate}
          delay={f.delay}
        />
      ))}

      {/* Top-centre personalised greeting */}
      {!hideGreeting && (
        <View pointerEvents="none" style={styles.greetingWrap}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greetingName ? `Bienvenue ${greetingName} 👋` : 'Bienvenue 👋'}
          </Text>
        </View>
      )}

      {/* Centre column */}
      <View style={styles.centerCol} pointerEvents="none">
        {/* Card with cream gradient background (faked with 2 stacked Views) */}
        <Animated.View style={[styles.cardOuter, cardStyle]}>
          <View style={styles.cardGlow} />
          <View style={styles.card}>
            {/* Card cream "gradient" — base + soft highlight strip */}
            <View pointerEvents="none" style={styles.cardBase} />
            <View pointerEvents="none" style={styles.cardHighlight} />

            {/* Crown */}
            <BounceEmoji emoji="👑" size={28} delay={150} />

            {/* VERKING wordmark — staggered colourful letters */}
            <View style={styles.logoRow}>
              {LOGO_TEXT.split('').map((letter, i) => (
                <Letter
                  key={`${letter}-${i}`}
                  letter={letter}
                  color={LETTER_COLORS[i] ?? '#FFFFFF'}
                  index={i}
                  isV={letter === 'V'}
                />
              ))}
            </View>

            {/* S.T.P pill */}
            <DelayedFade delay={500}>
              <View style={styles.stpPill}>
                <Text style={styles.stpText}>S.T.P — STATIONERY</Text>
              </View>
            </DelayedFade>
          </View>
        </Animated.View>

        {/* French tagline */}
        <DelayedFade delay={700}>
          <View style={styles.taglineRow}>
            <Text style={styles.taglineEmoji}>📚</Text>
            <Text style={styles.taglineText}>La rentrée commence ici</Text>
          </View>
        </DelayedFade>

        {/* Heart divider */}
        <DelayedFade delay={800}>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerHeart}>❤</Text>
            <View style={styles.dividerLine} />
          </View>
        </DelayedFade>

        {/* Arabic tagline */}
        <DelayedFade delay={900}>
          <View style={styles.taglineRow}>
            <Text style={styles.taglineEmoji}>🎒</Text>
            <Text style={styles.taglineText}>الدخول المدرسي يبدأ هنا</Text>
          </View>
        </DelayedFade>

        {/* Bouncing dots */}
        <View style={styles.dotsRow}>
          <Dot color="#60A5FA" delay={0} />
          <Dot color="#F472B6" delay={150} />
          <Dot color="#34D399" delay={300} />
        </View>

        {/* Progress bar */}
        <DelayedFade delay={1100}>
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, fillStyle]}>
                <View style={styles.progressGradient}>
                  <View style={[styles.progressStop, { backgroundColor: '#EC4899' }]} />
                  <View style={[styles.progressStop, { backgroundColor: '#8B5CF6' }]} />
                  <View style={[styles.progressStop, { backgroundColor: '#3B82F6' }]} />
                </View>
              </Animated.View>
            </View>
            <Text style={styles.progressLabel}>Chargement en cours... {pct}%</Text>
          </View>
        </DelayedFade>
      </View>

      {/* Footer */}
      <DelayedFade delay={1250} style={styles.footerWrap}>
        <Text style={styles.footerText}>VERKING • La qualité au service de vos enfants 👑</Text>
      </DelayedFade>

      {/* Phase 5.3 — visible Skip pill in the top-right after 1 s. The
          full-screen tap-to-skip below still works (power users), but
          the pill makes the affordance discoverable. */}
      {tapDismissArmed ? (
        <DelayedFade delay={0} style={styles.skipWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ignorer"
            onPress={onTap}
            style={({ pressed }) => [
              styles.skipBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
            ]}
            hitSlop={10}
          >
            <Text style={styles.skipText}>Passer →</Text>
          </Pressable>
        </DelayedFade>
      ) : null}

      {/* Tap-to-skip overlay — must sit on top so it receives taps
          even where children would otherwise capture. Other content
          uses pointerEvents="none" so visually nothing is covered. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ignorer l'écran de démarrage"
        onPress={onTap}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

/** Single VERKING letter, animated slide-up + colour. */
function Letter({
  letter, color, index, isV,
}: { letter: string; color: string; index: number; isV: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    const delay = 200 + index * 80;
    opacity.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 480, easing: Easing.out(Easing.back(1.6)) }));
  }, [index, opacity, translateY]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text
      style={[
        styles.letter,
        animated,
        {
          color,
          fontSize: isV ? 56 : 42,
          marginHorizontal: isV ? -1 : 0,
          textShadowColor: 'rgba(0,0,0,0.20)',
          textShadowOffset: { width: 2, height: 3 },
          textShadowRadius: 4,
        },
      ]}
    >
      {letter}
    </Animated.Text>
  );
}

/** Star background dot — soft fade pulse loop. */
function Star({
  top, left, size, delay, baseOpacity,
}: { top: number; left: number; size: number; delay: number; baseOpacity: number }) {
  const opacity = useSharedValue(baseOpacity);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(baseOpacity * 0.35, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(baseOpacity, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, baseOpacity, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        animated,
        {
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    />
  );
}

/** Floating emoji decorator with continuous bounce. */
function Floater({
  emoji, top, left, right, size, rotate, delay,
}: { emoji: string; top: number; left?: number; right?: number; size: number; rotate: number; delay: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0,   { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, translateY, opacity]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { rotate: `${rotate}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floater,
        animated,
        {
          top,
          left,
          right,
        },
      ]}
    >
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}

/** Three bouncing loading dots, staggered. */
function Dot({ color, delay }: { color: string; delay: number }) {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0,  { duration: 320, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, translateY]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.dot, animated, { backgroundColor: color }]} />;
}

/** Bouncing emoji used for the crown. */
function BounceEmoji({ emoji, size, delay }: { emoji: string; size: number; delay: number }) {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0,  { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, translateY]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.crownWrap, animated]}>
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}

/** Wraps children in a delayed fade-in + slide-up. */
function DelayedFade({
  delay, children, style,
}: { delay: number; children: React.ReactNode; style?: object }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));
  }, [delay, opacity, translateY]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0F0A2A',
    overflow: 'hidden',
  },
  band: {
    flex: 1,
    width: '100%',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -SCREEN_H * 0.25,
    left: -SCREEN_W * 0.25,
    width: SCREEN_W * 1.5,
    height: SCREEN_H * 0.6,
    borderRadius: SCREEN_W * 0.75,
    backgroundColor: 'rgba(236,72,153,0.18)',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  floater: {
    position: 'absolute',
  },
  greetingWrap: {
    position: 'absolute',
    top: SCREEN_H * 0.06,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  centerCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cardOuter: {
    marginBottom: 22,
  },
  cardGlow: {
    position: 'absolute',
    top: -18, left: -18, right: -18, bottom: -18,
    borderRadius: 38,
    backgroundColor: 'rgba(236,72,153,0.30)',
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 22,
    backgroundColor: '#FEF3C7',
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  cardBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FEF3C7',
  },
  cardHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '60%',
    backgroundColor: '#FDE68A',
    opacity: 0.55,
  },
  crownWrap: {
    marginBottom: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginVertical: 4,
  },
  letter: {
    fontWeight: '900',
    lineHeight: 60,
    paddingHorizontal: 1,
  },
  stpPill: {
    backgroundColor: '#1E293B',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 6,
  },
  stpText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  taglineEmoji: {
    fontSize: 22,
  },
  taglineText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    width: 56,
    height: 1.5,
    backgroundColor: 'rgba(244,114,182,0.55)',
  },
  dividerHeart: {
    color: '#F472B6',
    fontSize: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressWrap: {
    marginTop: 18,
    alignItems: 'center',
  },
  progressTrack: {
    width: PROGRESS_TRACK_WIDTH,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    overflow: 'hidden',
  },
  progressGradient: {
    flexDirection: 'row',
    width: PROGRESS_FILL_WIDTH,
    height: '100%',
  },
  progressStop: {
    flex: 1,
    height: '100%',
  },
  progressLabel: {
    marginTop: 8,
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 12,
    fontWeight: '500',
  },
  footerWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
  // Phase 5.3 — Skip pill in the top-right area (above the safe-area
  // status bar so it doesn't fight with the OS clock/battery icons).
  skipWrap: {
    position: 'absolute',
    top: SCREEN_H * 0.05,
    right: 18,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default AnimatedSplash;
