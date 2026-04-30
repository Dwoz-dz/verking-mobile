/**
 * Register — premium signup screen.
 *
 * Layout (top → bottom):
 *   ▸ Hero: "سجّل الآن وابدأ المفاجآت" + animated 3D-style gift emoji
 *     blob + glowing coral background.
 *   ▸ 4 benefit pills (gift / star / ticket / truck) — each in a
 *     candy-tinted card.
 *   ▸ Form: name + phone (with auto E.164 hint) + optional referral
 *     code accordion. Soft inputs, big labels.
 *   ▸ CTA: orange→coral gradient pill (full-width, glowing shadow).
 *   ▸ Account-recovery prompt: appears below CTA when register_device
 *     returns code = 'PHONE_TAKEN'.
 *   ▸ Step 2 modal: post-success, asks wilaya + (optional) school
 *     level → grants 100 pts.
 *
 * Visual language: KidColors palette (cream + coral + sunshine),
 * Plus Jakarta ExtraBold for headlines, soft shadows, spring scale on
 * every press.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RewardCelebration } from '@/components/registration/RewardCelebration';
import { BrandFont, Radius, Spacing } from '@/constants/theme';
import { BenefitPalette, KidColors } from '@/constants/kidColors';
import { useDirection } from '@/i18n/useDirection';
import { clearRegistrationReminder } from '@/lib/registrationLaunchCounter';
import {
  registerDevice,
  registerStep2,
  requestAccountRecovery,
  useRegistrationStatus,
} from '@/services/registration';
import { WilayaPickerModal } from '@/components/storefront/WilayaPickerModal';
import { SchoolLevelPicker } from '@/components/storefront/SchoolLevelPicker';
import { useDefaultWilaya, useWilayas } from '@/services/mobileConfig';

const PHONE_HINT_RE = /^(\+213|0|213)?[567]\d{8}$/;

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = i18n.language === 'ar';
  const { reload: reloadStatus } = useRegistrationStatus();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [referrer, setReferrer] = useState('');
  const [showReferrer, setShowReferrer] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phoneTakenForRecovery, setPhoneTakenForRecovery] = useState(false);

  // Reward popup state
  const [celebration, setCelebration] = useState<{
    points: number; couponCode: string | null;
  } | null>(null);

  // Step 2 modal
  const [step2Open, setStep2Open] = useState(false);

  const phoneIsValid = PHONE_HINT_RE.test(phone.replace(/\s+/g, ''));
  const nameIsValid = name.trim().length >= 2;
  const canSubmit = nameIsValid && phoneIsValid && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setPhoneTakenForRecovery(false);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});

    const res = await registerDevice({
      name: name.trim(),
      phone: phone.trim(),
      referrerCode: referrer.trim() || null,
    });

    setSubmitting(false);

    if (!res.ok) {
      if (res.code === 'PHONE_TAKEN') {
        setPhoneTakenForRecovery(true);
        return;
      }
      setSubmitError(translateError(res.code, t));
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      return;
    }

    if (res.already_registered) {
      Alert.alert(
        t('register.already_title', { defaultValue: 'مرحبا بك مجددا' }),
        t('register.already_body',  { defaultValue: 'هذا الجهاز مسجل بالفعل.' }),
      );
      router.replace('/(tabs)');
      return;
    }

    void clearRegistrationReminder();
    setCelebration({
      points: res.granted_points,
      couponCode: res.welcome_coupon_code,
    });
  };

  const onRecover = async () => {
    if (!phone.trim()) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const res = await requestAccountRecovery({ phone: phone.trim(), reason: 'app-register-collision' });
    if (res.ok) {
      Alert.alert(
        t('register.recovery_title', { defaultValue: 'طلب استرجاع الحساب أُرسل ✅' }),
        t('register.recovery_body',  { defaultValue: 'سنتصل بك خلال 24 ساعة لتأكيد ملكية الرقم. شكرا لصبرك 🤝' }),
      );
      router.replace('/(tabs)');
    } else {
      Alert.alert('Erreur', translateError(res.code, t));
    }
  };

  const onCelebrationDone = () => {
    setCelebration(null);
    reloadStatus();
    setStep2Open(true); // optional bonus step
  };

  const onSkipStep2 = () => {
    setStep2Open(false);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top bar — close + skip */}
          <View style={[styles.topBar, { flexDirection: rowDirection }]}>
            <Pressable hitSlop={8} onPress={() => router.replace('/(tabs)')} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={KidColors.textSoft} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable hitSlop={8} onPress={() => router.replace('/(tabs)')} style={styles.skipBtn}>
              <Text style={styles.skipText}>
                {t('register.skip', { defaultValue: 'تخطي' })}
              </Text>
            </Pressable>
          </View>

          {/* ─── Hero ─────────────────────────────────────────────── */}
          <View style={styles.hero}>
            {/* Layered gradient blobs */}
            <View style={[styles.blobOne, { backgroundColor: KidColors.coralPink + 'B8' }]} />
            <View style={[styles.blobTwo, { backgroundColor: KidColors.butter + 'CC' }]} />
            <View style={[styles.blobThree, { backgroundColor: KidColors.mintBubble + '80' }]} />

            <View style={styles.giftRing}>
              <Text style={styles.giftEmoji}>🎁</Text>
            </View>

            <Text style={[styles.heroTitle, { textAlign }]}>
              {t('register.hero.title', { defaultValue: 'سجّل الآن وابدأ المفاجآت ✨' })}
            </Text>
            <Text style={[styles.heroSub, { textAlign }]}>
              {t('register.hero.sub', {
                defaultValue: 'تسجيل بسيط بدون كلمة سر — اربح 500 نقطة فوراً + كوبون ترحيبي.',
              })}
            </Text>
          </View>

          {/* ─── Benefits ──────────────────────────────────────────── */}
          <View style={styles.benefitsRow}>
            <BenefitTile palette={BenefitPalette.gift}   emoji="🎁" label={t('register.benefit.gift',   { defaultValue: 'هدية فورية' })} />
            <BenefitTile palette={BenefitPalette.star}   emoji="⭐" label={t('register.benefit.points', { defaultValue: '500 نقطة' })} />
            <BenefitTile palette={BenefitPalette.ticket} emoji="🎫" label={t('register.benefit.coupon', { defaultValue: 'كوبون حصري' })} />
            <BenefitTile palette={BenefitPalette.truck}  emoji="🚚" label={t('register.benefit.ship',   { defaultValue: 'توصيل مجاني' })} />
          </View>

          {/* ─── Form ──────────────────────────────────────────────── */}
          <View style={styles.formCard}>
            <Text style={[styles.formTitle, { textAlign }]}>
              {t('register.form.title', { defaultValue: 'بياناتك السريعة' })}
            </Text>

            {/* Name */}
            <FormField label={t('register.form.name', { defaultValue: 'الاسم الكامل' })}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={isAr ? 'محمد بن علي' : 'Mohammed Ben Ali'}
                placeholderTextColor={KidColors.textSoft + '80'}
                autoComplete="name"
                style={[styles.input, { textAlign }]}
              />
            </FormField>

            {/* Phone */}
            <FormField
              label={t('register.form.phone', { defaultValue: 'رقم الهاتف' })}
              hint={isAr ? 'مثال: 0551234567' : 'Ex: 0551234567'}
            >
              <View style={[styles.phoneRow, { flexDirection: rowDirection }]}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>🇩🇿 +213</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="0551234567"
                  placeholderTextColor={KidColors.textSoft + '80'}
                  autoComplete="tel"
                  maxLength={13}
                  style={[styles.phoneInput, { textAlign: isAr ? 'right' : 'left' }]}
                />
                {phoneIsValid ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={KidColors.fresh}
                    style={styles.phoneCheck}
                  />
                ) : null}
              </View>
            </FormField>

            {/* Referrer code accordion */}
            <Pressable
              onPress={() => setShowReferrer((v) => !v)}
              style={[styles.referralToggle, { flexDirection: rowDirection }]}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={KidColors.lavender}
              />
              <Text style={styles.referralToggleText}>
                {t('register.referrer_toggle', { defaultValue: 'لديك كود صديق ؟ (نقاط إضافية)' })}
              </Text>
              <Ionicons
                name={showReferrer ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={KidColors.lavender}
              />
            </Pressable>
            {showReferrer ? (
              <View style={{ marginTop: 8 }}>
                <TextInput
                  value={referrer}
                  onChangeText={(v) => setReferrer(v.toUpperCase())}
                  placeholder="VRK-XXXX"
                  placeholderTextColor={KidColors.textSoft + '80'}
                  autoCapitalize="characters"
                  style={[styles.input, { textAlign }]}
                />
              </View>
            ) : null}

            {/* Submit error */}
            {submitError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={KidColors.coralDeep} />
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}

            {/* PHONE_TAKEN — recovery prompt */}
            {phoneTakenForRecovery ? (
              <View style={styles.recoveryCard}>
                <Text style={styles.recoveryTitle}>
                  {t('register.recovery_prompt_title', { defaultValue: '📞 هذا الرقم مسجل بالفعل' })}
                </Text>
                <Text style={styles.recoveryBody}>
                  {t('register.recovery_prompt_body', {
                    defaultValue: 'هل تريد استرجاع حسابك القديم على هذا الجهاز ؟ سنتصل بك للتأكيد.',
                  })}
                </Text>
                <Pressable
                  onPress={onRecover}
                  style={({ pressed }) => [
                    styles.recoveryBtn,
                    pressed && { transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Ionicons name="key-outline" size={16} color="#fff" />
                  <Text style={styles.recoveryBtnText}>
                    {t('register.recovery_cta', { defaultValue: 'طلب استرجاع الحساب' })}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* CTA */}
            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.cta,
                !canSubmit && { backgroundColor: KidColors.coralPink, shadowOpacity: 0 },
                pressed && canSubmit && { transform: [{ scale: 0.97 }] },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={styles.ctaText}>
                    {t('register.cta', { defaultValue: 'سجل الآن واربح 500 نقطة 🎁' })}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Trust strip */}
            <View style={[styles.trustStrip, { flexDirection: rowDirection }]}>
              <TrustItem emoji="🔒" text={t('register.trust.privacy', { defaultValue: 'بياناتك آمنة' })} />
              <TrustItem emoji="📞" text={t('register.trust.no_sms',  { defaultValue: 'بدون SMS' })} />
              <TrustItem emoji="⚡" text={t('register.trust.instant', { defaultValue: 'تسجيل فوري' })} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Reward popup ───────────────────────────────────────────── */}
      <RewardCelebration
        visible={celebration !== null}
        points={celebration?.points ?? 0}
        couponCode={celebration?.couponCode ?? null}
        title={t('register.reward_title', { defaultValue: 'مبروك ! 🎉 أنت الآن عضو في VERKING' })}
        subtitle={t('register.reward_sub', {
          defaultValue: 'استمتع بمكافآتك واكتشف عروض الدخول المدرسي',
        })}
        ctaLabel={t('register.reward_cta', { defaultValue: 'أكمل التسجيل (+100 نقطة) 🚀' })}
        onDone={onCelebrationDone}
      />

      {/* ─── Step 2 modal ───────────────────────────────────────────── */}
      <Step2Modal
        visible={step2Open}
        onClose={onSkipStep2}
        onCompleted={() => {
          setStep2Open(false);
          router.replace('/(tabs)');
        }}
      />
    </SafeAreaView>
  );
}

// ─── Step 2 Modal ──────────────────────────────────────────────────────
interface Step2Props {
  visible: boolean;
  onClose: () => void;
  onCompleted: () => void;
}
function Step2Modal({ visible, onClose, onCompleted }: Step2Props) {
  const { t } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const wilayas = useWilayas();
  const { effectiveCode } = useDefaultWilaya();
  const [wilayaCode, setWilayaCode] = useState<string | null>(effectiveCode ?? null);
  const [levelKey, setLevelKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && effectiveCode) setWilayaCode(effectiveCode);
  }, [visible, effectiveCode]);

  if (!visible) return null;

  const wilayaName = wilayaCode
    ? wilayas.find((w) => w.code === wilayaCode)?.name_fr ?? wilayaCode
    : null;

  const onSubmit = async () => {
    if (!wilayaCode) return;
    setSubmitting(true);
    const res = await registerStep2({ wilayaCode, levelKey });
    setSubmitting(false);
    if (res.ok) {
      onCompleted();
    } else {
      onClose();
    }
  };

  return (
    <View style={styles.step2Backdrop}>
      <View style={styles.step2Card}>
        <Pressable hitSlop={8} onPress={onClose} style={styles.step2Close}>
          <Ionicons name="close" size={20} color={KidColors.textSoft} />
        </Pressable>

        <Text style={styles.step2Emoji}>🎯</Text>
        <Text style={[styles.step2Title, { textAlign }]}>
          {t('register.step2.title', { defaultValue: 'أكمل ملفك واربح +100 نقطة' })}
        </Text>
        <Text style={[styles.step2Sub, { textAlign }]}>
          {t('register.step2.sub', {
            defaultValue: 'هذه المعلومات اختيارية — لكنها تساعدنا في اقتراحات تناسبك.',
          })}
        </Text>

        {/* Wilaya picker */}
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.step2Field, { flexDirection: rowDirection }]}
        >
          <Text style={styles.step2FieldEmoji}>📍</Text>
          <Text style={[styles.step2FieldLabel, { textAlign }]}>
            {wilayaName ?? t('register.step2.choose_wilaya', { defaultValue: 'اختر ولايتك' })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={KidColors.textSoft} />
        </Pressable>

        {/* Level picker */}
        <Pressable
          onPress={() => setLevelOpen(true)}
          style={[styles.step2Field, { flexDirection: rowDirection }]}
        >
          <Text style={styles.step2FieldEmoji}>🎓</Text>
          <Text style={[styles.step2FieldLabel, { textAlign }]}>
            {levelKey ?? t('register.step2.choose_level', { defaultValue: 'المستوى الدراسي (اختياري)' })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={KidColors.textSoft} />
        </Pressable>

        <Pressable
          onPress={onSubmit}
          disabled={!wilayaCode || submitting}
          style={({ pressed }) => [
            styles.cta,
            { marginTop: Spacing.md },
            (!wilayaCode || submitting) && { backgroundColor: KidColors.coralPink, shadowOpacity: 0 },
            pressed && wilayaCode && !submitting && { transform: [{ scale: 0.97 }] },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.ctaText}>
                {t('register.step2.cta', { defaultValue: 'حفظ +100 نقطة' })}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={onClose} hitSlop={8} style={{ marginTop: 12 }}>
          <Text style={styles.step2SkipText}>
            {t('register.step2.skip', { defaultValue: 'لاحقا' })}
          </Text>
        </Pressable>

        {pickerOpen ? (
          <WilayaPickerModal
            visible={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onPick={(code: string) => {
              setWilayaCode(code);
              setPickerOpen(false);
            }}
            selectedCode={wilayaCode}
          />
        ) : null}
        {levelOpen ? (
          <SchoolLevelPicker
            visible={levelOpen}
            initial={null}
            onClose={() => setLevelOpen(false)}
            onSaved={(profile) => {
              // SchoolLevelPicker already persists via school_save_my_profile.
              // We just remember the picked level for the form summary.
              setLevelKey(profile.level_key);
              setLevelOpen(false);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

// ─── small components ─────────────────────────────────────────────────

function FormField({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: Spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function BenefitTile({
  palette, emoji, label,
}: { palette: typeof BenefitPalette[keyof typeof BenefitPalette]; emoji: string; label: string }) {
  return (
    <View style={[styles.benefitTile, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={styles.benefitEmoji}>{emoji}</Text>
      <Text style={[styles.benefitLabel, { color: palette.label }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function TrustItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.trustItem}>
      <Text style={styles.trustEmoji}>{emoji}</Text>
      <Text style={styles.trustText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function translateError(code: string | undefined, t: (k: string, opts?: Record<string, unknown>) => string): string {
  switch (code) {
    case 'BAD_NAME':       return t('register.err.bad_name',  { defaultValue: 'الاسم قصير جداً.' });
    case 'BAD_PHONE':      return t('register.err.bad_phone', { defaultValue: 'رقم هاتف غير صالح.' });
    case 'BAD_DEVICE_ID':  return t('register.err.bad_device',{ defaultValue: 'الجهاز غير معرف.' });
    case 'PHONE_NOT_FOUND':return t('register.err.phone_404', { defaultValue: 'لم نجد حسابا بهذا الرقم.' });
    default:               return code ?? t('register.err.generic', { defaultValue: 'حدث خطأ، حاول مجددا.' });
  }
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: KidColors.cream },
  scroll: { paddingBottom: 80 },
  topBar: {
    paddingHorizontal: Spacing.md, paddingTop: 6, paddingBottom: 4,
    alignItems: 'center',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  skipText: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 13, color: KidColors.textSoft,
  },

  hero: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 8, paddingBottom: Spacing.lg,
    overflow: 'hidden',
  },
  blobOne: {
    position: 'absolute',
    top: -50, right: -30,
    width: 200, height: 200, borderRadius: 999,
  },
  blobTwo: {
    position: 'absolute',
    top: 30, left: -50,
    width: 180, height: 180, borderRadius: 999,
  },
  blobThree: {
    position: 'absolute',
    bottom: -30, right: 20,
    width: 120, height: 120, borderRadius: 999,
  },
  giftRing: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: KidColors.creamSoft,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: KidColors.coral,
    shadowOpacity: 0.45, shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
    borderWidth: 4, borderColor: KidColors.coralPink,
    zIndex: 2,
  },
  giftEmoji: { fontSize: 56 },
  heroTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 24, color: KidColors.text,
    marginTop: Spacing.md, zIndex: 2,
  },
  heroSub: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 14, color: KidColors.textSoft,
    marginTop: 6, lineHeight: 20, zIndex: 2,
  },

  benefitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: 8,
    justifyContent: 'center',
  },
  benefitTile: {
    width: '47%',
    paddingHorizontal: 12, paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  benefitEmoji: { fontSize: 22 },
  benefitLabel: {
    flex: 1,
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 13,
  },

  formCard: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.md,
    backgroundColor: KidColors.creamSoft,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    shadowColor: 'rgba(15,23,42,0.18)',
    shadowOpacity: 1, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  formTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, color: KidColors.text,
    letterSpacing: 0.3,
  },
  fieldLabel: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 12, color: KidColors.textSoft,
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldHint: {
    fontFamily: BrandFont.medium, fontWeight: '500',
    fontSize: 11, color: KidColors.textSoft + 'AA',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: KidColors.peach,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: BrandFont.semibold, fontWeight: '700',
    fontSize: 15, color: KidColors.text,
  },
  phoneRow: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: KidColors.peach,
    alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 2,
  },
  phonePrefix: {
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: KidColors.peachSoft,
    marginHorizontal: 4,
  },
  phonePrefixText: {
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 13, color: KidColors.coralDeep,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 8, paddingVertical: 12,
    fontFamily: BrandFont.semibold, fontWeight: '700',
    fontSize: 15, color: KidColors.text,
  },
  phoneCheck: { paddingHorizontal: 8 },

  referralToggle: {
    alignItems: 'center', gap: 6,
    paddingVertical: 12,
    marginTop: Spacing.xs,
  },
  referralToggleText: {
    flex: 1,
    fontFamily: BrandFont.bold, fontWeight: '700',
    fontSize: 13, color: KidColors.lavender,
  },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: KidColors.blush,
    borderRadius: Radius.md,
    padding: 10, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: KidColors.coral + '40',
  },
  errorText: {
    flex: 1,
    fontFamily: BrandFont.semibold, fontWeight: '700',
    fontSize: 13, color: KidColors.coralDeep,
  },

  recoveryCard: {
    marginTop: Spacing.sm,
    backgroundColor: KidColors.lavenderSoft,
    borderWidth: 1.5, borderColor: KidColors.lavender + '55',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  recoveryTitle: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 14, color: KidColors.lavenderDeep,
  },
  recoveryBody: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 12, color: KidColors.text,
    marginTop: 4,
  },
  recoveryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 10,
    backgroundColor: KidColors.lavender,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  recoveryBtnText: {
    color: '#fff',
    fontFamily: BrandFont.bold, fontWeight: '800',
    fontSize: 13, letterSpacing: 0.3,
  },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: Spacing.lg,
    paddingVertical: 16,
    borderRadius: Radius.pill,
    backgroundColor: KidColors.cta,
    shadowColor: KidColors.cta,
    shadowOpacity: 0.5, shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  ctaText: {
    color: '#fff',
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 16, letterSpacing: 0.4,
  },

  trustStrip: {
    marginTop: Spacing.md,
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  trustItem: {
    alignItems: 'center', gap: 2,
  },
  trustEmoji: { fontSize: 20 },
  trustText: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 11, color: KidColors.textSoft,
  },

  // Step 2 modal
  step2Backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
  },
  step2Card: {
    width: '100%', maxWidth: 400,
    backgroundColor: KidColors.creamSoft,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.3, shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  step2Close: {
    position: 'absolute',
    top: 12, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: KidColors.peachSoft,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  step2Emoji: { fontSize: 36, alignSelf: 'center', marginTop: 4 },
  step2Title: {
    fontFamily: BrandFont.extrabold, fontWeight: '900',
    fontSize: 18, color: KidColors.text,
    marginTop: 6,
  },
  step2Sub: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 13, color: KidColors.textSoft,
    marginTop: 4,
  },
  step2Field: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: KidColors.peach,
    paddingHorizontal: 14, paddingVertical: 12,
    marginTop: Spacing.sm,
    alignItems: 'center', gap: 10,
  },
  step2FieldEmoji: { fontSize: 18 },
  step2FieldLabel: {
    flex: 1,
    fontFamily: BrandFont.semibold, fontWeight: '700',
    fontSize: 14, color: KidColors.text,
  },
  step2SkipText: {
    fontFamily: BrandFont.medium, fontWeight: '600',
    fontSize: 13, color: KidColors.textSoft,
    textAlign: 'center',
  },
});
