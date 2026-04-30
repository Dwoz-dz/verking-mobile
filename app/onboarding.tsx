/**
 * Onboarding — first-launch 3-slide intro.
 *
 * Slides:
 *   1. مرحبا — welcome to VERKING
 *   2. اربح هدايا — benefits stack with kid colors
 *   3. سجل الآن — registration CTA
 *
 * Dismissable via "Passer" link on every slide. Final slide CTA
 * routes to /register. Last-launch state stored under
 * `vk:onboarded` so we never show this again.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFont, Radius, Spacing } from '@/constants/theme';
import { BenefitPalette, KidColors } from '@/constants/kidColors';
import { useDirection } from '@/i18n/useDirection';
import { safeStorage } from '@/lib/storage';

const { width: SCREEN_W } = Dimensions.get('window');

const ONBOARDED_KEY = 'vk:onboarded';

export async function markOnboarded(): Promise<void> {
  try { await safeStorage.setItem(ONBOARDED_KEY, '1'); } catch { /* noop */ }
}

export async function isOnboarded(): Promise<boolean> {
  try {
    const v = await safeStorage.getItem(ONBOARDED_KEY);
    return v === '1';
  } catch { return false; }
}

interface SlideSpec {
  emoji: string;
  title: string;
  subtitle: string;
  bgFrom: string;
  bgTo: string;
  pills: { emoji: string; text: string; tint: keyof typeof BenefitPalette }[];
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { rowDirection, textAlign } = useDirection();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slides: SlideSpec[] = [
    {
      emoji: '🎒',
      title: t('onboarding.s1.title', { defaultValue: 'مرحبا في VERKING' }),
      subtitle: t('onboarding.s1.sub',  { defaultValue: 'كل أدواتك المدرسية في تطبيق واحد، مع توصيل سريع لكل ولايات الجزائر.' }),
      bgFrom: KidColors.peach,
      bgTo: KidColors.cream,
      pills: [
        { emoji: '📚', text: 'كتب + كراريس', tint: 'school' },
        { emoji: '🎒', text: 'محافظ + مقلمات', tint: 'fire' },
        { emoji: '✏️', text: 'أدوات الكتابة', tint: 'gift' },
      ],
    },
    {
      emoji: '🎁',
      title: t('onboarding.s2.title', { defaultValue: 'سجّل واربح هدايا' }),
      subtitle: t('onboarding.s2.sub',  { defaultValue: 'كل عملية تسجيل تمنحك مكافآت فورية: نقاط، كوبونات، توصيل مجاني.' }),
      bgFrom: KidColors.lavenderSoft,
      bgTo: KidColors.mintBubble,
      pills: [
        { emoji: '🎁', text: '500 نقطة هدية', tint: 'gift' },
        { emoji: '🎫', text: 'كوبون ترحيبي', tint: 'ticket' },
        { emoji: '🚚', text: 'توصيل مجاني', tint: 'truck' },
      ],
    },
    {
      emoji: '✨',
      title: t('onboarding.s3.title', { defaultValue: 'وابدأ المفاجآت 🚀' }),
      subtitle: t('onboarding.s3.sub',  { defaultValue: 'تسجيل بسيط — اسم + رقم الهاتف فقط. لا كلمة سر، لا تعقيدات.' }),
      bgFrom: KidColors.butter,
      bgTo: KidColors.peachSoft,
      pills: [
        { emoji: '⭐', text: 'مكافآت فورية', tint: 'star' },
        { emoji: '🔥', text: 'عروض حصرية', tint: 'fire' },
        { emoji: '👥', text: 'جيب صديق = نقاط زيادة', tint: 'gift' },
      ],
    },
  ];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / SCREEN_W);
    if (i !== page) setPage(i);
  };

  const goNext = () => {
    if (page < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_W, animated: true });
    } else {
      finish('register');
    }
  };

  const finish = async (next: 'register' | 'home') => {
    await markOnboarded();
    if (next === 'register') router.replace('/register' as never);
    else router.replace('/(tabs)' as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Skip button — top-right (LTR) / top-left (RTL) */}
      <View style={[styles.topBar, { flexDirection: rowDirection }]}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => finish('home')} hitSlop={8} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('onboarding.skip', { defaultValue: 'تخطي' })}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_W}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {slides.map((s, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_W }]}>
            {/* Layered candy backgrounds */}
            <View style={[styles.bgFrom, { backgroundColor: s.bgFrom }]} />
            <View style={[styles.bgTo, { backgroundColor: s.bgTo }]} />

            {/* Hero emoji + glowing ring */}
            <View style={styles.heroRing}>
              <View style={[styles.heroInner, { backgroundColor: KidColors.creamSoft }]}>
                <Text style={styles.heroEmoji}>{s.emoji}</Text>
              </View>
            </View>

            {/* Title + subtitle */}
            <Text style={[styles.title, { textAlign }]}>{s.title}</Text>
            <Text style={[styles.subtitle, { textAlign }]}>{s.subtitle}</Text>

            {/* Benefit pills */}
            <View style={styles.pillsWrap}>
              {s.pills.map((p) => {
                const palette = BenefitPalette[p.tint];
                return (
                  <View
                    key={p.text}
                    style={[
                      styles.pill,
                      { backgroundColor: palette.bg, borderColor: palette.border },
                    ]}
                  >
                    <Text style={styles.pillEmoji}>{p.emoji}</Text>
                    <Text style={[styles.pillText, { color: palette.label }]}>{p.text}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer: dots + CTA */}
      <View style={styles.footer}>
        <View style={[styles.dots, { flexDirection: rowDirection }]}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === page && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.cta,
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.ctaText}>
            {page === slides.length - 1
              ? t('onboarding.cta_register', { defaultValue: 'سجّل الآن واربح 500 نقطة 🎁' })
              : t('onboarding.cta_next',     { defaultValue: 'التالي' })
            }
          </Text>
          <Ionicons
            name={page === slides.length - 1 ? 'sparkles' : 'arrow-forward'}
            size={18}
            color="#fff"
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: KidColors.cream },
  topBar: {
    position: 'absolute', top: 12, left: 12, right: 12,
    zIndex: 10,
    alignItems: 'center',
  },
  skipBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  skipText: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 13, color: KidColors.textSoft,
  },

  slide: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 80,
    paddingBottom: 200,
    alignItems: 'center',
  },
  bgFrom: {
    position: 'absolute',
    top: -120, right: -80,
    width: 380, height: 380, borderRadius: 999,
    opacity: 0.85,
  },
  bgTo: {
    position: 'absolute',
    bottom: -160, left: -80,
    width: 420, height: 420, borderRadius: 999,
    opacity: 0.75,
  },
  heroRing: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: KidColors.coralPink + '60',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
    shadowColor: KidColors.coral,
    shadowOpacity: 0.35, shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    zIndex: 2,
  },
  heroInner: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
  },
  heroEmoji: { fontSize: 76 },
  title: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 26, color: KidColors.text,
    marginTop: Spacing.lg, zIndex: 2,
  },
  subtitle: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 15, color: KidColors.textSoft,
    marginTop: Spacing.xs, lineHeight: 22, zIndex: 2,
  },
  pillsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, marginTop: Spacing.lg, zIndex: 2,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  pillEmoji: { fontSize: 16 },
  pillText: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 13, letterSpacing: 0.3,
  },

  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: Spacing.lg,
    paddingBottom: 40,
    backgroundColor: 'transparent',
  },
  dots: {
    justifyContent: 'center', gap: 6,
    marginBottom: Spacing.md,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: KidColors.coralPink + '99',
  },
  dotActive: {
    width: 24,
    backgroundColor: KidColors.cta,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: KidColors.cta,
    shadowColor: KidColors.cta,
    shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  ctaText: {
    color: '#fff',
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, letterSpacing: 0.4,
  },
});

void Image; // (reserved for future hero photo support)
