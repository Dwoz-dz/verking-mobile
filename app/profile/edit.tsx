/**
 * /profile/edit — Phase 3.1 profile editing screen.
 *
 * Lets the user (registered or guest) update:
 *   ▸ Avatar (Phase 7 wires the native picker; for now the URL field
 *     is filled by the upload flow we'll plug in later)
 *   ▸ Name (full name) — also visible on registered profiles
 *   ▸ Email
 *   ▸ Birth date
 *   ▸ Bio
 *
 * Phone is read-only when the device is registered (changing the phone
 * is the recovery flow's job, not a profile-edit one).
 *
 * Saves go through `update_my_profile` (SECURITY DEFINER, Phase 2.2);
 * a successful save toast confirms, and the bus is bumped so all
 * downstream Profile / Drawer hooks refetch.
 */
import { Ionicons } from '@expo/vector-icons';
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

import { UserAvatar } from '@/components/ui/UserAvatar';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { bumpRefresh } from '@/lib/refresh/refreshBus';
import { flashInfo } from '@/lib/ui/flash';
import { updateMyProfile, useMyProfile } from '@/services/profile';

export default function ProfileEditScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = i18n.language === 'ar';
  const { profile, loading } = useMyProfile();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Hydrate fields once the profile loads.
  useEffect(() => {
    if (loading) return;
    setName(profile.name ?? '');
    setEmail(profile.email ?? '');
    setBirthDate(profile.birth_date ?? '');
    setBio(profile.bio ?? '');
  }, [loading, profile.name, profile.email, profile.birth_date, profile.bio]);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await updateMyProfile({
        name: name.trim() || null,
        email: email.trim() || null,
        birth_date: birthDate.trim() || null,
        bio: bio.trim() || null,
      });
      if (!res.ok) {
        flashInfo({
          title: t('profile_edit.save_failed_title', { defaultValue: 'Échec de l’enregistrement' }),
          body: t('profile_edit.save_failed_body', {
            defaultValue: 'Une erreur est survenue. Réessayez dans un instant.',
          }),
        });
        return;
      }
      bumpRefresh(); // tell every dependent hook to refetch
      // Phase Final — friendlier success path: show a non-blocking toast
      // and route back immediately. Old alert kept the user staring at
      // the form until they tapped OK.
      flashInfo({
        title: t('profile_edit.save_ok_title', { defaultValue: '✅ Profil enregistré' }),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onAvatarTap = () => {
    // Phase 7 wires the camera/gallery picker. For now, friendly
    // "coming soon" message keeps the UI honest about what works today.
    flashInfo({
      title: t('profile_edit.avatar_soon_title', { defaultValue: '📷 Photo de profil' }),
      body: t('profile_edit.avatar_soon_body', {
        defaultValue: 'L’upload de photo arrive dans la prochaine version.',
      }),
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
          {t('profile_edit.title', { defaultValue: 'Modifier mon profil' })}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar block */}
          <View style={styles.avatarBlock}>
            <Pressable onPress={onAvatarTap}>
              <View style={styles.avatarRing}>
                <UserAvatar
                  size={112}
                  uri={profile.avatar_url}
                  fallbackText={profile.name}
                  bordered
                />
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>
              {t('profile_edit.avatar_hint', { defaultValue: 'Touchez la photo pour la modifier' })}
            </Text>
          </View>

          {/* Phone (read-only when registered) */}
          <Field
            label={t('profile_edit.phone', { defaultValue: 'Téléphone' })}
            icon="call-outline"
            textAlign={textAlign}
          >
            <View style={[styles.input, styles.inputReadOnly]}>
              <Text style={[styles.inputText, { textAlign }]}>
                {profile.phone ?? t('profile_edit.phone_guest', { defaultValue: '— invité' })}
              </Text>
              {profile.is_registered ? (
                <Ionicons name="lock-closed" size={14} color={Brand.textMuted} />
              ) : null}
            </View>
            {profile.is_registered ? (
              <Text style={styles.helperText}>
                {t('profile_edit.phone_locked_hint', {
                  defaultValue: 'Pour changer de numéro, utilisez la récupération de compte.',
                })}
              </Text>
            ) : null}
          </Field>

          <Field
            label={t('profile_edit.name', { defaultValue: 'Nom complet' })}
            icon="person-outline"
            textAlign={textAlign}
          >
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={isAr ? 'الاسم الكامل' : 'Votre nom complet'}
              placeholderTextColor={Brand.textSubtle}
              style={[styles.input, { textAlign }]}
              autoCorrect={false}
              maxLength={64}
            />
          </Field>

          <Field
            label={t('profile_edit.email', { defaultValue: 'Email' })}
            icon="mail-outline"
            textAlign={textAlign}
          >
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={isAr ? 'بريدك الإلكتروني' : 'votre@email.com'}
              placeholderTextColor={Brand.textSubtle}
              style={[styles.input, { textAlign }]}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              maxLength={128}
            />
          </Field>

          <Field
            label={t('profile_edit.birth_date', { defaultValue: 'Date de naissance' })}
            icon="calendar-outline"
            textAlign={textAlign}
          >
            <TextInput
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Brand.textSubtle}
              style={[styles.input, { textAlign }]}
              autoCorrect={false}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.helperText}>
              {t('profile_edit.birth_hint', { defaultValue: 'Format : AAAA-MM-JJ' })}
            </Text>
          </Field>

          <Field
            label={t('profile_edit.bio', { defaultValue: 'Bio' })}
            icon="information-circle-outline"
            textAlign={textAlign}
          >
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={isAr ? 'بضع كلمات عن نفسك' : 'Quelques mots sur vous'}
              placeholderTextColor={Brand.textSubtle}
              style={[styles.input, styles.bioInput, { textAlign }]}
              multiline
              maxLength={240}
            />
            <Text style={styles.helperText}>{`${bio.length} / 240`}</Text>
          </Field>

          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              saving && { opacity: 0.7 },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.saveBtnText}>
                  {t('profile_edit.save_cta', { defaultValue: 'Enregistrer' })}
                </Text>
              </>
            )}
          </Pressable>

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  textAlign: 'left' | 'right' | 'center';
  children: React.ReactNode;
}

function Field({ label, icon, textAlign, children }: FieldProps) {
  return (
    <View style={fieldStyles.wrap}>
      <View style={fieldStyles.labelRow}>
        <Ionicons name={icon} size={13} color={Brand.primary} />
        <Text style={[fieldStyles.label, { textAlign }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 4, marginBottom: Spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 11,
    color: Brand.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.surfaceMuted,
  },
  title: {
    flex: 1,
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 17,
    color: Brand.secondary,
    letterSpacing: -0.2,
  },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  avatarBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 6,
  },
  avatarRing: {
    width: 124, height: 124, borderRadius: 62,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primaryTint,
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 6, right: 6,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Brand.cta,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  avatarHint: {
    fontFamily: BrandFont.medium,
    fontWeight: '600',
    fontSize: 11,
    color: Brand.textMuted,
    marginTop: 2,
  },

  input: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  inputReadOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.surfaceMuted,
  },
  inputText: { flex: 1, fontSize: 14, fontWeight: '700', color: Brand.text },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  helperText: {
    fontSize: 11,
    color: Brand.textSubtle,
    fontWeight: '500',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.cta,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  saveBtnText: {
    color: '#FFF',
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.4,
  },
});
