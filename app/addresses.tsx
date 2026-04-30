/**
 * /addresses — Phase 3.2 address book.
 *
 * Lists all addresses for the current device with:
 *   ▸ Default row pinned to top with a star badge.
 *   ▸ Tap a row → opens the edit modal.
 *   ▸ Long-press → quick action sheet (Set default / Delete).
 *   ▸ + Ajouter → add modal.
 *
 * The actual edit modal is `<AddressEditModal />` — kept inline here so
 * the file ships as a single screen. The BrandConfirmDialog handles
 * the destructive "Delete" path so the user doesn't lose data by
 * accident.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WilayaPickerModal } from '@/components/storefront/WilayaPickerModal';
import { BrandConfirmDialog } from '@/components/ui/BrandConfirmDialog';
import { EmptyStateView } from '@/components/ui/EmptyStateView';
import { Brand, BrandFont, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/i18n/useDirection';
import { bumpRefresh } from '@/lib/refresh/refreshBus';
import {
  deleteMyAddress,
  saveMyAddress,
  setDefaultAddress,
  useMyAddresses,
  type AddressInput,
  type AddressRow,
} from '@/services/addresses';
import { useWilayas } from '@/services/mobileConfig';

const LABEL_PRESETS: { label: string; emoji: string }[] = [
  { label: 'Maison',  emoji: '🏠' },
  { label: 'Travail', emoji: '🏢' },
  { label: 'Famille', emoji: '👨‍👩‍👧' },
  { label: 'École',   emoji: '🎓' },
  { label: 'Autre',   emoji: '📍' },
];

export default function AddressesScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const router = useRouter();
  const isAr = i18n.language === 'ar';
  const { addresses, loading, reload } = useMyAddresses();
  const wilayas = useWilayas();

  const [editing, setEditing] = useState<AddressRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AddressRow | null>(null);

  const wilayaName = (code: string) => {
    const w = wilayas.find((x) => x.code === code);
    if (!w) return code;
    return isAr ? w.name_ar : w.name_fr;
  };

  const onSetDefault = async (row: AddressRow) => {
    if (row.is_default) return;
    const ok = await setDefaultAddress(row.id);
    if (ok) {
      reload();
      bumpRefresh();
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmDelete) return;
    const ok = await deleteMyAddress(confirmDelete.id);
    setConfirmDelete(null);
    if (ok) {
      reload();
      bumpRefresh();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.secondary} />
        </Pressable>
        <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
          {t('addresses.title', { defaultValue: 'Mes adresses' })}
        </Text>
        <Pressable
          onPress={() => setCreating(true)}
          hitSlop={12}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : addresses.length === 0 ? (
        <EmptyStateView
          size="lg"
          emoji="📍"
          title={t('addresses.empty_title', { defaultValue: 'Aucune adresse enregistrée' })}
          subtitle={t('addresses.empty_sub', {
            defaultValue: 'Ajoutez votre première adresse pour accélérer vos commandes futures.',
          })}
          ctaLabel={t('addresses.empty_cta', { defaultValue: '+ Ajouter une adresse' })}
          onCta={() => setCreating(true)}
          style={{ flex: 1 }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {addresses.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => setEditing(row)}
              style={({ pressed }) => [
                styles.card,
                pressed && { transform: [{ scale: 0.98 }] },
                row.is_default && styles.cardDefault,
              ]}
            >
              <View style={[styles.cardHeader, { flexDirection: rowDirection }]}>
                <View style={[styles.emojiPlate, row.is_default && { backgroundColor: Brand.cta + '22' }]}>
                  <Text style={styles.emoji}>{row.emoji ?? '🏠'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={[styles.labelRow, { flexDirection: rowDirection }]}>
                    <Text style={[styles.label, { textAlign }]} numberOfLines={1}>
                      {row.label}
                    </Text>
                    {row.is_default ? (
                      <View style={styles.defaultBadge}>
                        <Ionicons name="star" size={10} color={Brand.cta} />
                        <Text style={styles.defaultBadgeText}>
                          {t('addresses.default', { defaultValue: 'Par défaut' })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.cardSub, { textAlign }]} numberOfLines={2}>
                    {row.address_line1}
                  </Text>
                  <Text style={[styles.cardMeta, { textAlign }]} numberOfLines={1}>
                    {row.wilaya_code} {wilayaName(row.wilaya_code)}
                    {row.commune ? ` • ${row.commune}` : ''}
                  </Text>
                  <Text style={[styles.cardMeta, { textAlign }]} numberOfLines={1}>
                    📞 {row.phone}
                  </Text>
                </View>
              </View>
              <View style={[styles.actionRow, { flexDirection: rowDirection }]}>
                {!row.is_default ? (
                  <Pressable
                    onPress={() => void onSetDefault(row)}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="star-outline" size={14} color={Brand.primary} />
                    <Text style={styles.actionBtnText}>
                      {t('addresses.set_default', { defaultValue: 'Définir par défaut' })}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setConfirmDelete(row)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.deleteBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={14} color={Brand.danger} />
                  <Text style={[styles.actionBtnText, { color: Brand.danger }]}>
                    {t('common.delete', { defaultValue: 'Supprimer' })}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Add / Edit modal */}
      {(editing || creating) && (
        <AddressEditModal
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => {
            reload();
            bumpRefresh();
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {/* Delete confirm */}
      <BrandConfirmDialog
        visible={!!confirmDelete}
        title={t('addresses.delete_title', { defaultValue: 'Supprimer cette adresse ?' })}
        message={t('addresses.delete_body', {
          defaultValue: 'Cette action est irréversible.',
        })}
        confirmLabel={t('common.delete', { defaultValue: 'Supprimer' })}
        destructive
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Edit modal
// ═══════════════════════════════════════════════════════════════════════

interface AddressEditModalProps {
  initial: AddressRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function AddressEditModal({ initial, onClose, onSaved }: AddressEditModalProps) {
  const { t, i18n } = useTranslation();
  const { textAlign, rowDirection } = useDirection();
  const isAr = i18n.language === 'ar';
  const wilayas = useWilayas();

  const [label, setLabel] = useState(initial?.label ?? 'Maison');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🏠');
  const [wilayaCode, setWilayaCode] = useState(initial?.wilaya_code ?? '16');
  const [commune, setCommune] = useState(initial?.commune ?? '');
  const [addressLine, setAddressLine] = useState(initial?.address_line1 ?? '');
  const [landmark, setLandmark] = useState(initial?.landmark ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [wilayaPickerOpen, setWilayaPickerOpen] = useState(false);

  const wilayaName = wilayas.find((w) => w.code === wilayaCode);

  const onSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: AddressInput = {
        id: initial?.id ?? null,
        label: label.trim() || 'Maison',
        emoji,
        wilaya_code: wilayaCode,
        commune: commune.trim() || null,
        address_line1: addressLine.trim(),
        landmark: landmark.trim() || null,
        phone: phone.trim(),
        note: note.trim() || null,
        is_default: isDefault,
      };
      const res = await saveMyAddress(payload);
      if (!res.ok) {
        setErrorMsg(
          res.code === 'INVALID_ADDRESS' ? t('addresses.error_address', { defaultValue: 'Adresse requise' })
          : res.code === 'INVALID_PHONE' ? t('addresses.error_phone', { defaultValue: 'Téléphone requis' })
          : res.code === 'INVALID_WILAYA' ? t('addresses.error_wilaya', { defaultValue: 'Wilaya invalide' })
          : t('addresses.error_generic', { defaultValue: 'Échec de l’enregistrement' })
        );
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={[styles.modalHeader, { flexDirection: rowDirection }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="close" size={20} color={Brand.secondary} />
          </Pressable>
          <Text style={[styles.title, { textAlign }]}>
            {initial
              ? t('addresses.edit_title', { defaultValue: 'Modifier l’adresse' })
              : t('addresses.add_title', { defaultValue: 'Ajouter une adresse' })}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Label presets */}
            <Text style={modalStyles.fieldLabel}>
              {t('addresses.field_label', { defaultValue: 'Étiquette' })}
            </Text>
            <View style={modalStyles.presetRow}>
              {LABEL_PRESETS.map((preset) => {
                const active = preset.label === label;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => { setLabel(preset.label); setEmoji(preset.emoji); }}
                    style={[
                      modalStyles.presetChip,
                      active && { backgroundColor: Brand.primary, borderColor: Brand.primary },
                    ]}
                  >
                    <Text style={modalStyles.presetEmoji}>{preset.emoji}</Text>
                    <Text style={[modalStyles.presetText, active && { color: '#FFF' }]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Wilaya picker */}
            <Text style={modalStyles.fieldLabel}>
              {t('addresses.field_wilaya', { defaultValue: 'Wilaya' })}
            </Text>
            <Pressable
              onPress={() => setWilayaPickerOpen(true)}
              style={modalStyles.input}
            >
              <Text style={[modalStyles.inputText, { textAlign }]}>
                {wilayaCode} {wilayaName ? (isAr ? wilayaName.name_ar : wilayaName.name_fr) : '—'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Brand.textMuted} />
            </Pressable>

            {/* Commune */}
            <Text style={modalStyles.fieldLabel}>
              {t('addresses.field_commune', { defaultValue: 'Commune (optionnel)' })}
            </Text>
            <TextInput
              value={commune}
              onChangeText={setCommune}
              placeholder={isAr ? 'البلدية' : 'Bab Ezzouar, Hydra…'}
              placeholderTextColor={Brand.textSubtle}
              style={[modalStyles.inputText, modalStyles.textInput, { textAlign }]}
              maxLength={64}
            />

            {/* Address line */}
            <Text style={modalStyles.fieldLabel}>
              {t('addresses.field_line', { defaultValue: 'Adresse complète' })}
            </Text>
            <TextInput
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder={isAr ? 'العنوان الكامل' : 'Cité 1500 logements, Bât A...'}
              placeholderTextColor={Brand.textSubtle}
              style={[modalStyles.inputText, modalStyles.textInput, { textAlign, minHeight: 60 }]}
              multiline
              maxLength={200}
            />

            {/* Landmark */}
            <Text style={modalStyles.fieldLabel}>
              {t('addresses.field_landmark', { defaultValue: 'Repère (optionnel)' })}
            </Text>
            <TextInput
              value={landmark}
              onChangeText={setLandmark}
              placeholder={isAr ? 'علامة مميزة' : 'En face de la mosquée…'}
              placeholderTextColor={Brand.textSubtle}
              style={[modalStyles.inputText, modalStyles.textInput, { textAlign }]}
              maxLength={120}
            />

            {/* Phone */}
            <Text style={modalStyles.fieldLabel}>
              {t('addresses.field_phone', { defaultValue: 'Téléphone' })}
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+213 5XX XXX XXX"
              placeholderTextColor={Brand.textSubtle}
              style={[modalStyles.inputText, modalStyles.textInput, { textAlign }]}
              keyboardType="phone-pad"
              maxLength={20}
            />

            {/* Note */}
            <Text style={modalStyles.fieldLabel}>
              {t('addresses.field_note', { defaultValue: 'Note livreur (optionnel)' })}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={isAr ? 'ملاحظة لساعي البريد' : 'Étage 3, code 4523…'}
              placeholderTextColor={Brand.textSubtle}
              style={[modalStyles.inputText, modalStyles.textInput, { textAlign }]}
              maxLength={120}
            />

            {/* Default */}
            <Pressable
              onPress={() => setIsDefault((v) => !v)}
              style={[modalStyles.defaultRow, { flexDirection: rowDirection }]}
            >
              <View style={[
                modalStyles.checkbox,
                isDefault && { backgroundColor: Brand.cta, borderColor: Brand.cta },
              ]}>
                {isDefault ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
              </View>
              <Text style={[modalStyles.defaultLabel, { textAlign }]}>
                {t('addresses.set_as_default', { defaultValue: 'Définir comme adresse par défaut' })}
              </Text>
            </Pressable>

            {errorMsg ? (
              <Text style={modalStyles.errorText}>{errorMsg}</Text>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.saveBtn,
                submitting && { opacity: 0.7 },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.saveBtnText}>
                    {t('addresses.save_cta', { defaultValue: 'Enregistrer' })}
                  </Text>
                </>
              )}
            </Pressable>
            <View style={{ height: Spacing.xl }} />
          </ScrollView>
        </KeyboardAvoidingView>

        <WilayaPickerModal
          visible={wilayaPickerOpen}
          onClose={() => setWilayaPickerOpen(false)}
          onPick={(code) => { setWilayaCode(code); setWilayaPickerOpen(false); }}
          selectedCode={wilayaCode}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

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
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.cta,
    shadowColor: Brand.shadowOrange,
    shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  title: {
    flex: 1,
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 17,
    color: Brand.secondary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: Spacing.sm,
  },
  cardDefault: {
    borderColor: Brand.cta + '55',
    backgroundColor: Brand.ctaSoft + '40',
  },
  cardHeader: { gap: Spacing.sm, alignItems: 'flex-start' },
  emojiPlate: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primaryTint,
  },
  emoji: { fontSize: 22 },
  labelRow: { alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: {
    fontFamily: BrandFont.extrabold,
    fontWeight: '900',
    fontSize: 15,
    color: Brand.text,
    letterSpacing: -0.2,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Brand.ctaSoft,
    borderWidth: 1,
    borderColor: Brand.cta + '55',
  },
  defaultBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: Brand.cta,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardSub: {
    fontSize: 13,
    color: Brand.text,
    fontWeight: '600',
    marginTop: 2,
  },
  cardMeta: {
    fontSize: 11,
    color: Brand.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  actionRow: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.primaryTint,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.primary,
  },
  deleteBtn: { backgroundColor: Brand.dangerSoft },

  // Modal
  modalSafe: { flex: 1, backgroundColor: Brand.background },
  modalHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  modalScroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },

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

const modalStyles = StyleSheet.create({
  fieldLabel: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 11,
    color: Brand.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  presetEmoji: { fontSize: 14 },
  presetText: {
    fontFamily: BrandFont.bold,
    fontWeight: '800',
    fontSize: 12,
    color: Brand.text,
  },
  input: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: { fontSize: 14, fontWeight: '600', color: Brand.text, flex: 1 },
  textInput: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  defaultRow: {
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.lg,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Brand.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.surface,
  },
  defaultLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
  },
  errorText: {
    color: Brand.danger,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
